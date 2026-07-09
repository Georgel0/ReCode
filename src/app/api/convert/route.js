import { NextResponse } from 'next/server';
import admin from "firebase-admin";
import { nanoid } from 'nanoid';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import * as prettier from 'prettier';
import { PROMPT_CONFIG } from '@/lib/ai/prompts';
import { getRedisClient } from '@/lib/redis';

const CODE_FIELDS_BY_TYPE = {
  formatter: [{ path: 'content', lang: (p) => p.lang }],
  refactor: [{ path: 'files[].content', lang: (p) => p.targetLang }],
  converter: [{ path: 'files[].content', lang: (p) => p.targetLang }],
  generator: [{ path: 'files[].content', lang: (p) => p.language }],
  sql: [{ path: 'query', lang: () => 'sql' }],
  json: [{ path: 'formattedJson', lang: () => 'json' }],
  'css-framework': [
    { path: 'convertedCode', lang: (p) => p.targetLang },
    { path: 'convertedHtml', lang: () => 'html' },
  ],
  'api-mocks': [
    { path: 'handlers[].code', lang: (p) => (p.includeTypes ? 'typescript' : 'javascript') },
    { path: 'handlers[].errorVariants[].code', lang: (p) => (p.includeTypes ? 'typescript' : 'javascript') },
  ],
};

function prettierParserFor(language) {
  if (!language) return null;
  const map = {
    javascript: 'babel', js: 'babel', jsx: 'babel',
    typescript: 'typescript', ts: 'typescript', tsx: 'typescript',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
    markdown: 'markdown', md: 'markdown', vue: 'vue', graphql: 'graphql',
  };
  return map[String(language).toLowerCase()] ?? null;
}

function collectFieldRefs(obj, pathParts) {
  if (!obj || pathParts.length === 0) return [];
  const [first, ...rest] = pathParts;
  const isArray = first.endsWith('[]');
  const key = isArray ? first.slice(0, -2) : first;

  if (rest.length === 0) {
    return isArray ? [] : [{ container: obj, key }];
  }
  const val = obj[key];
  if (isArray) {
    return Array.isArray(val) ? val.flatMap((item) => collectFieldRefs(item, rest)) : [];
  }
  return val ? collectFieldRefs(val, rest) : [];
}

function looksSquashed(code) {
  if (typeof code !== 'string' || code.length < 200) return false;
  const newlineCount = (code.match(/\n/g) || []).length;
  return newlineCount < code.length / 300;
}

function hasSquashedCodeFields(type, data, payload) {
  const specs = CODE_FIELDS_BY_TYPE[type];
  if (!specs || !data) return false;
  return specs.some(({ path }) =>
    collectFieldRefs(data, path.split('.')).some(({ container, key }) => looksSquashed(container[key]))
  );
}

async function prettifyCodeFields(type, data, payload) {
  const specs = CODE_FIELDS_BY_TYPE[type];
  if (!specs || !data) return data;

  for (const { path, lang } of specs) {
    const parser = prettierParserFor(lang(payload));
    if (!parser) continue;
    for (const { container, key } of collectFieldRefs(data, path.split('.'))) {
      const value = container[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      try {
        container[key] = await prettier.format(value, {
          parser, singleQuote: true, semi: true, printWidth: 100,
        });
      } catch (err) {
        console.warn(`Prettier formatting failed for ${path} (parser=${parser}):`, err.message);
      }
    }
  }
  return data;
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { }

  const cleanMarkdown = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleanMarkdown); } catch (e) { }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const jsonCandidate = text.substring(start, end + 1)
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    try { return JSON.parse(jsonCandidate); } catch (e) { }
  }
  return null;
}

function initializeFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return console.warn("FIREBASE_SERVICE_ACCOUNT missing or invalid.");

  try {
    const serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8'));
    if (serviceAccount?.project_id) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log("Firebase Admin Initialized Successfully");
    }
  } catch (error) {
    console.error("Firebase Init Error:", error);
  }
}

initializeFirebase();

const registry = createProviderRegistry({
  gateway: createOpenAI({
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
  }),
});

const groq = createGroq();
const GROQ_MAX_TOKENS_DEFAULT = 8000;
const GROQ_MAX_TOKENS_MOCK = 24000;

async function resolveMockId(redis, desiredId, uid) {
  if (!desiredId) return { mockId: nanoid(8), idChanged: false };

  const existingRaw = await redis.get(`mock:${desiredId}`);
  if (!existingRaw) return { mockId: desiredId, idChanged: false };

  try {
    const existing = JSON.parse(existingRaw);
    if (!existing.ownerId || existing.ownerId === uid) {
      return { mockId: desiredId, idChanged: false };
    }
  } catch {
    // Corrupted entry under this key — treat it as unusable and reissue.
  }

  return { mockId: nanoid(8), idChanged: true };
}

export async function POST(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { 
      type, input, qualityMode = 'fast', 
      action, existingMockId, expiresIn = 3600, wakeData 
    } = payload;

    if (action === 'wake') {
      if (!existingMockId || !wakeData) {
        return NextResponse.json({ error: 'Missing data for wake up' }, { status: 400 });
      }
      const redis = await getRedisClient();

      const { mockId, idChanged } = await resolveMockId(redis, existingMockId, uid);
      const ttl = parseInt(expiresIn, 10) || 3600;

      wakeData.mockId = mockId;
      wakeData.ownerId = uid;
      wakeData.idChanged = idChanged;

      await redis.set(`mock:${mockId}`, JSON.stringify(wakeData), { EX: ttl });

      wakeData.expiresAt = Date.now() + (ttl * 1000);
      return NextResponse.json(wakeData);
    }

    if (action === 'stop') {
      if (!existingMockId) {
        return NextResponse.json({ error: 'Missing mock ID to stop' }, { status: 400 });
      }
      const redis = await getRedisClient();

      const existingRaw = await redis.get(`mock:${existingMockId}`);
      if (!existingRaw) {
        // Already gone (expired or never existed) — turning it off is a no-op success.
        return NextResponse.json({ stopped: true, mockId: existingMockId });
      }

      try {
        const existing = JSON.parse(existingRaw);
        if (existing.ownerId && existing.ownerId !== uid) {
          return NextResponse.json({ error: 'You do not own this mock server' }, { status: 403 });
        }
      } catch {
        // Corrupted entry — nothing coherent to protect, let the delete through.
      }

      await redis.del(`mock:${existingMockId}`);
      return NextResponse.json({ stopped: true, mockId: existingMockId });
    }

    if (!input || !PROMPT_CONFIG[type]) {
      return NextResponse.json({ error: 'Invalid input or missing configuration type' }, { status: 400 });
    }

    const config = PROMPT_CONFIG[type];

    if (payload.schema && type !== 'sql-simulate') {
      payload.schema = payload.schema.replace(/INSERT\s+INTO[\s\S]*?;/gi, '');
      if (payload.schema.length > 20000) {
        payload.schema = payload.schema.substring(0, 15000) + '\n-- [Schema truncated due to length limits]';
      }
    }

    if (type === 'mock' || type === 'sql') {
      payload.rowCount = (type === 'mock' && qualityMode === 'turbo')
        ? Math.min(Number(payload.rowCount) || 15, 25)
        : Number(payload.rowCount) || 15;
    }

    let systemPrompt = config.system(payload);
    const userPrompt = config.user(input, payload);

    if (config.schema && qualityMode === 'turbo') {
      const jsonSchema = zodToJsonSchema(config.schema, { target: "jsonSchema7" });
      systemPrompt += `\n\nCRITICAL SYSTEM INSTRUCTION: You MUST return ONLY a valid JSON object. The JSON must strictly validate against this JSON Schema: ${JSON.stringify(jsonSchema)}`;
    }

    let finalData;

    if (qualityMode === 'turbo') {
      const modelInstance = groq('llama-3.3-70b-versatile');
      const maxTokens = type === 'mock' ? GROQ_MAX_TOKENS_MOCK : GROQ_MAX_TOKENS_DEFAULT;

      if (config.schema) {
        let sawInvalidJson = false;
        let sawSquashedCode = false;

        for (let attempt = 0; attempt < 3; attempt++) {
          let retryNote = '';
          if (sawInvalidJson) {
            retryNote = `\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a JSON object — no markdown, no explanation.`;
          } else if (sawSquashedCode) {
            retryNote = `\n\nIMPORTANT: In your previous response, code fields were written as a single line. Every code field MUST contain real line breaks (\\n) between lines, indentation, and blank lines between logical blocks — exactly as you'd write it in an editor, just JSON-escaped. Do not minify or collapse the code.`;
          }

          const { text } = await generateText({
            model: modelInstance,
            system: systemPrompt,
            prompt: userPrompt + retryNote,
            temperature: attempt === 0 ? 0.1 : 0.05,
            maxTokens,
            experimental_providerMetadata: {
              groq: { response_format: { type: 'json_object' } }
            }
          });

          const parsed = extractJson(text);
          if (!parsed) { sawInvalidJson = true; sawSquashedCode = false; continue; }

          finalData = parsed; 
          if (!hasSquashedCodeFields(type, parsed, payload)) break;
          sawInvalidJson = false;
          sawSquashedCode = true;
        }
        if (!finalData) throw new Error("Groq failed to return valid JSON after multiple attempts.");

        finalData = await prettifyCodeFields(type, finalData, payload);
      } else {
        const { text } = await generateText({
          model: modelInstance, system: systemPrompt, prompt: userPrompt, maxTokens,
        });
        finalData = { convertedCode: text.trim() };
      }
    } else {
      const modelId = qualityMode === 'quality'
        ? 'gateway:deepseek/deepseek-v3.2-thinking'
        : 'gateway:mistral/devstral-2';

      const modelInstance = registry.languageModel(modelId);

      if (config.schema) {
        const { object } = await generateObject({
          model: modelInstance, system: systemPrompt, prompt: userPrompt,
          schema: config.schema, maxTokens: 8000
        });
        finalData = await prettifyCodeFields(type, object, payload);
      } else {
        const { text } = await generateText({
          model: modelInstance, system: systemPrompt, prompt: userPrompt, maxTokens: 8000
        });
        finalData = { convertedCode: text.trim() };
      }
    }

    if (type === 'api-mocks' && finalData) {
      try {
        const redis = await getRedisClient();

        const { mockId, idChanged } = await resolveMockId(redis, existingMockId, uid);
        const ttl = parseInt(expiresIn, 10) || 3600;

        const ALLOWED_PAGINATION_STYLES = ['none', 'offset', 'page', 'cursor'];
        const ALLOWED_AUTH_STYLES = ['none', 'bearer', 'apiKey', 'basic'];
        const MAX_DELAY_MS = 10000;

        finalData.mockId = mockId;
        finalData.ownerId = uid;
        finalData.idChanged = idChanged;
        finalData.config = {
          errorRate: Math.min(100, Math.max(0, Number(payload.errorRate) || 0)),
          delayMs: Math.min(MAX_DELAY_MS, Math.max(0, Number(payload.delayMs) || 0)),
          paginationStyle: ALLOWED_PAGINATION_STYLES.includes(payload.paginationStyle)
            ? payload.paginationStyle
            : 'none',
          authStyle: ALLOWED_AUTH_STYLES.includes(payload.authStyle)
            ? payload.authStyle
            : 'none',
        };

        await redis.set(`mock:${mockId}`, JSON.stringify(finalData), { EX: ttl });

        finalData.expiresAt = Date.now() + (ttl * 1000);
      } catch (redisError) {
        console.error("Failed to save mock to Redis:", redisError);
      }
    }

    return NextResponse.json(finalData);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
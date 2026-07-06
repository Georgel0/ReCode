import { NextResponse } from 'next/server';
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PROMPT_CONFIG } from '@/lib/ai/prompts';

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

export async function POST(request) {
  // Verify Firebase token before processing anything
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await admin.auth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { type, input, qualityMode = 'fast' } = payload;

    if (!input || !PROMPT_CONFIG[type]) {
      return NextResponse.json({ error: 'Invalid input or missing configuration type' }, { status: 400 });
    }

    const config = PROMPT_CONFIG[type];

    // Truncation Safeguard for Schemas
    // Only strip INSERT statements for non-simulate types
    if (payload.schema && type !== 'sql-simulate') {
      payload.schema = payload.schema.replace(/INSERT\s+INTO[\s\S]*?;/gi, '');
      if (payload.schema.length > 20000) {
        payload.schema = payload.schema.substring(0, 15000) + '\n-- [Schema truncated due to length limits]';
      }
    }

    // Cap row counts safely
    // Only normalise rowCount for the types that use it
    if (type === 'mock' || type === 'sql') {
      payload.rowCount = (type === 'mock' && qualityMode === 'turbo')
        ? Math.min(Number(payload.rowCount) || 15, 25)
        : Number(payload.rowCount) || 15;
    }

    // Generate Prompts
    let systemPrompt = config.system(payload);
    const userPrompt = config.user(input, payload);

    if (config.schema && qualityMode === 'turbo') {
      const jsonSchema = zodToJsonSchema(config.schema, { target: "jsonSchema7" });
      systemPrompt += `\n\nCRITICAL SYSTEM INSTRUCTION: You MUST return ONLY a valid JSON object. The JSON must strictly validate against this JSON Schema: ${JSON.stringify(jsonSchema)}`;
    }

    let finalData;

    // Route: Turbo (Groq)
    if (qualityMode === 'turbo') {
      const modelInstance = groq('llama-3.3-70b-versatile');
      const maxTokens = type === 'mock' ? GROQ_MAX_TOKENS_MOCK : GROQ_MAX_TOKENS_DEFAULT;

      if (config.schema) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { text } = await generateText({
            model: modelInstance,
            system: systemPrompt,
            prompt: attempt === 0 ? userPrompt
              : `${userPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. ` +
              `Return ONLY a JSON object — no markdown, no explanation.`,
            temperature: attempt === 0 ? 0.1 : 0.05,
            maxTokens,
            experimental_providerMetadata: {
              groq: { response_format: { type: 'json_object' } }
            }
          });
          finalData = extractJson(text);
          if (finalData) break;
        }
        if (!finalData) throw new Error("Groq failed to return valid JSON after multiple attempts.");
      } else {
        const { text } = await generateText({
          model: modelInstance, system: systemPrompt, prompt: userPrompt, maxTokens,
        });
        finalData = { convertedCode: text.trim() };
      }
    }
    // Route: Standard / Quality (Gateway)
    else {
      const modelId = qualityMode === 'quality'
        ? 'gateway:deepseek/deepseek-v3.2-thinking'
        : 'gateway:mistral/devstral-2';

      const modelInstance = registry.languageModel(modelId);

      if (config.schema) {
        const { object } = await generateObject({
          model: modelInstance, system: systemPrompt, prompt: userPrompt,
          schema: config.schema, maxTokens: 8000
        });
        finalData = object;
      } else {
        const { text } = await generateText({
          model: modelInstance, system: systemPrompt, prompt: userPrompt, maxTokens: 8000
        });
        finalData = { convertedCode: text.trim() };
      }
    }

    return NextResponse.json(finalData);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
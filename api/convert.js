import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { z } from 'zod';
import { PROMPT_CONFIG } from './prompts.js';

// Firebase Initialization
if (!admin.apps.length) {
  try {
    const rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawData) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");

    let serviceAccount;
    
    if (!rawData.trim().startsWith('{')) {
      const decoded = Buffer.from(rawData, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    } else {
      serviceAccount = JSON.parse(rawData.replace(/\\n/g, '\n'));
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized Successfully");
  } catch (error) {
    console.error("Firebase Admin Init Error:", error.message);
  }
}

const registry = createProviderRegistry({
  fast: createGroq({
    apiKey: process.env.GROQ_API_KEY,
  }),
  quality: createOpenAI({
    apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
    baseURL: "https://ai-gateway.vercel.sh/v1", 
  }),
});

// Validate incoming data
const RequestSchema = z.object({
  type: z.string(),
  input: z.string().min(1),
  sourceLang: z.string().optional().default(''),
  targetLang: z.string().optional().default(''),
  mode: z.string().optional().default(''),
  qualityMode: z.enum(['fast', 'quality']).optional().default('fast'),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  // Auth Check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token.' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid session.' });
  }

  // Parse Request
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid Input", details: parseResult.error.flatten() });
  }

  const { type, input, sourceLang, targetLang, mode, qualityMode } = parseResult.data;
  const config = PROMPT_CONFIG[type];

  if (!config) return res.status(400).json({ error: `Invalid processing type: ${type}` });

  try {
    const systemPrompt = config.system(sourceLang || mode || targetLang, targetLang);
    const userPrompt = config.user(input);

    let finalData;

    if (qualityMode === 'fast') {
      const modelInstance = registry.languageModel('fast:llama-3.3-70b-versatile');
      
      const { text } = await generateText({
        model: modelInstance,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
      });

      finalData = { 
        convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim(),
        raw: text 
      };
    } else {
      const complexTasks = ['sql', 'generator', 'analysis', 'refactor'];
      const modelId = complexTasks.includes(type) 
        ? 'quality:deepseek/deepseek-v3.2-thinking' 
        : 'quality:mistral/devstral-2';

      const modelInstance = registry.languageModel(modelId);

      if (config.schema) {
        const { object } = await generateObject({
          model: modelInstance,
          system: systemPrompt,
          prompt: userPrompt,
          schema: config.schema,
        });
        finalData = object;
      } else {
        const { text } = await generateText({
          model: modelInstance,
          system: systemPrompt,
          prompt: userPrompt,
        });
        finalData = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
      }
    }

    return res.status(200).json(finalData);

  } catch (error) {
    console.error("AI Processing Failed:", error);
    return res.status(500).json({ error: "Processing Failed", details: error.message });
  }
}
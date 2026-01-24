import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { z } from 'zod';
import { PROMPT_CONFIG } from './prompts.js';

// Robust JSON Extractor 
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        const clean = text.replace(/```json|```/g, '').trim();
        try {
          return JSON.parse(clean);
        } catch (e3) {
          return null;
        }
      }
    }
    return null;
  }
}

// Firebase Initialization
if (!admin.apps.length) {
  try {
    const rawData = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawData) {
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
    }
  } catch (error) {
    console.error("Firebase Init Error:", error.message);
  }
}

// Registry Setup
const registry = createProviderRegistry({
  fast: createGroq({
    apiKey: process.env.GROQ_API_KEY,
  }),
  quality: createOpenAI({
    apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
    baseURL: "https://ai-gateway.vercel.sh/v1",
  }),
});

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
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    await admin.auth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid Session' });
  }
  
  // Validate Input
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid Input", details: parseResult.error.flatten() });
  }
  
  const { type, input, sourceLang, targetLang, mode, qualityMode } = parseResult.data;
  const config = PROMPT_CONFIG[type];
  
  if (!config) return res.status(400).json({ error: `Invalid processing type: ${type}` });
  
  try {
    const systemPrompt = typeof config.system === 'function' ?
      config.system({ sourceLang, targetLang, mode, qualityMode }) :
      config.system;
    
    const userPrompt = typeof config.prompt === 'function' ?
      config.prompt({ input, sourceLang, targetLang, mode }) :
      input;
    
    // Select Model
    const modelId = qualityMode === 'fast' ?
      'fast:llama-3.3-70b-versatile' :
      'quality:mistral/devstral-2'; 
    
    const modelInstance = registry.languageModel(modelId);
    let finalData;
    
    // Quality Mode (Try Structure first)
    if (config.schema && qualityMode !== 'fast') {
      try {
        const { object } = await generateObject({
          model: modelInstance,
          system: systemPrompt,
          prompt: userPrompt,
          schema: config.schema,
        });
        finalData = object;
      } catch (objError) {
        console.warn("generateObject failed, falling back to text:", objError.message);
      }
    }
    
    // Fast Mode / Fallback (Text + Extract)
    if (!finalData) {
      const jsonInstruction = config.schema ?
        "\n\nIMPORTANT: Return ONLY valid JSON. No markdown. No explanations." :
        "";
      
      const { text } = await generateText({
        model: modelInstance,
        system: systemPrompt + jsonInstruction,
        prompt: userPrompt,
      });
      
      if (config.schema) {
        finalData = extractJson(text);
        if (!finalData) throw new Error("AI returned invalid JSON.");
      } else {
        // Plain text output (for SQL or plain code)
        finalData = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
      }
    }
    
    return res.status(200).json(finalData);
    
  } catch (error) {
    console.error("AI Processing Failed:", error);
    return res.status(500).json({ error: error.message || "Processing Failed" });
  }
}
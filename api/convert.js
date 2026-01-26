import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { z } from 'zod';
import { PROMPT_CONFIG } from './prompts.js';

function extractJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // Attempt to find the first '{' and the last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && end > start) {
      const jsonCandidate = text.substring(start, end + 1);
      try {
        // Basic cleanup for common AI JSON errors
        const cleanCandidate = jsonCandidate
          .replace(/,\s*}/g, '}') 
          .replace(/[\x00-\x1F\x7F-\x9F]/g, ""); 
        
        return JSON.parse(cleanCandidate);
      } catch (e2) {
        // Fallback: Try removing markdown blocks if they exist
        const cleanMarkdown = text.replace(/```json|```/g, '').trim();
        try { return JSON.parse(cleanMarkdown); } catch (e3) { return null; }
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
  
  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid Input", details: parseResult.error.flatten() });
  }
  
  const { type, input, sourceLang, targetLang, mode, qualityMode } = parseResult.data;
  const config = PROMPT_CONFIG[type];
  if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });
  
  try {
    // Pass context object to system prompts so they can adapt to Fast Mode requirements
    const context = { sourceLang, targetLang, mode, qualityMode };
    
    const systemPrompt = typeof config.system === 'function' ?
      config.system(context) : config.system;
    
    const userPrompt = typeof config.user === 'function' ?
      config.user(input) :
      typeof config.prompt === 'function' ?
      config.prompt({ input, sourceLang, targetLang, mode }) :
      input;
    
    const modelId = qualityMode === 'fast' ?
      'fast:llama-3.3-70b-versatile' :
      (type === 'analysis' ?  'quality:deepseek/deepseek-v3.2-thinking' : 'quality:mistral/devstral-2');
    
    const modelInstance = registry.languageModel(modelId);
    let finalData;
    
    // Robust Execution Logic
    if (config.schema && qualityMode !== 'fast') {
      try {
        const result = await generateObject({
          model: modelInstance,
          system: systemPrompt,
          prompt: userPrompt,
          schema: config.schema,
          mode: 'json',
          maxTokene: 4096,
        });
        finalData = result.object;
      } catch (e) {
        console.warn("Structured output failed, falling back to text:", e.message);
      }
    }
    
    if (!finalData) {
      // Force JSON instruction in Fast Mode
      const jsonForce = config.schema ?
        "\n\nIMPORTANT: Output PURE JSON ONLY. No text before or after." : "";
      
      const result = await generateText({
        model: modelInstance,
        system: systemPrompt + jsonForce,
        prompt: userPrompt,
        temperature: 0.1 
      });
      
      const text = result.text;
      
      if (config.schema) {
        finalData = extractJson(text);
        if (!finalData) {
          console.error("JSON Extraction Failed. Raw Output:", text.slice(0, 200));
          throw new Error("AI generated invalid data format. Please try again.");
        }
      } else {
        finalData = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
      }
    }
    
    return res.status(200).json(finalData);
    
  } catch (error) {
    console.error("Processing Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
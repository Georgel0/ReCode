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

const RequestSchema = z.object({
  type: z.string(),
  input: z.string().min(1),
  sourceLang: z.string().optional().default(''),
  targetLang: z.string().optional().default(''),
  mode: z.string().optional().default(''),
  qualityMode: z.enum(['fast', 'quality']).optional().default('fast'),
});

// Helper to reliably extract JSON from chatty model responses
function parseGeneratedJSON(text) {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Find the first '{' and the last '}'
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      const jsonStr = text.substring(firstOpen, lastClose + 1);
      try {
        return JSON.parse(jsonStr);
      } catch (innerE) {
        return null; // Failed to parse extracted content
      }
    }
    return null; // No JSON structure found
  }
}

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

  const parseResult = RequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid Input", details: parseResult.error.flatten() });
  }

  const { type, input, sourceLang, targetLang, mode, qualityMode } = parseResult.data;
  const config = PROMPT_CONFIG[type];

  if (!config) return res.status(400).json({ error: `Invalid processing type: ${type}` });

  try {
    let systemPrompt = config.system(sourceLang || mode || targetLang, targetLang);
    const userPrompt = config.user(input);

    let finalData;

    // --- LOGIC BRANCHING ---

    if (qualityMode === 'fast') {
      // FAST MODE: Groq (Llama 3.3 70B)
      const modelInstance = registry.languageModel('fast:llama-3.3-70b-versatile');
      
      // If this type expects an object (like analysis/refactor), we must force JSON
      if (config.schema) {
        systemPrompt += "\n\nIMPORTANT: Output ONLY valid JSON. No markdown formatting, no explanations.";
      }

      const { text } = await generateText({
        model: modelInstance,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1, 
      });

      if (config.schema) {
        // Attempt to parse strictly for object-based tools (Analysis, Refactor, Generator)
        const parsed = parseGeneratedJSON(text);
        
        if (parsed) {
          finalData = parsed;
        } else {
          // If parsing fails, we must return an error structure the frontend understands
          // OR fallback to wrapping it if your frontend can handle a raw string for specific types
          console.warn("Fast mode JSON parse failed, returning raw text as convertedCode");
          finalData = { 
            error: "Failed to generate structured data", 
            convertedCode: text, // Fallback for display
            // Mock empty fields to prevent frontend crash if it expects them
            summary: "Error parsing AI response",
            files: [] 
          };
        }
      } else {
        // For simple text tools (Converter, SQL)
        finalData = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
      }

    } else {
      // QUALITY MODE: DeepSeek & Mistral
      const complexTasks = ['sql', 'generator', 'analysis', 'refactor'];
      const modelId = complexTasks.includes(type) 
        ? 'quality:deepseek/deepseek-v3.2-thinking' 
        : 'quality:mistral/devstral-2';

      const modelInstance = registry.languageModel(modelId);

      if (config.schema) {
        try {
          const { object } = await generateObject({
            model: modelInstance,
            system: systemPrompt,
            prompt: userPrompt,
            schema: config.schema, 
          });
          finalData = object;
        } catch (objError) {
          // DeepSeek Thinking Fallback (manual extraction)
          console.log("Standard object generation failed, attempting manual text extraction");
          const { text } = await generateText({
            model: modelInstance,
            system: systemPrompt,
            prompt: userPrompt,
          });
          
          const parsed = parseGeneratedJSON(text);
          if (parsed) {
             finalData = parsed;
          } else {
             throw new Error("Model failed to return valid JSON structure");
          }
        }
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

/**
 * @fileoverview Next.js API route for AI-powered code conversion and generation.
 * Utilizes the AI SDK to route requests to various LLMs. 
 * Integrates with Firebase Admin for auth/logging.
 */

import { NextResponse } from 'next/server';
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PROMPT_CONFIG } from '@/lib/prompts.js';

// Robust JSON extraction from LLM strings. 
function extractJson(text) {
 if (!text) return null;
 
 try {
  return JSON.parse(text);
 } catch (e) {
  const cleanMarkdown = text.replace(/```json|```/g, '').trim();
  try {
   return JSON.parse(cleanMarkdown);
  } catch (e3) {
   const start = text.indexOf('{');
   const end = text.lastIndexOf('}');
   
   if (start !== -1 && end !== -1 && end > start) {
    const jsonCandidate = text.substring(start, end + 1);
    const cleanCandidate = jsonCandidate
     .replace(/,\s*}/g, '}')
     .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    
    try {
     return JSON.parse(cleanCandidate);
    } catch (e4) {
     return null;
    }
   }
   return null;
  }
 }
}

// Retrieves and parses the Firebase service account credentials.
function getServiceAccount() {
 const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
 if (!raw) return null;
 
 try {
  return JSON.parse(raw);
 } catch (e) {
  try {
   const decoded = Buffer.from(raw, 'base64').toString('utf-8');
   return JSON.parse(decoded);
  } catch (e2) {
   console.error("Firebase Service Account format error: Not valid JSON or Base64.");
   return null;
  }
 }
}

// Firebase Initialization
if (!admin.apps.length) {
 const serviceAccount = getServiceAccount();
 
 if (serviceAccount && serviceAccount.project_id) {
  try {
   admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
   });
   console.log("Firebase Admin Initialized Successfully");
  } catch (error) {
   console.error("Firebase Init Error:", error);
  }
 } else {
  console.warn("FIREBASE_SERVICE_ACCOUNT missing or invalid.");
 }
}

const registry = createProviderRegistry({
 gateway: createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
 }),
});

const groq = createGroq();

export async function POST(request) {
 try {
  const body = await request.json();
  const { type, input, sourceLang, targetLang, mode, qualityMode, explainChanges, schema } = body;
  
  if (!input || !PROMPT_CONFIG[type]) {
   return NextResponse.json({ error: 'Invalid input or type' }, { status: 400 });
  }
  
  // TRUNCATION SAFEGUARD: Clean massive schemas
  let cleanedSchema = schema;
  if (cleanedSchema) {
   // Remove INSERT INTO statements to save context window
   cleanedSchema = cleanedSchema.replace(/INSERT\s+INTO[\s\S]*?;/gi, '');
   // Cap payload at ~15,000 chars to prevent token bloat
   if (cleanedSchema.length > 15000) {
    cleanedSchema = cleanedSchema.substring(0, 20000) + '\n-- [Schema truncated due to length limits]';
   }
  }
  
  const config = PROMPT_CONFIG[type];
  
  // Pass the rich context to the system prompt
  const promptContext = { sourceLang, targetLang, mode, schema: cleanedSchema, explainChanges };
  let systemPrompt = config.system(promptContext);
  const userPrompt = config.user(input);
  
  if (config.schema && qualityMode === 'turbo') {
   const jsonSchema = zodToJsonSchema(config.schema, { target: "jsonSchema7" });
   systemPrompt += `\n\nCRITICAL SYSTEM INSTRUCTION: You MUST return ONLY a valid JSON object. The JSON must strictly validate against this JSON Schema: ${JSON.stringify(jsonSchema, null, 2)}`;
  }
  
  let finalData;
  
  if (qualityMode === 'turbo') {
   const modelInstance = groq('llama-3.3-70b-versatile');
   
   if (config.schema) {
    // Give the model 3 chances to output valid JSON
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
     const { text } = await generateText({
      model: modelInstance,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.1
     });
     
     finalData = extractJson(text);
     if (finalData) break;
     
     console.warn(`Groq JSON extraction failed on attempt ${attempt + 1}. Retrying...`);
    }
    
    if (!finalData) {
     throw new Error("Groq failed to return valid JSON after multiple attempts. The output may be exceeding token limits.");
    }
   } else {
    const { text } = await generateText({
     model: modelInstance,
     system: systemPrompt,
     prompt: userPrompt,
     maxTokens: 8000
    });
    finalData = { convertedCode: text.trim() };
   }
  } else {
   const modelId = qualityMode === 'quality' ?
    'gateway:deepseek/deepseek-v3.2-thinking' :
    'gateway:mistral/devstral-2';
   
   const modelInstance = registry.languageModel(modelId);
   
   if (config.schema) {
    const { object } = await generateObject({
     model: modelInstance,
     system: systemPrompt,
     prompt: userPrompt,
     schema: config.schema,
     maxTokens: 8000
    });
    finalData = object;
   } else {
    const { text } = await generateText({
     model: modelInstance,
     system: systemPrompt,
     prompt: userPrompt,
     maxTokens: 8000
    });
    finalData = { convertedCode: text.trim() };
   }
  }
  
  return NextResponse.json(finalData);
  
 } catch (error) {
  console.error("API Error:", error);
  return NextResponse.json({ error: error.message }, { status: 500 });
 }
}
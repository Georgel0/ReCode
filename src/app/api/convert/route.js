/**
 * @fileoverview Next.js API route for AI-powered code conversion and generation.
 * Utilizes the AI SDK to route requests to various LLMs 
 * based on the requested quality mode and following a strict schema from '@/lib/prompts.js'. Integrates with Firebase Admin for auth/logging.
 */

import { NextResponse } from 'next/server';
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import Groq from 'groq-sdk';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { PROMPT_CONFIG } from '@/lib/prompts.js';

/**
 * Robust JSON extraction from LLM strings. 
 * Strategy: Delimiters -> JSON.parse -> Markdown Strip -> Bracket Heuristics.
 */
function extractJson(text) {
 if (!text) return null;
 
 // Try Delimiters (Highest Reliability)
 const startTag = "~~~JSON_OUTPUT_START~~~";
 const endTag = "~~~JSON_OUTPUT_END~~~";
 const sIndex = text.indexOf(startTag);
 const eIndex = text.lastIndexOf(endTag);
 
 if (sIndex !== -1 && eIndex !== -1) {
  try {
   const raw = text.substring(sIndex + startTag.length, eIndex).trim();
   return JSON.parse(raw);
  } catch (e) {
   console.warn("Delimiter found but JSON parse failed", e);
  }
 }
 
 // Fallback: Try Standard JSON.parse
 try {
  return JSON.parse(text);
 } catch (e) {
  // Fallback: Clean Markdown
  const cleanMarkdown = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleanMarkdown); } catch (e3) {
   // Last Resort: Heuristic Bracket Finding
   const start = text.indexOf('{');
   const end = text.lastIndexOf('}');
   if (start !== -1 && end !== -1 && end > start) {
    const jsonCandidate = text.substring(start, end + 1);
    // Remove control chars and try basic trailing comma fix
    const cleanCandidate = jsonCandidate
     .replace(/,\s*}/g, '}')
     .replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    try { return JSON.parse(cleanCandidate); } catch (e4) { return null; }
   }
   return null;
  }
 }
}

/**
 * Retrieves and parses the Firebase service account credentials from environment variables.
 * Supports both direct JSON and Base64-encoded JSON formats.
 * @returns {object|null} - The parsed service account object or null if parsing fails.
 */
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

// Firebase Initialization. Initialized in the global scope to persist the connection across serverless cold starts.
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
  console.warn("FIREBASE_SERVICE_ACCOUNT missing or invalid. Auth checks may fail.");
 }
}

/**
 * Creates a provider registry for AI models with configured API keys.
 * @type {import('ai').ProviderRegistry}
 */
const registry = createProviderRegistry({
 gateway: createOpenAI({
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
 }),
});

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * @typedef {Object} CodeConversionRequest
 * @property {string} type - The type of operation (must match a key in PROMPT_CONFIG).
 * @property {string} input - The raw source code to be processed.
 * @property {string} [sourceLang] - The programming language of the input code.
 * @property {string} [targetLang] - The programming language to convert to.
 * @property {string} [mode] - Specific processing mode (e.g., 'explain', 'refactor').
 * @property {'quality'|'fast'|'turbo'} qualityMode - Determines the AI model used.
 */

/**
 * Handles POST requests for code conversion operations.
 * @param {Request} request - The incoming request object.
 * @returns {Promise<NextResponse>} - Returns status 200 with the converted JSON data/code, 
 * status 400 for bad input, or 500 for server errors.
 */
export async function POST(request) {
 try {
  const body = await request.json();
  const { type, input, sourceLang, targetLang, mode, qualityMode } = body;
  
  if (!input || !PROMPT_CONFIG[type]) {
   return NextResponse.json({ error: 'Invalid input or type' }, { status: 400 });
  }
  
  const config = PROMPT_CONFIG[type];
  const systemPrompt = config.system({ sourceLang, targetLang, mode });
  const userPrompt = config.user(input);
  
  let finalData;
  
  if (qualityMode === 'turbo') {
   const jsonForce = config.schema ? "\n\nIMPORTANT: Output PURE JSON." : "";
   const completion = await groqClient.chat.completions.create({
    messages: [
     { role: "system", content: systemPrompt + jsonForce },
     { role: "user", content: userPrompt }
    ],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    response_format: config.schema ? { type: "json_object" } : { type: "text" },
   });
   
   const text = completion.choices[0]?.message?.content || "";
   finalData = config.schema ? extractJson(text) : { convertedCode: text.trim() };
   
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
    });
    finalData = object;
   } else {
    const { text } = await generateText({
     model: modelInstance,
     system: systemPrompt,
     prompt: userPrompt,
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
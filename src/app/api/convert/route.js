import { NextResponse } from 'next/server';
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, generateObject, experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { PROMPT_CONFIG } from '@/lib/prompts.js';

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
    console.warn("FIREBASE_SERVICE_ACCOUNT missing or invalid. Auth checks may fail.");
  }
}

const registry = createProviderRegistry({
  // Fast Mode 
  groq: createGroq({
    apiKey: process.env.GROQ_API_KEY
  }),
  // Quality Mode
  gateway: createOpenAI({
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
  }),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, input, sourceLang, targetLang, mode, qualityMode } = body;
    
    // Validate Input
    if (!input) return NextResponse.json({ error: 'Input code is required' }, { status: 400 });
    
    // Setup Prompt
    const config = PROMPT_CONFIG[type];
    if (!config) return NextResponse.json({ error: 'Invalid operation type' }, { status: 400 });
    
    const systemPrompt = config.system({ sourceLang, targetLang, mode });
    const userPrompt = config.user(input);
    
    let modelId = 'groq:llama-3.3-70b-versatile';
    if (qualityMode === 'quality') {
      modelId = 'gateway:deepseek/deepseek-v3.2-thinking';
    }
    
    const modelInstance = registry.languageModel(modelId);
    let finalData;
    
    // Try Structured Output
    if (config.schema && qualityMode !== 'fast') {
      try {
        const result = await generateObject({
          model: modelInstance,
          system: systemPrompt,
          prompt: userPrompt,
          schema: config.schema,
          mode: 'json',
          maxTokens: 8192,
        });
        finalData = result.object;
      } catch (e) {
        console.warn("Structured output failed, falling back to text.", e);
      }
    }
    
    // Fallback to Text Generation
    if (!finalData) {
      const jsonForce = config.schema ? "\n\nIMPORTANT: Output PURE JSON ONLY." : "";
      const result = await generateText({
        model: modelInstance,
        system: systemPrompt + jsonForce,
        prompt: userPrompt,
        temperature: 0.1
      });
      
      const text = result.text;
      if (config.schema) {
        finalData = extractJson(text);
        if (!finalData) throw new Error("AI generated invalid JSON format.");
      } else {
        finalData = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
      }
    }
    
    return NextResponse.json(finalData);
    
  } catch (error) {
    console.error("API Processing Error:", error);
    return NextResponse.json({
      error: error.message || "Internal Server Error",
      details: error.toString()
    }, { status: 500 });
  }
}
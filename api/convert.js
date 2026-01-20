import { createGateway } from '@ai-sdk/gateway';
import { generateText } from 'ai';
import JSON5 from "json5";
import admin from "firebase-admin";

// Initialize Firebase Admin (Server-Side)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Firebase Admin Init Error:", error.message);
  }
}

// Initialize Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.VERCEL_AI_GATEWAY_KEY
});

const PROMPT_CONFIG = {
  converter: {
    model: "mistral/devstral-2", 
    system: () => "You are a code conversion engine. Output ONLY the raw code string. No markdown backticks. No explanations.",
    user: (input, src, tgt) => `Convert this ${src} code to ${tgt}:\n\n${input}`,
    responseType: 'text'
  },
  'css-framework': {
    model: "mistral/devstral-2",
    system: (target) => target === 'tailwind' ?
      `You are a CSS to Tailwind converter. Return strictly valid JSON: { "conversions": [{ "selector": "name", "tailwindClasses": "class names" }] }. No markdown.` : 
      `You are a CSS to ${target} converter. Output ONLY the raw converted code. No markdown backticks. No explanations.`,
    user: (input, _, target) => `Convert this CSS to ${target}:\n\n${input}`,
    responseType: (target) => target === 'tailwind' ? 'json_files' : 'text'
  },
  regex: {
    model: "mistral/devstral-2",
    system: () => "You are a Regular Expression expert. Return strictly valid JSON with fields: 'pattern' (raw string) and detailed explanation (bullet points). No markdown.",
    user: (input) => `Requirement: ${input}\n\nReturn JSON format: { "pattern": "...", "explanation": "..." }`,
    responseType: 'text' 
  },
  json: {
    model: "mistral/devstral-2",
    system: () => "You are a JSON repair expert. Return strictly valid JSON with fields: 'formattedJson' and 'explanation'. No markdown.",
    user: (input) => `Input JSON: ${input}\n\nReturn JSON format: { "formattedJson": "...", "explanation": "..." }`,
    responseType: 'text'
  },
  generator: {
    model: "mistral/devstral-2",
    system: () => `You are an expert multi-file code generator. Return strictly valid JSON in this format: { "files": [{ "fileName": "filename.ext", "content": "code content" }] }. No markdown backticks.`,
    user: (input) => `Request: ${input}`,
    responseType: 'json_files'
  },

  analysis: {
    model: "deepseek/deepseek-v3.2-thinking",
    system: () => "You are a senior code auditor. Analyze the code deeply for security, complexity (Big O), and logic. Return a strictly valid JSON object: { \"summary\": \"...\", \"score\": 0-100, \"complexity\": \"...\", \"security\": [], \"improvements\": [], \"bugs\": [] }.",
    user: (input) => `Analyze this code:\n\n${input}`,
    responseType: 'analysis'
  },
  sql: {
    model: "deepseek/deepseek-v3.2-thinking",
    system: () => "You are an expert SQL Architect. Generate optimized SQL. Return ONLY the raw SQL code. Use comments -- for explanations inside the code.",
    user: (input) => input,
    responseType: 'text'
  },
  refactor: {
    model: "deepseek/deepseek-v3.2-thinking",
    system: (mode) => {
      const goals = {
        clean: "readability and DRY principles, focus entirely on readability",
        perf: "algorithmic efficiency and memory optimization, focus entirely on performance",
        modern: "modern language features and removing deprecations, focuc entirely on modernizing the code",
        comments: "add one-line comments through the code to explain what the code dose, foucus on code explanation"
      };
      return `You are a Code Refactoring Expert. Goal: ${goals[mode] || goals.clean}.
      CRITICAL:
      1. Maintain cross-file integrity.
      2. Do not break existing logic.
      3. Return strictly valid JSON: { "files": [{ "fileName": "name.ext", "content": "refactored code" }] }.`;
    },
    user: (input) => `Refactor these files:\n\n${input}`,
    responseType: 'json_files'
  }
};

export default async function handler(req, res) {
  // Basic Validation
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  if (!process.env.VERCEL_AI_GATEWAY_KEY) {
    return res.status(500).json({ error: "Server Error: Gateway Key missing." });
  }

  // Authentication (Firebase)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token.' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    await admin.auth().verifyIdToken(token);
  } catch (error) {
    console.error("Auth Failed:", error);
    return res.status(401).json({ error: 'Unauthorized: Invalid session.' });
  }

  // Processing
  const { type, input, sourceLang, targetLang, mode } = req.body;
  const config = PROMPT_CONFIG[type];
  
  if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });

  // Resolve prompts and model
  const finalSystem = config.system(targetLang || mode);
  const finalUser = config.user(input, sourceLang, targetLang);
  const finalResponseType = typeof config.responseType === 'function' ? 
    config.responseType(targetLang) : config.responseType;

  // Select the specific model from our config
  const selectedModelId = config.model;

  try {
    // Call Vercel AI Gateway
    const { text } = await generateText({
      model: gateway(selectedModelId), // Routes to Mistral or DeepSeek
      messages: [
        { role: "system", content: finalSystem },
        { role: "user", content: finalUser }
      ],
      temperature: 0.1,
    });

    // Parse & Format Response
    let finalResponse = {};

    if (finalResponseType === 'json_files' || finalResponseType === 'analysis' || type === 'json' || type === 'regex' || type === 'css-framework') {
      // Robust JSON Extraction
      // Find the JSON object { ... }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let jsonString = jsonMatch ? jsonMatch[0] : text;
      
      // Clean markdown backticks if the regex missed them
      jsonString = jsonString.replace(/^```(json)?\s*|```$/g, '').trim();

      try {
        const parsed = JSON5.parse(jsonString);
        
        if (finalResponseType === 'analysis') {
          finalResponse = { analysis: parsed };
        } else if (type === 'regex') {
          finalResponse = { convertedCode: parsed.pattern, explanation: parsed.explanation };
        } else if (type === 'json') {
          finalResponse = { convertedCode: parsed.formattedJson, explanation: parsed.explanation };
        } else {
          finalResponse = parsed; // Files array or conversion array
        }
      } catch (e) {
        console.error("JSON Parse Error:", e);
        finalResponse = {
          error: "AI Response Parse Failure",
          rawOutput: text, // Send back raw text so user can at least see it
          files: [{ fileName: "output_log.txt", content: text }]
        };
      }
    } else {
      // Plain text response (SQL, Simple Convert)
      finalResponse = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
    }
    
    return res.status(200).json(finalResponse);

  } catch (error) {
  console.error("GATEWAY ERROR DETAILS:", {
    message: error.message,
    statusCode: error.statusCode, 
    data: error.data
  });
  return res.status(500).json({ error: error.message });
}
}
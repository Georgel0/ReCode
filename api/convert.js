import JSON5 from "json5";
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, experimental_createProviderRegistry as createProviderRegistry } from 'ai';

// Initialize Firebase Admin 
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

// Centralize provider configurations and API keys
const registry = createProviderRegistry({
  fast: createGroq({
    apiKey: process.env.GROQ_API_KEY,
  }),
  
  quality: createOpenAI({
    apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
    baseURL: "https://ai-gateway.vercel.sh/v1", 
  }),
});

const PROMPT_CONFIG = {
  refactor: {
    system: (mode) => {
      const goals = {
        clean: "Prioritize readability, meaningful variable naming, and DRY (Don't Repeat Yourself) principles.",
        perf: "Focus on algorithmic efficiency, minimizing memory footprint, and optimizing time complexity.",
        modern: "Utilize the latest language-specific features and syntax while removing deprecated or legacy patterns.",
        comments: "Provide comprehensive inline documentation that explains 'why' logic exists, not just 'what' it does."
      };
      
      const specificGoal = goals[mode] || goals.clean;
      
      return `You are a Senior Software Architect specializing in Code Refactoring.
      Your primary objective: ${specificGoal}
      
      STRICT OPERATIONAL RULES:
      1. Dependency Integrity: Maintain all imports, exports, and relationships between files.
      2. Logic Preservation: You must not change the functional behavior or add new features.
      3. Modern Standards: Apply industry-standard best practices for the detected programming language.
      
      INPUT FORMAT: A JSON array of files [{"name": "...", "content": "..."}].
      OUTPUT FORMAT: Return ONLY a strictly valid JSON object. No markdown backticks, no preamble, no conversational text.
      JSON SCHEMA: { "files": [{ "fileName": "name.ext", "content": "refactored code" }] }`;
    },
    user: (input) => `Refactor the following codebase while strictly preserving all inter-file references and functional parity:\n\n${input}`,
    responseType: 'json_files'
  },
  
  converter: {
    system: () => "You are a specialized Code Translation Engine. Your task is to translate source code from one language to another. Ensure the target syntax is valid and idiomatic. Output ONLY the raw code string. DO NOT include markdown code blocks (```), explanations, or notes.",
    user: (input, src, tgt) => `Translate this ${src} source code into functionally equivalent ${tgt} code:\n\n${input}`,
    responseType: 'text'
  },
  
  generator: {
    system: () => `You are an Expert Software Engineer. Generate complete, production-ready code based on the user's requirements. 
    Ensure modularity and clean structure. 
    OUTPUT REQUIREMENT: Return a strictly valid JSON object with the structure: { "files": [{ "fileName": "filename.ext", "content": "code content" }] }. 
    DO NOT use markdown formatting, backticks, or prose.`,
    user: (input) => `Generate a solution for the following request, splitting logic into appropriate files if necessary:\n\n${input}`,
    responseType: 'json_files'
  },
  
  analysis: {
    system: () => `You are a Senior Security and Performance Auditor. Conduct a deep-dive analysis of the provided code.
    You must return a strictly valid JSON object (no markdown) with this exact structure:
    { 
      "summary": "Detailed overview of the architecture and purpose", 
      "score": <Number 0-100>, 
      "complexity": "Detailed Big O analysis of Time and Space", 
      "security": ["List specific CVEs or vulnerabilities"], 
      "improvements": ["Actionable refactoring suggestions"], 
      "bugs": ["Identified logical errors or edge cases"] 
    }`,
    user: (input) => `Perform an exhaustive audit on this code:\n\n${input}`,
    responseType: 'analysis'
  },
  
  'css-framework': {
    system: (target) => target === 'tailwind' ?
      `You are a CSS-to-Tailwind Specialist. Map standard CSS selectors to their equivalent utility classes. 
      Return ONLY valid JSON: { "conversions": [{ "selector": "name", "tailwindClasses": "classes" }] }. No prose.` : 
      `You are a CSS-to-${target} converter. Translate the syntax perfectly. Output ONLY the raw code. No markdown.`,
    user: (input, _, target) => `Convert this CSS input to ${target} syntax:\n\n${input}`,
    responseType: (target) => target === 'tailwind' ? 'json_files' : 'text'
  },
  
  regex: {
    system: () => "You are a Regular Expression Architect. Create an optimized regex pattern based on requirements. Return a strictly valid JSON object without markdown. Format: { \"pattern\": \"raw regex string\", \"explanation\": \"concise bullet points of the logic\" }.",
    user: (input) => `Generate a regex pattern for: ${input}`,
    responseType: 'json_files'
  },
  
  sql: {
    system: () => "You are a Database Architect. Generate, optimize, or convert SQL queries according to the target dialect's best practices. Output ONLY raw SQL. Use -- for any necessary comments. No markdown blocks.",
    user: (input) => `Process the following SQL requirement:\n\n${input}`,
    responseType: 'text'
  },
  
  json: {
    system: () => "You are a JSON Validation and Repair Expert. Fix syntax errors (trailing commas, missing quotes) and format the JSON. Return a strictly valid JSON object. Format: { \"formattedJson\": \"stringified result\", \"explanation\": \"list of fixes made\" }.",
    user: (input) => `Validate and repair this JSON: ${input}`,
    responseType: 'json_files'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  // Security check
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
  
  const { type, input, sourceLang, targetLang, mode, qualityMode = 'fast' } = req.body;
  const config = PROMPT_CONFIG[type];
  if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });
  
  const finalSystem = config.system(targetLang || mode);
  const finalUser = config.user(input, sourceLang, targetLang);
  const finalResponseType = typeof config.responseType === 'function' ? config.responseType(targetLang) : config.responseType;
  
  try {
    let modelInstance;
    
    if (qualityMode === 'quality') {
      const modelId = ['generator', 'analysis', 'sql'].includes(type) 
        ? 'deepseek/deepseek-v3.2-thinking' 
        : 'mistral/devstral-2';
      
      modelInstance = registry.languageModel(`quality:${modelId}`);
    } else {
      modelInstance = registry.languageModel('fast:llama-3.3-70b-versatile');
    }
    
    const { text } = await generateText({
      model: modelInstance,
      system: finalSystem,
      prompt: finalUser,
      temperature: qualityMode === 'quality' ? 0.2 : 0.1,
    });
    
    let finalResponse = {};
    
    if (['json_files', 'json', 'regex'].includes(finalResponseType) || type === 'json' || type === 'regex') {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let jsonString = jsonMatch ? jsonMatch[0] : text;
      jsonString = jsonString.replace(/^```(json)?\s*|```$/g, '').trim();
      
      try {
        finalResponse = JSON5.parse(jsonString);
      } catch (e) {
        console.error("JSON5 Parse Error:", e);
        finalResponse = { error: "Parse Failure", raw: text };
      }
    } else if (finalResponseType === 'analysis') {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      try {
        finalResponse = jsonMatch ? JSON5.parse(jsonMatch[0]) : { analysis: text };
      } catch {
        finalResponse = { analysis: text };
      }
    } else {
      finalResponse = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
    }
    
    return res.status(200).json(finalResponse);
    
  } catch (error) {
    console.error("AI Processing Failed:", error);
    return res.status(500).json({ error: "AI Processing Failed: " + error.message });
  }
}
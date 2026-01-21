import Groq from "groq-sdk";
import JSON5 from "json5";
import admin from "firebase-admin";
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

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

const PROMPT_CONFIG = {
  refactor: {
    system: (mode) => {
      const goals = {
        clean: "Focus on readability, better variable naming, and DRY principles.",
        perf: "Focus on algorithmic efficiency, reducing memory footprint, and optimizing loops.",
        modern: "Focus on using the latest language features (e.g., ES6+, Python 3.10+) and removing deprecated APIs.",
        comments: "Focus on adding comments that explain the code, make sure the code is still readable and explained well."
      };
      
      const specificGoal = goals[mode] || goals.clean;
      
      return `You are a Code Refactoring Expert.
      Your goal: ${specificGoal}
      
      CRITICAL REQUIREMENTS:
      1. Cross-File Integrity: If files import/reference each other, ensure all references remain valid after refactoring.
      2. Functional Parity: The logic must remain identical; do not add new features or remove existing functionality.
      3. Environment: Use modern best practices suitable for the detected languages.
      
      Input: A JSON array of files [{"name": "...", "content": "..."}].
      Return strictly valid JSON: { "files": [{ "fileName": "name.ext", "content": "refactored code" }] }.
      Output ONLY the JSON object. No markdown, no prose, no backticks.`;
    },
    user: (input) => `Refactor these files while maintaining their relationships:\n\n${input}`,
    responseType: 'json_files'
  },
  
  converter: {
    system: () => "You are a code conversion engine. Output ONLY the raw code string.  Make sure the conversion is valid and the syntaxes are correct. No markdown backticks. No explanations.",
    user: (input, src, tgt) => `Convert this ${src} code to ${tgt}:\n\n${input}`,
    responseType: 'text'
  },
  
  generator: {
    system: () => `You are an expert multi-file code generator. Generate the code by fallowing the user request. Return strictly valid JSON in this format: { "files": [{ "fileName": "filename.ext", "content": "code content" }] }. No markdown backticks. No explanations.`,
    user: (input) => `Request: ${input}`,
    responseType: 'json_files'
  },
  
  analysis: {
    system: () => "You are a senior code auditor. Analyze the code deeply and give a deep explanation of the code. Return a strictly valid JSON object (no markdown formatting around it) with this structure: { \"summary\": \"Executive summary of what the code does\", \"score\": Number(0-100), \"complexity\": \"Time and Space complexity analysis\", \"security\": [\"List of security vulnerabilities found (empty if none)\"], \"improvements\": [\"List of performance or clean code improvements\"], \"bugs\": [\"List of potential bugs or edge cases\"] }.",
    user: (input) => `Analyze this code:\n\n${input}`,
    responseType: 'analysis'
  },
  
  'css-framework': {
    system: (target) => target === 'tailwind' ?
      `You are a CSS to Tailwind converter. Return strictly valid JSON: { "conversions": [{ "selector": "name", "tailwindClasses": "class names" }] }. No markdown.` : `You are a CSS to ${target} converter. Output ONLY the raw converted code. No markdown backticks. No explanations.`,
    user: (input, _, target) => `Convert this CSS to ${target}:\n\n${input}`,
    responseType: (target) => target === 'tailwind' ? 'json_files' : 'text'
  },
  
  regex: {
    system: () => "You are a Regular Expression expert. Fallow the user requirement and generate the best regex to match it. You must return a strictly valid JSON object. Do not include markdown formatting (like ```json). The JSON must have two fields: 'pattern' (the raw regex string without leading/trailing slashes) and 'explanation' (a concise, bulleted explanation of the logic).",
    user: (input) => `Requirement: ${input}\n\nReturn JSON format: { "pattern": "...", "explanation": "..." }`,
    responseType: 'text'
  },
  
  sql: {
    system: () => "You are an expert SQL Architect. Your task is to generate, convert, or optimize SQL queries. Return ONLY the raw SQL code. Do not use Markdown formatting (no ```sql). If comments are requested, include them inside the SQL using -- or /* */ syntax. Strictly follow the Target Dialect syntax.",
    user: (input) => input,
    responseType: 'text'
  },
  
  json: {
    system: () => "You are a JSON repair and formatting expert. You must return a strictly valid JSON object. Do not include markdown formatting (like ```json). The JSON must have two fields: 'formattedJson' (the repaired and pretty-printed JSON string) and 'explanation' (a concise, bulleted list of what was fixed or validated).",
    user: (input) => `Input JSON: ${input}\n\nReturn JSON format: { "formattedJson": "...", "explanation": "..." }`,
    responseType: 'text'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { GROQ_API_KEY } = process.env;
  
  // Security check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token.' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    await admin.auth().verifyIdToken(token);
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: 'Unauthorized: Invalid session.' });
  }
  
  // Extract qualityMode from request (default to 'fast')
  const { type, input, sourceLang, targetLang, mode, qualityMode = 'fast' } = req.body;
  
  const config = PROMPT_CONFIG[type];
  if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });
  
  const finalSystem = config.system(targetLang || mode);
  const finalUser = config.user(input, sourceLang, targetLang);
  const finalResponseType = typeof config.responseType === 'function' ? config.responseType(targetLang) : config.responseType;
  
  try {
    let text = "";
    
    if (qualityMode === 'quality') {
      
      //  Determine Exact Model
      let modelName;
      
      if (['generator', 'analysis', 'sql'].includes(type)) {
        modelName = 'deepseek/deepseek-v3.2-thinking';
      } else {
        modelName = 'mistral/devstral-2';
      }
      
      // Initialize OpenAI Provider via Vercel Gateway
      const openai = createOpenAI({
        apiKey: process.env.VERCEL_AI_GATEWAY_KEY,
        baseURL: "https://api.vercel.ai/v1",
      });
      
      // Generate
      const { text: generatedText } = await generateText({
        model: openai(modelName),
        messages: [
          { role: "system", content: finalSystem },
          { role: "user", content: finalUser }
        ],
        temperature: 0.2,
      });
      
      text = generatedText;
      
    } else {
      if (!GROQ_API_KEY) return res.status(500).json({ error: "Server Error: API Key missing." });
      
      const groq = new Groq({ apiKey: GROQ_API_KEY });
      
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: finalSystem },
          { role: "user", content: finalUser }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: finalResponseType === 'json_files' ? { type: "json_object" } : undefined
      });
      
      text = completion.choices[0]?.message?.content || "";
    }
    
    let finalResponse = {};
    
    // Response parsing logic
    if (finalResponseType === 'json_files' || finalResponseType === 'json' || type === 'json' || type === 'regex') {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let jsonString = jsonMatch ? jsonMatch[0] : text;
      jsonString = jsonString.replace(/^```(json)?\s*|```$/g, '').trim();
      
      try {
        finalResponse = JSON5.parse(jsonString);
      } catch (e) {
        console.error("JSON5 Parse Error:", e);
        finalResponse = { error: "Parse Failure", raw: text };
      }
    }
  else if (finalResponseType === 'analysis') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalResponse = JSON5.parse(jsonMatch[0]);
      } else {
        finalResponse = { analysis: text };
      }
    } catch {
      finalResponse = { analysis: text };
    }
  }
  else {
    finalResponse = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
  }
  
  return res.status(200).json(finalResponse);
  
} catch (error) {
  console.error("AI Processing Failed:", error);
  return res.status(500).json({ error: "AI Processing Failed: " + error.message });
}
}
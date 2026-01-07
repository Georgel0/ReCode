import Groq from "groq-sdk";
import JSON5 from "json5";

const PROMPT_CONFIG = {
  refactor: {
    system: () => `You are a Code Refactoring Expert.
      Your goal is to take a collection of files and refactor them to be faster, cleaner, and use modern best practices.
      Input will be a JSON array of files: [{"name": "...", "content": "..."}].
      Return strictly valid JSON in this format: { "files": [{ "fileName": "name.ext", "content": "refactored code" }] }.
      Output ONLY the JSON object. No markdown backticks. No explanation or comments.`,
    user: (input) => `Refactor these files:\n\n${input}`,
    responseType: 'json_files'
  },
  
  converter: {
    system: () => "You are a code conversion engine. Output ONLY the raw code string. No markdown backticks. No explanations.",
    user: (input, src, tgt) => `Convert this ${src} code to ${tgt}:\n\n${input}`,
    responseType: 'text'
  },
  
  generator: {
    system: () => `You are an expert multi-file code generator. Return strictly valid JSON in this format: { "files": [{ "fileName": "filename.ext", "content": "code content" }] }. No markdown backticks. No explanations.`,
    user: (input) => `Request: ${input}`,
    responseType: 'json_files'
  },
  
  analysis: {
    system: () => "You are a senior code reviewer. Analyze the code concisely. Use HTML formatting (<br>, <strong>) for readability if needed, but do not use Markdown.",
    user: (input) => `Analyze this code:\n\n${input}`,
    responseType: 'analysis'
  },
  
  'css-framework': {
    system: (target) => target === 'tailwind' ?
      `You are a CSS to Tailwind converter. Return strictly valid JSON: { "conversions": [{ "selector": "name", "tailwindClasses": "class names" }] }. No markdown.` :
      `You are a CSS to ${target} converter. Output ONLY the raw converted code. No markdown backticks. No explanations.`,
    
    user: (input, _, target) => `Convert this CSS to ${target}:\n\n${input}`,
    
    responseType: (target) => target === 'tailwind' ? 'json_files' : 'text'
  },
  
  regex: {
    system: () => "You are a Regular Expression generator. Return ONLY the raw regex pattern. No markdown, no explanations.",
    user: (input) => `Create a regex for this requirement:\n\n${input}`,
    responseType: 'text'
  },
  
  sql: {
    system: () => "You are a SQL query builder. Return ONLY the raw SQL query. No markdown, no explanations.",
    user: (input, _, target) => `Dialect: ${target || 'Standard SQL'}\nRequirement: ${input}`,
    responseType: 'text'
  },
  
  json: {
    system: () => "You are a JSON validator and formatter. Return ONLY the raw valid JSON string.",
    user: (input) => `Fix and format this JSON:\n\n${input}`,
    responseType: 'text'
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  
  const { GROQ_API_KEY } = process.env;
  if (!GROQ_API_KEY) return res.status(500).json({ error: "Server Error: API Key missing." });
  
  const { type, input, sourceLang, targetLang } = req.body;
  const groq = new Groq({ apiKey: GROQ_API_KEY });
  
  const config = PROMPT_CONFIG[type];
  if (!config) return res.status(400).json({ error: `Invalid type: ${type}` });
  
  // Resolve values safely
  const finalSystem = config.system(targetLang);
  const finalUser = config.user(input, sourceLang, targetLang);
  const finalResponseType = typeof config.responseType === 'function' 
    ? config.responseType(targetLang) 
    : config.responseType;
  
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: finalSystem }, 
        { role: "user", content: finalUser }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      // Use the resolved response type here
      response_format: finalResponseType === 'json_files' ? { type: "json_object" } : undefined
    });
    
    let text = completion.choices[0]?.message?.content || "";
    let finalResponse = {};
    
    // Logic for Multi-File/JSON Outputs
    if (finalResponseType === 'json_files') {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let jsonString = jsonMatch ? jsonMatch[0] : text;
      jsonString = jsonString.replace(/^```(json)?\s*|```$/g, '').trim();
      
      try {
        const parsed = JSON5.parse(jsonString);
        // Validate that we got what we expected
        if (!parsed.files && !parsed.conversions) {
          throw new Error("Missing expected keys in JSON response");
        }
        finalResponse = parsed;
      } catch (e) {
        console.error("JSON5 Parse Error:", e);
        finalResponse = {
          error: "Parse Failure",
          files: [{ fileName: "error_log.txt", content: text }]
        };
      }
    }
    else if (finalResponseType === 'analysis') {
      finalResponse = { analysis: text };
    }
    else {
      // Text-only modes (sql, regex, converter)
      finalResponse = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
    }
    
    return res.status(200).json(finalResponse);
    
  } catch (error) {
    console.error("Groq API Error:", error);
    return res.status(500).json({ error: "AI Processing Failed: " + error.message });
  }
}
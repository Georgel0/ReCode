import Groq from "groq-sdk";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const API_KEY = process.env.GROQ_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Server Error: GROQ_API_KEY is missing." });
  }
  
  const { type, input, sourceLang, targetLang } = req.body;
  const groq = new Groq({ apiKey: API_KEY });
  
  let systemMessage = "";
  let userMessage = "";
  
  // DEFINING PROMPTS
  if (type === 'converter') {
    systemMessage = "You are a code conversion engine. Output ONLY the raw code string. No markdown backticks. No explanations.";
    userMessage = `Convert this ${sourceLang} code to ${targetLang}:\n\n${input}`;
  }
  else if (type === 'generator') {
    systemMessage = `You are an expert multi-file code generator. Provide all necessary files. 
    Return strictly valid JSON in this format: { "files": [{ "fileName": "filename.ext", "content": "code content" }] }. 
    No markdown backticks, no explanations. Support languages like Python, C, C#, C++, Swift, Go, and PHP.`;
    userMessage = `Write code for the following request:\n\n${input}`;
  }
  else if (type === 'analysis') {
    systemMessage = "You are a senior code reviewer. Analyze the code concisely. Use HTML formatting (<br>, <strong>) for readability if needed, but do not use Markdown.";
    userMessage = `Analyze this code:\n\n${input}`;
  }
  else if (type === 'css-framework') {
    if (targetLang === 'tailwind') {
      systemMessage = `You are a CSS to Tailwind converter. Return strictly valid JSON: { "conversions": [{ "selector": "name", "tailwindClasses": "class names" }] }. No markdown.`;
      userMessage = `Convert this CSS to Tailwind:\n\n${input}`;
    } else {
      systemMessage = `You are a CSS to ${targetLang} converter. Output ONLY the raw converted code. No markdown backticks. No explanations.`;
      userMessage = `Convert this CSS to ${targetLang}:\n\n${input}`;
    }
  }
  else if (type === 'regex') {
    systemMessage = "You are a Regular Expression generator. Return ONLY the raw regex pattern. No markdown, no explanations.";
    userMessage = `Create a regex for this requirement:\n\n${input}`;
  }
  else if (type === 'sql') {
    systemMessage = "You are a SQL query builder. Return ONLY the raw SQL query. No markdown, no explanations.";
    userMessage = `Dialect: ${targetLang || 'Standard SQL'}\nRequirement: ${input}`;
  }
  else if (type === 'json') {
    systemMessage = "You are a JSON validator and formatter. Repair any syntax errors, remove comments if present, and format the JSON. Return ONLY the raw valid JSON string.";
    userMessage = `Fix and format this JSON:\n\n${input}`;
  }
  
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: systemMessage }, { role: "user", content: userMessage }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
    });
    
    let text = completion.choices[0]?.message?.content || "";
    
    // Extract JSON if it exists within the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const potentialJson = jsonMatch ? jsonMatch[0] : text;

    let finalResponse = {};
    
    if (type === 'css-framework' && targetLang === 'tailwind') {
      try {
        finalResponse = JSON.parse(potentialJson);
      } catch (e) {
        throw new Error("AI did not return valid JSON for Tailwind");
      }
    }
    else if (type === 'generator') {
      try {
        finalResponse = JSON.parse(potentialJson);
      } catch (e) {
        // Fallback: treat the text as a single file if JSON parsing fails
        finalResponse = { files: [{ fileName: 'index.txt', content: text }] };
      }
    }
    else if (['converter', 'regex', 'sql', 'json'].includes(type)) {
      finalResponse = { convertedCode: text.replace(/^```[a-z]*\s*|```$/g, '').trim() };
    }
    else if (type === 'analysis') {
      finalResponse = { analysis: text };
    }
    
    return res.status(200).json(finalResponse);
    
  } catch (error) {
    console.error("Groq API Error:", error);
    return res.status(500).json({ error: "AI Processing Failed: " + error.message });
  }
}
import { z } from 'zod';

export const OUTPUT_SCHEMAS = {
  json: z.object({
    formattedJson: z.string().describe("The fixed and valid JSON string"),
    explanation: z.string().describe("Bulleted list of specific syntax errors fixed")
  }),
  
  refactor: z.object({
    files: z.array(z.object({
      sourceId: z.union([z.string(), z.number()]).describe("The original unique ID provided in the input"),
      fileName: z.string().describe("The name of the file (can be updated if refactoring suggests better naming)"),
      content: z.string().describe("The full refactored code")
    }))
  }),
  
  generator: z.object({
    files: z.array(z.object({
      fileName: z.string(),
      content: z.string()
    }))
  }),
  
  analysis: z.object({
    summary: z.string(),
    score: z.number().min(0).max(100),
    complexity: z.string(),
    security: z.array(z.string()),
    improvements: z.array(z.string()),
    bugs: z.array(z.string())
  }),
  
  regex: z.object({
    pattern: z.string().describe("The raw regex string without delimiting slashes"),
    summary: z.string().describe("A one sentence summary of what this does"),
    breakdown: z.array(z.object({
      token: z.string().describe("The specific part of the regex code"),
      description: z.string().describe("What this specific token does")
    })).describe("Breakdown of the regex logic token by token")
  }),
  
  'css-framework-json': z.object({
    // Used for "CSS Only" mode
    conversions: z.array(z.object({
      selector: z.string().describe("The original CSS selector"),
      tailwindClasses: z.string().describe("The equivalent utility classes")
    })).optional(),
    
    // Used for "HTML + CSS" mode
    convertedHtml: z.string().optional().describe("The full HTML string with framework classes applied"),
    
    // Used for SASS/LESS/Stylus
    convertedCode: z.string().optional().describe("The refactored stylesheet code"),
    
    explanation: z.string().optional().describe("Technical notes about complex mappings or custom values used")
  })
};

const withSchema = (basePrompt, schemaDesc) => {
  return `${basePrompt}
  
  CRITICAL OUTPUT RULES:
  1. You MUST return a valid JSON object.
  2. Use this EXACT structure:
  ${schemaDesc}
  3. WRAP your entire JSON output in these tags: 
     ~~~JSON_OUTPUT_START~~~ 
     (your json here) 
     ~~~JSON_OUTPUT_END~~~
  4. Do NOT use markdown code blocks (\`\`\`json).
  5. Escape all double quotes inside string values.`
};

export const PROMPT_CONFIG = {
  json: {
    system: () => withSchema(
      `You are a Senior Data Engineer specializing in JSON data recovery. 
      Your Task: Rescue broken JSON structures.
      
      Guidelines:
      1. Fix trailing commas, missing quotes, mismatched brackets, and data type errors.
      2. If the input is 'loose' JS objects (keys without quotes), standardise them to strict JSON.
      3. In the 'explanation', be specific (e.g., "Fixed missing comma on line 5").`,
      `{ "formattedJson": "string (the strictly valid JSON)", "explanation": "string" }`
    ),
    user: (input) => `Repair and prettify this JSON data:\n\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.json
  },
  
  refactor: {
    system: (ctx) => {
      const mode = ctx?.mode || 'clean';
      const goals = {
        clean: "Maximum readability, standard naming conventions, and DRY principles.",
        perf: "Algorithmic efficiency (reduce Big O), memory management, and loop optimization.",
        modern: "Modern syntax features (ES2024+, async/await) and removing deprecated patterns.",
        comments: "Comprehensive documentation explaining the 'Why' and 'How'."
      };
      
      return withSchema(
        `You are a Principal Software Architect. 
        Your Task: Refactor the provided project source code.
        Focus Mode: ${goals[mode]}
        
        Guidelines:
        - Input format: An array of objects containing { "sourceId": ID, "name": string, "content": string }.
        - CRITICAL: Every file in the output MUST include the exact "sourceId" provided in the input. This is used to map files back to the UI.
        - Dependency Awareness: If you rename a file or an exported member in one file, you MUST update the corresponding imports in all other files in the set.
        - Preserve logic parity unless specifically optimizing for Performance mode.`,
        `{ "files": [ { "sourceId": "string/number", "fileName": "string", "content": "string" } ] }`
      );
    },
    user: (input) => `Refactor this project source code:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.refactor
  },
  
  converter: {
    system: (ctx) => `You are a Polyglot Expert in coding languages. 
      Your Task: Translate code from ${ctx?.sourceLang || 'auto-detect'} to ${ctx?.targetLang}.
      
      Guidelines:
      - Use idiomatic patterns and best practices for ${ctx?.targetLang}.
      - Convert libraries to their nearest equivalents (e.g., React -> Vue, Pandas -> Dplyr).
      - Output ONLY the raw code. No markdown formatting. No comments about the translation.`,
    user: (input) => `Code to translate:\n${input}`,
    responseType: 'text'
  },
  
  generator: {
    system: () => withSchema(
      `You are a Lead Developer. 
      Your Task: Scaffold a complete, production-ready solution based on requirements.
      
      Guidelines:
      - Architecture: Use industry standards (MVC, MVVM, or Component-based) appropriate for the request.
      - Separation of Concerns: Split code into logical files (e.g., styles.css, App.js, utils.js).
      - Robustness: Include error handling and basic comments.`,
      `{ "files": [ { "fileName": "string (e.g., main.py)", "content": "string (complete source code)" } ] }`
    ),
    user: (input) => `Generate a project for these requirements: ${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.generator
  },
  
  analysis: {
    system: () => withSchema(
      `You are a Senior Security & Performance Auditor. 
      Your Task: Conduct a deep-dive static analysis of the code.
      
      Guidelines:
      - Score: 0 (Critical Failure) to 100 (Flawless).
      - Complexity: Calculate Time and Space complexity (Big O).
      - Security: Look for XSS, SQLi, RCE, insecure deps, and hardcoded secrets, mention them ONLY if they exist. Do not report a vulnerability unless you can trace the exact path from input to sink. 
      - Bugs: Find logic errors, race conditions, or unhandled null states.`,
      `{ 
        "summary": "string (executive summary)", 
        "score": number, 
        "complexity": "string", 
        "security": ["string (specific vulnerability)"], 
        "improvements": ["string (actionable advice)"], 
        "bugs": ["string (potential error)"] 
       }`
    ),
    user: (input) => `Analyze this code:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.analysis
  },
  
  'css-framework': {
    system: (ctx) => {
      const { targetLang, mode, qualityMode } = ctx || {};
      
      const contextInstruction = "If the user provided 'EXTRA CONTEXT' or a config snippet, prioritize using those specific tokens, colors, or spacing scales.";
      
      // SCENARIO 1: Tailwind CSS
      if (targetLang === 'tailwind') {
        if (mode === 'html') {
          return withSchema(
            `You are a Tailwind CSS Expert. 
           Task: Rewrite the provided HTML by applying Tailwind utility classes directly to elements.
           - ${contextInstruction}
           - Use arbitrary values (e.g., w-[13.5px]) only when standard classes don't fit.
           - Remove original <style> tags and class names that are now redundant.`,
            `{ "convertedHtml": "string", "explanation": "string" }`
          );
        }
        return withSchema(
          `You are a Tailwind CSS Expert. Convert CSS selectors into utility class strings.
         - ${contextInstruction}
         - Handle hover:, focus:, and media queries as Tailwind prefixes.`,
          `{ "conversions": [{ "selector": "string", "tailwindClasses": "string" }], "explanation": "string" }`
        );
      }
      
      // SCENARIO 2: Bootstrap 5
      if (targetLang === 'bootstrap') {
        return withSchema(
          `You are a Bootstrap 5 Expert. 
         - Convert the input to use standard Bootstrap 5 utility classes and components.
         - If mode is 'html', return the full HTML string in 'convertedHtml'.
         - If mode is 'css', provide the mapping in 'conversions'.`,
          `{ "convertedHtml": "string", "conversions": "array", "explanation": "string" }`
        );
      }
      
      // SCENARIO 3: Preprocessors (SASS/LESS)
      return withSchema(
        `You are a CSS Architecture Expert. Convert the input to valid ${targetLang || 'SASS'}.
       - Use modern syntax (nesting, variables, mixins).
       - Extract repeated values into a variable block at the top.`,
        `{ "convertedCode": "string", "explanation": "string" }`
      );
    },
    user: (input) => `INPUT TO CONVERT:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS['css-framework-json']
  },
  
  regex: {
    system: (ctx) => withSchema(
      `You are a Regex Architect. 
      Your Task: Generate a strictly valid Regular Expression.
      
      Target Flavor: ${ctx?.targetLang || 'JavaScript'}
      
      Guidelines:
      1. Return ONLY the pattern string (no bounding slashes).
      2. If "Refining", use the previous pattern as context to improve the new one.
      3. Create a granular breakdown of the logic for the 'breakdown' array.`,
      `{ 
         "pattern": "string (raw pattern)", 
         "summary": "string (explanation)",
         "breakdown": [{ "token": "string", "description": "string" }] 
       }`
    ),
    
    user: (input) => input,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.regex
  },
  
  sql: {
    system: () => `You are a Database Administrator specializing in Query Optimization.
      Your Task: Generate or Optimize SQL queries.
      
      Guidelines:
      - Use standard ANSI SQL unless a specific dialect is requested.
      - Focus on Index usage and avoiding full table scans.
      - Output ONLY the raw SQL code.
      - Add brief "-- comments" explaining complex logic.`,
    user: (input) => `SQL Requirement:\n${input}`,
    responseType: 'text'
  }
};
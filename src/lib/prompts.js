import { z } from 'zod';

export const OUTPUT_SCHEMAS = {
  json: z.object({
    formattedJson: z.string().describe("The fixed and valid JSON string"),
    explanation: z.string().describe("Bulleted list of specific syntax errors fixed")
  }),
  refactor: z.object({
    files: z.array(z.object({
      fileName: z.string(),
      content: z.string()
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
    pattern: z.string(),
    explanation: z.string()
  }),
  'css-framework-json': z.object({
    conversions: z.array(z.object({
      selector: z.string(),
      tailwindClasses: z.string()
    })).optional(),
    convertedCode: z.string().optional()
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
        clean: "Maximum readability, standard naming conventions (camelCase/snake_case contextually), and DRY principles.",
        perf: "Algorithmic efficiency (reduce Big O), memory management, and loop optimization.",
        modern: "Modern syntax features (ES2024+, async/await) and removing deprecated patterns.",
        comments: "Comprehensive JSDoc/Docstring documentation explaining the 'Why' and 'How'."
      };
      
      return withSchema(
        `You are a Principal Software Architect. 
        Your Task: Refactor the provided code focusing strictly on: ${goals[mode]}
        
        Guidelines:
        - The input is a JSON representation of a file system.
        - You MUST process every single file provided.
        - Preserve all imports, exports, and logic parity (unless optimizing).
        - Do not hallucinate new files unless necessary for the refactor.`,
        `{ "files": [ { "fileName": "string", "content": "string (the full refactored code)" } ] }`
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
      if (ctx?.targetLang === 'tailwind') {
        return withSchema(
          `You are a Tailwind CSS Expert. Convert CSS/SASS to Tailwind utility classes. Extract the style from inline code and if missing add class names for them`,
          `{ "conversions": [{ "selector": "string", "tailwindClasses": "string" }] }`
        );
      }
      
      return withSchema(
        `You are a CSS Preprocessor Expert. Convert the input to valid ${ctx?.targetLang || 'SASS'}.
         - Nest selectors where appropriate.
         - Use variables for colors.`,
        `{ "convertedCode": "string" }`
      );
    },
    user: (input) => `Convert these styles:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS['css-framework-json']
  },
  
  regex: {
    system: () => withSchema(
      `You are a Regex Architect. 
      Your Task: Generate a strictly valid Regular Expression.
      
      CRITICAL VALIDATION:
      1. Return ONLY the pattern string. 
      2. DO NOT include the bounding slashes (e.g., return "^[a-z]+$" NOT "/^[a-z]+$/").
      3. DO NOT include flags (g, i, m) in the pattern string.
      4. Escape backslashes correctly for JSON (e.g., "\\d" becomes "\\\\d").`,
      `{ "pattern": "string (the raw regex pattern)", "explanation": "string (how it works)" }`
    ),
    user: (input) => `Generate a regex pattern for: ${input}`,
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
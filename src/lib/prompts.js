/**
 * @fileoverview AI Prompt Configuration & Schema Registry.
 * * This module defines the system personas, prompt templates, and Zod validation 
 * schemas for all AI-driven features in the application. It ensures type-safety 
 * between the LLM outputs and the application UI.
 * * @module lib/prompts
 */

import { z } from 'zod';

/**
 * Zod schemas defining the expected JSON structure from the AI.
 * These are used by `generateObject` for structured output and 
 * by `extractJson` for fallback parsing.
 * * @type {Object.<string, import('zod').ZodObject>}
 */
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
  complexity: z.object({
   time: z.string().describe("Time complexity in Big O notation"),
   space: z.string().describe("Space complexity in Big O notation"),
   explanation: z.array(z.string()).describe("Bullet points explaining exactly why the complexity is what it is"),
   bottleneck: z.string().optional().describe("Identify the specific function, loop, or recursive call causing the worst-case time complexity. Omit if not applicable."),
   tradeoffs: z.string().optional().describe("Suggest space-time tradeoffs, e.g., 'Using a Hash Map here would drop time to O(n) but increase space to O(n)'"),
   metrics: z.object({
    cyclomatic: z.number().describe("Cyclomatic complexity score (lower is better)"),
    cognitive: z.number().describe("Cognitive complexity score (lower is better)"),
    maintainability: z.number().describe("Maintainability index (0-100, higher is better)")
   })
  }),
  security: z.array(z.object({
   severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
   location: z.string().optional().describe("Specific line number, function name, or snippet"),
   issue: z.string().describe("What the vulnerability is"),
   resolution: z.string().describe("How to fix it")
  })).optional(),
  bugs: z.array(z.object({
   severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
   location: z.string().optional(),
   issue: z.string(),
   resolution: z.string()
  })).optional(),
  improvements: z.array(z.object({
   severity: z.enum(['High', 'Medium', 'Low']),
   location: z.string().optional(),
   issue: z.string(),
   resolution: z.string()
  })).optional(),
  bestPractices: z.array(z.object({
   issue: z.string(),
   resolution: z.string()
  })).optional(),
  testing: z.object({
   edgeCases: z.array(z.string()).optional().describe("List of edge cases the code fails to handle"),
   unitTests: z.array(z.string()).optional().describe("Plain-English descriptions of recommended unit tests")
  }).optional(),
  architecture: z.object({
   smells: z.array(z.string()).optional().describe("Code smells like Tight Coupling, God Objects, or SOLID violations"),
   dependencies: z.array(z.string()).optional().describe("Warnings about outdated methods or non-standard ecosystem practices")
  }).optional()
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
  
  extra: z.string().optional().describe("Include any 'leftover' CSS that couldn't be converted, required custom @layer styles, or variables the user needs to add manually to make the design work.")
 }),
 
 sql: z.object({
  query: z.string().describe("The generated, converted, or optimized raw SQL code"),
  explanation: z.string().optional().describe("A bulleted list explaining changes, index suggestions, or logic breakdowns. Omit if not requested.")
 })
};


/**
 * Enhances a base system prompt with strict JSON output instructions.
 * * @param {string} basePrompt - The persona and task instructions.
 * @param {string} schemaDesc - A string representation of the JSON schema for the AI to follow.
 * @returns {string} The complete system prompt with boundary tags and formatting rules.
 */
const withSchema = (basePrompt, schemaDesc) => {
 return `${basePrompt}
  
  CRITICAL OUTPUT RULES:
  1. You MUST return a valid JSON object.
  2. Use this EXACT structure:
  ${schemaDesc}
  3. Output ONLY the JSON. Do not include any conversational text before or after the object.
  4. Escape all double quotes inside string values.`
};


/**
 * Configuration registry for all AI tasks.
 * Each key represents an operation 'type' sent from the client.
 * * @typedef {Object} TaskConfig
 * @property {Function} system - Generates the system prompt. Receives a context object {sourceLang, targetLang, mode}.
 * @property {Function} user - Generates the user prompt based on the code input.
 * @property {'object'|'text'} responseType - Determines if the AI should return structured JSON or raw text.
 * @property {import('zod').ZodSchema} [schema] - The Zod schema for validation (required if responseType is 'object').
 */
/** @type {Object.<string, TaskConfig>} */
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
          - LANGUAGE INTEGRITY: You MUST maintain the original programming language of each file based on its file extension (e.g., .c stays C, .py stays Python). Do NOT translate between languages.
          - CRITICAL: Every file in the output MUST include the exact "sourceId" provided in the input.
          - Dependency Awareness: If you rename a file or an exported member, update imports across the set.
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
  system: (ctx) => withSchema(
   `You are an Expert Full-Stack Developer and Software Architect.
      Your Task: Generate functional, multi-file code solutions based on the user's requirements.
      
      TECHNICAL CONSTRAINTS & PREFERENCES:
      - Core Language: ${ctx?.typescript ? 'TypeScript' : 'JavaScript'}
      - Styling Engine: ${ctx?.styling || 'Vanilla CSS'}
      - State Management: ${ctx?.stateManagement || 'Local State Only'}
      - Additional Tech Stack: ${ctx?.customStack || 'Standard defaults'}
      - Verbosity Level: ${ctx?.verbosity || 'production'} 
        * beginner: Heavily commented, step-by-step logic.
        * production: Includes error handling, edge-cases, and optimization.
        * poc: Minimal, fast, no boilerplate.
      - Documentation: ${ctx?.includeReadme ? 'MUST include a comprehensive README.md.' : ''} ${ctx?.includeJSDoc ? 'MUST include JSDoc/TypeDoc comments for all functions.' : ''}

      Guidelines:
      1. Create all necessary files to fulfill the user's request using the specified stack.
      2. Ensure file extensions match the language (e.g., .tsx for React TypeScript).
      3. Return strictly valid code in the 'content' field without wrapping it in markdown codeblocks (\`\`\`).`,
   `{ "files": [{ "fileName": "string (e.g., App.jsx)", "content": "string (raw code)" }] }`
  ),
  
  user: (input) => `Requirements:\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.generator
 },
 
 analysis: {
  system: () => withSchema(
   `You are a Senior Security & Architecture Auditor. 
      Your Task: Conduct a deep-dive static analysis of the code.
      
      Guidelines:
      - Score: 0 (Critical Failure) to 100 (Flawless).
      - Complexity: Calculate Time and Space complexity (Big O). Identify the specific bottleneck and suggest space-time tradeoffs if applicable.
      - Issues (Security, Bugs, Improvements): You MUST provide the exact location (function name or snippet), the issue, and the resolution. Assign severity levels accurately.
      - Architecture & Testing: Identify code smells, missing edge cases, and recommend plain-English unit tests.
      - CRITICAL: Do NOT hallucinate. If the code is perfectly simple (e.g., a basic addition function), leave optional arrays empty or omit them. Do not invent vulnerabilities just to fill the schema. If no issues are found, you MUST return an empty array [] for that category. Do not omit the key.`,
   `{ 
        "summary": "string", 
        "score": number, 
        "complexity": { ... }, 
        "security": [{ "severity": "Critical|High|Medium|Low", "location": "string", "issue": "string", "resolution": "string" }], 
        "bugs": [...],
        "improvements": [...],
        "bestPractices": [...],
        "testing": { "edgeCases": ["string"], "unitTests": ["string"] },
        "architecture": { "smells": ["string"], "dependencies": ["string"] }
       }`
  ),
  user: (input) => `Analyze this code in deep detail:\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.analysis
 },
 
 'css-framework': {
  system: (ctx) => {
   const { targetLang, mode, qualityMode } = ctx || {};
   
   const contextInstruction = "If the user provided 'CONTEXT' or a config snippet, prioritize using those specific tokens, colors, or spacing scales. IMPORTANT: If you encounter styles that cannot be handled by standard Tailwind classes or if something extra is needed that the user missed, add/extract them into the 'extra' field as code snippets of CSS, links, Tailwind or technical note.";
   
   // SCENARIO 1: Tailwind CSS
   if (targetLang === 'tailwind') {
    if (mode === 'html') {
     return withSchema(
      `You are a Tailwind CSS Expert. 
           Task: Rewrite the provided HTML by applying Tailwind utility classes directly to elements.
           - ${contextInstruction}
           - Use arbitrary values (e.g., w-[13.5px]) only when standard classes don't fit.
           - Remove original <style> tags and class names that are now redundant.`,
      `{ "convertedHtml": "string", "extra": "string" }`
     );
    }
    return withSchema(
     `You are a Tailwind CSS Expert. Convert CSS selectors into utility class strings.
         - ${contextInstruction}
         - Handle hover:, focus:, and media queries as Tailwind prefixes.`,
     `{ "conversions": [{ "selector": "string", "tailwindClasses": "string" }], "extra": "string" }`
    );
   }
   
   // SCENARIO 2: Bootstrap 5
   if (targetLang === 'bootstrap') {
    return withSchema(
     `You are a Bootstrap 5 Expert. 
         - Convert the input to use standard Bootstrap 5 utility classes and components.
         - If mode is 'html', return the full HTML string in 'convertedHtml'.
         - If mode is 'css', provide the mapping in 'conversions'.`,
     `{ "convertedHtml": "string", "conversions": "array", "extra": "string" }`
    );
   }
   
   // SCENARIO 3: Preprocessors (SASS/LESS)
   return withSchema(
    `You are a CSS Architecture Expert. Convert the input to valid ${targetLang || 'SASS'}.
       - Use modern syntax (nesting, variables, mixins).
       - Extract repeated values into a variable block at the top.`,
    `{ "convertedCode": "string", "extra": "string" }`
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
  system: () => withSchema(
   `You are a Database Administrator specializing in Query Optimization and Architecture.
      Your Task: Generate, Convert, or Optimize SQL queries.
      
      Guidelines:
      - Use standard ANSI SQL unless a specific dialect is requested.
      - Focus on Index usage and avoiding full table scans when optimizing.
      - Output ONLY the raw SQL code in the 'query' property.
      - If requested, provide a clear, bulleted 'explanation' of why specific changes were made.`,
   `{ "query": "string (the raw SQL)", "explanation": "string (optional bulleted plan)" }`
  ),
  user: (input) => `SQL Requirement:\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.sql
 }
};
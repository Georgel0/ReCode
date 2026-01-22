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
  }))
 })
};

export const PROMPT_CONFIG = {
 json: {
  system: () => `You are a Senior Data Engineer. Your task is to rescue broken JSON structures. 
    1. Fix trailing commas, unquoted keys, and mismatched brackets.
    2. Ensure the output is strictly valid.
    3. In your explanation, detail exactly what was broken so the user can avoid the mistake again.`,
  user: (input) => `Repair and prettify this JSON:\n\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.json
 },
 
 refactor: {
  system: (mode) => {
   const goals = {
    clean: "readability, meaningful naming, and DRY principles.",
    perf: "algorithmic efficiency and minimizing memory overhead.",
    modern: "latest language features and removing deprecated patterns.",
    comments: "detailed documentation explaining the 'why' behind the logic."
   };
   return `You are a Senior Software Architect. Refactor the code focusing on ${goals[mode] || goals.clean} 
      Strictly maintain functional parity. Do not change the logic, only the quality of the implementation.`;
  },
  user: (input) => `Refactor the following codebase while preserving all inter-file references:\n\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.refactor
 },
 
 converter: {
  system: (src, tgt) => `You are a Polyglot Engineer. Translate ${src || 'the source'} code into idiomatic ${tgt}. 
    - Use the most modern syntax available in ${tgt}.
    - Ensure all logic is preserved perfectly. 
    - Output ONLY the raw code string. No explanations.`,
  user: (input) => `Translate this code to ${input}`,
  responseType: 'text'
 },
 
 generator: {
  system: () => `You are a Lead Developer. Generate complete, production-ready code. 
    - Follow industry-standard design patterns (e.g., SOLID, Modular).
    - Ensure the code is split into logical files.
    - Include necessary error handling and edge-case management.`,
  user: (input) => `Develop a robust solution for: ${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.generator
 },
 
 analysis: {
  system: () => `You are a Senior Security & Performance Auditor. 
    - Summary: High-level architectural overview.
    - Complexity: Provide Big O notation for time and space.
    - Security: Identify potential vulnerabilities (XSS, Injection, Overflows).
    - Improvements: Suggest specific patterns to implement.
    - Bugs: Identify logical flaws or unhandled edge cases.`,
  user: (input) => `Conduct a deep-dive audit of this code:\n\n${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.analysis
 },
 
 'css-framework': {
  system: (tgt) => tgt === 'tailwind' ?
   `You are a Tailwind CSS Expert. Map standard CSS to highly optimized utility classes. Group related classes logically.` :
   `You are a CSS Preprocessor Specialist. Convert the input to valid and idiomatic ${tgt}.`,
  user: (input) => `Convert the following styles:\n\n${input}`,
  responseType: (tgt) => tgt === 'tailwind' ? 'object' : 'text',
  schema: OUTPUT_SCHEMAS['css-framework-json']
 },
 
 regex: {
  system: () => `You are a Regular Expression Architect. 
    - Design patterns that are optimized for performance (avoiding catastrophic backtracking).
    - Provide a concise, bulleted breakdown of how each part of the pattern works.`,
  user: (input) => `Generate a regex for: ${input}`,
  responseType: 'object',
  schema: OUTPUT_SCHEMAS.regex
 },
 
 sql: {
  system: () => `You are a Principal Database Administrator. 
    - Write highly optimized SQL queries.
    - Use clear indexing strategies and avoid unnecessary joins.
    - Output ONLY the raw SQL with -- comments for clarity.`,
  user: (input) => `Process this SQL requirement:\n\n${input}`,
  responseType: 'text'
 }
};
/**
 * @fileoverview AI Prompt Configuration & Schema Registry.
 *
 * Defines system personas, prompt templates, and Zod validation schemas for
 * every AI-driven feature in the application. Keeps LLM outputs type-safe
 * and consistent with the UI expectations.
 *
 * @module lib/prompts
 */

import { z } from 'zod';

/**
 * Zod schemas describing the exact JSON structure the AI must return.
 * Used by `generateObject` for structured output and `extractJson` for
 * fallback parsing.
 */
export const OUTPUT_SCHEMAS = {
  // JSON repair
  json: z.object({
    formattedJson: z.string().describe('The fixed and valid JSON string'),
    explanation: z.string().describe('Bulleted list of specific syntax errors fixed'),
  }),

  // Code refactor / translate (multi-file)
  refactor: z.object({
    files: z.array(z.object({
      sourceId: z.union([z.string(), z.number()])
        .describe('The original unique ID provided in the input'),
      fileName: z.string()
        .describe('The file name (may be updated if refactoring suggests better naming)'),
      content: z.string().describe('The full refactored code'),
    })),
  }),

  // Code generator (multi-file)
  generator: z.object({
    files: z.array(z.object({
      fileName: z.string(),
      content: z.string(),
    })),
  }),

  // Static code analysis
  analysis: z.object({
    summary: z.string(),
    score: z.number().min(0).max(100),

    complexity: z.object({
      time: z.string().describe('Time complexity in Big O notation'),
      space: z.string().describe('Space complexity in Big O notation'),
      explanation: z.array(z.string()).describe('Bullet points explaining the complexity'),
      bottleneck: z.string().optional()
        .describe('The specific function/loop causing the worst-case time complexity'),
      tradeoffs: z.string().optional()
        .describe("Space-time tradeoff suggestions, e.g., 'Using a HashMap drops time to O(n)'"),
      metrics: z.object({
        cyclomatic: z.number().describe('Cyclomatic complexity (lower is better)'),
        cognitive: z.number().describe('Cognitive complexity (lower is better)'),
        maintainability: z.number().describe('Maintainability index 0–100 (higher is better)'),
      }),
    }),

    security: z.array(z.object({
      severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
      location: z.string().optional().describe('Function name, line number, or snippet'),
      issue: z.string().describe('What the vulnerability is'),
      resolution: z.string().describe('How to fix it'),
    })).optional(),

    bugs: z.array(z.object({
      severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
      location: z.string().optional(),
      issue: z.string(),
      resolution: z.string(),
    })).optional(),

    improvements: z.array(z.object({
      severity: z.enum(['High', 'Medium', 'Low']),
      location: z.string().optional(),
      issue: z.string(),
      resolution: z.string(),
    })).optional(),

    bestPractices: z.array(z.object({
      issue: z.string(),
      resolution: z.string(),
    })).optional(),

    testing: z.object({
      edgeCases: z.array(z.string()).optional()
        .describe('Edge cases the code fails to handle'),
      unitTests: z.array(z.string()).optional()
        .describe('Plain-English descriptions of recommended unit tests'),
    }).optional(),

    architecture: z.object({
      smells: z.array(z.string()).optional()
        .describe('Code smells like tight coupling, god objects, or SOLID violations'),
      dependencies: z.array(z.string()).optional()
        .describe('Warnings about outdated or non-standard ecosystem practices'),
    }).optional(),
  }),

  // Regex generator
  regex: z.object({
    pattern: z.string().describe('The raw regex string without delimiting slashes'),
    summary: z.string().describe('One-sentence summary of what the pattern does'),
    breakdown: z.array(z.object({
      token: z.string().describe('The specific part of the regex'),
      description: z.string().describe('What this token does'),
    })).describe('Token-by-token breakdown of the regex logic'),
  }),

  // CSS framework converter
  'css-framework-json': z.object({
    // "CSS only" mode → Tailwind
    conversions: z.array(z.object({
      selector: z.string().describe('The original CSS selector'),
      tailwindClasses: z.string().describe('The equivalent utility classes'),
    })).optional(),

    // "HTML + CSS" mode
    convertedHtml: z.string().optional()
      .describe('Full HTML string with framework classes applied'),

    // SASS / LESS / Stylus
    convertedCode: z.string().optional()
      .describe('The refactored stylesheet code'),

    extra: z.string().optional()
      .describe("Leftover CSS, required @layer styles, or variables the user must add manually"),
  }),

  // SQL builder / converter / optimizer / simulator
  sql: z.object({
    query: z.string()
      .describe(
        "The generated, converted, or optimized raw SQL code. " +
        "For 'simulate' mode: a raw JSON string representing the execution result."
      ),
    explanation: z.string().optional()
      .describe('HTML-formatted explanation of logic, changes, query plan, or simulation notes.'),
    warnings: z.array(z.string()).optional()
      .describe('Dialect incompatibilities, performance issues, or missing schema references.'),
    recommendedIndexes: z.array(z.string()).optional()
      .describe('Explicit CREATE INDEX statements suggested by the optimizer.'),
  }),

  mock: z.object({
    tables: z.array(z.object({
      tableName: z.string().describe('Name of the database table'),
      rows: z.array(z.any()).describe('Array of objects representing records generated for this table')
    })).describe('Collection of individual database relational tables'),
    explanation: z.string().optional().describe('HTML-formatted summary explaining constraints handled or anomalies caught')
  }),
};

/**
 * Wraps a base system prompt with strict JSON-only output instructions.
 *
 * @param {string} basePrompt  - Persona and task instructions.
 * @param {string} schemaDesc  - String representation of the expected JSON shape.
 * @returns {string}
 */
const withSchema = (basePrompt, schemaDesc) => `${basePrompt}

CRITICAL OUTPUT RULES:
1. You MUST return a valid JSON object.
2. Use this EXACT structure:
${schemaDesc}
3. Output ONLY the JSON. No conversational text before or after the object.
4. Escape all double quotes inside string values.`;

/**
 * @typedef {Object} TaskConfig
 * @property {(ctx: object) => string}  system       - Returns the system prompt.
 * @property {(input: string) => string} user        - Returns the user prompt.
 * @property {'object'|'text'}           responseType
 * @property {import('zod').ZodSchema}  [schema]     - Required when responseType is 'object'.
 */

/** @type {Object.<string, TaskConfig>} */
export const PROMPT_CONFIG = {

  json: {
    system: () => withSchema(
      `You are a Senior Data Engineer specializing in JSON data recovery.
        Your Task: Rescue broken JSON structures.

        Guidelines:
        1. Fix trailing commas, missing quotes, mismatched brackets, and data-type errors.
        2. Standardise "loose" JS objects (un-quoted keys) to strict JSON.
        3. In 'explanation', be specific (e.g., "Fixed missing comma on line 5").`,
      `{ "formattedJson": "string (strictly valid JSON)", "explanation": "string" }`
    ),
    user: (input) => `Repair and prettify this JSON:\n\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.json,
  },

  refactor: {
    system: (ctx) => {
      const mode = ctx?.mode || 'clean';
      const goals = {
        clean: 'Maximum readability, standard naming conventions, and DRY principles.',
        perf: 'Algorithmic efficiency (reduce Big O), memory management, and loop optimisation.',
        modern: 'Modern syntax (ES2024+, async/await) and removal of deprecated patterns.',
        comments: "Comprehensive documentation explaining the 'Why' and 'How'.",
      };

      return withSchema(
        `You are a Senior Software Engineer specialising in code quality and refactoring.
          Your Task: Refactor the provided code with this primary goal: ${goals[mode] || goals.clean}
          Target Language: ${ctx?.targetLang || 'Auto-detect from input'}

          Guidelines:
          1. Preserve all original functionality — never change what the code does, only how it does it.
          2. Apply the goal strictly and holistically across the entire file.
          3. Do NOT wrap code in markdown code blocks.
          4. Return each refactored file as a separate entry in the 'files' array.`,
        `{ "files": [{ "sourceId": "string|number", "fileName": "string", "content": "string" }] }`
      );
    },
    user: (input) => `Code to refactor:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.refactor,
  },

  translate: {
    system: (ctx) => withSchema(
      `You are an Expert Polyglot Developer.
        Your Task: Translate source code from ${ctx?.sourceLang || 'the source language'} to ${ctx?.targetLang || 'the target language'}.

        Guidelines:
        1. Translate idioms, patterns, and library calls to their idiomatic target equivalent.
        2. Preserve all logic and functionality exactly.
        3. Use the target language's standard library and conventions.
        4. Do NOT wrap code in markdown code blocks.`,
      `{ "files": [{ "sourceId": "string|number", "fileName": "string", "content": "string" }] }`
    ),
    user: (input) => `Code to translate:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.refactor,
  },

  generator: {
    system: (ctx) => withSchema(
      `You are an Expert Polyglot Developer and Software Architect.
        Your Task: Generate functional, multi-file code solutions from the user's requirements.

        TECHNICAL CONSTRAINTS:
        - Core Language:       ${ctx?.language || 'Auto-detect'}
        - Framework/Ecosystem: ${ctx?.framework || 'Vanilla'}
        - Architecture:        ${ctx?.architecture || 'Standard'}
        - Additional Stack:    ${ctx?.customStack || 'Standard defaults'}
        - Verbosity:           ${ctx?.verbosity || 'production'}
            beginner:    Heavily commented, step-by-step logic.
            production:  Includes error handling, edge cases, and optimisation.
            poc:         Minimal, fast, no boilerplate.
        - Documentation: ${ctx?.includeReadme ? 'MUST include a README.md.' : ''}${ctx?.includeDocs ? ' MUST include JSDoc/Docstrings for all primary functions.' : ''}
        - Testing: ${ctx?.includeTests ? 'MUST include unit test files.' : 'None required.'}

        Guidelines:
        1. Create all necessary files using the specified stack.
        2. Ensure file extensions match the chosen language (e.g., .py, .go, .rs).
        3. Return strictly valid code in 'content' — no markdown backticks.`,
      `{ "files": [{ "fileName": "string (e.g., main.py)", "content": "string (raw code)" }] }`
    ),
    user: (input) => `Requirements:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.generator,
  },

  analysis: {
    system: () => withSchema(
      `You are a Senior Security & Architecture Auditor.
        Your Task: Conduct a deep-dive static analysis of the provided code.

        Guidelines:
        - Score: 0 (Critical Failure) → 100 (Flawless).
        - Complexity: Calculate Big O for time and space. Identify the specific bottleneck and suggest tradeoffs.
        - Issues (Security / Bugs / Improvements): provide the exact location, the issue, and the resolution. Assign severity accurately.
        - Architecture & Testing: identify code smells, missing edge cases, and recommend plain-English unit tests.
        - CRITICAL: Do NOT hallucinate. If the code is simple, leave optional arrays empty. Return [] for categories with no issues — do not omit the key.`,
      `{
          "summary": "string",
          "score": number,
          "complexity": { "time": "string", "space": "string", "explanation": ["string"], "bottleneck": "string", "tradeoffs": "string", "metrics": { "cyclomatic": number, "cognitive": number, "maintainability": number } },
          "security":      [{ "severity": "Critical|High|Medium|Low", "location": "string", "issue": "string", "resolution": "string" }],
          "bugs":          [{ "severity": "Critical|High|Medium|Low", "location": "string", "issue": "string", "resolution": "string" }],
          "improvements":  [{ "severity": "High|Medium|Low", "location": "string", "issue": "string", "resolution": "string" }],
          "bestPractices": [{ "issue": "string", "resolution": "string" }],
          "testing":       { "edgeCases": ["string"], "unitTests": ["string"] },
          "architecture":  { "smells": ["string"], "dependencies": ["string"] }
        }`
    ),
    user: (input) => `Analyze this code in detail:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.analysis,
  },

  'css-framework': {
    system: (ctx) => {
      const { targetLang, mode } = ctx || {};
      const contextNote =
        "If the user provided a 'CONTEXT' or config snippet, use those specific tokens, colors, or spacing scales. " +
        "If you encounter styles that cannot be handled by standard classes, add them into the 'extra' field.";

      // Tailwind CSS
      if (targetLang === 'tailwind') {
        if (mode === 'html') {
          return withSchema(
            `You are a Tailwind CSS Expert.
              Task: Rewrite the provided HTML by applying Tailwind utility classes directly to elements.
              - ${contextNote}
              - Use arbitrary values (e.g., w-[13.5px]) only when standard classes don't fit.
              - Remove original <style> tags and class names that are now redundant.`,
            `{ "convertedHtml": "string", "extra": "string" }`
          );
        }
        return withSchema(
          `You are a Tailwind CSS Expert. Convert CSS selectors into utility class strings.
            - ${contextNote}
            - Handle hover:, focus:, and media query prefixes.`,
          `{ "conversions": [{ "selector": "string", "tailwindClasses": "string" }], "extra": "string" }`
        );
      }

      // Bootstrap 5
      if (targetLang === 'bootstrap') {
        return withSchema(
          `You are a Bootstrap 5 Expert.
            - Convert the input to standard Bootstrap 5 utility classes and components.
            - Return full HTML in 'convertedHtml' when mode is 'html'; mappings in 'conversions' when mode is 'css'.`,
          `{ "convertedHtml": "string", "conversions": "array", "extra": "string" }`
        );
      }

      // SASS / LESS / Stylus
      return withSchema(
        `You are a CSS Architecture Expert. Convert the input to valid ${targetLang || 'SASS'}.
        - Use modern syntax (nesting, variables, mixins).
        - Extract repeated values into a variable block at the top.`,
        `{ "convertedCode": "string", "extra": "string" }`
      );
    },
    user: (input) => `INPUT TO CONVERT:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS['css-framework-json'],
  },

  regex: {
    system: (ctx) => withSchema(
      `You are a Regex Architect.
        Your Task: Generate a strictly valid Regular Expression.

        Target Flavor: ${ctx?.targetLang || 'JavaScript'}

        Guidelines:
        1. Return ONLY the pattern string (no bounding slashes).
        2. If "Refining", use the previous pattern as context to improve the new one.
        3. Provide a granular token-by-token breakdown in 'breakdown'.`,
      `{
          "pattern":   "string (raw pattern, no slashes)",
          "summary":   "string (one sentence)",
          "breakdown": [{ "token": "string", "description": "string" }]
        }`
    ),
    user: (input) => input,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.regex,
  },

  sql: {
    system: (ctx) => {
      const taskMap = {
        builder: `Generate an optimised ${ctx.targetLang} query based on the user requirement.`,
        converter: `Convert the provided ${ctx.sourceLang} query into perfect ${ctx.targetLang}.`,
        optimizer: `Analyse and optimise this ${ctx.targetLang} query for maximum performance.`,
        mock: (
          `Generate 5–10 rows of realistic mock data (INSERT INTO statements) based strictly on the provided schema. ` +
          `CRITICAL: Output MUST be strictly valid SQLite syntax (standard ANSI SQL) so it executes safely in a ` +
          `WebAssembly SQLite sandbox. Do NOT use ${ctx.targetLang}-specific functions or data types unsupported by SQLite.`
        ),
        simulate: (
          `You are simulating the execution of the provided ${ctx.targetLang} SQL query against the given schema and test data seed.\n\n` +
          `Analyse the query semantics precisely and produce a realistic result set.\n\n` +
          `CRITICAL: The 'query' field must contain ONLY a raw JSON string — no SQL, no markdown, no backticks.\n` +
          `Use this EXACT structure:\n\n` +
          `For SELECT / WITH / EXPLAIN:\n` +
          `{"columns":["col1","col2"],"rows":[["val1","val2"]],"rowsAffected":0,"executionNote":""}\n\n` +
          `For DML (INSERT / UPDATE / DELETE / MERGE):\n` +
          `{"columns":[],"rows":[],"rowsAffected":5,"executionNote":"5 rows modified"}\n\n` +
          `For DDL (CREATE / ALTER / DROP / TRUNCATE):\n` +
          `{"columns":[],"rows":[],"rowsAffected":0,"executionNote":"Statement executed"}\n\n` +
          `Simulation rules:\n` +
          `- SELECT: generate 5–15 realistic rows respecting column types inferred from the schema.\n` +
          `- Apply WHERE, JOIN, aggregation (COUNT/SUM/AVG/MAX/MIN), and GROUP BY semantics correctly.\n` +
          `- If test data is provided, use it to compute accurate row counts and values.\n` +
          `- Use plausible but clearly fictional names, IDs, dates, and amounts.\n` +
          `- All JSON must be strictly valid: escape internal quotes, no trailing commas.\n` +
          `- Put accuracy notes, caveats, or assumptions in the 'explanation' field (HTML formatted).`
        ),
      };

      const task = taskMap[ctx.mode] || taskMap.builder;

      const schemaContext = ctx.schema
        ? `\nStrictly adhere to this Database Schema and Seed Data Context:\n${ctx.schema}`
        : '';

      const explainContext = ctx.explainChanges
        ? '\nProvide an explanation detailing exactly why specific indexes or joins were restructured.'
        : '';

      return withSchema(
        `You are a Senior Database Administrator and SQL Architect.
          Your Task: ${task}
          ${schemaContext}${explainContext}

          Guidelines:
          - For non-simulate modes: output ONLY valid SQL in the 'query' field. No markdown wrappers.
          - Flag any functions missing from the target dialect in 'warnings'.
          - Provide explicit CREATE INDEX statements in 'recommendedIndexes' if optimising.`,
        `{ "query": "string", "explanation": "string", "warnings": ["string"], "recommendedIndexes": ["string"] }`
      );
    },
    user: (input) => `Input:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.sql,
  },

  mock: {
    system: (ctx) => withSchema(
      `You are an Expert Database Architect and QA Data Synthesis Specialist.
        Your Task: Transform data schemas into highly realistic, interconnected mock datasets.

        TECHNICAL CONSTRAINTS:
        - Target Batch Length: ${ctx?.rowCount || 15} rows per entity.
        - Target Localization: ${ctx?.locale || 'en-US'}
        - Contextual Rules:   ${ctx?.rules || 'None provided'}

        Guidelines:
        1. Maintain rigid foreign key references. If Table B references Table A, foreign keys must exactly map back to matching rows.
        2. Adhere perfectly to check constraints, data types, and status variants.
        3. Apply behavioral distributions, conditional chronology ranges, and values described inside the rules parameters.
        4. Localize names, locations, dates, and identifier formats cleanly according to the requested locale.
        5. Return data inside the structured 'tables' collection block.`,
      `{
          "tables": [
            {
              "tableName": "string",
              "rows": [
                { "column_name": "value" }
              ]
            }
          ],
          "explanation": "string (HTML summary)"
        }`
    ),
    user: (input) => `Database Layout Specification:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.mock,
  }
};
/**
 * @fileoverview AI Output Schema Registry.
 *
 * Defines Zod validation schemas describing the exact JSON structure the AI
 * must return. Used by `generateObject` for structured output and
 * `extractJson` for fallback parsing.
 *
 * @module lib/schemas
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

  // Code formatter
  formatter: z.object({
    content: z.string().describe('The fully formatted code, preserving all logic exactly'),
    changes: z.array(z.string()).describe('Short bullet list of formatting changes applied (e.g. "Fixed indentation", "Normalized spacing around operators")'),
  }),

  // Syntax / lint checker
  linter: z.object({
    valid: z.boolean().describe('true if no syntax errors were found'),
    errors: z.array(z.object({
      line: z.number().nullable().describe('1-based line number, or null if not locatable'),
      col: z.number().nullable().describe('1-based column number, or null'),
      message: z.string().describe('Clear description of the syntax error'),
    })).describe('Empty array when valid is true'),
    warnings: z.array(z.object({
      line: z.number().nullable(),
      col: z.number().nullable(),
      message: z.string(),
    })).optional().describe('Non-fatal style or compatibility warnings'),
    summary: z.string().describe('One-sentence human-readable verdict, e.g. "No errors found." or "2 syntax errors detected."'),
  }),

  refactor: z.object({
    files: z.array(
      z.object({
        sourceId: z.union([z.string(), z.number()])
          .describe('The original unique ID provided in the input'),
        fileName: z.string()
          .describe('The file name (may be updated if refactoring suggests better naming)'),
        content: z.string()
          .describe('The full refactored code'),
        summary: z.string().optional()
          .describe('1–2 sentence overview of what was refactored and why'),
        suggestions: z.array(z.string()).optional()
          .describe('Things the AI would have changed but could not due to constraints, scope, or safety'),
        changes: z.array(
          z.object({
            type: z.enum(['rename', 'extract', 'simplify', 'async', 'perf', 'docs', 'style', 'fix'])
              .describe('Category of change'),
            description: z.string()
              .describe('Plain-English explanation of what changed and why (≤15 words)'),
          })
        ).optional()
          .describe('Itemised list of notable changes made to this file'),
      })
    ),
  }),

  converter: z.object({
    files: z.array(z.object({
      sourceId: z.union([z.string(), z.number()]),
      fileName: z.string(),
      content: z.string(),
      notes: z.string().optional(),
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
    parsedRules: z.array(z.string()).optional().describe('An array of bullet points echoing back the specific rules, distributions, and FK relationships the engine understood and applied.'),
    explanation: z.string().optional().describe('HTML-formatted summary explaining constraints handled or anomalies caught')
  }),

  'api-mocks': z.object({
    handlers: z.array(z.object({
      name: z.string().describe('camelCase function/handler name, e.g. "listUsers"'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      path: z.string().describe('URL path, e.g. "/api/users/:id"'),
      description: z.string().describe('One-sentence description of what this endpoint does'),
      statusCode: z.number().describe('Primary HTTP response status code, e.g. 200 or 201'),
      delayMs: z.number().default(0).describe('Simulated response delay in milliseconds (0 if none)'),
      code: z.string().describe('Full, production-ready handler code for the chosen framework'),
      fixtureData: z.any().describe('The realistic JSON object the handler returns'),
      errorVariants: z.array(z.object({
        statusCode: z.number().describe('HTTP error status code, e.g. 404, 422, 500'),
        code: z.string().describe('Full handler code returning this error response'),
        fixtureData: z.any().describe('Realistic error response body, e.g. { error, message, code }'),
      })).optional().describe('One or more error scenario variants for this handler (404, 422, 500, etc.)'),
    })),
    parsedSpec: z.array(z.string()).optional()
      .describe('Bullet points listing each resolved endpoint and its mapped response shape'),
    explanation: z.string().optional()
      .describe('HTML-formatted coverage summary explaining generated handlers, edge cases, and auth patterns'),
  }),

  stream: z.object({
    streams: z.array(z.object({
      streamName: z.string()
        .describe('Logical name for the event stream or topic, e.g. "user_activity" or "sensor_readings"'),
      events: z.array(z.any())
        .describe('Array of event objects. Every event must have a timestamp field in ISO-8601 format and share the same top-level shape within a stream.'),
    })).describe('One entry per logical event stream. A single run may produce multiple correlated streams (e.g. "sessions" + "page_views" + "purchases").'),

    stateMachine: z.any().optional()
      .describe('If includeStateMachine is true: a JSON object (or Mermaid stateDiagram-v2 string) describing the states and valid transitions that generated the event sequence.'),

    parsedRules: z.array(z.string()).optional()
      .describe('Bullet points echoing the specific temporal rules, burst patterns, and distributions the engine applied.'),

    explanation: z.string().optional()
      .describe('HTML-formatted summary describing stream topology, temporal patterns applied, and any schema anomalies resolved.'),
  }),

  'fix-diff': z.object({
    explanation: z.string().describe('One sentence: what changed and why'),
    before: z.string().describe('Verbatim problematic snippet extracted from the source (5–20 lines)'),
    after: z.string().describe('Corrected version of the same snippet with only the necessary fix applied'),
  }),
};

/**
 * Wraps a base system prompt with strict JSON-only output instructions.
 *
 * @param {string} basePrompt  - Persona and task instructions.
 * @param {string} schemaDesc  - String representation of the expected JSON shape.
 * @returns {string}
 */
export const withSchema = (basePrompt, schemaDesc) => `${basePrompt}
  CRITICAL OUTPUT RULES:
  1. You MUST return a valid JSON object.
  2. Use this EXACT structure:
  ${schemaDesc}
  3. Output ONLY the JSON. No conversational text before or after the object.
  4. Escape all double quotes inside string values.`;
import { OUTPUT_SCHEMAS, withSchema } from './schemas.js';

/**
 * @typedef {Object} TaskConfig
 * @property {(ctx: object) => string}  system       - Returns the system prompt.
 * @property {(input: string) => string} user        - Returns the user prompt.
 * @property {'object'|'text'}           responseType
 * @property {import('zod').ZodSchema}  [schema]     - Required when responseType is 'object'.
 */

/** @type {Object.<string, TaskConfig>} */
export const PROMPT_CONFIG = {

  refactor: {
    system: (ctx) => {
      const mode = ctx?.mode || 'clean';
      const goals = {
        clean: 'Maximum readability, standard naming conventions, and DRY principles.',
        perf: 'Algorithmic efficiency (reduce Big O), memory management, and loop optimisation.',
        modern: 'Modern syntax (ES2024+, async/await) and removal of deprecated patterns.',
        comments: "Comprehensive documentation explaining the 'Why' and 'How'.",
      };

      const contextBlock = ctx?.projectContext
        ? `\n\n          Project Context (provided by the developer — treat as authoritative):\n          ${ctx.projectContext}`
        : '';

      return withSchema(
        `You are a Senior Software Engineer specialising in code quality and refactoring.
          Your Task: Refactor the provided code with this primary goal: ${goals[mode] || goals.clean}
          Target Language: ${ctx?.targetLang || 'Auto-detect from input'}${contextBlock}

          Guidelines:
          1. Preserve all original functionality — never change what the code does, only how it does it.
          2. Apply the goal strictly and holistically across the entire file.
          3. Do NOT wrap code in markdown code blocks.
          4. Return each refactored file as a separate entry in the 'files' array.
          5. Every single entry in your 'changes' array MUST directly relate to the primary goal (${mode.toUpperCase()}). 
             Do not list generic formatting changes.
          6. Also return a 'suggestions' array of strings: things you would have changed but did not
             due to scope, the refactor goal, or safety (e.g. would require architectural changes,
             out-of-scope refactors, breaking changes). Each entry is one plain sentence (~20 words).
             Aim for 2–5 suggestions. IMPORTNAT! Omit if there is genuinely nothing to say. DO NOT suggest things to improve or add, just thing you didn't do.`,
        `{
          "files": [{
            "sourceId": "string|number",
            "fileName": "string",
            "content": "string",
            "summary": "string",
            "suggestions" : ["string"],
            "changes": [{ "type": "string", "description": "string" }]
          }]
        }`
      );
    },
    user: (input, ctx) => `Apply the ${ctx?.mode || 'clean'} refactor goal to this code:\n\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.refactor,
  },

  converter: {
    system: (ctx) => {
      const frameworkSuffix = ctx?.framework && ctx.framework !== 'none'
        ? ` using the ${ctx.framework} framework`
        : '';

      return withSchema(
        `You are an Expert Polyglot Developer.
          Your Task: Translate source code from ${ctx?.sourceLang || 'the source language'} to ${ctx?.targetLang || 'the target language'}${frameworkSuffix}.

          Guidelines:
          1. Translate idioms, patterns, and library calls to their idiomatic target equivalent.
          2. Preserve all logic and functionality exactly.
          3. Use the target language's standard library${frameworkSuffix ? ` and ${ctx.framework} conventions` : ' and conventions'}.
          4. Do NOT wrap code in markdown code blocks.
          5. DEPENDENCY AWARENESS: If a file has a 'dependsOn' field listing imports, ensure that
            the converted output references the converted filenames and function signatures — not
            the original source names. Converted imports must resolve to other converted files.
          6. CONVERSION NOTES: For each file, populate the 'notes' field with a concise bulleted
            list of the key decisions you made (e.g. "mapped fs → pathlib", "dropped async because
            no async I/O present", "3 closure patterns rewritten as classes"). This helps the
            developer understand and trust the output.`,
        `{ "files": [{ "sourceId": "string|number", "fileName": "string", "content": "string", "notes": "string (bulleted decisions, use \\n for line breaks)" }] }`
      );
    },
    user: (input) =>
      `Translate the following files. Each file has a "sourceId" — copy it verbatim into its output object.\n\nFiles:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.converter,
  },

  generator: {
    system: (ctx) => {
      const language = ctx?.language || 'Auto-detect';
      const framework = ctx?.framework || 'None';
      const architecture = ctx?.architecture || 'Standard';
      const verbosity = ctx?.verbosity || 'production';
      const customStack = ctx?.customStack?.trim();

      const verbosityRule =
        verbosity === 'beginner' ? 'Every block of logic MUST have an inline comment explaining what it does and why. Use the simplest constructs available.' :
          verbosity === 'poc' ? 'Write the minimum code that works. No error handling, no edge cases, no boilerplate. Speed over correctness.' :
            'Include error handling, input validation, and edge-case guards on every public function.';

      const docRules = [
        ctx?.includeReadme ? 'MUST output a README.md file. It must cover: purpose, setup, usage, and environment variables.' : null,
        ctx?.includeDocs ? 'MUST add JSDoc / docstrings to every exported function and class.' : null,
        ctx?.includeTests ? 'MUST output a test file (e.g. *.test.ts / test_*.py). Cover the main happy path and at least one failure case per function.' : null,
      ].filter(Boolean);

      return withSchema(
        `You are a code generator. Output ONLY what the rules below specify.
        RULES — every rule is mandatory and overrides your defaults:
        [LANGUAGE]   All files MUST be written in: ${language}
                    Do NOT output files in any other language, even if the prompt implies it.
        [FRAMEWORK]  Use this framework/runtime: ${framework}
                    Do NOT introduce any other framework or routing library.
        [ARCH]       Follow this architectural pattern: ${architecture}
        [VERBOSITY]  ${verbosityRule}
        [STACK]      ${customStack ? `Only use these additional libraries/tools: ${customStack}. Do not add anything else.` : 'Use only the standard library of the chosen language/framework. No extra dependencies.'}
        [FILES]      Use the correct file extensions for ${language}. No mixing of languages.
                    Raw code only in every file — no markdown fences, no commentary outside of code.
        ${docRules.length ? '\n[EXTRAS]\n' + docRules.map(r => `             - ${r}`).join('\n') : ''}`,
        `{ "files": [{ "fileName": "string", "content": "string (raw code, no backticks)" }] }`
      );
    },
    user: (input) => `Generate code for the following requirements:\n\n${input}`,
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
    system: (ctx = {}) => {
      const taskMap = {
        builder: `Generate an optimised ${ctx.targetLang} query based on the user requirement.`,
        converter: `Convert the provided ${ctx.sourceLang} query into perfect ${ctx.targetLang}.`,
        optimizer: `Analyse and optimise this ${ctx.targetLang} query for maximum performance.`,
        mock: (
          `Generate 5–10 rows of realistic mock data (INSERT INTO statements) based strictly on the provided schema. ` +
          (ctx.targetLang === 'SQLite'
            ? `CRITICAL: Output MUST be strictly valid SQLite syntax (no dialect-specific types or functions).`
            : `Use valid ${ctx.targetLang} syntax. Ensure INSERT statements are compatible with the target dialect.`)
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
          `- Put accuracy notes, caveats, or assumptions in the 'explanation' field (HTML formatted).` +
          `\n- Quality Mode: ${ctx.qualityMode === 'high'
            ? 'Produce detailed, edge-case-rich results with varied data distributions.'
            : 'Produce straightforward representative results.'}`
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

  mock: {
    system: (ctx) => {
      const dqInstruction = ctx?.dataQuality < 100
        ? `CRITICAL: Data Quality is set to ${ctx.dataQuality}%. Intentionally inject edge cases, nulls, empty strings, and boundary values (e.g., 0, -1) into approximately ${100 - ctx.dataQuality}% of the records to stress-test validation logic.`
        : `Ensure 100% data quality. No nulls or edge cases unless explicitly requested in the schema.`;
      const seedInstruction = ctx?.seed
        ? `Seed provided: ${ctx.seed}. Use this as the cryptographic seed for your internal pseudo-random generation to ensure deterministic, repeatable outputs.`
        : `No explicit seed provided. Generate randomly.`;
      const analysisInstruction = ctx?.includeAnalysis
        ? `5. In 'parsedRules', echo back a concise list of the custom rules and FK relationships you successfully mapped.\n        6. Provide an 'explanation' detailing constraints handled or anomalies caught.`
        : `5. In 'parsedRules', echo back a concise list of the custom rules and FK relationships you successfully mapped.\n        6. CRITICAL: DO NOT generate the 'explanation' field. Omit it entirely.`;
      const sampleInstruction = ctx?.isSample
        ? `IMPORTANT: The row count below is a statistical SAMPLE, not the final dataset size — a separate process will extrapolate additional rows afterward from the patterns you return. Make sure any percentage/distribution rules are reflected proportionally *within this sample*, so those proportions extrapolate reliably.`
        : '';
      return withSchema(
        `You are an Expert Database Architect and QA Data Synthesis Specialist.
      Your Task: Transform data schemas into highly realistic, interconnected mock datasets.
      RELATIONAL & GENERATION GUIDELINES:
      1. Maintain rigid foreign key references. If Table B references Table A, foreign keys must exactly map back to matching generated rows.
      2. Respect Custom Annotations: If a column has comments like @faker:creditCard or @regex:[A-Z]{3}-\\d{4}, generate data strictly matching that format.
      3. ${dqInstruction}
      4. Apply behavioral distributions, conditional chronology ranges, and values described inside the rules parameters.
      ${seedInstruction}
      ${analysisInstruction}
      ${sampleInstruction}`,
        `{
        "tables": [ { "tableName": "string", "rows": [ { "column_name": "value" } ] } ],
        "parsedRules": ["string"]${ctx?.includeAnalysis ? `,\n          "explanation": "string (HTML)"` : ''}
      }`
      )
    },
    user: (input, ctx) => {
      const rulesText = ctx?.rules ? `\n- Custom Rules: ${ctx.rules}` : '';
      const rowCountLine = ctx?.isSample
        ? `- Sample Size: generate a representative sample of ${ctx?.rowCount || 15} rows per entity (this is NOT the final row count — do not pad, truncate, or treat it as a hard target)`
        : `- Target Row Count: ${ctx?.rowCount || 15} rows per entity`;
      return `Database Layout Specification:\n${input}
    
    CRITICAL CONSTRAINTS FOR THIS RUN:
    ${rowCountLine}
    - Localization: ${ctx?.locale || 'en-US'}
    - Data Quality: ${ctx?.dataQuality ?? 100}%${rulesText}`;
    },
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.mock,
  },

  'api-mocks': {
    system: (ctx) => {
      const frameworkGuide = {
        msw: `Generate MSW v2 (msw@^2) handlers using the 'http' and 'HttpResponse' imports.
        - Each handler must be a self-contained call: http.get('/path', resolver), etc.
        - Use HttpResponse.json(fixtureData, { status: N }) for responses.
        - If delayMs > 0, wrap the resolver body with: await delay(${ctx?.delayMs ?? 0})
        - Export a single handlers array: export const handlers = [...].`,

        nextjs: `Generate Next.js 14+ App Router Route Handlers.
        - Each file exports named async functions: export async function GET(request) { ... }
        - Use NextResponse.json(data, { status: N }) from 'next/server'.
        - Include the file path comment at the top of each handler, e.g. // app/api/users/route.ts
        - Group related CRUD handlers into the same file comment block.`,

        axios: `Generate Axios Mock Adapter handler registrations.
        - Each handler is a mock.onGet/onPost/etc. call on the 'mock' adapter instance.
        - Assume: import MockAdapter from 'axios-mock-adapter'; const mock = new MockAdapter(axios, { delayResponse: ${ctx?.delayMs ?? 0} });
        - Use mock.onGet('/path').reply(status, fixtureData) pattern.
        - Export a setupMocks() function containing all registrations.`,

        json: `Generate only JSON fixture objects — no framework code.
        - The 'code' field should be a well-commented JSON string (using // comments) describing the shape.
        - Use realistic, deeply nested data with proper types and values.
        - Include a helpful comment header: // GET /api/users — 200 OK`,
      };

      const authNote = ctx?.authStyle !== 'none'
        ? `AUTH: Simulate ${ctx.authStyle} authentication. For ${ctx.authStyle === 'bearer' ? 'Bearer/JWT' : ctx.authStyle === 'apikey' ? 'API Key header' : 'session cookie'} protected routes, include a guard comment or conditional check inside the handler that returns 401 when the header is absent.`
        : 'AUTH: No authentication simulation required.';

      const paginationNote = ctx?.paginationStyle !== 'none'
        ? `PAGINATION: Apply ${ctx.paginationStyle} pagination pattern. For list endpoints, include the appropriate pagination metadata in the fixture (${ctx.paginationStyle === 'offset' ? '{ data: [...], total, limit, offset }' :
          ctx.paginationStyle === 'cursor' ? '{ data: [...], nextCursor, hasMore }' :
            '{ data: [...], page, perPage, totalPages, totalItems }'
        }).`
        : 'PAGINATION: No pagination required.';

      const envPrefixNote = ctx?.envPrefix && ctx.envPrefix !== 'none'
        ? `ENV VARS: Use ${ctx.envPrefix} for all configurable values. Specifically:
           - Base URL: ${ctx.envPrefix}.API_BASE_URL (fallback: '/api')
           - Auth token names: ${ctx.envPrefix}.AUTH_HEADER_NAME where applicable
           - Any other environment-specific strings (API versions, tenant IDs) should also use ${ctx.envPrefix}.VARIABLE_NAME`
        : '';

      const errorNote = ctx?.errorRate > 0
        ? `ERROR VARIANTS: Every handler MUST include an 'errorVariants' array with at least one realistic error scenario. Each variant must have:
           - statusCode: appropriate HTTP error code (404 for not found, 422 for validation, 401 for unauthorized, 500 for server errors)
           - code: a complete handler code string returning the error response
           - fixtureData: a realistic error response body (e.g. { "error": "...", "message": "...", "code": "..." })
           Choose error types appropriate to the HTTP method: GET/DELETE → 404, POST/PUT/PATCH → 422 validation errors.
           Approximately ${ctx.errorRate}% of endpoints should also have a 500 server error variant.`
        : `ERROR VARIANTS: For each handler, include at least one 'errorVariants' entry with the most likely failure case (e.g. 404 for GET/:id, 422 for POST/PUT/PATCH). This array is always required.`;

      const typeNote = ctx?.includeTypes
        ? `TYPES: Prepend TypeScript interface/type definitions for request params and response shapes above each handler.`
        : '';

      const analysisNote = ctx?.includeAnalysis
        ? `5. In 'parsedSpec', list each endpoint resolved as a concise bullet: "GET /users → UserListResponse (paginated)".
         6. In 'explanation', provide an HTML-formatted coverage summary covering: endpoints generated, auth patterns, pagination, and any spec ambiguities resolved.`
        : `5. In 'parsedSpec', list each endpoint resolved as a concise bullet.
         6. CRITICAL: DO NOT include the 'explanation' field. Omit it entirely.`;

      return withSchema(
        `You are a Senior API Architect and Mock Infrastructure Specialist.
          Your Task: Transform API specifications into production-quality mock handlers with realistic fixture data.

          CRITICAL OUTPUT REQUIREMENTS (NON-NEGOTIABLE — violating these breaks the consuming app):
          - Every 'code' field must contain real, working code. NEVER return "", null, "// TODO", "...", or a comment-only placeholder.
          - Every 'fixtureData' field must be a populated, realistic object or array. NEVER return {}, [], or null.
          - If you are unsure of exact framework syntax, edge cases, auth details, or pagination shape, DO NOT omit the field or the handler — instead output the SIMPLEST possible correct version (e.g. a bare handler returning one static HttpResponse.json({...}) object). A minimal but non-empty handler is always required over a missing/blank one.
          - Never skip generating a handler because a feature (auth, pagination, errors) feels complex. Simplify that feature; do not drop the handler.
          - errorVariants is ALWAYS required and must contain at least one fully populated variant with real code and real fixtureData — never an empty array, never a variant with blank strings.
          - If you cannot fully resolve the spec, still generate ${ctx?.endpointCount ?? 5} best-guess endpoints with complete, non-empty fields rather than fewer endpoints with gaps.

          INPUT SPEC FORMAT: ${ctx?.detectedFormat ?? 'auto'} (${ctx?.detectedFormat === 'graphql' ? 'GraphQL SDL — derive REST-style handlers for each Query/Mutation field' :
          ctx?.detectedFormat === 'openapi' ? 'OpenAPI/Swagger definition — follow the paths and operations exactly' :
            ctx?.detectedFormat === 'typescript' ? 'TypeScript interfaces — infer CRUD endpoints from entity shapes' :
              ctx?.detectedFormat === 'json' ? 'JSON sample — infer entity shape and generate standard CRUD endpoints' :
                ctx?.detectedFormat === 'rest' ? 'Explicit REST spec — implement exactly as specified' :
                  'Auto-detected — infer the most appropriate endpoint structure'
        })
 
      TARGET FRAMEWORK: ${ctx?.framework ?? 'msw'}
      ${frameworkGuide[ctx?.framework ?? 'msw']}
 
      CONSTRAINTS:
      - Generate exactly ${ctx?.endpointCount ?? 5} endpoints covering meaningful CRUD/query operations.
      - ${authNote}
      - ${paginationNote}
      - ${errorNote}
      - ${typeNote ? `- ${typeNote}` : ''}
      - ${envPrefixNote ? `- ${envPrefixNote}` : ''}
      - Fixture data must be realistic: proper names, emails, UUIDs, ISO dates, monetary amounts — not "foo" or "string1".
      - Every 'code' field must be immediately copy-pasteable with no placeholders.
 
      OUTPUT RULES:
      1. One object per endpoint in the 'handlers' array.
      2. 'fixtureData' must be valid JSON that exactly matches the response the 'code' would return.
      3. 'statusCode' must be the primary success code (200 for GET/PUT/PATCH/DELETE, 201 for POST).
      4. 'delayMs' should be ${ctx?.delayMs ?? 0} for all handlers (0 = no delay).
      ${analysisNote}`,

        `{
        "handlers": [
          {
            "name": "string",
            "method": "GET | POST | PUT | PATCH | DELETE",
            "path": "/api/...",
            "description": "string",
            "statusCode": 200,
            "delayMs": 0,
            "code": "string (full framework-specific handler code)",
            "fixtureData": {},
            "errorVariants": [
              {
                "statusCode": 404,
                "code": "string (handler code returning this error)",
                "fixtureData": { "error": "string", "message": "string" }
              }
            ]
          }
        ],
        "parsedSpec": ["string"]${ctx?.includeAnalysis ? `,\n        "explanation": "string (HTML)"` : ''}
      }`
      );
    },
    user: (input) => `API Specification:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS['api-mocks'],
  },

  stream: {
    system: (ctx) => {
      const dqInstruction = ctx?.dataQuality < 100
        ? `CRITICAL: Data Quality is set to ${ctx.dataQuality}%. Intentionally inject edge cases into ~${100 - ctx.dataQuality}% of events: duplicate timestamps, missing optional fields, out-of-order sequence numbers, and boundary metric values (0, -1, NaN-like strings).`
        : `Ensure 100% data quality. All timestamps strictly valid ISO-8601. No missing required fields unless the schema marks them optional.`;

      const seedInstruction = ctx?.seed
        ? `Seed provided: "${ctx.seed}". Use this as a deterministic basis for all random choices — identical seed must produce identical output.`
        : `No seed provided. Generate randomly.`;

      const paradigmGuides = {
        telemetry: `Generate time-series metric events: CPU/memory/latency readings, counter increments, gauge snapshots. Include a numeric 'value' field and a 'unit' field on every event.`,
        access_log: `Generate HTTP access log events mirroring the Combined Log Format fields: method, path, status_code, response_time_ms, user_agent, ip. Status codes should follow realistic distributions (70% 2xx, 20% 3xx, 8% 4xx, 2% 5xx).`,
        journey: `Generate a chronological customer journey: each event represents one step in a user session (page_view → add_to_cart → checkout_start → purchase or abandonment). Preserve causal ordering: a purchase event can only follow a checkout_start by the same session_id.`,
        iot: `Generate IoT sensor readings: device_id, sensor_type, raw_value, unit, battery_level, signal_strength. Include occasional anomaly spikes (~5% of readings deviating >3σ from the mean).`,
        audit: `Generate immutable audit trail events: actor_id, action (CREATE|UPDATE|DELETE|LOGIN|LOGOUT|EXPORT), resource_type, resource_id, before_state (JSON or null), after_state (JSON or null), ip_address.`,
        custom: `Derive the event shape directly from the user's schema. Infer field types, relationships, and temporal patterns from the provided definition.`,
      };

      const paradigmNote = paradigmGuides[ctx?.streamParadigm ?? 'custom'] ?? paradigmGuides.custom;

      const formatGuide = {
        json: `Emit plain JSON objects. Each item in 'events' is a flat-to-moderately-nested JSON object.`,
        kafka: `Wrap each event as a Kafka message envelope: { "topic": "<streamName>", "partition": <0–3>, "offset": <sequential>, "key": "<partition_key_value>", "value": { ...event fields }, "headers": { "content-type": "application/json" } }`,
        eventbridge: `Wrap each event in AWS EventBridge envelope: { "version": "0", "id": "<uuid>", "source": "com.app.<streamName>", "detail-type": "<EventType>", "time": "<ISO8601>", "detail": { ...event fields } }`,
        cloudevents: `Wrap each event in CloudEvents v1.0 envelope: { "specversion": "1.0", "type": "com.app.<streamName>.<event_type>", "source": "/app/<streamName>", "id": "<uuid>", "time": "<ISO8601>", "datacontenttype": "application/json", "data": { ...event fields } }`,
        pubsub: `Wrap each event as a Google Pub/Sub message: { "messageId": "<string>", "publishTime": "<ISO8601>", "attributes": { "event_type": "<string>" }, "data": "<base64-encoded JSON string of event fields>" }`,
        kinesis: `Wrap each event as an AWS Kinesis record: { "sequenceNumber": "<sequential_string>", "approximateArrivalTimestamp": <epoch_ms>, "partitionKey": "<string>", "data": { ...event fields } }`,
      };

      const formatNote = formatGuide[ctx?.eventFormat ?? 'json'] ?? formatGuide.json;

      const wantStateMachine = ctx?.includeStateMachine === true || ctx?.includeStateMachine === 'true';
      const wantAnalysis = ctx?.includeAnalysis === true || ctx?.includeAnalysis === 'true';

      const stateMachineNote = wantStateMachine
        ? `STATE MACHINE: After generating events, you MUST include a 'stateMachine' field in your response. Format it as a Mermaid stateDiagram-v2 string listing every state and valid transition observed in the generated sequence (e.g. "idle --> active : session_start"). This must accurately reflect the transitions present in the emitted events — do not invent transitions that don't appear.`
        : `STATE MACHINE: Do NOT include the 'stateMachine' field. Omit it entirely.`;

      const analysisNote = wantAnalysis
        ? `ANALYSIS: You MUST include both 'parsedRules' and 'explanation' fields. In 'parsedRules', echo back the specific temporal rules and distributions applied as an array of bullet strings. In 'explanation', provide an HTML-formatted summary: streams generated, event count per stream, temporal patterns used, and any schema ambiguities resolved.`
        : `ANALYSIS: In 'parsedRules', echo back a concise bullet list of rules applied. CRITICAL: DO NOT generate the 'explanation' field. Omit it entirely.`;

      const schemaOptionalFields = [
        wantStateMachine ? `  "stateMachine": "string (Mermaid stateDiagram-v2) | object",` : null,
        `  "parsedRules": ["string"],`,
        wantAnalysis ? `  "explanation": "string (HTML)"` : null,
      ].filter(Boolean).join('\n');

      return withSchema(
        `You are an Expert Event Architect and Stream Data Synthesis Specialist.
      Your Task: Transform an event schema or state machine definition into a realistic, temporally coherent event stream.
 
      TECHNICAL CONSTRAINTS:
      - Stream Paradigm:  ${ctx?.streamParadigm ?? 'custom'} — ${paradigmNote}
      - Output Format:    ${ctx?.eventFormat ?? 'json'} — ${formatNote}
      - Events per Stream: ${ctx?.eventCount ?? 25}
      - Custom Rules:     ${ctx?.rules || 'None provided'}
      - ${seedInstruction}
 
      TEMPORAL GENERATION RULES:
      1. All timestamps must be ISO-8601 and strictly monotonically increasing within each stream unless the rules explicitly request out-of-order delivery.
      2. Respect causal ordering: if event B is logically caused by event A (e.g. a purchase follows a checkout), B's timestamp must be after A's timestamp for the same session/entity.
      3. If multiple streams are present, align cross-stream timestamps so correlated events (sharing a session_id, user_id, or trace_id) appear at plausible relative times.
      4. Apply all temporal rules from the CUSTOM RULES section precisely — burst patterns, business-hours clustering, quiet periods, etc.
      5. ${dqInstruction}
 
      REALISM RULES:
      6. Values must be realistic: proper UUIDs, real-looking email addresses, plausible metric ranges, coherent HTTP paths, valid ISO country codes. Never use "string1", "foo", or placeholder text.
      7. Numeric fields must have domain-appropriate ranges (e.g. HTTP latency 10–2000ms, CPU 0–100%).
      8. If the schema uses FK-style references (user_id linking sessions to users), the referenced IDs must form a consistent pool — don't generate a new random UUID for every single event.
 
      ${stateMachineNote}
      ${analysisNote}`,

        `{
        "streams": [
          {
            "streamName": "string",
            "events": [ { "timestamp": "ISO8601", "...field": "value" } ]
          }
        ],
        ${schemaOptionalFields}
      }`
      );
    },
    user: (input) => `Event Stream Specification:\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.stream,
  },



  // In-tool promps, not separate modules
  'fix-diff': {
    system: () => withSchema(
      `You are an expert code reviewer producing surgical, minimal fixes.
        Your Task: Given a specific issue found in code, return exactly the problematic snippet and its corrected version.
 
        Guidelines:
        - Extract the EXACT lines from the source that contain the problem — do not paraphrase or reformat them.
        - The "before" must be a verbatim slice of the source (5–20 lines max).
        - The "after" must be the corrected version of that same slice, with only the necessary change applied.
        - Do NOT rewrite surrounding code that is unrelated to the issue.
        - The "explanation" must be one concise sentence describing what changed and why.
        - CRITICAL: Do not hallucinate lines that are not in the source.`,
      `{
          "explanation": "string",
          "before": "string",
          "after": "string"
        }`
    ),
    user: (input, options) =>
      `Language: ${options.language}
        Severity: ${options.severity}
        Location: ${options.location}
        Issue: ${options.issue}
        Resolution guidance: ${options.resolution}
        
        SOURCE CODE:
        \`\`\`${options.language}
        ${input}
        \`\`\``,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.fix_diff,
  },

  formatter: {
    system: (ctx) => withSchema(
      `You are a Code Formatter. Your only job is to format the provided ${ctx?.lang || 'code'} for readability.

      Rules:
      1. DO NOT change any logic, variable names, or behaviour — formatting only.
      2. Fix indentation (use 2 spaces), normalize blank lines, align operators where idiomatic.
      3. Apply the standard style conventions for ${ctx?.lang || 'the language'} (e.g. PEP 8 for Python, gofmt style for Go).
      4. In 'changes', list only the categories of changes made (max 5 bullets). If nothing needed fixing, say so.
      5. Do NOT wrap code in markdown fences.`,
      `{ "content": "string (formatted code)", "changes": ["string"] }`
    ),
    user: (input) => `Format this code:\n\n${input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.formatter,
  },

  linter: {
    system: (ctx) => withSchema(
      `You are a Syntax Checker for ${ctx?.lang || 'code'}. Perform a strict syntax-only analysis.

      Rules:
      1. Check ONLY for syntax errors — undefined variables, type mismatches, and logic bugs are OUT OF SCOPE.
      2. For each error: provide the exact 1-based line number if determinable, and a clear message.
      3. Warnings are for non-fatal issues: deprecated syntax, shadowed names, or dialect quirks.
      4. If the code is syntactically valid, return valid: true and an empty errors array.
      5. Be precise — do not hallucinate errors that aren't there.`,
      `{ "valid": boolean, "errors": [{ "line": number|null, "col": number|null, "message": "string" }], "warnings": [{ "line": number|null, "col": number|null, "message": "string" }], "summary": "string" }`
    ),
    user: (input) => `Check this ${input.lang || 'code'} for syntax errors:\n\n${input.code || input}`,
    responseType: 'object',
    schema: OUTPUT_SCHEMAS.linter,
  },
};
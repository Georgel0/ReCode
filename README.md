# ReCode | AI Developer Suite

> **Write better code. Faster than ever.** The ultimate AI-powered playground for developers to convert, analyze, refactor, and generate code.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-white?logo=vercel)](https://recode-alpha.vercel.app/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)](https://firebase.google.com/)

---

## Live Demo
**[View the Live Application](https://recode-alpha.vercel.app/)**

---

## About The Project

**ReCode** is a comprehensive developer utility suite built with **Next.js 14 (App Router)**. It leverages AI models to solve day-to-day coding headaches. Whether you need to generate production-grade mock data from a DDL schema, audit a function for security vulnerabilities, translate code between programming languages, or build complex SQL queries from plain English — ReCode has a dedicated module for every boring task.

---

## Features & Tools

### Mock Data Factory
The flagship mock data engine. Paste your SQL DDL, OpenAPI/Swagger specs, GraphQL SDL, TypeScript interfaces, or JSON schemas and instantly generate realistic, relational, high-fidelity mock data across three paradigms:

- **API & Frontend Mocks** — Generate fully-functional mock server handlers with live, time-limited URLs. Supports multiple frameworks (Express, Fastify, MSW, MirageJS), pagination styles (offset, cursor, page-based), auth simulation (JWT, OAuth2, API Key), configurable error rates and response delays, and TypeScript type definition generation. Export as Postman collections, VS Code snippets, or ZIP project structures. Inline editing of handlers and fixture data, endpoint filtering, regeneration of individual handlers, and a built-in history system for rolling back.

- **Database Seeding** — Turn CREATE TABLE statements, Prisma schemas, or TypeORM definitions into fully populated relational datasets. Supports foreign key integrity (FKs resolve to generated parent PKs), behavioral rules with distribution controls (e.g., "75% of users must have the role 'Admin'"), locale-aware data (en-US, en-GB, de-DE, fr-FR, ja-JP), `@faker` annotations for column-level formatting (`@faker:creditCard`, `@faker:uuid`, etc.), configurable row counts, data quality sliders, seed locking for reproducibility, and an interactive ERD visualizer. Editable cells with right-click context menus, column filtering, sorting, per-row deletion, and per-cell regeneration. Export as CSV, JSON, SQL seeds, Prisma seed files, or TypeScript types.

- **Streaming & Events** — Generate time-series telemetry, access logs, customer journey events, and Kafka-ready event fixtures. Supports multiple paradigms (SSE, WebSocket, Kafka, Webhook), NDJSON/JSON output formats, state machine generation, configurable event counts, seed locking, data quality controls, and rule-based constraints (e.g., monotonically increasing timestamps, correlated `session_id` values). Visualize events as a table with column badges and distribution charts, a chronological timeline, an interactive replay player with speed controls, a correlated multi-stream view, and raw NDJSON output. Export as NDJSON, JSON, CSV, Kafka NDJSON, or copy-ready code snippets for Python, JavaScript, and cURL.

---

### Code Analysis & Security Auditor
Deep-dive into your codebase with a full-spectrum health audit across six dimensions:

- **Security Audit** — Detects injection vulnerabilities, unsafe data handling, hardcoded credentials, and authentication flaws.
- **Big O Complexity Analysis** — Visualizes time and space complexity per function with an interactive reference chart.
- **Bug Detection** — Catches logical errors, off-by-one mistakes, unhandled edge cases, and null-reference risks.
- **Best Practices Review** — Surfaces deviations from clean code principles with specific, actionable fix suggestions.
- **Architecture Review** — Identifies code smells, circular dependencies, god objects, and tight coupling.
- **Testing Coverage Hints** — Auto-generates edge case suggestions and unit test stubs.

Results are presented as a composite **Quality Score (0–100)** with a visual ring gauge, an executive summary, and tabbed detailed reports. Includes language auto-detection, an audit history log, an exportable HTML report, and a one-click "Optimize Code" button that routes findings directly into the Refactor module.

---

### Code Converter
Translate source code across over 20 programming languages with semantic awareness — going beyond find-and-replace to correctly translate loops, classes, control flow, and idioms. Key features include:

- **Multi-File Support** — Upload or create multiple source tabs, convert them all in a single run with cross-file import resolution.
- **Partial (Block-Only) Conversion** — Select specific lines via drag-to-select and convert only that block.
- **Framework-Aware Output** — Target specific frameworks: Vanilla, React, Angular, Vue.js, Svelte, Express, Fastify.
- **Side-by-Side Diff View** — Review every change with a full diff panel before accepting results.
- **Conversion History & Notes** — Browse past conversions, restore earlier versions, and review per-file conversion notes.
- **Feedback Loop** — Provide natural-language feedback on a bad conversion and the AI revises it on the spot.
- **Syntax Checking & Formatting** — Built-in linter and code formatter for output quality assurance.
- **One-Click Pipelines** — Route converted output directly into Code Analysis for auditing or Code Refactor for cleanup.
- **Export** — Download individual files, ZIP archives, or copy to clipboard.

---

### Code Refactor
Transform tangled, hard-to-maintain code into clean, professional source with four targeted modes:

- **Clean Mode** — Reduces nesting, simplifies complex conditionals, and improves readability.
- **Performance Mode** — Refactors loops and data handling to reduce memory footprint and execution time.
- **Modernize Mode** — Replaces legacy patterns with ES6+, async/await, and current language idioms.
- **Documentation Mode** — Generates clear JSDoc/TSDoc-style comments for functions, parameters, and non-obvious logic blocks.

Multi-file support with consistent cross-file naming, a project context input for stack-specific tailoring, sync-scroll between source and output, a full diff panel to review changes, and ZIP download for the complete refactored project.

---

### Code Generator
Bridge the gap between thought and execution. Describe your requirements in plain English — from a single function to a full multi-file project — and the AI scaffolds the complete solution. Supports framework-aware generation (Next.js, React, Express, and more), multi-file architecture with logically separated files, configurable presets (language, framework, style), ZIP export of the entire generated project, and inline editing of generated files before download.

---

### CSS Framework Converter
Modernize your styling workflow by converting between CSS frameworks and utility-class systems. Paste raw CSS, HTML with inline styles, or framework-specific code and convert to:

- Tailwind CSS (v3 utility classes)
- Bootstrap (component classes)
- SCSS/SASS (nested, variables)
- LESS
- UnoCSS
- Pure CSS

Includes an HTML+CSS live preview pane, a context input for custom conversion instructions (e.g., "Use REM units", "Primary color is blue"), per-selector result cards with one-click copy, and file upload support for `.css`, `.html`, `.jsx`, and `.tsx` files.

---

### SQL Builder
Design, convert, optimize, and execute SQL queries without memorizing exact syntax:

- **Natural Language to SQL** — Describe what data you need in plain English and get a valid, optimized query.
- **Dialect Conversion** — Translate queries between 10+ dialects including PostgreSQL, MySQL, SQL Server, Oracle, SQLite, and BigQuery.
- **Query Optimization** — Submit existing queries to receive execution plan improvements and indexing suggestions.
- **Schema-Aware Generation** — Provide your table schema for contextually accurate queries with correct column names.
- **Built-In Test Runner** — Execute generated queries against an in-browser SQL sandbox (DuckDB-WASM & PGLite) with auto-generated test data.
- **ER Diagram Visualizer** — Parse your schema into an interactive entity-relationship diagram.
- **Workspace System** — Save and switch between multiple schema/query workspaces.

---

### Regex Generator
Describe the pattern you want to match in natural language and receive a syntactically correct regular expression with:

- **Token-Level Breakdown** — Every character, quantifier, and group explained in human-readable detail.
- **Live Test Cases** — Add test strings with match/ban expectations. Real-time highlighting shows exactly what your regex captures — green for passes, red for failures.
- **Multi-Flavor Support** — Generates patterns compatible with JavaScript, Python, and PCRE (PHP/Go) engines.
- **Flag Controls** — Toggle global, case-insensitive, multiline, and dotall flags with real-time feedback.
- **Refine Mode** — Iterate on an existing pattern by describing what to change, rather than starting from scratch.
- **Built-In Cheatsheet** — Reference modal covering anchors, quantifiers, groups, character classes, lookaheads/lookbehinds, and more.

---

### JSON Formatter & Repair Tool
More than a prettifier — a complete JSON manipulation workbench:

- **AI-Powered Auto-Repair** — Detects and fixes common syntax errors: missing commas, unquoted keys, trailing commas, and broken nesting that standard formatters fail on.
- **Multiple View Modes** — Switch between Code (with syntax highlighting), interactive Tree (expand/collapse/edit), structural Diff (A vs B comparison), and Zod Schema generation.
- **JSONPath Querying** — Run JSONPath expressions against your output with highlighted result paths.
- **Format Conversion** — Convert to/from YAML, TOML, and CSV in a single click.
- **Schema Validation** — Paste a JSON Schema to validate your output with detailed error paths.
- **URL & cURL Import** — Fetch JSON directly from a URL or paste a cURL command to import API responses.
- **Sort Keys & Auto-Format** — Toggle alphabetical key sorting and automatic formatting on paste.
- **Minify & Prettify** — Instant toggling between compact and indented output.
- **Session History** — Restore any previous formatting session from the local history panel.
- **Download** — Export as JSON, YAML, TOML, or Zod TypeScript schema.

---

## Key Highlights

- **Collapsible Mini Sidebar** — A space-efficient navigation pattern for desktop, with a fully responsive mobile layout.
- **Theme Engine** — Three custom dark themes and three light themes with dynamic CSS variable switching.
- **Smart History & Draft Persistence** — Auto-saves your work to Firebase Firestore with configurable auto-save toggles, plus local IndexedDB draft persistence so you never lose progress between sessions.
- **Dual AI Modes** — Switch between **Fast Mode** (speed-optimized) and **Quality Mode** (reasoning-optimized) depending on task complexity.
- **Cross-Tool Pipelines** — Route output from one tool directly into another. For example: convert code → audit the result → refactor the findings — all without copy-pasting.
- **Shareable State** — Every tool supports URL-encoded state sharing via a `?share=` parameter. Share your prompt and config (never your output), and the recipient generates fresh results from your exact setup.
- **Export Everywhere** — ZIP archives, individual files, clipboard copy, Postman collections, VS Code snippets, CSV, JSON, NDJSON, SQL seeds, Prisma seeds, TypeScript types — every tool provides multiple export paths.

---

## Tech Stack

### Frontend
- **[Next.js 14](https://nextjs.org/)** (App Router, React 18) — Server-side rendering, file-based routing, and React Server Components
- **[FontAwesome](https://fontawesome.com/)** — Icon library

### AI & LLM Integration
- **[Vercel AI SDK](https://sdk.vercel.ai/)** (`ai` v6) — Unified streaming AI interface
- **[@ai-sdk/openai](https://www.npmjs.com/package/@ai-sdk/openai)** — OpenAI provider (GPT models)
- **[@ai-sdk/groq](https://www.npmjs.com/package/@ai-sdk/groq)** — Groq provider (fast inference via LPU)
- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)** — Google Gemini API
- **[groq-sdk](https://www.npmjs.com/package/groq-sdk)** — Direct Groq SDK for specialized workloads

### Backend & Data
- **[Firebase](https://firebase.google.com/)** — Firestore for real-time history sync, Anonymous Auth for user sessions
- **[Vercel](https://vercel.com/)** — Hosting, Edge Network, Analytics, and Speed Insights
- **[Redis](https://redis.io/)** (`redis` v6) — Caching and session management

### In-Browser Data Engines
- **[DuckDB-WASM](https://duckdb.org/)** — In-browser analytical SQL engine for the SQL Builder's test runner
- **[PGLite](https://pglite.dev/)** (`@electric-sql/pglite`) — Lightweight PostgreSQL-compatible engine running entirely in the browser
- **[sql.js](https://sql.js.org/)** — SQLite compiled to WebAssembly for sandboxed query execution

### Code Processing & Visualization
- **[Prism.js](https://prismjs.com/)** & **[Highlight.js](https://highlightjs.org/)** — Syntax highlighting
- **[react-syntax-highlighter](https://www.npmjs.com/package/react-syntax-highlighter)** — Code block rendering
- **[react-simple-code-editor](https://www.npmjs.com/package/react-simple-code-editor)** — Lightweight code editing surface
- **[react-diff-viewer-continued](https://www.npmjs.com/package/react-diff-viewer-continued)** — Side-by-side diff visualization
- **[Mermaid](https://mermaid.js.org/)** (`mermaid` v11) — Diagram generation (ERD, state machines)
- **[Recharts](https://recharts.org/)** — Charting library for distribution visualizations
- **[react18-json-view](https://www.npmjs.com/package/react18-json-view)** — Interactive JSON tree viewer with edit support

### Data Formatting & Repair
- **[jsonrepair](https://www.npmjs.com/package/jsonrepair)** — Automatic JSON error fixing
- **[json5](https://www.npmjs.com/package/json5)** — Relaxed JSON parsing (comments, trailing commas)
- **[sql-formatter](https://www.npmjs.com/package/sql-formatter)** — SQL pretty-printing
- **[DOMPurify](https://www.npmjs.com/package/dompurify)** — XSS sanitization for AI-generated HTML explanations
- **[zod](https://zod.dev/)** & **[zod-to-json-schema](https://www.npmjs.com/package/zod-to-json-schema)** — Schema validation and conversion

### Utilities
- **[JSZip](https://stuk.github.io/jszip/)** — Client-side ZIP generation for multi-file downloads
- **[file-saver](https://www.npmjs.com/package/file-saver)** — Trigger browser file downloads
- **[idb-keyval](https://www.npmjs.com/package/idb-keyval)** — IndexedDB key-value store for local draft persistence
- **[lodash](https://lodash.com/)** — Utility functions (debounce used for draft auto-save)
- **[nanoid](https://www.npmjs.com/package/nanoid)** — Unique ID generation
- **[diff](https://www.npmjs.com/package/diff)** — Text diffing for JSON structural comparison
- **[sonner](https://sonner.emilkowal.ski/)** — Toast notifications
- **[react-tooltip](https://react-tooltip.com/)** — Accessible tooltips

---

By Georgel0
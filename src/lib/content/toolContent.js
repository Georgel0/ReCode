/* Each tool has a footer, we store its data here so we dont have to hardcode anything in each tool. */
export const toolsContent = [
  {
    slug: 'code-analysis',
    title: 'AI Code Analysis & Security Auditor',
    heading: 'Optimize Your Code with AI-Powered Static Analysis',
    description: 'Instantly analyze source code for bugs, security vulnerabilities, and performance bottlenecks. Our AI auditor delivers a full-spectrum health report covering code quality, algorithmic complexity, architecture, and test coverage.',
    features: [
      { title: 'Security Audit', text: 'Detect injection vulnerabilities, unsafe data handling, and authentication flaws before they reach production.' },
      { title: 'Complexity Analysis', text: 'Visualize Big O time and space complexity with a detailed breakdown per function, backed by a reference chart.' },
      { title: 'Best Practices', text: 'Surface deviations from industry-standard clean code principles with specific, actionable fix suggestions.' },
      { title: 'Bug Detection', text: 'Catch logical errors, off-by-one mistakes, unhandled edge cases, and null-reference risks across your codebase.' },
      { title: 'Architecture Review', text: 'Identify code smells, tight coupling, and dependency issues that silently increase long-term maintenance cost.' },
      { title: 'Test Coverage Hints', text: 'Get auto-generated edge case suggestions and unit test stubs so you know exactly what to cover next.' }
    ],
    faq: [
      { question: 'What languages are supported?', answer: 'The auditor supports most popular languages including JavaScript, TypeScript, Python, Java, C++, Go, Rust, and more, with automatic language detection built in.' },
      { question: 'Does it check for security vulnerabilities?', answer: 'Yes — it specifically targets common security anti-patterns such as injection risks, insecure deserialization, hardcoded credentials, and unsafe API usage.' },
      { question: 'What does the quality score represent?', answer: 'The score (0–100) is a composite of security, bug density, complexity, and best-practice adherence. It gives you a quick signal of overall code health at a glance.' },
      { question: 'Can I export or share my audit results?', answer: 'Yes. You can export a formatted HTML report or copy the full audit as JSON directly from the results panel, making it easy to share with teammates or attach to a PR.' },
      { question: 'What is the Architecture tab?', answer: 'It surfaces structural issues like circular dependencies, god objects, and high coupling — problems that are easy to miss in reviews but compound over time.' },
      { question: 'Can I run the audit on converted code?', answer: 'Absolutely. The auditor integrates directly with the Code Converter — once a conversion finishes, you can route the output straight into a full audit without repasting anything.' },
      { question: 'Is there an audit history?', answer: 'Yes. Every audit is automatically saved to a local history log. You can browse past sessions, reload any snapshot back into the editor, and track how your score evolves over time.' }
    ]
  },
  {
    slug: 'sql-builder',
    title: 'AI SQL Query Builder & Optimizer',
    heading: 'Generate and Optimize Complex SQL Queries Instantly',
    description: 'Transform natural language into structured SQL queries. Whether you need to build a new query, convert between dialects, or optimize slow executions, our AI handles PostgreSQL, MySQL, SQL Server, and more.',
    features: [
      { title: 'Natural Language to SQL', text: 'Describe what data you need in plain English and get a valid SQL query.' },
      { title: 'Dialect Conversion', text: 'Easily switch queries between MySQL, PostgreSQL, Oracle, and Snowflake.' },
      { title: 'Query Optimization', text: 'Submit existing queries to find execution plan improvements and indexing suggestions.' }
    ],
    faq: [
      { question: 'Can I provide my own schema?', answer: 'Yes, the tool allows you to input your table schema to ensure generated queries use correct column names.' },
      { question: 'Which dialects are supported?', answer: 'We support over 10 major dialects including Standard SQL, T-SQL, PL/SQL, and BigQuery.' }
    ]
  },
  {
    slug: 'regex-generator',
    title: 'AI Regular Expression Generator',
    heading: 'Create and Test Complex Regex Patterns with AI',
    description: 'Regex can be painful. Describe the pattern you want to match, and our tool will generate the expression for you, complete with a detailed explanation of how it works.',
    features: [
      { title: 'Pattern Explanation', text: 'Breaks down exactly what every character and quantifier in your regex is doing.' },
      { title: 'Live Testing', text: 'Test your generated regex against sample strings immediately within the tool.' },
      { title: 'Multi-language Syntax', text: 'Generates patterns compatible with JavaScript, Python, PHP, and more.' }
    ],
    faq: [
      { question: 'Is the regex tested for performance?', answer: 'The AI aims for efficient patterns to avoid catastrophic backtracking issues.' },
      { question: 'Can it handle complex lookaheads?', answer: 'Yes, it can generate advanced patterns including lookaheads, lookbehinds, and non-capturing groups.' },
      {
        question: "What is the cheatsheet for if we ask the AI to generate the regex anyway?",
        answer: "So you can actually learn something..."
      }
    ]
  },
  {
    slug: 'json-formatter',
    title: 'AI JSON Formatter & Repair Tool',
    heading: 'Clean, Format, and Fix Broken JSON Structures',
    description: 'More than just a prettifier. Our AI JSON tool can automatically detect and repair common syntax errors like missing commas, incorrect quotes, or trailing characters.',
    features: [
      { title: 'Auto-Repair Logic', text: 'Smart detection of syntax errors that standard formatters usually fail on.' },
      { title: 'Minification & Beautification', text: 'Toggle between compact minified code and readable, indented structures.' },
      { title: 'Structure Validation', text: 'Ensures your output strictly follows RFC 8259 standards.' }
    ],
    faq: [
      { question: 'Can it fix deeply nested errors?', answer: 'Yes, the AI understands the hierarchy and can often infer missing closing brackets in nested objects.' },
      { question: 'Is it safe for large files?', answer: 'It is optimized for standard API responses and configuration files.' }
    ]
  },
  {
    slug: 'css-converter',
    title: 'CSS Framework & Tailwind Converter',
    heading: 'Convert CSS to Tailwind, Bootstrap, or SASS Effortlessly',
    description: 'Modernize your workflow by converting raw CSS into utility classes or migrating between different frontend frameworks in seconds.',
    features: [
      { title: 'Tailwind Integration', text: 'Instantly map standard CSS properties to the nearest Tailwind CSS utility classes.' },
      { title: 'Cross-Framework Support', text: 'Convert styles between Bootstrap, SASS, LESS, and pure CSS.' },
      { title: 'Responsive Logic', text: 'Attempts to preserve media queries and responsive design patterns during conversion.' }
    ],
    faq: [
      { question: 'Does it support inline styles?', answer: 'Yes, you can paste HTML with inline styles and it will extract and convert them.' },
      { question: 'Is the Tailwind output customizable?', answer: 'The tool uses standard Tailwind v3 defaults for mapping classes. You can also set context for the AI for special requests.' }
    ]
  },
  {
    slug: 'code-refactor',
    title: 'AI Code Refactoring & Optimization',
    heading: 'Upgrade Your Codebase with Automated Refactoring',
    description: 'Improve the maintainability and performance of your code. Our tool identifies redundant logic, improves variable naming, and applies modern design patterns.',
    features: [
      { title: 'Clean Code Transformation', text: 'Focuses on readability, reducing nesting, and simplifying complex conditionals.' },
      { title: 'Performance Tuning', text: 'Refactors loops and data handling to reduce memory footprint and execution time.' },
      { title: 'Bug Prevention', text: 'Identifies and fixes common "code smells" that lead to runtime errors.' },
      { title: 'Modern Syntax Upgrades', text: 'Automatically replaces legacy patterns with ES6+, async/await, and current language idioms.' },
      { title: 'Inline Documentation', text: 'Generates clear JSDoc-style comments for functions, parameters, and non-obvious logic blocks.' }
    ],
    faq: [
      { question: 'Will it change my code logic?', answer: 'The AI is designed to preserve functional parity while improving the internal structure.' },
      { question: 'What is the "Dry Run" mode?', answer: 'It allows you to see the suggestions before applying them to your production files.' },
      { question: 'Which languages are supported?', answer: 'The tool supports JavaScript, TypeScript, Python, Java, C#, Go, and several other common languages.' },
      { question: 'Can I refactor multiple files at once?', answer: 'Yes. You can upload several files simultaneously and the AI processes each one, preserving cross-file naming consistency.' },
      { question: 'Is my code stored or used for training?', answer: 'No. Code you submit is processed in memory for the duration of the request and is never stored or used to train any model.' },
      { question: 'How do I get the best results?', answer: 'Select the refactor mode that matches your goal — Clean, Performance, Modernize, or Comments — and add a short project context note so the AI can tailor its output to your stack.' }
    ]
  },
  {
    slug: 'code-generator',
    title: 'AI Project & Code Snippet Generator',
    heading: 'Generate Full-Stack Boilerplates and Logic Instantly',
    description: 'Stop writing boilerplate from scratch. Describe your requirements—from a simple function to a full multi-file project—and let AI build the foundation.',
    features: [
      { title: 'Multi-File Architecture', text: 'Generates logically separated files (e.g., styles, logic, and components) ready for download.' },
      { title: 'ZIP Export', text: 'Download your entire generated project as a single ZIP file for immediate use.' },
      { title: 'Framework Aware', text: 'Understand modern frameworks like Next.js, React, and Express.' }
    ],
    faq: [
      { question: 'Can I generate a full app?', answer: 'You can generate significant portions and file structures for apps based on your prompts.' },
      { question: 'Is the code production-ready?', answer: 'It provides a very strong foundation, though we recommend a manual review of all AI-generated logic.' }
    ]
  },
  {
    slug: 'code-converter',
    title: 'Universal Code Translator & Converter',
    heading: 'Translate Code Between Any Programming Language',
    description: 'Migrating a project or learning a new stack? Convert snippets or entire files between languages — Python to TypeScript, Java to Kotlin, C++ to Rust — and get working, idiomatic output in seconds.',
    features: [
      { title: 'Syntax Mapping', text: 'Goes beyond find-and-replace — understands semantic differences so loops, classes, and control flow translate correctly.' },
      { title: 'Library Equivalents', text: 'Automatically suggests the closest standard library alternatives in the target language, not just raw syntax.' },
      { title: 'Multi-File Support', text: 'Upload multiple source files at once and convert them as a batch, with cross-file imports resolved automatically.' },
      { title: 'Partial Conversion', text: 'Select specific lines to convert instead of the whole file — useful when you only need to port a single function or block.' },
      { title: 'Diff View', text: 'See a side-by-side diff of source and output so you can review every change before using the result.' },
      { title: 'Conversion History', text: 'Each conversion is saved locally so you can compare outputs or roll back to an earlier version at any time.' }
    ],
    faq: [
      { question: 'Which languages are supported?', answer: 'Over 20 languages including Python, TypeScript, Rust, Go, Swift, Kotlin, C#, Java, PHP, Ruby, and more.' },
      { question: 'Can I convert multiple files at once?', answer: 'Yes — upload or paste several files and they will all be converted in a single run, with shared imports and dependencies taken into account.' },
      { question: 'How accurate is the output?', answer: 'For most common patterns the output is directly usable. Complex or language-specific idioms include conversion notes explaining any decisions made.' },
      { question: 'Is my code sent anywhere or stored?', answer: 'Code is processed in the moment and never stored on our servers. Your workspace is saved locally in your browser only.' },
      { question: 'Can I give feedback on a bad conversion?', answer: 'Yes — use the feedback bar below the output to describe what went wrong and the converter will revise it on the spot.' },
      { question: 'Does it work for partial snippets?', answer: 'Absolutely. You can paste a single function, a class, or even a few lines — it does not require complete, runnable files.' }
    ]
  },
  {
    slug: 'mock-generator',
    title: 'Enterprise Mock Data Factory',
    heading: 'Generate Relational, High-Fidelity Mock Data',
    description: 'Instantly generate interconnected rows of realistic data. Paste your SQL DDL, TypeScript interfaces, or JSON schemas, define behavioral rules, and get production-ready relational mock data.',
    features: [
      { title: 'Schema Inference', text: 'Automatically parses DDL, Prisma ORM, or TypeScript interfaces to understand data types.' },
      { title: 'Relational Integrity', text: 'Foreign keys intelligently map to generated primary keys across multiple tables.' },
      { title: 'Behavioral Rules', text: 'Define exact mathematical distributions, chronological date logic, and geographic localization.' }
    ],
    faq: [
      { question: 'Can I export to SQL?', answer: 'Yes, you can preview the data in the UI and export it as JSON, CSV, or raw SQL INSERT statements.' },
      { question: 'How are foreign keys handled?', answer: 'The AI maps the schema relations and ensures that IDs referenced in child tables actually exist in the generated parent tables.' }
    ]
  }];

/** @returns {Object|null} */
export const getToolContent = (slug) => {
  return toolsContent.find(tool => tool.slug === slug) || null;
};


// Landingpage info
export const tools = [
  {
    name: 'Code Converter',
    path: '/code-converter',
    icon: 'fas fa-rotate',
    desc: 'Translate logic across languages instantly.',
    info: 'Paste code in one language and get a working equivalent in another — classes, loops, idioms and all. Handles the structural differences between languages automatically, so you can focus on reviewing the output rather than rewriting it by hand. Useful for migrations, cross-team handoffs, or just picking up a new language faster.'
  },
  {
    name: 'Code Refactor',
    path: '/code-refactor',
    icon: 'fas fa-wand-magic-sparkles',
    desc: 'Clean, optimize, and modernize your snippets.',
    info: 'Transform tangled, hard-to-maintain code into clean, professional source. The AI eliminates redundant loops, flattens nested conditionals, enforces modern syntax (ES6+, async/await), and applies established design patterns to cut technical debt and keep your codebase easy to extend.'
  },
  {
    name: 'Code Analysis',
    path: '/code-analysis',
    icon: 'fas fa-search',
    desc: 'Deep-dive into complexity and security.',
    info: 'Run a full health audit on your code across six dimensions: Big O time/space complexity, security vulnerabilities, bug detection, best practices, architecture smells, and test coverage hints — all scored and exportable in one pass.'
  },
  {
    name: 'Code Generator',
    path: '/code-generator',
    icon: 'fas fa-cubes',
    desc: 'Generate boilerplate from natural language.',
    info: 'Bridge the gap between thought and execution. Describe your requirements in plain English (e.g., "A React hook for debounced API calls") and receive fully functional, documented code snippets ready to be dropped into your project.'
  },
  {
    name: 'CSS Converter',
    path: '/css-frameworks',
    icon: 'fab fa-css3-alt',
    desc: 'Convert raw CSS to Tailwind or modern frameworks.',
    info: 'Modernize your styling workflow by translating raw CSS properties into utility classes for Tailwind CSS, or structured SCSS/Bootstrap components. It maps standard layout rules to framework-specific shorthand instantly.'
  },
  {
    name: 'SQL Builder',
    path: '/sql-builder',
    icon: 'fas fa-database',
    desc: 'Design complex queries with AI precision.',
    info: 'Construct complex database queries without memorizing exact syntax. Describe the data you need in natural language, and the AI generates optimized SQL including Joins, CTEs, and Unions for PostgreSQL, MySQL, and more.'
  },
  {
    name: 'Regex Generator',
    path: '/regex-generator',
    icon: 'fas fa-asterisk',
    desc: 'Pattern matching made human-readable.',
    info: 'Regular expressions are notoriously difficult to write. Describe the pattern you want to match (e.g., "extract prices from a string") and receive the exact regex string along with a human-readable explanation of how the pattern works.'
  },
  {
    name: 'JSON Formatter',
    path: '/json-formatter',
    icon: 'fas fa-list-alt',
    desc: 'Fix and beautify messy data structures.',
    info: 'A utility for sanitizing data. Beyond simple indentation, this tool detects and fixes common syntax errors—like missing commas or unquoted keys—ensuring your JSON is valid and readable for APIs and config files.'
  },
  {
    name: 'Mock Data Factory',
    path: '/mock-generator',
    icon: 'fas fa-table-cells',
    desc: 'Generate relational, high-fidelity mock data.',
    info: 'Turn schemas into realistic, interconnected mock data with complex behavioral rules, geographical localization, and structural integrity.'
  }];


// Coding languages used across the app
export const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'jsx', label: 'JSX', ext: '.jsx' },
  { value: 'tsx', label: 'TSX', ext: '.tsx' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'mojo', label: 'Mojo', ext: '.mojo' },
  { value: 'java', label: 'Java', ext: '.java' },
  { value: 'c', label: 'C', ext: '.c' },
  { value: 'csharp', label: 'C#', ext: '.cs' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
  { value: 'go', label: 'Go', ext: '.go' },
  { value: 'rust', label: 'Rust', ext: '.rs' },
  { value: 'php', label: 'PHP', ext: '.php' },
  { value: 'swift', label: 'Swift', ext: '.swift' },
  { value: 'kotlin', label: 'Kotlin', ext: '.kt' },
  { value: 'ruby', label: 'Ruby', ext: '.rb' },
  { value: 'dart', label: 'Dart', ext: '.dart' },
  { value: 'zig', label: 'Zig', ext: '.zig' },
  { value: 'r', label: 'R', ext: '.r' },
  { value: 'scala', label: 'Scala', ext: '.scala' },
  { value: 'elixir', label: 'Elixir', ext: '.ex' },
  { value: 'haskell', label: 'Haskell', ext: '.hs' },
  { value: 'lua', label: 'Lua', ext: '.lua' },
  { value: 'plaintext', label: 'Plain Text', ext: '.txt' },
];
/* Each tool has a footer, we store its data here so we dont have to hardcode anything in each tool. */

export const toolsContent = [
{
 slug: 'code-analysis',
 title: 'AI Code Analysis & Security Auditor',
 heading: 'Optimize Your Code with AI-Powered Static Analysis',
 description: 'Instantly analyze source code for bugs, security vulnerabilities, and performance bottlenecks. Our AI auditor provides deep insights into code quality and algorithmic complexity.',
 features: [
  { title: 'Security Audit', text: 'Identify potential risks like injection vulnerabilities and unsafe data handling.' },
  { title: 'Complexity Analysis', text: 'Understand the Big O notation and time complexity of your functions.' },
  { title: 'Best Practices', text: 'Get suggestions based on industry-standard clean code principles.' }
 ],
 faq: [
  { question: 'What languages are supported?', answer: 'The analysis tool supports most popular languages including JavaScript, Python, Java, C++, and more.' },
  { question: 'Does it check for security?', answer: 'Yes, it specifically looks for common security anti-patterns and vulnerabilities.' }
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
  { question: "What is the cheatsheet for if we ask the AI to generate the regex anyway?",
   answer: "So you can actually learn something..." }
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
  { question: 'Is the Tailwind output customizable?', answer: 'The tool uses standard Tailwind v3 defaults for mapping classes.' }
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
  { title: 'Bug Prevention', text: 'Identifies and fixes common "code smells" that lead to runtime errors.' }
 ],
 faq: [
  { question: 'Will it change my code logic?', answer: 'The AI is designed to preserve functional parity while improving the internal structure.' },
  { question: 'What is the "Dry Run" mode?', answer: 'It allows you to see the suggestions before applying them to your production files.' }
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
 description: 'Migrating a project? Easily convert snippets or entire files from Python to JavaScript, Java to C#, or even legacy code to modern syntax.',
 features: [
  { title: 'Syntax Mapping', text: 'Deeply understands the semantic differences between languages for accurate translation.' },
  { title: 'Library Equivalents', text: 'Often suggests equivalent standard libraries in the target language.' },
  { title: 'Upload Support', text: 'Upload your source file directly to preserve formatting during conversion.' }
 ],
 faq: [
  { question: 'Which languages are supported?', answer: 'We support over 20 languages including Rust, Go, Swift, Mojo, and Kotlin.' },
  { question: 'Does it keep my prompts?', answer: 'Yes, you can save your code snippets to the history section and access then anytime.' }
 ]
}];

/** @returns {Object|null} */
export const getToolContent = (slug) => {
 return toolsContent.find(tool => tool.slug === slug) || null;
};
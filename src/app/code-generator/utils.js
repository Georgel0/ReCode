import { convertCode } from '@/lib/api';

export const EXTENSION_MAP = {
  js: 'javascript',
  jsx: 'react',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  css: 'css',
  json: 'json',
  md: 'markdown',
  py: 'python',
  c: 'c',
  cs: 'csharp',
  cpp: 'cpp',
  swift: 'swift',
  go: 'go',
  php: 'php',
  java: 'java',
  sql: 'sql',
  sh: 'bash',
  yml: 'yaml'
};

export const STYLING_OPTIONS = [
  'Tailwind CSS', 
  'CSS Modules', 
  'Styled Components', 
  'SCSS', 
  'Vanilla CSS',
  'None'
];

export const STATE_MANAGEMENT = [
  'None (Local State Only)', 
  'Redux Toolkit', 
  'Zustand', 
  'Context API',
  'Jotai'
];

export const VERBOSITY_LEVELS = [
  { value: 'beginner', label: 'Beginner (Heavily commented, step-by-step)' },
  { value: 'production', label: 'Production-Ready (Error handling, edge-cases)' },
  { value: 'poc', label: 'Proof of Concept (Minimal, fast, no boilerplate)' }
];


export const generateProjectFiles = async (input, config, options) => {
  // Pass the config directly as the context (ctx) parameter
  // instead of string-concatenating it into the user prompt.
  let result = await convertCode('generator', input, { 
    ...options, 
    context: config
  });

  // Frontend Failsafe Parsing
  if (result && result.files && result.files.length === 1 && result.files[0].fileName === 'index.txt') {
    const rawContent = result.files[0].content;
    if (rawContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.files) {
          result = parsed;
        }
      } catch (e) {
        console.warn("API failsafe parse failed:", e);
      }
    }
  }

  // String Escaping / Formatting
  if (result && result.files) {
    result.files = result.files.map(file => {
      let content = file.content;
      if (content && content.includes('\\n') && !content.includes('\n')) {
        content = content.replace(/\\n/g, '\n');
      }
      return { ...file, content };
    });
  }

  return result;
};

export const getLanguage = (fileName) => {
  if (!fileName) return 'javascript';
  const ext = fileName.split('.').pop().toLowerCase();
  return EXTENSION_MAP[ext] || 'javascript';
};
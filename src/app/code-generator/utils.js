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
  yml: 'yaml',
  rs: 'rust',
  rb: 'ruby'
};

export const FRAMEWORKS = [
  { value: 'None (Vanilla)', label: 'None (Vanilla)' },
  {
    value: 'React / Next.js', label: 'React / Next.js',
    subOptions: [
      { key: 'router', label: 'Router', options: ['React Router', 'Next.js App Router', 'Next.js Pages Router'] },
      { key: 'state', label: 'State Management', options: ['Context API', 'Zustand', 'Redux Toolkit', 'Jotai', 'Recoil'] },
      { key: 'styling', label: 'Styling', options: ['CSS Modules', 'Tailwind CSS', 'Styled Components', 'Emotion', 'Vanilla CSS'] },
    ],
  },
  {
    value: 'Vue / Nuxt', label: 'Vue / Nuxt',
    subOptions: [
      { key: 'router', label: 'Routing', options: ['Vue Router (SPA)', 'Nuxt Auto-routing'] },
      { key: 'state', label: 'State Management', options: ['Pinia', 'Vuex'] },
      { key: 'styling', label: 'Styling', options: ['Scoped CSS', 'Tailwind CSS', 'CSS Modules'] },
    ],
  },
  {
    value: 'Angular', label: 'Angular',
    subOptions: [
      { key: 'state', label: 'State Management', options: ['NgRx', 'Akita', 'Services'] },
      { key: 'styling', label: 'Styling', options: ['SCSS', 'Tailwind CSS', 'Angular Material'] },
    ],
  },
  {
    value: 'Svelte', label: 'Svelte',
    subOptions: [
      { key: 'router', label: 'Routing', options: ['SvelteKit', 'Client-side only'] },
      { key: 'styling', label: 'Styling', options: ['Scoped CSS', 'Tailwind CSS', 'Vanilla CSS'] },
    ],
  },
  {
    value: 'Django', label: 'Django',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL', 'MySQL', 'SQLite'] },
      { key: 'api', label: 'API Style', options: ['Django REST Framework', 'GraphQL (Strawberry)', 'Views only'] },
      { key: 'auth', label: 'Auth', options: ['Django Auth', 'JWT (SimpleJWT)', 'OAuth2 (social-auth)'] },
    ],
  },
  {
    value: 'Flask', label: 'Flask',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL (SQLAlchemy)', 'MongoDB', 'MySQL', 'SQLite'] },
      { key: 'api', label: 'API Style', options: ['Flask-RESTful', 'Blueprint routes', 'GraphQL'] },
    ],
  },
  {
    value: 'FastAPI', label: 'FastAPI',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL (SQLAlchemy)', 'MongoDB', 'Redis', 'SQLite'] },
      { key: 'auth', label: 'Auth', options: ['JWT (OAuth2)', 'API Key', 'None'] },
    ],
  },
  {
    value: 'Spring Boot', label: 'Spring Boot',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL', 'MySQL', 'MongoDB', 'H2 (In-Memory)'] },
      { key: 'build', label: 'Build Tool', options: ['Maven', 'Gradle'] },
    ],
  },
  {
    value: 'Express / Node.js', label: 'Express / Node.js',
    subOptions: [
      { key: 'database', label: 'Database', options: ['MongoDB (Mongoose)', 'PostgreSQL', 'MySQL', 'SQLite'] },
      { key: 'auth', label: 'Auth', options: ['JWT', 'Session', 'Passport.js', 'None'] },
    ],
  },
  {
    value: 'NestJS', label: 'NestJS',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL (TypeORM)', 'MongoDB', 'MySQL'] },
      { key: 'auth', label: 'Auth', options: ['JWT (Passport)', 'API Key', 'None'] },
    ],
  },
  {
    value: 'Laravel', label: 'Laravel',
    subOptions: [
      { key: 'database', label: 'Database', options: ['MySQL', 'PostgreSQL', 'SQLite'] },
      { key: 'auth', label: 'Auth', options: ['Sanctum', 'Passport', 'Breeze'] },
    ],
  },
  {
    value: '.NET Core', label: '.NET Core',
    subOptions: [
      { key: 'database', label: 'Database', options: ['SQL Server', 'PostgreSQL', 'SQLite'] },
      { key: 'pattern', label: 'API Pattern', options: ['Minimal API', 'MVC Controllers', 'Razor Pages'] },
    ],
  },
  {
    value: 'Gin (Go)', label: 'Gin (Go)',
    subOptions: [
      { key: 'database', label: 'Database', options: ['PostgreSQL (GORM)', 'MySQL (GORM)', 'MongoDB'] },
      { key: 'auth', label: 'Auth', options: ['JWT', 'Session', 'None'] },
    ],
  },
];

export const ARCHITECTURE_PATTERNS = [
  'Standard / Minimal',
  'MVC (Model-View-Controller)',
  'Clean Architecture',
  'Microservices',
  'Event-Driven',
  'Serverless'
];

export const VERBOSITY_LEVELS = [
  { value: 'beginner', label: 'Beginner (Heavily commented, step-by-step)' },
  { value: 'production', label: 'Production-Ready (Error handling, edge-cases)' },
  { value: 'poc', label: 'Proof of Concept (Minimal, fast, no boilerplate)' }
];

const DEFAULTS = {
  language: 'Auto-Detect / Any',
  framework: 'None (Vanilla)',
  architecture: 'Standard / Minimal',
};

const normalizeConfig = (config) => ({
  ...config,
  language: config.language === DEFAULTS.language ? null : config.language,
  framework: config.framework === DEFAULTS.framework ? null : config.framework,
  architecture: config.architecture === DEFAULTS.architecture ? null : config.architecture,
});

export const generateProjectFiles = async (input, config, options) => {
  let result = await convertCode('generator', input, {
    ...options,
    ...normalizeConfig(config),
  });

  // Frontend Failsafe Parsing
  if (result && result.files && result.files.length === 1 && result.files[0].fileName === 'index.txt') {
    const rawContent = result.files[0].content;
    if (rawContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.files) result = parsed;
      } catch (e) {
        console.warn('API failsafe parse failed:', e);
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
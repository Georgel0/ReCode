import hljs from 'highlight.js/lib/common';
import { LANGUAGES } from '@/lib/content';

const HLJS_TO_APP = {
  'javascript': 'javascript', 'typescript': 'typescript',
  'python': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
  'cs': 'csharp', 'csharp': 'csharp', 'go': 'go', 'rust': 'rust',
  'ruby': 'ruby', 'php': 'php', 'swift': 'swift', 'kotlin': 'kotlin',
  'scala': 'scala', 'html': 'html', 'xml': 'html', 'css': 'css',
  'scss': 'scss', 'json': 'json', 'yaml': 'yaml',
  'bash': 'bash', 'shell': 'bash', 'sh': 'bash',
  'sql': 'sql', 'graphql': 'graphql', 'markdown': 'markdown',
  'javascriptreact': 'jsx', 'typescriptreact': 'tsx', 'jsx': 'jsx', 'tsx': 'tsx'
};

const LANG_HEURISTICS = [
  { lang: 'tsx', re: /(import\s+React|from\s+['"]react['"]).*?(interface|type)\b|:\s*React\.(FC|ReactNode|CSSProperties)/m },
  { lang: 'jsx', re: /(import\s+React|from\s+['"]react['"]|<\w+[^>]*\sclassName=["'{]|return\s+\(\s*<\w+|<>\s*<)/m },
  { lang: 'python', re: /^\s*(def |class |from .+ import\b|import\s+(pandas|numpy|matplotlib|django|flask|fastapi)\b|if __name__\s*==|@[\w.]+\s*\n)/m },
  { lang: 'java', re: /public\s+(class|interface|enum)\s+\w+|System\.out\.print|@Override|import\s+org\.springframework/ },
  { lang: 'csharp', re: /namespace\s+[\w.]+\s*\{|using\s+(System|UnityEngine|Microsoft)\b|\[(ApiController|SerializeField)\]/ },
  { lang: 'cpp', re: /#include\s*[<"]\w+(\.h)?[>"]|std::|cout\s*<<|\bvoid\s+(setup|loop)\(\)/ },
  { lang: 'ruby', re: /\bdef\s+\w+[\s\S]*?\bend\b|attr_(accessor|reader|writer)|<\s*ApplicationRecord/ },
  { lang: 'php', re: /<\?php|\$\w+\s*=|use\s+Illuminate\\|namespace\s+App\\Http\\/ },
  { lang: 'swift', re: /\bfunc\s+\w+.*->|import\s+(Foundation|SwiftUI)\b/ },
  { lang: 'rust', re: /\bfn\s+\w+\s*\(|let\s+mut\s+\w+|impl\s+\w+|use\s+std::/ },
  { lang: 'go', re: /^package\s+\w+|:=\s*|^import\s+\(/m },
  { lang: 'kotlin', re: /\bfun\s+\w+\s*\(|data\s+class\s+\w+/ },
  { lang: 'typescript', re: /:\s*(string|number|boolean|void|any|never)\b|interface\s+\w+\s*\{|type\s+\w+\s*=/ },
  { lang: 'html', re: /<!DOCTYPE\s+html>|<html\b|<body\b/i },
  { lang: 'css', re: /^[.#]?[\w-]+\s*\{[\s\S]*?^\}/m },
  { lang: 'json', re: /^\s*[{[]/ },
  { lang: 'sql', re: /\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|CREATE\s+TABLE)\b/i },
  { lang: 'yaml', re: /^[\w-]+:\s+\S/m },
  { lang: 'bash', re: /^#!\/bin\/(ba)?sh|\becho\b.+\bgrep\b/m },
];

export const detectLanguage = (code) => {
  if (!code || code.trim().length < 10) return 'plaintext';

  // Try fast regex heuristics first
  for (const { lang, re } of LANG_HEURISTICS) {
    if (re.test(code)) return lang;
  }

  // Fall back to hljs with a relevance threshold
  try {
    const hljs_langs = Object.keys(HLJS_TO_APP);
    const result = hljs.highlightAuto(code, hljs_langs);
    if (result.language && result.relevance >= 5) {
      return HLJS_TO_APP[result.language] ?? result.language;
    }
  } catch {
    // ignore
  }

  return 'plaintext';
};


export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

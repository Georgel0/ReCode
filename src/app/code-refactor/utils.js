import { LANGUAGES } from '@/lib';

export const sanitizeFilename = (name) => {
  // Removes path traversal and dangerous characters
  return name.replace(/["<>:/\\|?*\x00-\x1F]/g, '_').substring(0, 100);
};

export const validateFile = (file) => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File ${file.name} exceeds the 5MB limit.` };
  }
  return { valid: true };
};

export const REFACTOR_MODES = [
  { id: 'clean', label: 'Clean & Readability', desc: 'Improves naming, structure, and formatting.', icon: 'fa-solid fa-broom' },
  { id: 'perf', label: 'Performance', desc: 'Optimizes loops, memory usage, and complexity.', icon: 'fa-solid fa-gauge-high' },
  { id: 'modern', label: 'Modernize Syntax', desc: 'Updates legacy syntax to modern language features.', icon: 'fa-solid fa-rocket' },
  { id: 'comments', label: 'Add Comments', desc: 'Adds documentation and inline explanations.', icon: 'fa-solid fa-comment-dots' },
];

export const DEFAULT_REFACTOR_MODE = 'clean';

const VALID_MODE_IDS = new Set(REFACTOR_MODES.map((m) => m.id));

export const isValidRefactorMode = (modeId) => VALID_MODE_IDS.has(modeId);

export const resolveRefactorMode = (modeId) =>
  isValidRefactorMode(modeId) ? modeId : DEFAULT_REFACTOR_MODE;

// Map a filename's extension to a LANGUAGES[].value, falling back if unknown.
export const getLanguageFromFilename = (filename, fallback = 'plaintext') => {
  if (!filename || !filename.includes('.')) return fallback;
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return LANGUAGES.find((l) => l.ext === ext)?.value ?? fallback;
};

// Refactor mode suggestion — scores the code against weighted signals per
// mode and returns the strongest one, or null if nothing stands out.

const countMatches = (code, regex) => (code.match(regex) || []).length;

const MODERN_PATTERNS = [
  [/\bvar\s+/g, 2],
  [/\.then\s*\(/g, 2],
  [/\brequire\s*\(/g, 1.5],
  [/module\.exports/g, 1.5],
  [/function\s*\(\s*err\s*,/g, 2.5],
  [/==(?!=)|!=(?!=)/g, 1],
  [/\bnew\s+Promise\s*\(/g, 0.5],
  [/\.apply\s*\(|\.call\s*\(/g, 0.5],
];

const maxLoopNestingDepth = (lines) => {
  const loopOpenRegex = /\b(for|while)\s*\(/;
  let braceDepth = 0;
  const loopStack = [];
  let max = 0;

  for (const line of lines) {
    if (loopOpenRegex.test(line)) loopStack.push(braceDepth);

    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;

    while (loopStack.length && braceDepth < loopStack[loopStack.length - 1] + 1) {
      loopStack.pop();
    }
    max = Math.max(max, loopStack.length);
  }
  return max;
};

export const suggestRefactorMode = (code) => {
  if (!code || !code.trim()) return null;

  const lines = code.split('\n');
  const totalLines = lines.filter((l) => l.trim().length > 0).length;
  if (totalLines < 3) return null;

  const scores = { clean: 0, perf: 0, modern: 0, comments: 0 };

  for (const [regex, weight] of MODERN_PATTERNS) {
    scores.modern += countMatches(code, regex) * weight;
  }

  const nesting = maxLoopNestingDepth(lines);
  if (nesting >= 2) scores.perf += 3 * (nesting - 1);
  scores.perf += countMatches(code, /\.(indexOf|includes|find|findIndex)\s*\(/g) * 0.4;
  scores.perf += countMatches(code, /JSON\.parse\s*\(\s*JSON\.stringify/g) * 2;

  const commentLines = lines.filter((l) => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
  const commentRatio = commentLines / totalLines;
  const functionCount = countMatches(code, /\bfunction\b/g) + countMatches(code, /=>/g);

  if (totalLines > 15 && commentRatio < 0.05) scores.comments += 2;
  if (functionCount > 2 && commentRatio < 0.1) scores.comments += Math.min(functionCount * 0.5, 3);

  scores.clean += countMatches(code, /\b(?:let|const|var)\s+(?:tmp\d*|temp\d*|foo|bar|baz|val\d*|data\d*|[a-z]\d?)\b/g);

  const deepIndentLines = lines.filter((l) => {
    const m = l.match(/^(\s+)/);
    return m && m[1].replace(/\t/g, '  ').length >= 8;
  }).length;

  scores.clean += (deepIndentLines / totalLines) * 10;
  if (functionCount > 0 && totalLines / functionCount > 40) scores.clean += 2;
  scores.clean += Math.min(countMatches(code, /[^\w.](?:[2-9]\d*|\d{2,})(?!\w)/g) * 0.25, 3);

  const THRESHOLD = 2.5;
  let bestMode = null;
  let bestScore = THRESHOLD;
  
  for (const [mode, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMode = mode;
    }
  }
  return bestMode;
};
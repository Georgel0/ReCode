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

export const suggestRefactorMode = (code) => {
  if (!code) return 'clean';
  if (code.includes('var ') || code.includes('.then(') || code.includes('require(')) return 'modern';
  if (code.match(/for\s*\(.*for\s*\(/)) return 'perf';
  if (!code.includes('//') && !code.includes('/*')) return 'comments';
  return 'clean';
};

export const REFACTOR_MODES = [
  { id: 'clean', label: 'Clean & Readability', desc: 'Improves naming, structure, and formatting.' },
  { id: 'perf', label: 'Performance', desc: 'Optimizes loops, memory usage, and complexity.' },
  { id: 'modern', label: 'Modernize Syntax', desc: 'Updates legacy code.' },
  { id: 'comments', label: 'Add Comments', desc: 'Adds documentation.' },
];
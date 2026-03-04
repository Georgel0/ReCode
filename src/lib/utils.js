import hljs from 'highlight.js/lib/common';
import { LANGUAGES } from '@/lib';

export const detectLanguage = (code) => {
  if (!code || code.trim().length < 5) return 'unknown';

  const checkList = LANGUAGES.map(lang => lang.value);

  try {
    const result = hljs.highlightAuto(code, checkList);
    return result.language || 'unknown';
  } catch (e) {
    return 'unknown';
  }
};
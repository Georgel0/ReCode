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

export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
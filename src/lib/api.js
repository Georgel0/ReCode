import { auth, initializeAuth } from '@/lib/firebase';

/**
 * Communicates with the AI Conversion API.
 * Handles Auth token injection, parameter normalization, and automatic retries.
 * @param {string} type - The operation type (e.g., 'code-analysis', 'sql-builder').
 * @param {string} input - The source code or text to process.
 * @param {string|Object} [arg3] - Source language string OR an options object.
 * @param {string|Object} [arg4] - Target language string OR an options object containing {mode, qualityMode}.
 * @param {string} [arg5='fast'] - Quality mode fallback ('quality', 'fast', 'turbo').
 * @returns {Promise<Object>} The AI-generated response.
 */
export const convertCode = async (type, input, arg3 = '', arg4 = '', arg5 = 'fast') => {
  let lastError;
  const MAX_RETRIES = 2;
  
  // Argument Normalization
  // Supports both positional arguments: (type, input, lang, target, quality)
  // and object-based arguments: (type, input, { sourceLang, targetLang, mode, qualityMode })
  let sourceLang = '';
  let targetLang = '';
  let mode = '';
  let qualityMode = 'fast';
  
  if (typeof arg3 === 'object' && arg3 !== null) {
    ({ sourceLang = '', targetLang = '', mode = '', qualityMode = 'fast' } = arg3);
  } else {
    sourceLang = arg3 || '';
    targetLang = typeof arg4 === 'string' ? arg4 : '';
    qualityMode = arg5 || 'fast';
    if (typeof arg4 === 'object' && arg4 !== null) {
      mode = arg4.mode || '';
      if (arg4.qualityMode) qualityMode = arg4.qualityMode;
    }
  }
  
  // Request Execution with Retry Logic
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // Ensure user is logged in (Anonymous or Permanent) to get a Bearer token
      let user = auth.currentUser;
      if (!user) {
        user = await initializeAuth();
      }
      
      const token = await user.getIdToken();
      if (!token) throw new Error("Could not retrieve Auth Token.");
      
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, input, sourceLang, targetLang, mode, qualityMode }),
      });
      
      // Handle raw text first to catch non-JSON server crashes
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
      }
      
      if (response.ok) return data;
      throw new Error(data.error || "Unknown Server Error");
      
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error);
      
      // Exponential backoff or simple delay between retries
      if (i < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  throw lastError;
};
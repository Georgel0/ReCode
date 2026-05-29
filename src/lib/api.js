import { auth, initializeAuth } from '@/lib/firebase';

/**
 * Communicates with the AI Conversion API.
 * @param {string} type - The operation type (e.g., 'analysis', 'sql', 'converter').
 * @param {string} input - The primary text or code payload to process.
 * @param {Object} [options={}] - Additional configuration (e.g., targetLang, qualityMode, schemas).
 * @returns {Promise<Object>} The AI-generated response.
 */
export const convertCode = async (type, input, options = {}) => {
  const MAX_RETRIES = 2;
  const { qualityMode = 'fast', ...restOptions } = options;

  let lastError;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      let user = auth.currentUser || await initializeAuth();
      const token = await user.getIdToken();
      
      if (!token) throw new Error("Could not retrieve Auth Token.");

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          input,
          qualityMode,
          ...restOptions 
        }),
      });

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
      console.error(`API Attempt ${i + 1} failed:`, error);
      if (i < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastError;
};
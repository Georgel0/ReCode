import { auth, initializeAuth } from '@/lib/firebase';

export const convertCode = async (type, input, arg3 = '', arg4 = '', arg5 = 'fast') => {
  let lastError;
  const MAX_RETRIES = 2;

  let sourceLang = '';
  let targetLang = '';
  let mode = ''; 
  let qualityMode = 'fast';

  if (typeof arg3 === 'object' && arg3 !== null) {
    sourceLang = arg3.sourceLang || '';
    targetLang = arg3.targetLang || '';
    mode = arg3.mode || '';
    qualityMode = arg3.qualityMode || 'fast';
  } else {
    sourceLang = arg3 || '';
    targetLang = typeof arg4 === 'string' ? arg4 : '';
    qualityMode = arg5 || 'fast';
    if (typeof arg4 === 'object' && arg4 !== null) {
      mode = arg4.mode || '';
      if (arg4.qualityMode) qualityMode = arg4.qualityMode; 
    }
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      let user = auth.currentUser;
      if (!user) {
        console.log("Waiting for Firebase Auth...");
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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
      }

      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || "Unknown Server Error");
      }

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastError;
};
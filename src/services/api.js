import { getAuth } from "firebase/auth";

export const convertCode = async (type, input, sourceLang = '', targetLang = '') => {
  let lastError;
  const MAX_RETRIES = 3;
  const auth = getAuth();

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;

      if (!token) throw new Error("User not authenticated.");

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, input, sourceLang, targetLang }),
      });

      // Read the raw text first
      const text = await response.text();

      // Try to parse it as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // If parsing fails, it means Vercel sent an HTML/Text error page (Crash/Timeout)
        throw new Error(`Server Error (${response.status}): ${text.slice(0, 100)}...`);
      }

      if (response.ok) {
        return data;
      } else {
        throw new Error(data.error || "Unknown Server Error");
      }

    } catch (error) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      // Don't retry if it's a 401 (Auth) or 500 (Server Crash) to avoid spamming
      if (error.message.includes("401") || error.message.includes("Server Error")) break;

      if (i < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  throw lastError;
};
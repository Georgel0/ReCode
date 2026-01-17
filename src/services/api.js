import { getAuth } from "firebase/auth";

export const convertCode = async (type, input, sourceLang = '', targetLang = '') => {
 let lastError;
 const MAX_RETRIES = 3;
 const auth = getAuth(); 
 
 for (let i = 0; i < MAX_RETRIES; i++) {
  try {
   // Get the current user's ID token securely
   // If the user isn't logged in (which shouldn't happen with anon auth), token will be null
   const user = auth.currentUser;
   const token = user ? await user.getIdToken() : null;

   if (!token) {
     throw new Error("User not authenticated. Cannot access API.");
   }

   // Send the token in the headers
   const response = await fetch('/api/convert', {
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
     'Authorization': `Bearer ${token}` // <--- This matches the check in convert.js
    },
    body: JSON.stringify({ type, input, sourceLang, targetLang }),
   });
   
   const responseBody = await response.json();
   
   if (response.ok) {
    return responseBody;
   } else {
    const error = responseBody.error || `Server Error (${response.status}): Unknown issue.`;
    throw new Error(error);
   }
   
  } catch (error) {
   lastError = error;
   console.error(`API attempt ${i + 1} failed:`, error.message);
   
   if (i < MAX_RETRIES - 1) {
    await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
   }
  }
 }
 
 throw lastError || new Error("API request failed after multiple retries. Check your network or Vercel logs.");
};
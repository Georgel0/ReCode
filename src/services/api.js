export const convertCode = async (type, input, sourceLang = '', targetLang = '') => {
 let lastError;
 const MAX_RETRIES = 3;
 
 for (let i = 0; i < MAX_RETRIES; i++) {
  try {
   const response = await fetch('/api/convert', {
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, input, sourceLang, targetLang }),
   });
   
   const responseBody = await response.json();
   
   // If the Vercel API returned a success status (200), return the result
   if (response.ok) {
    return responseBody;
   } else {
    // If the Vercel API returned an error status (4xx, 5xx)
    const error = responseBody.error || `Server Error (${response.status}): Unknown issue.`;
    throw new Error(error);
   }
   
  } catch (error) {
   lastError = error;
   console.error(`API attempt ${i + 1} failed:`, error.message);
   
   // Wait with exponential backoff before retrying
   if (i < MAX_RETRIES - 1) {
    await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000));
   }
  }
 }
 
 // If all retries fail, throw the last error to be caught by the module components
 throw lastError || new Error("API request failed after multiple retries. Check your network or Vercel logs.");
};
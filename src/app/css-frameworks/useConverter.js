import { useState, useCallback } from 'react';
import { convertCode } from '@/lib/api'; 

export function useConverter(qualityMode) {
 const [status, setStatus] = useState('idle'); 
 const [error, setError] = useState(null);
 const [data, setData] = useState(null);
 
 const convert = useCallback(async ({ activeMode, inputs, targetLang }) => {
  
  if (activeMode === 'css' && !inputs.css.trim()) {
   return setError('Please provide CSS to convert.');
  }
  if (activeMode === 'html' && !inputs.html.trim()) {
   return setError('Please provide HTML to convert.');
  }
  
  // Reset State
  setStatus('loading');
  setError(null);
  setData(null);
  
  try {
   // Construct Payload
   let payloadInput = inputs.css;
   
   if (activeMode === 'html') {
    payloadInput = `
          HTML:
          ${inputs.html}
          
          CSS TO APPLY:
          ${inputs.css}
          
          EXTRA CONTEXT:
          ${inputs.context}
        `;
   } else if (inputs.context) {
    payloadInput = `${inputs.css}\n\nCONTEXT:\n${inputs.context}`;
   }
   
   // API Call
   const result = await convertCode('css-framework', payloadInput, {
    sourceLang: 'css',
    targetLang,
    mode: activeMode,
    qualityMode
   });
   
   if (!result) throw new Error("No data returned");
   
   setData(result);
   setStatus('success');
  } catch (err) {
   setError(err.message || "Conversion failed");
   setStatus('error');
  }
 }, [qualityMode]);
 
 const reset = () => {
  setData(null);
  setError(null);
  setStatus('idle');
 };
 
 return {
  status,
  loading: status === 'loading',
  error,
  data,
  convert,
  reset,
  setData
 };
}
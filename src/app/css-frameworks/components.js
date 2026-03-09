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

export const TARGET_FRAMEWORKS = [
 { value: 'tailwind', label: 'Tailwind CSS' },
 { value: 'bootstrap', label: 'Bootstrap 5' },
 { value: 'sass', label: 'SASS/SCSS' },
 { value: 'less', label: 'LESS' },
];

export const MODES = [
 { id: 'css', label: 'CSS Only', icon: 'fab fa-css3-alt' },
 { id: 'html', label: 'HTML + CSS', icon: 'fa-brands fa-html5' }
];

export const generatePreviewDoc = (html, css, type) => {
 if (!html) return '';
 
 const CDNS = {
  tailwind: `<script src="https://cdn.tailwindcss.com"></script>`,
  bootstrap: `<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">`
 };
 
 return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${CDNS[type] || ''}
        <style>
          body { padding: 20px; font-family: sans-serif; }
          ${css || ''}
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;
};
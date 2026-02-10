'use client';

import { useState, useEffect, useRef } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';
import JSON5 from 'json5';
import ReactJson from 'react-json-view'; 

export default function JsonFormatter() {
 const [input, setInput] = useState('');
 const [outputCode, setOutputCode] = useState('');
 const [explanation, setExplanation] = useState('');
 const [loading, setLoading] = useState(false);
 const [copyFeedback, setCopyFeedback] = useState('Copy');
 const [errorMsg, setErrorMsg] = useState(null);
 const [lastResult, setLastResult] = useState(false);
 const [viewMode, setViewMode] = useState('code');
 const fileInputRef = useRef(null);
 const { moduleData, qualityMode } = useApp();
 
 const isDarkMode = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'json') {
   setInput(moduleData.input || '');
   const { code, info } = parseJsonResponse(moduleData.fullOutput);
   setOutputCode(code);
   setExplanation(info);
  }
 }, [moduleData]);
 
 const parseJsonResponse = (rawOutput) => {
  if (typeof rawOutput === 'object' && rawOutput !== null) {
   
   return {
    code: rawOutput.formattedJson || '',
    info: rawOutput.explanation || "JSON formatted successfully."
   };
  }
  
  try {
   // Fallback if the logic on the backend fails
   const cleanJson = (rawOutput || '').replace(/```json|```/g, '').trim();
   const parsed = JSON.parse(cleanJson);
   
   return {
    code: parsed.formattedJson || rawOutput,
    info: parsed.explanation || "JSON formatted and repaired."
   };
  } catch (e) {
   return { code: rawOutput || '', info: "AI formatted the JSON." };
  }
 };
 
 const handlePrettify = () => {
  if (!input.trim()) return;
  setErrorMsg(null);
  
  try {
   // Try Strict Parse first
   const parsed = JSON.parse(input);
   
   setOutputCode(JSON.stringify(parsed, null, 2));
   setExplanation("Valid JSON: Formatted successfully.");
  } catch (strictError) {
   // Try Loose Parse (JSON5) - Functional Enhancement
   try {
    const looseParsed = JSON5.parse(input);
    
    setOutputCode(JSON.stringify(looseParsed, null, 2));
    setExplanation("Loose JSON detected: Keys quoted and structure fixed via Client-side Logic (JSON5).");
   } catch (looseError) {
    // Fail with specific location
    const msg = looseError.message || strictError.message;
    // Attempt to extract line number for UX
    const match = msg.match(/line (\d+) column (\d+)/) || msg.match(/position (\d+)/);
    const loc = match ? ` at ${match[0]}` : '';
    
    setErrorMsg(`Invalid JSON${loc}: Use 'AI Fix' to repair syntax errors.`);
   }
  }
 };
 
 const handleMinify = () => {
  if (!input.trim()) return;
  setErrorMsg(null);
  try {
   // JSON5 to allow minifying loose objects
   const parsed = JSON5.parse(input);
   
   setOutputCode(JSON.stringify(parsed));
   setExplanation("JSON minified to a single line.");
  } catch (e) {
   setErrorMsg("Invalid JSON: Minification requires valid syntax.");
  }
 };
 
 const handleAiFix = async () => {
  if (!input.trim()) return;
  setLoading(true);
  setOutputCode('');
  setExplanation('');
  setErrorMsg(null);
  
  try {
   const result = await convertCode('json', input, { qualityMode });
   const { code, info } = parseJsonResponse(result);
   
   if (code) {
    setOutputCode(code);
    setExplanation(info);
    setLastResult({ type: "json", input, output: result });
   }
  } catch (error) {
   alert(`Fix failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const loadSample = () => {
  setInput('{\n  "status": "broken",\n  "error": "missing quotes and commas"\n  unquoted_key: 123\n  "list": [1, 2, 3,]\n}');
 };
 
 const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
   setInput(event.target.result);
   setErrorMsg(null);
  };
  
  reader.readAsText(file);
  // Reset input so same file can be selected again
  e.target.value = '';
 };
 
 const handleCopy = () => {
  if (outputCode) {
   navigator.clipboard.writeText(outputCode);
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback('Copy'), 2000);
  }
 };
 
 const getJsonForTree = () => {
  try {
   return outputCode ? JSON.parse(outputCode) : {};
  } catch (e) {
   return { error: "Cannot parse JSON for Tree View" };
  }
 };
 
 return (
  <div className="module-container">
   <ModuleHeader 
    title="JSON Formatter & Validator"
    description="Format instantly, or use AI to automatically repair broken JSON structures."
    resultData={lastResult}
   />

   <div className="converter-grid">
    <div className="panel">
     <div className="panel-header-row">
      <h3>Input JSON</h3>
      <div className="header-actions">
       <input 
        type="file" 
        accept=".json,.txt,.js" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden-input"
       />
       <button className="file-upload-btn" onClick={() => fileInputRef.current?.click()}>
         <i className="fa-solid fa-upload"></i> Upload
        </button>
        <button className="mode-btn" onClick={loadSample}>Load Sample</button>
       </div>
      </div>
      
      <textarea 
       value={input} 
       onChange={(e) => setInput(e.target.value)} 
       placeholder='Paste your JSON here or upload a file...' 
       spellCheck="false"
       className={errorMsg ? 'has-error json-textarea' : 'json-textarea'}
      />
      
      {errorMsg && <div className="error-message"><i className="fa-solid fa-circle-exclamation"></i> {errorMsg}</div>}
          
      <div className="action-row">
       <button className="primary-button secondary-action-btn" onClick={handleMinify} disabled={loading}>
        <i className="fa-solid fa-compress"></i> Minify
       </button>
       <button className="primary-button secondary-action-btn" onClick={handlePrettify} disabled={loading}>
        <i className="fa-solid fa-align-left"></i> Prettify
       </button>
       <button className="primary-button" onClick={handleAiFix} disabled={loading}>
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
        {loading ? 'Repairing...' : 'AI Fix & Format'}
       </button>
      </div>
     </div>

     <div className="panel">
      <div className="panel-header-row">
       <h3>Formatted Output</h3>
       <div className="view-mode-toggles">
        <button 
         className={`view-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
         onClick={() => setViewMode('code')}>
         <i className="fa-solid fa-code"></i> Code
        </button>
        <button 
         className={`view-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
         onClick={() => setViewMode('tree')}
         disabled={!outputCode}>
         <i className="fa-solid fa-folder-tree"></i> Tree
        </button>
       </div>
      </div>
          
      <div className="results-container">
       {outputCode ? (
        <>
         <div className="output-wrapper json-output-box"> 
          {viewMode === 'code' ? (
           <>
            <textarea 
             value={outputCode} 
             readOnly 
             className="output-textarea json-textarea"
             spellCheck="false"
            />
            <button className="copy-btn copy-btn-absolute" onClick={handleCopy}>
             <i className="fa-solid fa-copy"></i> {copyFeedback}
            </button>
           </>
          ) : (
           <div className="tree-view-container">
            <ReactJson 
             src={getJsonForTree()} 
             theme={isDarkMode ? "ocean" : "rjv-default"}
             iconStyle="triangle"
             displayDataTypes={false}
             enableClipboard={true}
            />
           </div>
          )}
         </div>

         {explanation && (
          <div className="ai-summary json-explanation">
           <strong><i className="fa-solid fa-clipboard-check"></i> Repair & Logic Log:</strong>
           <div className="explanation-content">{explanation}</div>
          </div>
        )}
       </>
      ) : (
       <div className="placeholder-text">
        {loading ? (
         <div className="processing-state">
          <div className="pulse-ring"></div>
          <p>AI is optimizing your JSON...</p>
         </div>
        ) : 'Clean JSON will appear here.'}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
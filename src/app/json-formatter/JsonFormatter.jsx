'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/services/api';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext'; 

export default function JsonFormatter({ onLoadData, qualityMode }) {
 const [input, setInput] = useState('');
 const [outputCode, setOutputCode] = useState('');
 const [explanation, setExplanation] = useState('');
 const [loading, setLoading] = useState(false);
 const [copyFeedback, setCopyFeedback] = useState('Copy');
 const [errorMsg, setErrorMsg] = useState(null);
 const [lastResult, setLastResult] = useState(false);
 
 const parseJsonReponse = (rawOutput) => {
  if (typeof rawOutput === 'object' && rawOutput !== null) {
   return {
    code: rawOutput.formattedJson || '',
    info: rawOutput.explanation || "JSON formatted successfully."
   };
  }
  
  try {
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
 
 useEffect(() => {
  if (onLoadData) {
   setInput(onLoadData.input || '');
   const { code, info } = parseJsonReponse(onLoadData.fullOutput);
   setOutputCode(code);
   setExplanation(info);
  }
 }, [onLoadData]);
 
 
 const handlePrettify = () => {
  if (!input.trim()) return;
  setErrorMsg(null);
  try {
   const parsed = JSON.parse(input);
   setOutputCode(JSON.stringify(parsed, null, 2));
   setExplanation("Cleanly formatted via client-side logic.");
  } catch (e) {
   setErrorMsg("Invalid JSON: Use 'AI Fix' to repair syntax errors.");
  }
 };
 
 const handleMinify = () => {
  if (!input.trim()) return;
  setErrorMsg(null);
  try {
   const parsed = JSON.parse(input);
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
   const { code, info } = parseJsonReponse(result);
   if (result && (result.formattedJson || result.convertedCode)) {
    setOutputCode(result.formattedJson || '');
    setExplanation(result.explanation || '');
    
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
 
 const handleCopy = () => {
  if (outputCode) {
   navigator.clipboard.writeText(outputCode);
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback('Copy'), 2000);
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
            <button className="mode-btn" onClick={loadSample}>Load Sample</button>
          </div>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder='Paste your JSON here...' 
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
          <h3>Formatted Output</h3>
          <div className="results-container">
            {outputCode ? (
                <>
                    <div className="output-wrapper json-output-box"> 
                        <textarea 
                            value={outputCode} 
                            readOnly 
                            className="output-textarea json-textarea"
                            spellCheck="false"
                        />
                        <button className="copy-btn copy-btn-absolute" onClick={handleCopy}>
                           <i className="fa-solid fa-copy"></i> {copyFeedback}
                        </button>
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
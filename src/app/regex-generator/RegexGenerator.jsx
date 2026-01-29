'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/services/api';
import ModuleHeader from '@/components/ModuleHeader';

export default function RegexGenerator({ onLoadData, qualityMode }) {
 const [input, setInput] = useState('');
 const [outputCode, setOutputCode] = useState('');
 const [explanation, setExplanation] = useState('');
 const [testString, setTestString] = useState('');
 const [testResult, setTestResult] = useState(null);
 
 const [loading, setLoading] = useState(false);
 const [copyFeedback, setCopyFeedback] = useState('Copy');
 const [lastResult, setLastResult] = useState(false);
 
 // Helper to parse the JSON string from the API
 const parseResponse = (rawOutput) => {
  if (typeof rawOutput === 'object' && rawOutput !== null) {
   return {
    pattern: rawOutput.pattern || '',
    explanation: rawOutput.explanation || "AI-generated pattern."
   };
  }
  
  // Handle string fallback (if server sent a string)
  try {
   const cleanJson = (rawOutput || '').replace(/```json|```/g, '').trim();
   const parsed = JSON.parse(cleanJson);
   return {
    pattern: parsed.pattern || rawOutput,
    explanation: parsed.explanation || "AI-generated pattern."
   };
  } catch (e) {
   return { pattern: rawOutput || '', explanation: "AI-generated pattern." };
  }
 };
 
 useEffect(() => {
  if (onLoadData) {
   setInput(onLoadData.input || '');
   const { pattern, explanation } = parseResponse(onLoadData.fullOutput);
   setOutputCode(pattern);
   setExplanation(explanation);
  }
 }, [onLoadData]);
 
 // Real-time Regex Testing Logic
 useEffect(() => {
  if (!outputCode || !testString) {
   setTestResult(null);
   return;
  }
  
  try {
   // Create regex from the raw pattern string
   const regex = new RegExp(outputCode, 'gi');
   const matches = [...testString.matchAll(regex)];
   setTestResult({ isMatch: matches.length > 0, count: matches.length });
  } catch (e) {
   setTestResult({ error: "Invalid Regex Pattern" });
  }
 }, [outputCode, testString]);
 
 const handleGenerate = async () => {
  if (!input.trim()) return;
  setLoading(true);
  setOutputCode('');
  setExplanation('');
  setLastResult(false);
  
  try {
   const result = await convertCode('regex', input, { qualityMode });
   const { pattern, explanation } = parseResponse(result);
   
   if (result && (result.pattern || result.convertedCode)) {
    setOutputCode(result.pattern || '');
    setExplanation(result.explanation || '');
    
    setLastResult({
     type: "regex",
     input: input,
     output: result
    });
   }
  } catch (error) {
   alert(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const handleCopy = () => {
  if (outputCode) {
   navigator.clipboard.writeText(outputCode);
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback('Copy'), 2000);
  }
 };
 
 const renderHighlightedText = () => {
  if (!testResult || testResult.error || !testResult.isMatch) return testString;
  
  try {
   const regex = new RegExp(`(${outputCode})`, 'gi');
   const parts = testString.split(regex);
   return parts.map((part, i) =>
    new RegExp(outputCode, 'gi').test(part) ? (
     <span key={i} className="regex-match-highlight">{part}</span>
    ) : part
   );
  } catch (e) {
   return testString;
  }
 };
 
 return (
  <div className="module-container">
      <ModuleHeader 
        title="Regex Generator"
        description="Describe your pattern, get the regex, and test it instantly."
        resultData={lastResult}
      />

      <div className="converter-grid">
        <div className="panel">
          <h3>Pattern Description</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="e.g., Match a valid email address..." 
            spellCheck="false"
          />
          <div className="action-row">
             <button className="primary-button" onClick={handleGenerate} disabled={loading}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              {loading ? 'Generating...' : 'Generate Regex'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Resulting Regex</h3>
          <div className="results-container">
            {outputCode ? (
                <>
                    <div className="output-wrapper regex-output-box"> 
                        <textarea 
                            value={outputCode} 
                            readOnly 
                            className="output-textarea code-accent regex-textarea"
                            spellCheck="false"
                        />
                        <button className="copy-btn copy-btn-absolute" onClick={handleCopy}>
                           <i className="fa-solid fa-copy"></i> {copyFeedback}
                        </button>
                    </div>

                    <div className="ai-summary regex-explanation">
                        <strong><i className="fa-solid fa-circle-info"></i> Logic Breakdown:</strong>
                        <div className="explanation-content">{explanation}</div>
                    </div>

                    <div className="selector-card regex-test-bench">
                        <div className="selector-name"><i className="fa-solid fa-vial"></i> Test Playground</div>
                        <input 
                            type="text"
                            className="output-textarea regex-test-input"
                            placeholder="Type text here to test the pattern..."
                            value={testString}
                            onChange={(e) => setTestString(e.target.value)}
                        />
                        
                        {testString && (
                            <div className="regex-test-feedback">
                                <div className="selector-name">Preview:</div>
                                <div className="code-pre regex-preview-area">
                                    {renderHighlightedText()}
                                </div>
                                <div className="regex-status-row">
                                    {testResult?.error ? (
                            <span className="regex-status-error">
                                            <i className="fa-solid fa-triangle-exclamation"></i> {testResult.error}
                                        </span>
                                    ) : (
                                        <span className={testResult?.isMatch ? "regex-status-success" : "regex-status-neutral"}>
                        <i className={`fa-solid ${testResult?.isMatch ? 'fa-check' : 'fa-xmark'}`}></i> 
                         {testResult?.isMatch ? `Match Found (${testResult.count})` : 'No Match'}
                           </span>
                           )}
                        </div>
                     </div>
                  )}
                </div>
              </>
            ) : (
              <div className="placeholder-text">
                {loading ? (
                   <div className="processing-state">
                     <div className="pulse-ring"></div>
                     <p>AI is working...</p>
                    </div>
                ) : 'Your Regex pattern will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
 );
}
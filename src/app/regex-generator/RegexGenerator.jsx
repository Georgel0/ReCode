'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';

import './regexGenerator.css';

const CHEATSHEET = {
 "Anchors": [
  { token: "^", desc: "Start of string" },
  { token: "$", desc: "End of string" },
  { token: "\\b", desc: "Word boundary" },
  { token: "\\B", desc: "Non-word boundary" }
 ],
 "Quantifiers": [
  { token: "*", desc: "0 or more" },
  { token: "+", desc: "1 or more" },
  { token: "?", desc: "0 or 1 (Optional)" },
  { token: "{3}", desc: "Exactly 3" },
  { token: "{3,}", desc: "3 or more" },
  { token: "{3,5}", desc: "Between 3 and 5" },
  { token: "*?", desc: "Lazy quantifier (matches as little as possible)" }
 ],
 "Character Classes": [
  { token: "\\d", desc: "Digit [0-9]" },
  { token: "\\D", desc: "Not a digit" },
  { token: "\\w", desc: "Word char [A-Za-z0-9_]" },
  { token: "\\W", desc: "Not a word char" },
  { token: "\\s", desc: "Whitespace (space, tab, newline)" },
  { token: "\\S", desc: "Not whitespace" },
  { token: ".", desc: "Any character except newline" },
  { token: "[aeiou]", desc: "Custom set (any vowel)" },
  { token: "[^aeiou]", desc: "Negated set (any non-vowel)" }
 ],
 "Groups & Logic": [
  { token: "|", desc: "OR operator" },
  { token: "(...)", desc: "Capturing group" },
  { token: "(?:...)", desc: "Non-capturing group" },
  { token: "\\1", desc: "Backreference to group #1" }
 ],
 "Lookarounds": [
  { token: "(?=...)", desc: "Positive Lookahead (followed by...)" },
  { token: "(?!...)", desc: "Negative Lookahead (not followed by...)" },
  { token: "(?<=...)", desc: "Positive Lookbehind (preceded by...)" },
  { token: "(?<!...)", desc: "Negative Lookbehind (not preceded by...)" }
 ],
 "Flags": [
  { token: "g", desc: "Global search" },
  { token: "i", desc: "Case-insensitive" },
  { token: "m", desc: "Multiline" },
  { token: "s", desc: "Dotall (dot matches newlines)" }
 ]
};


export default function RegexGenerator() {
 const { moduleData, qualityMode } = useApp();
 
 const [input, setInput] = useState('');
 const [refineMode, setRefineMode] = useState(false);
 const [flavor, setFlavor] = useState('JavaScript');
 const [flags, setFlags] = useState({ g: true, i: true, m: false, s: false });
 
 const [outputCode, setOutputCode] = useState('');
 const [summary, setSummary] = useState('');
 const [breakdown, setBreakdown] = useState([]);
 
 const [testCases, setTestCases] = useState([
  { id: 1, text: 'example@email.com', shouldMatch: true },
  { id: 2, text: 'invalid-email', shouldMatch: false }
 ]);
 
 const [loading, setLoading] = useState(false);
 const [copyFeedback, setCopyFeedback] = useState('Copy');
 const [showCheatsheet, setShowCheatsheet] = useState(false);
 const [lastResult, setLastResult] = useState(null);
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'regex') {
   setInput(moduleData.input || '');
   handleResponseParsing(moduleData.fullOutput);
  }
 }, [moduleData]);
 
 const handleResponseParsing = (raw) => {
  // Handle both Structured JSON (from schema) and fallback
  const data = typeof raw === 'string' ? parseFallback(raw) : raw;
  
  setOutputCode(data.pattern || '');
  setSummary(data.summary || data.explanation || 'Generated pattern');
  setBreakdown(data.breakdown || []);
  
  // Auto-switch to refine mode after first generation
  if (data.pattern) setRefineMode(true);
 };
 
 const parseFallback = (text) => {
  try {
   const clean = text.replace(/```json|```/g, '').trim();
   return JSON.parse(clean);
  } catch (e) {
   return { pattern: text, summary: "Raw output generated." };
  }
 };
 
 const handleGenerate = async () => {
  if (!input.trim()) return;
  setLoading(true);
  
  try {
   // Construct prompt based on mode
   const promptText = refineMode ?
    `Current Pattern: ${outputCode}\nRequest: Refine this to ${input}` :
    input;
   
   const result = await convertCode('regex', promptText, { qualityMode, targetLang: flavor });
   
   handleResponseParsing(result);
   
   if (result) {
    setLastResult({ type: "regex", input: promptText, output: result });
    // Clear input if refining for next step
    if (refineMode) setInput('');
   }
   
  } catch (error) {
   alert(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const handleCopy = () => {
  if (outputCode) {
   // Construct full regex string including flags
   const flagStr = Object.keys(flags).filter(k => flags[k]).join('');
   const fullString = `/${outputCode}/${flagStr}`;
   
   navigator.clipboard.writeText(fullString);
   
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback('Copy'), 2000);
  }
 };
 
 const getRegexObject = () => {
  try {
   const activeFlags = Object.keys(flags).filter(k => flags[k]).join('');
   
   return new RegExp(outputCode, activeFlags);
  } catch (e) {
   return null;
  }
 };
 
 const addTestCase = () => {
  const newId = Math.max(...testCases.map(t => t.id), 0) + 1;
  setTestCases([...testCases, { id: newId, text: '', shouldMatch: true }]);
 };
 
 const removeTestCase = (id) => {
  setTestCases(testCases.filter(t => t.id !== id));
 };
 
 const updateTestCase = (id, field, value) => {
  setTestCases(testCases.map(t => t.id === id ? { ...t, [field]: value } : t));
 };
 
 const renderHighlightedText = (text) => {
  if (!outputCode) return text;
  
  try {
   // Highlighting always needs 'g' to find all occurrences, but must use the user's Case Insensitive choice
   const highlightFlags = `g${flags.i ? 'i' : ''}`;
   const regex = new RegExp(outputCode, highlightFlags);
   
   let lastIndex = 0;
   const elements = [];
   let match;
   
   // Reset lastIndex just in case
   regex.lastIndex = 0;
   
   while ((match = regex.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
     elements.push(text.substring(lastIndex, match.index));
    }
    
    elements.push(
     <span key={`${match.index}-match`} className="regex-match-highlight">
      {match[0]}
     </span>
    );
    
    lastIndex = regex.lastIndex;
    
    // Prevent infinite loops on zero-width matches
    if (match.index === regex.lastIndex) {
     regex.lastIndex++;
    }
   }
   
   // Push remaining text
   if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
   }
   
   return elements.length > 0 ? elements : text;
  } catch (e) {
   return text;
  }
 };
 
 const checkMatch = (text) => {
  const regex = getRegexObject();
  if (!regex) return { error: true };
  
  return { isMatch: regex.test(text) };
 };
 
 return (
  <div className="module-container">
   <ModuleHeader 
    title="Regex Generator"
    description="Describe, Refine, and Battle-Test your Regular Expressions."
    resultData={lastResult}
   />

   {showCheatsheet && (
    <div className="modal-overlay" onClick={() => setShowCheatsheet(false)}>
     <div className="modal-content" onClick={e => e.stopPropagation()}>
      <h2>Regex Cheatsheet</h2>
      <div className="ext-grid">
       {Object.entries(CHEATSHEET).map(([category, items]) => (
        <div key={category} className="cheatsheet-category">
         <h4 style={{color: 'var(--accent)', margin: '0 0 10px 0'}}>{category}</h4>
         {items.map(item => (
          <div key={item.token} className="tailwind-code" style={{marginBottom:'5px'}}>
           <code>{item.token} </code>
           <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{item.desc}</span>
          </div>
         ))}
        </div>
       ))}
      </div>
     <button className="secondary-button modal-close-btn" onClick={() => setShowCheatsheet(false)}>Close</button>
    </div>
   </div>
  )}

  <div className="converter-grid">
   <div className="panel">
    <div className="panel-header-row">
     <h3>{refineMode ? 'Refine Pattern' : 'Pattern Description'}</h3>
     <button className="mode-btn" onClick={() => setShowCheatsheet(true)}>
      <i className="fa-solid fa-book"></i> Cheatsheet
     </button>
    </div>

    <div className="controls-group">
     <div className="control-field">
      <label className="label-text">Target Flavor</label>
      <select value={flavor} onChange={(e) => setFlavor(e.target.value)}>
       <option value="JavaScript">JavaScript (Standard)</option>
       <option value="Python">Python</option>
       <option value="PCRE">PCRE (PHP/Go)</option>
      </select>
     </div>
            
     <div className="control-field">
      <label className="label-text">Flags</label>
      <div className="flag-group">
       {['g', 'i', 'm', 's'].map(flag => (
        <label key={flag} className="custom-check">
         <input 
          type="checkbox" 
          checked={flags[flag]} 
          onChange={() => setFlags({...flags, [flag]: !flags[flag]})}
         />
        <span className="box">
         <i className="fas fa-check"></i>
        </span>
        <span className="label-text">{flag}</span>
       </label>
      ))}
     </div>
    </div>
   </div>

   <textarea 
    value={input} 
    onChange={(e) => setInput(e.target.value)} 
    placeholder={refineMode 
     ? "Tell AI how to change the current regex (e.g., 'Make it support negative numbers')..." 
     : "Describe what you want to match (e.g., 'A secure password with 1 number and 1 special char')..."}
    spellCheck="false"
    style={{minHeight: '120px'}}
   />
          
   <div className="action-row between center-y">
    {refineMode && (
     <button className="secondary-button" onClick={() => {
       setRefineMode(false);
       setInput('');
       setOutputCode('');
      }}>
        <i className="fa-solid fa-rotate-left"></i> Start Over
     </button>
    )}
    <button className="primary-button" onClick={handleGenerate} disabled={loading}>
     <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : refineMode ? 'fa-sliders' : 'fa-wand-magic-sparkles'}`}></i>
     {loading ? 'Processing...' : refineMode ? 'Refine Regex' : 'Generate Regex'}
    </button>
   </div>
  </div>

  <div className="panel">
   <h3>Result</h3>
   <div className="results-container">
    {outputCode ? (
     <>
      <div className="output-wrapper regex-output-box"> <div className="tailwind-code">
        <span style={{color: 'var(--text-secondary)', userSelect:'none'}}>/</span>
        <input 
         type="text" 
         value={outputCode} 
         readOnly 
         className="code-editor"
         style={{padding: '0 4px', height: 'auto'}}
        />
        <span style={{color: 'var(--text-secondary)', userSelect:'none'}}>
         / {Object.keys(flags).filter(k => flags[k]).join('')}
        </span>
        <button className="copy-btn" onClick={handleCopy}>
         {copyFeedback}
        </button>
       </div>
      </div>

      <div className="ai-summary">
       <strong><i className="fa-solid fa-circle-info"></i> {summary}</strong>
       {breakdown.length > 0 && (
       <div className="regex-token-grid">
        {breakdown.map((item, idx) => (
         <div key={idx} className="token-row">
          <span className="token-badge">{item.token}</span>
          <span className="token-desc">{item.description}</span>
         </div>
        ))}
       </div>
      )}
     </div>

     <div className="selector-card regex-test-bench">
      <div className="panel-header-row" style={{marginBottom: '10px'}}>
       <div className="selector-name"><i className="fa-solid fa-vial"></i> Test Cases</div>
        <button className="icon-btn" onClick={addTestCase} title="Add Test Case">
         <i className="fa-solid fa-plus"></i>
        </button>
       </div>

       <div className="test-cases-list">
        {testCases.map((test) => {
          const result = checkMatch(test.text);
          const isSuccess = result.isMatch === test.shouldMatch; 
          return (
           <div key={test.id} className="test-case-row">
            <div 
             className={`expectation-toggle ${test.shouldMatch ? 'expect-match' : 'expect-fail'}`}
             onClick={() => updateTestCase(test.id, 'shouldMatch', !test.shouldMatch)}
             title={`Click to change expectation. Currently expecting: ${test.shouldMatch ? 'Match' : 'No Match'}`} >
             <i className={`fa-solid ${test.shouldMatch ? 'fa-check' : 'fa-ban'}`}></i>
            </div>
            
            <div className="test-input-wrapper">
             <input 
              type="text"
              value={test.text}
              onChange={(e) => updateTestCase(test.id, 'text', e.target.value)}
              placeholder="Test string..."
              className="test-input-field"
             />
             <div className="test-input-highlight-layer">
              {renderHighlightedText(test.text)}
             </div>
            </div>

            <div className={`result-indicator ${isSuccess ? 'success' : 'fail'}`}>
             {result.error ? (
              <i className="fa-solid fa-triangle-exclamation" title="Invalid Regex"></i>
             ) : (
              <i className={`fa-solid ${isSuccess ? 'fa-check' : 'fa-xmark'}`}></i>
             )}
            </div>

            <button className="remove-btn" onClick={() => removeTestCase(test.id)}>
             <i className="fa-solid fa-trash"></i>
            </button>
           </div>
          );
         })}
        </div>
                  
        {flavor !== 'JavaScript' && (
         <div className="regex-status-neutral" style={{fontSize:'0.8rem', marginTop:'10px'}}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          Note: Testing runs in your browser (JS). Python/PCRE specific tokens (e.g., named groups) might cause errors here but work in your target env.
         </div>
        )}
       </div>
      </>
     ) : (
      <div className="placeholder-text">
       {loading ? (
         <div className="processing-state">
          <div className="pulse-ring"></div>
          <p>Crafting your expression...</p>
         </div>
        ) : 'Describe your pattern to generate a regex.'}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib/api';
import { CopyButton } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context/AppContext';

const DIALECTS = [
 { value: 'Standard SQL', label: 'Standard SQL' },
 { value: 'PostgreSQL', label: 'PostgreSQL' },
 { value: 'MySQL', label: 'MySQL' },
 { value: 'SQLite', label: 'SQLite' },
 { value: 'SQL Server', label: 'SQL Server (T-SQL)' },
 { value: 'Oracle', label: 'Oracle PL/SQL' },
 { value: 'Snowflake', label: 'Snowflake' },
 { value: 'BigQuery', label: 'Google BigQuery' },
 { value: 'Redshift', label: 'AWS Redshift' },
];

const MODES = [
 { id: 'builder', label: 'Builder', icon: 'fa-wand-magic-sparkles' },
 { id: 'converter', label: 'Converter', icon: 'fa-right-left' },
 { id: 'optimizer', label: 'Optimizer', icon: 'fa-gauge-high' },
];

export default function SqlBuilder() {
 const [activeMode, setActiveMode] = useState('builder');
 const [input, setInput] = useState('');
 const [schema, setSchema] = useState('');
 const [showSchema, setShowSchema] = useState(false);
 
 const [targetDialect, setTargetDialect] = useState('Standard SQL');
 const [sourceDialect, setSourceDialect] = useState('MySQL');
 
 const [outputCode, setOutputCode] = useState('');
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const { moduleData, qualityMode } = useApp();
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'sql') {
   setInput(moduleData.input || '');
   setOutputCode(moduleData.fullOutput?.convertedCode || '');
   if (moduleData.targetLang) setTargetDialect(moduleData.targetLang);
   if (moduleData.mode) setActiveMode(moduleData.mode);
  }
 }, [moduleData]);
 
 const handleGenerate = async () => {
  if (!input.trim()) return;
  setLoading(true);
  setOutputCode('');
  setLastResult(false);
  
  try {
   let fullPrompt = '';
   
   if (activeMode === 'builder') {
    fullPrompt = `Generate a ${targetDialect} query based on this requirement: "${input}".\n`;
    if (schema) fullPrompt += `Use this Database Schema strictly: ${schema}`;
   }
   else if (activeMode === 'converter') {
    fullPrompt = `Convert the following ${sourceDialect} query to ${targetDialect}.\nOriginal SQL:\n${input}`;
   }
   else if (activeMode === 'optimizer') {
    fullPrompt = `Analyze and optimize this ${targetDialect} query for performance. Add comments explaining changes.\nQuery:\n${input}`;
    if (schema) fullPrompt += `\nSchema Context: ${schema}`;
   }
   
   // passing the prompt as 'input' to the backend
   const result = await convertCode('sql', fullPrompt, { targetLang: targetDialect, qualityMode });
   
   if (result && result.convertedCode) {
    setOutputCode(result.convertedCode);
    setLastResult({
     type: "sql",
     mode: activeMode,
     input: input,
     output: result
    });
   } else {
    throw new Error("Unexpected response structure.");
   }
  } catch (error) {
   alert(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const clearInputs = () => {
  setInput('');
  setOutputCode('');
  setSchema('');
 };
 
 return (
  <div className="module-container">
   <ModuleHeader 
    title="SQL Forge"
    description="Generate, convert, and optimize SQL queries for any database."
    resultData={lastResult}
   />

   <div className="tabs-container">
    {MODES.map(m => (
     <button
      key={m.id}
      className={`tab-btn ${activeMode === m.id ? 'active' : ''}`}
      onClick={() => { setActiveMode(m.id); setOutputCode(''); }}
     >
      <i className={`fa-solid ${m.icon}`}></i> {m.label}
     </button>
    ))}
   </div>

   <div className="converter-grid">
    <div className="panel">
     <div className="panel-header-row">
      <h3>
       {activeMode === 'builder' && 'Requirement'}
       {activeMode === 'converter' && 'Source Query'}
       {activeMode === 'optimizer' && 'Slow Query'}
      </h3>
      <button className="mode-btn" onClick={clearInputs}>
        <i className="fa-solid fa-eraser"></i> Clear
       </button>
      </div>

       <div className="controls-group">
        {activeMode === 'converter' ? (
         <div className="ext-grid">
          <div className="control-field">
           <span className="label-text">From:</span>
           <select 
            value={sourceDialect} 
            onChange={(e) => setSourceDialect(e.target.value)}
            className="lang-select full-width"
           >
            {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
           </select>
          </div>
          <div className="control-field">
           <span className="label-text">To:</span>
           <select 
            value={targetDialect} 
            onChange={(e) => setTargetDialect(e.target.value)}
            className="lang-select full-width"
           >
           {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
         </div>
        </div>
       ) : (
        <div className="action-row start center-y" style={{ marginBottom: '1rem' }}>
         <span className="label-text">Dialect:</span>
         <select 
          value={targetDialect} 
          onChange={(e) => setTargetDialect(e.target.value)}
          className="lang-select"
         >
          {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
       </div>
      )}

      {activeMode !== 'converter' && (
       <div className="schema-wrapper">
        <button 
         className={`schema-toggle-btn ${showSchema ? 'active' : ''}`}
         onClick={() => setShowSchema(!showSchema)}
        >
         <i className="fa-solid fa-database"></i> 
         {showSchema ? 'Hide Database Schema' : 'Add Database Schema (Context)'}
        </button>
                
        {showSchema && (
         <textarea 
          className="schema-input"
          placeholder="CREATE TABLE users (id INT, name TEXT...);"
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          spellCheck="false"
         />
        )}
       </div>
      )}
     </div>

     <textarea 
      value={input} 
      onChange={(e) => setInput(e.target.value)} 
      placeholder={
       activeMode === 'builder' ? "e.g., Get top 5 users who spent more than $100 last month..." :
       activeMode === 'converter' ? "Paste your SQL here to convert it..." :
       "Paste your slow query here..." }
      spellCheck="false"
      className="main-input"
     />
     
     <div className="action-row">
      <button className="primary-button" onClick={handleGenerate} disabled={loading}>
       {loading ? (
        <>
         <i className="fa-solid fa-spinner fa-spin"></i> Processing...
        </>
       ) : (
        <>
         <i className="fa-solid fa-gears"></i> 
         {activeMode === 'builder' ? 'Build Query' : activeMode === 'converter' ? 'Convert' : 'Optimize'}
        </>
       )}
      </button>
     </div>
    </div>

    <div className="panel">
     <h3>Generated SQL ({targetDialect})</h3>
     <div className="results-container">
      {outputCode ? (
       <div className="output-wrapper"> 
        <textarea 
         value={outputCode} 
         readOnly 
         className="output-textarea"
         spellCheck="false"
        />
        
        <CopyButton codeToCopy={outputCode} />
       </div>
      ) : (
       <div className="placeholder-text">
        {loading ? (
         <div className="processing-state">
          <div className="pulse-ring"></div>
          <p>AI is building...</p>
         </div>
        ) : 'Result will appear here.'}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
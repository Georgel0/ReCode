'use client';

import ReactDiffViewer from 'react-diff-viewer-continued';
import { ModuleHeader } from '@/components/layout';
import { CodeEditor, CodeOutput, CopyButton } from '@/components/ui';
import { useTheme } from '@/context';
import { useSqlForge, MODES, DIALECTS } from './useSqlForge';
import './SqlBuilder.css';

export default function SqlBuilder() {
 
 const { currentTheme } = useTheme();
 const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);
 
 const {
  activeMode,
  setActiveMode,
  input,
  setInput,
  schema,
  handleSchemaChange,
  showSchema,
  setShowSchema,
  targetDialect,
  setTargetDialect,
  sourceDialect,
  setSourceDialect,
  explainChanges,
  setExplainChanges,
  outputCode,
  explanation,
  loading,
  lastResult,
  handleGenerate,
  clearInputs,
  handleFileUpload,
  handleFormatCode
 } = useSqlForge();
 
 return (
  <div className="module-container">
   <ModuleHeader 
    title="SQL Builder"
    description="Generate, convert, and optimize SQL queries for any database."
    resultData={lastResult}
   />

   <div className="tabs-container">
    {MODES.map(m => (
     <button
      key={m.id}
      className={`tab-btn ${activeMode === m.id ? 'active' : ''}`}
      onClick={() => setActiveMode(m.id)}
     >
      <i className={`fa-solid ${m.icon}`}></i> {m.label}
     </button>
    ))}
   </div>

   <div className="converter-grid">
    <div className="panel flex-col">
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
         <input 
          list="source-dialects" 
          value={sourceDialect} 
          onChange={(e) => setSourceDialect(e.target.value)}
          className="combobox-input full-width"
          placeholder="Search dialect..."
         />
         <datalist id="source-dialects">
          {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
         </datalist>
        </div>
        <div className="control-field">
         <span className="label-text">To:</span>
         <input 
          list="target-dialects" 
          value={targetDialect} 
          onChange={(e) => setTargetDialect(e.target.value)}
          className="combobox-input full-width"
          placeholder="Search dialect..."
         />
         <datalist id="target-dialects">
          {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
         </datalist>
        </div>
       </div>
      ) : (
       <div className="action-row start center-y" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span className="label-text">Dialect:</span>
        <input 
         list="target-dialects" 
         value={targetDialect} 
         onChange={(e) => setTargetDialect(e.target.value)}
         className="combobox-input"
         placeholder="Search dialect..."
        />
                
        {activeMode === 'optimizer' && (
         <label className="custom-check" style={{ marginLeft: 'auto' }}>
          <input 
           type="checkbox" 
           checked={explainChanges} 
           onChange={(e) => setExplainChanges(e.target.checked)} 
          />
          <div className="box"><i className="fa-solid fa-check"></i></div>
          <span className="label-text">Explain Changes</span>
         </label>
        )}
       </div>
      )}
      
      {activeMode !== 'converter' && (
       <div className="schema-wrapper">
        <div className="schema-header-actions">
         <button 
          className={`schema-toggle-btn ${showSchema ? 'active' : ''}`}
          onClick={() => setShowSchema(!showSchema)}
         >
          <i className="fa-solid fa-database"></i> 
          {showSchema ? 'Hide Database Schema' : 'Add Database Schema (Context)'}
         </button>
         {showSchema && (
          <div className="upload-btn-wrapper">
           <button className="file-upload-btn">
            <i className="fa-solid fa-file-import"></i> Auto-Discover (.sql)
           </button>
           <input type="file" accept=".sql,.txt" onChange={handleFileUpload} />
          </div>
         )}
        </div>
                        
        {showSchema && (
         <div className="schema-editor-wrapper">
          <CodeEditor 
           value={schema}
           onValueChange={handleSchemaChange}
           language="sql"
           placeholder="CREATE TABLE users (id INT, name TEXT...);"
          />
         </div>
        )}
       </div>
      )}
     </div>

     <div className="main-input-wrapper flex-grow">
      <CodeEditor 
       value={input}
       onValueChange={setInput}
       language="sql"
       placeholder={
        activeMode === 'builder' ? "e.g., Get top 5 users who spent more than $100 last month..." :
        activeMode === 'converter' ? "Paste your SQL here to convert it..." :
        "Paste your slow query here..."
       }
      />
     </div>
          
     <div className="action-row" style={{ marginTop: '1rem' }}>
      <button className="primary-button full-width" onClick={handleGenerate} disabled={loading || !input.trim()}>
       {loading ? (
        <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
       ) : (
        <><i className="fa-solid fa-gears"></i>
        {activeMode === 'builder' ? 'Build Query' : activeMode === 'converter' ? 'Convert' : 'Optimize'}</>
       )}
      </button>
     </div>
    </div>

    <div className="panel flex-col">
     <div className="panel-header-row">
      <h3>Generated SQL ({targetDialect})</h3>
      {outputCode && (
        <div className="header-actions">
         <button className="secondary-button btn-small" onClick={handleFormatCode}>
          <i className="fa-solid fa-align-left"></i> Format
         </button>
         
         <CopyButton codeToCopy={outputCode} className="secondary-button btn-small" />
        </div>
       )}
      </div>

      <div className="results-container flex-grow">
       {outputCode ? (
        <div className="output-scrollable">
         {activeMode === 'optimizer' ? (
          <div className="diff-viewer-wrapper">
           <ReactDiffViewer
            oldValue={input}
            newValue={outputCode}
            splitView={true}
            useDarkTheme={isDarkTheme}
            compareMethod="diffLines"
            leftTitle="Original Query"
            rightTitle="Optimized Query"
            styles={!isDarkTheme ? undefined : {
             variables: {
              diffViewerBackground: 'var(--bg-primary)',
              addedBackground: 'rgba(46, 160, 67, 0.15)',
              addedGutterBackground: 'rgba(46, 160, 67, 0.25)',
              removedBackground: 'rgba(248, 81, 73, 0.15)',
              removedGutterBackground: 'rgba(248, 81, 73, 0.25)',
             },
             contentText: { fontSize: '13px', lineHeight: '20px' }
            }}
           />
          </div>
         ) : (
          <CodeOutput content={outputCode} language="sql" />
         )}
          
         {explanation && (
          <div className="ai-summary" style={{ marginTop: '1rem' }}>
           <strong><i className="fa-solid fa-lightbulb"></i> Explain Plan</strong>
          <div dangerouslySetInnerHTML={{ __html: explanation.replace(/\n/g, '<br/>') }} />
         </div>
        )}
       </div>
      ) : (
       <div className="placeholder-text placeholder-container-inner">
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
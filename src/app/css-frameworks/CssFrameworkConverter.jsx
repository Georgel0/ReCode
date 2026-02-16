'use client';

import { useState, useRef, useEffect } from 'react';
import { useConverter } from './useConverter';
import { TARGET_FRAMEWORKS, MODES } from './constants';
import PreviewPane from './PreviewPane';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';

export default function CssFrameworkConverter({ preSetTarget = 'tailwind' }) {

 const { qualityMode } = useApp();
 const fileInputRef = useRef(null);
 
 const [activeMode, setActiveMode] = useState('css');
 const [targetLang, setTargetLang] = useState(preSetTarget);
 const [activeInputTab, setActiveInputTab] = useState('css'); 
 const [activeOutputTab, setActiveOutputTab] = useState('code'); 
 
 const [inputs, setInputs] = useState({ css: '', html: '', context: '' });
 
 const { status, error, data, convert, reset } = useConverter(qualityMode);
 
 const handleInputChange = (field, value) => {
  setInputs(prev => ({ ...prev, [field]: value }));
 };
 
 useEffect(() => {
  if (activeMode === 'html') {
   setActiveInputTab('html');
  } else {
   setActiveInputTab('css');
  }
  // Reset output when mode changes to avoid stale data
  reset();
 }, [activeMode]);

 const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
   const content = event.target.result;
   
   if (file.name.endsWith('.html')) {
    handleInputChange('html', content);
    
    if (activeMode !== 'html') setActiveMode('html');
   } else if (file.name.endsWith('.css') || file.name.endsWith('.scss')) {
    handleInputChange('css', content);
   } else {
    // Default fallback
    handleInputChange(activeInputTab, content);
   }
  };
  reader.readAsText(file);
  // Reset input to allow re-uploading same file
  e.target.value = null;
 };
 
 const handleConvert = () => {
  convert({ activeMode, inputs, targetLang });
  if (activeMode === 'html') {
   setActiveOutputTab('preview');
  }
 };
 
 const copyToClipboard = (text) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
 };
 
 // Helper to get display label
 const targetLabel = TARGET_FRAMEWORKS.find(f => f.value === targetLang)?.label || 'Framework';
 
 return (
  <div className="module-container">
    <ModuleHeader 
      title="CSS Framework Converter"
      description="Transform standard CSS/HTML into utility classes or other framework formats."
    />

    <div className="panel" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <div className="framework-toolbar">
          
        <div className="toolbar-group">
          <span className="toolbar-label">Convert Mode:</span>
          <div className="mode-selector">
            {MODES.map(mode => (
              <button
                key={mode.id}
                className={`mode-btn ${activeMode ===
                  mode.id ? 'selected' : ''}`}
                onClick={() => setActiveMode(mode.id)}
                >
                <i className={mode.icon} style={{ marginRight: '6px' }}></i>
                  {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Target:</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="lang-select"
            style={{ minWidth: '150px' }}>
            
            {TARGET_FRAMEWORKS.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>

    <div className="framework-converter-grid">
        
      <div className="panel converter-panel">
          
        <div className="panel-header-row">
          <h3>Input Source</h3>
          <div className="header-actions">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden-input" 
              accept=".css,.html,.txt,.jsx.,tsx"
              onChange={handleFileUpload}
            />
            <button 
              className="file-upload-btn" 
              onClick={() => fileInputRef.current?.click()}
              title="Upload CSS or HTML file">
              <i className="fa-solid fa-upload"></i> Upload
            </button>
              
            <button 
              className="secondary-button clear-btn"
              onClick={() => setInputs({ css: '', html: '', context: '' })}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} >
              Clear
            </button>
          </div>
        </div>

        <div className="tabs-container">
          {activeMode === 'html' && (
            <button 
              className={`tab-btn ${activeInputTab === 'html' ? 'active' : ''}`}
              onClick={() => setActiveInputTab('html')}
              >
              <i className="fa-brands fa-html5"></i> HTML
            </button>
          )}
          <button 
            className={`tab-btn ${activeInputTab === 'css' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('css')} >
            <i className="fa-brands fa-css3-alt"></i> CSS
          </button>
          <button 
            className={`tab-btn ${activeInputTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveInputTab('context')} >
            <i className="fa-solid fa-wand-magic-sparkles"></i> Context
          </button>
        </div>

        <div className="input-editor-wrapper">
          <textarea 
            className="framework-textarea"
            value={inputs[activeInputTab]}
            onChange={(e) => handleInputChange(activeInputTab, e.target.value)}
            placeholder={
              activeInputTab === 'css' ? ".btn { background: red; padding: 10px; } ..." :
                activeInputTab === 'html' ? "<div class='card'>...</div>" :
                "E.g., 'Use standard Tailwind spacing' or 'My primary color is #ff0000'"
            }
            spellCheck="false"
          />
        </div>

        <div className="action-row" style={{ marginTop: '1rem' }}>
          <button 
            className="primary-button action-btn" 
            onClick={handleConvert} 
            disabled={status === 'loading' || (!inputs.css && !inputs.html)}
            style={{ width: '100%' }} >
            
            {status === 'loading' ? (
              <><div className="spinner" style={{width: '20px', height: '20px', borderWidth: '2px', marginRight: '10px'}}></div> Converting...</>
            ) : (
              <>Convert to {targetLabel} <i className="fa-solid fa-arrow-right" style={{marginLeft: '8px'}}></i></>
            )}
          </button>
        </div>
          
        {error && (
          <div className="error-message has-error" style={{ marginTop: '1rem', padding: '10px', border: '1px solid #ff4d4d', borderRadius: '4px' }}>
              <i className="fa-solid fa-circle-exclamation"></i> {error}
          </div>
        )}
      </div>

      <div className="panel converter-panel">
          
        <div className="panel-header-row">
          <h3>Generated Output</h3>
            
          <div className="view-mode-toggles">
            <button 
              className={`view-toggle-btn ${activeOutputTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('code')} >
              <i className="fa-solid fa-code"></i> Code
            </button>
            <button 
              className={`view-toggle-btn ${activeOutputTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('preview')}
              disabled={activeMode === 'css' && !inputs.html} 
              title={activeMode === 'css' && !inputs.html ? "Add HTML input to see preview" : ""}  >
              <i className="fa-solid fa-eye"></i> Preview
            </button>
          </div>
        </div>

        <div className="output-scroll-area">
            
          {!data ? (
            <div className="empty-state-container">
              {status === 'loading' ? (
                 <div className="processing-state">
                   <div className="pulse-ring"></div>
                   <p>AI is processing your styles...</p>
                  </div>
              ) : (
                <div>
                  <i className="fa-solid fa-wand-magic-sparkles empty-state-icon"></i>
                  <p>Result will appear here</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeOutputTab === 'preview' ? (
                <div className="preview-pane-wrapper">
                  <PreviewPane 
                      inputHtml={inputs.html} 
                      inputCss={inputs.css} 
                      outputHtml={data.convertedHtml ||
                        inputs.html} 
                      targetLang={targetLang}
                      loading={status === 'loading'}
                   />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  
                  {data.conversions && Array.isArray(data.conversions) ? (
                      <div className="selector-list-container">
                         <div className="action-row end">
                            <button 
                              className="secondary-button"
                              onClick={() => {
                                 const allText = data.conversions.map(c => `/* ${c.selector} */\n${c.tailwindClasses}`).join('\n\n');
                                 copyToClipboard(allText);
                              }}
                            >
                              <i className="fa-regular fa-copy"></i> Copy All
                            </button>
                         </div>
                         {data.conversions.map((item, idx) => (
                          <div key={idx} className="selector-card">
                            <div className="selector-header">
                              <span>{item.selector}</span>
                            </div>
                            <div className="code-result-block">
                              <pre className="code-result-text">{item.tailwindClasses}</pre>
                              <button 
                                className="icon-btn copy-btn"
                                onClick={() => copyToClipboard(item.tailwindClasses)}
                                title="Copy class"
                              >
                                <i className="fa-regular fa-copy"></i>
                            </button>
                          </div>
                         </div>
                       ))}
                    </div>
                   ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <textarea 
                        className="framework-textarea"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '4px' }}
                        value={data.convertedHtml || data.convertedCode || ''}
                        readOnly
                       />
                       <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <button 
                            className="primary-button copy-btn"
                            onClick={() => copyToClipboard(data.convertedHtml || data.convertedCode)}  >
                          <i className="fa-regular fa-copy"></i> Copy Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  </div>
 );
}
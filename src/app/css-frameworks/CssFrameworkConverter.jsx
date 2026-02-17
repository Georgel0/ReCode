'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useConverter } from './useConverter';
import { TARGET_FRAMEWORKS, MODES } from './constants';
import PreviewPane from './PreviewPane';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';

import './CssFrameworks.css'

export default function CssFrameworkConverter({ preSetTarget = 'tailwind' }) {
  const { moduleData, qualityMode } = useApp();
  const fileInputRef = useRef(null);
  
  const [activeMode, setActiveMode] = useState('css');
  const [targetLang, setTargetLang] = useState(preSetTarget);
  const [activeInputTab, setActiveInputTab] = useState('css');
  const [activeOutputTab, setActiveOutputTab] = useState('code');
  const [lastResult, setLastResult] = useState(false);
  
  const [inputs, setInputs] = useState({ css: '', html: '', context: '' });
  
  const { status, error, data, convert, reset, setData } = useConverter(qualityMode);
  
  const isRestoring = useRef(false);
  
  // This pastes the history items
  useEffect(() => {
    if (moduleData && moduleData.type === "css-framework") {
      isRestoring.current = true;
      
      const savedMode = moduleData.sourceLang || moduleData.activeMode || "css";
      setActiveMode(savedMode);
      setTargetLang(moduleData.targetLang || "tailwind");
      
      let savedInputs = typeof moduleData.input === 'string' ? JSON.parse(moduleData.input) : moduleData.input;
      
      if (savedInputs && savedInputs._meta) {
        if (savedInputs._meta.activeInputTab) setActiveInputTab(savedInputs._meta.activeInputTab);
        if (savedInputs._meta.activeOutputTab) setActiveOutputTab(savedInputs._meta.activeOutputTab);
        
        const { _meta, ...cleanInputs } = savedInputs;
        savedInputs = cleanInputs;
      } else {
        setActiveInputTab(savedMode === 'html' ? 'html' : 'css');
      }
      
      setInputs(savedInputs || { css: '', html: '', context: '' });
      
      const output = moduleData.output || moduleData;
      if (output.convertedCode || output.conversions || output.convertedHtml) {
        setData({
          convertedCode: output.convertedCode,
          convertedHtml: output.convertedHtml,
          conversions: output.conversions,
        });
      }
      
      setTimeout(() => { isRestoring.current = false; }, 100);
    }
  }, [moduleData, setData]);
  
  // This saves the history items 
  useEffect(() => {
    if (data) {
      setLastResult({
        type: "css-framework",
        input: JSON.stringify({
          ...inputs,
          _meta: { activeInputTab, activeOutputTab }
        }),
        output: data,
        sourceLang: activeMode,
        targetLang: targetLang,
        activeMode: activeMode,
        qualityMode
      });
    }
  }, [data, activeMode, targetLang, inputs, activeInputTab, activeOutputTab]);
  
  useEffect(() => {
    setActiveInputTab(activeMode === 'html' ? 'html' : 'css');
  }, [activeMode]);
  
  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (file.name.endsWith('.html')) {
        handleInputChange('html', content);
        if (activeMode !== 'html') {
          setActiveMode('html');
          reset();
        }
      } else {
        handleInputChange('css', content);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };
  
  const handleConvert = () => {
    convert({ activeMode, inputs, targetLang });
    if (activeMode === 'html') setActiveOutputTab('preview');
  };
  
  const copyToClipboard = (text) => {
    if (text) navigator.clipboard.writeText(text);
  };
  
  const targetLabel = TARGET_FRAMEWORKS.find(f => f.value === targetLang)?.label || 'Framework';
  
  return (
    <div className="module-container">
      <ModuleHeader
        title="CSS Framework Converter"
        description="Transform standard CSS/HTML into utility classes or other framework formats."
        resultData={lastResult}
      />

      <div className="framework-toolbar-container">
        <div className="toolbar-group">
          <span className="toolbar-label">Mode</span>
          <div className="mode-selector">
            {MODES.map(mode => (
              <button
                key={mode.id}
                className={`mode-btn ${activeMode === mode.id ? 'selected' : ''}`}
                onClick={() => {
                  setActiveMode(mode.id);
                  reset();
                }} >
                <i className={mode.icon} style={{ marginRight: '6px' }}></i>
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group select-full-width-mobile">
          <span className="toolbar-label">Target</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="lang-select"
            style={{ minWidth: '160px' }}
          >
            {TARGET_FRAMEWORKS.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="framework-converter-grid">
        
        <div className="converter-panel">
          <div className="panel-header">
            <div className="panel-title">
              <i className="fa-solid fa-code"></i> Source Code
            </div>
            <div className="panel-actions">
               <input
                type="file"
                ref={fileInputRef}
                className="hidden-input"
                accept=".css,.html,.txt,.jsx,.tsx"
                onChange={handleFileUpload}
              />
              <button
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file"
              >
                <i className="fa-solid fa-upload"></i> <span className="btn-label">Upload</span>
              </button>
              <button
                className="secondary-button clear-btn-small"
                onClick={() => setInputs({ css: '', html: '', context: '' })}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="tabs-nav">
            {activeMode === 'html' && (
              <button
                className={`tab-item ${activeInputTab === 'html' ? 'active' : ''}`}
                onClick={() => setActiveInputTab('html')}
              >
                <i className="fa-brands fa-html5"></i> HTML
              </button>
            )}
            <button
              className={`tab-item ${activeInputTab === 'css' ? 'active' : ''}`}
              onClick={() => setActiveInputTab('css')}
            >
              <i className="fab fa-css3-alt"></i> CSS
            </button>
            <button
              className={`tab-item ${activeInputTab === 'context' ? 'active' : ''}`}
              onClick={() => setActiveInputTab('context')}
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i> Context
            </button>
          </div>

          <div className="panel-content">
            <div className="editor-wrapper">
              <textarea
                className="code-textarea"
                value={inputs[activeInputTab]}
                onChange={(e) => handleInputChange(activeInputTab, e.target.value)}
                placeholder={
                  activeInputTab === 'css' ? "/* Paste CSS here */\n.btn { ... }" :
                  activeInputTab === 'html' ? "\n<div class='card'>...</div>" :
                  "Enter specific instructions (e.g., 'Use REM units', 'Primary color is blue')..."
                }
                spellCheck="false"
              />
            </div>
          </div>

          <div className="panel-footer">
            <button
              className="primary-button full-width"
              onClick={handleConvert}
              disabled={status === 'loading' || (!inputs.css && !inputs.html)}
              style={{ width: '100%' }}
            >
              {status === 'loading' ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
              ) : (
                <>Convert to {targetLabel} <i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>
            {error && (
              <div className="error-message has-error" style={{ marginTop: '0.5rem' }}>
                <i className="fa-solid fa-circle-exclamation"></i> {error}
              </div>
            )}
          </div>
        </div>

        <div className="converter-panel">
          <div className="panel-header">
            <div className="panel-title">
              <i className="fa-solid fa-bolt"></i> Output
            </div>
            <div className="view-toggles">
              <button
                className={`view-btn ${activeOutputTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('code')}
              >
                Code
              </button>
              <button
                className={`view-btn ${activeOutputTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('preview')}
                disabled={activeMode === 'css' && !inputs.html}
              >
                Preview
              </button>
            </div>
          </div>

          <div className="panel-content">
            {!data ? (
              <div className="empty-state">
                 {status === 'loading' ? (
                   <>
                    <div className="spinner"></div>
                    <span>Generating styles...</span>
                   </>
                 ) : (
                   <>
                    <i className="fa-solid fa-layer-group"></i>
                    <span>Ready to convert</span>
                   </>
                 )}
              </div>
            ) : (
              <>
                {activeOutputTab === 'preview' ? (
                  <div className="preview-pane-wrapper" style={{ height: '100%' }}>
                    <PreviewPane
                      inputHtml={inputs.html}
                      inputCss={inputs.css}
                      outputHtml={data.convertedHtml || inputs.html}
                      targetLang={targetLang}
                      loading={status === 'loading'}
                    />
                  </div>
                ) : (
                  <div className="results-scroll-area">
                    {data.conversions && Array.isArray(data.conversions) ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                           <button 
                             className="secondary-button" 
                             style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                             onClick={() => {
                               const all = data.conversions.map(c => `/* ${c.selector} */\n${c.tailwindClasses}`).join('\n\n');
                               copyToClipboard(all);
                             }}>
                             Copy All
                           </button>
                        </div>
                        {data.conversions.map((item, idx) => (
                          <div key={idx} className="result-card">
                            <div className="result-header">
                              <span>{item.selector}</span>
                              <button
                                className="copy-icon-btn"
                                onClick={() => copyToClipboard(item.tailwindClasses)}
                                title="Copy"
                              >
                                <i className="fa-regular fa-copy"></i>
                              </button>
                            </div>
                            <pre className="result-code-block">{item.tailwindClasses}</pre>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="result-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                         <textarea
                            className="code-textarea"
                            value={data.convertedHtml || data.convertedCode || ''}
                            readOnly
                            style={{ background: 'var(--bg-tertiary)' }}
                         />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          {activeOutputTab === 'code' && data && !Array.isArray(data.conversions) && (
             <div className="panel-footer">
               <button
                 className="secondary-button full-width"
                 onClick={() => copyToClipboard(data.convertedHtml || data.convertedCode)}
                 style={{ width: '100%' }}
               >
                 <i className="fa-regular fa-copy"></i> Copy Result
               </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
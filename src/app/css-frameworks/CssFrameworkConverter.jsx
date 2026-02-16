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
    setActiveInputTab(activeMode === 'html' ? 'html' : 'css');
    reset();
  }, [activeMode, reset]);

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
        handleInputChange(activeInputTab, content);
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
    if (!text) return;
    navigator.clipboard.writeText(text);
  };
  
  const targetLabel = TARGET_FRAMEWORKS.find(f => f.value === targetLang)?.label || 'Framework';
 
  return (
    <div className="module-container">
      <ModuleHeader 
        title="CSS Framework Converter"
        description="Transform standard CSS/HTML into utility classes or other framework formats."
      />

      <div className="panel toolbar-panel">
        <div className="framework-toolbar">
          <div className="toolbar-group">
            <span className="label-text">Mode:</span>
            <div className="mode-selector">
              {MODES.map(mode => (
                <button
                  key={mode.id}
                  className={`mode-btn ${activeMode === mode.id ? 'selected' : ''}`}
                  onClick={() => setActiveMode(mode.id)}
                >
                  <i className={mode.icon}></i>
                  <span className="btn-label">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-group">
            <span className="label-text">Target:</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="lang-select"
            >
              {TARGET_FRAMEWORKS.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="converter-grid">
        <div className="panel converter-panel">
          <div className="panel-header-row">
            <h3>Input Source</h3>
            <div className="header-actions">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden-input" 
                accept=".css,.html,.txt,.jsx,.tsx"
                onChange={handleFileUpload}
              />
              <button className="file-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <i className="fa-solid fa-upload"></i> Upload
              </button>
              <button className="clear-btn-small" onClick={() => setInputs({ css: '', html: '', context: '' })}>
                Clear
              </button>
            </div>
          </div>

          <div className="tabs-container">
            {activeMode === 'html' && (
              <button className={`tab-btn ${activeInputTab === 'html' ? 'active' : ''}`} onClick={() => setActiveInputTab('html')}>
                <i className="fa-brands fa-html5"></i> HTML
              </button>
            )}
            <button className={`tab-btn ${activeInputTab === 'css' ? 'active' : ''}`} onClick={() => setActiveInputTab('css')}>
              <i className="fa-brands fa-css3-alt"></i> CSS
            </button>
            <button className={`tab-btn ${activeInputTab === 'context' ? 'active' : ''}`} onClick={() => setActiveInputTab('context')}>
              <i className="fa-solid fa-wand-magic-sparkles"></i> Context
            </button>
          </div>

          <div className="editor-container">
            <textarea 
              className="code-editor"
              value={inputs[activeInputTab]}
              onChange={(e) => handleInputChange(activeInputTab, e.target.value)}
              placeholder={
                activeInputTab === 'css' ? ".btn { background: red; padding: 10px; }" :
                activeInputTab === 'html' ? "<div class='card'>...</div>" : "Additional instructions..."
              }
              spellCheck="false"
            />
          </div>

          <div className="action-row">
            <button 
              className="primary-button full-width" 
              onClick={handleConvert} 
              disabled={status === 'loading' || (!inputs.css && !inputs.html)}
            >
              {status === 'loading' ? (
                <><div className="spinner"></div> Converting...</>
              ) : (
                <>Convert to {targetLabel} <i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>
          </div>
          {error && <div className="error-message"><i className="fa-solid fa-circle-exclamation"></i> {error}</div>}
        </div>

        <div className="panel converter-panel">
          <div className="panel-header-row">
            <h3>Generated Output</h3>
            <div className="view-mode-toggles">
              <button className={`view-toggle-btn ${activeOutputTab === 'code' ? 'active' : ''}`} onClick={() => setActiveOutputTab('code')}>
                <i className="fa-solid fa-code"></i> Code
              </button>
              <button 
                className={`view-toggle-btn ${activeOutputTab === 'preview' ? 'active' : ''}`} 
                onClick={() => setActiveOutputTab('preview')}
                disabled={activeMode === 'css' && !inputs.html}
              >
                <i className="fa-solid fa-eye"></i> Preview
              </button>
            </div>
          </div>

          <div className="output-wrapper">
            {!data ? (
              <div className="placeholder-container-inner">
                {status === 'loading' ? (
                   <div className="processing-state"><div className="pulse-ring"></div><p>AI is processing...</p></div>
                ) : (
                  <div><i className="fa-solid fa-wand-magic-sparkles empty-state-icon"></i><p>Result will appear here</p></div>
                )}
              </div>
            ) : (
              <div className="results-container">
                {activeOutputTab === 'preview' ? (
                  <PreviewPane 
                    inputHtml={inputs.html} 
                    inputCss={inputs.css} 
                    outputHtml={data.convertedHtml || inputs.html} 
                    targetLang={targetLang}
                    loading={status === 'loading'}
                  />
                ) : (
                  <div className="code-output-container">
                    {data.conversions && Array.isArray(data.conversions) ? (
                      <div className="selectors-list">
                        {data.conversions.map((item, idx) => (
                          <div key={idx} className="selector-card">
                            <div className="selector-name">{item.selector}</div>
                            <div className="tailwind-code">
                              <code>{item.tailwindClasses}</code>
                              <button className="icon-btn" onClick={() => copyToClipboard(item.tailwindClasses)}><i className="fa-regular fa-copy"></i></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="editor-container">
                        <textarea className="code-editor" value={data.convertedHtml || data.convertedCode || ''} readOnly />
                        <button className="copy-btn-absolute" onClick={() => copyToClipboard(data.convertedHtml || data.convertedCode)}><i className="fa-regular fa-copy"></i> Copy</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
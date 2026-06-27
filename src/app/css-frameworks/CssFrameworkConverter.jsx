'use client';

import { useState, useRef, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { TARGET_FRAMEWORKS, MODES, useConverter } from './components';
import { useDraft } from '@/lib';
import { PreviewPane } from './PreviewPane';
import { CopyButton, CodeEditor } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';

import './CssFrameworks.css';

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
    if (moduleData && (moduleData.type === "css-framework" || moduleData.type === "css-tailwind")) {
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

      let output = moduleData.output || moduleData.fullOutput || moduleData;

      if (typeof output === 'string') {
        try {
          output = JSON.parse(output);
        } catch (e) {
          console.error("Could not parse history output:", e);
        }
      }

      if (output.convertedCode || output.conversions || output.convertedHtml) {
        setData({
          convertedCode: output.convertedCode,
          convertedHtml: output.convertedHtml,
          conversions: output.conversions,
          extra: output.extra
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
  }, [data, activeMode, targetLang, inputs, activeInputTab, activeOutputTab, qualityMode]);

  useDraft(
    'css-framework-draft-data',
    {
      activeMode,
      targetLang,
      activeInputTab,
      activeOutputTab,
      inputs,
      data
    },
    (saved) => {
      if (saved.activeMode) setActiveMode(saved.activeMode);
      if (saved.targetLang) setTargetLang(saved.targetLang);
      if (saved.activeInputTab) setActiveInputTab(saved.activeInputTab);
      if (saved.activeOutputTab) setActiveOutputTab(saved.activeOutputTab);
      if (saved.inputs) setInputs(saved.inputs);
      if (saved.data) setData(saved.data);
    },
    {
      isEmpty: (d) => 
        !d.inputs?.css?.trim() && 
        !d.inputs?.html?.trim() && 
        !d.inputs?.context?.trim() &&
        !d.data,
      skip: moduleData?.type === 'css-framework' || moduleData?.type === 'css-tailwind',
    }
  );

  useEffect(() => {
    if (data && activeOutputTab === 'code') {
      Prism.highlightAll();
    }
  }, [data, activeOutputTab]);

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

  const targetLabel = TARGET_FRAMEWORKS.find(f => f.value === targetLang)?.label || 'Framework';

  const copyAll = data?.conversions ? data.conversions.map(c => `/* ${c.selector} */\n${c.tailwindClasses}`).join('\n\n') : '';

  // Determine the language for the active input tab
  const getEditorLanguage = (tab) => {
    if (tab === 'html') return 'html';
    if (tab === 'css') return 'css';
    return 'plaintext';
  };

  return (
    <div className="module-container">
      <ModuleHeader
        title="CSS Framework Converter"
        description="Transform standard CSS/HTML into utility classes or other framework formats."
        resultData={lastResult}
      />

      <div className="f-framework-toolbar-container">
        <div className="f-toolbar-group">
          <span className="f-toolbar-label">Mode</span>
          <div className="f-mode-selector">
            {MODES.map(mode => (
              <button
                key={mode.id}
                className={`f-mode-btn ${activeMode === mode.id ? 'selected' : ''}`}
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

        <div className="f-toolbar-group f-select-full-width-mobile">
          <span className="f-toolbar-label">Target</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="f-lang-select"
            style={{ minWidth: '160px' }} >
            {TARGET_FRAMEWORKS.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="f-framework-converter-grid">
        <div className="f-converter-panel">
          <div className="f-panel-header">
            <div className="f-panel-title">
              <i className="fa-solid fa-code"></i> Source Code
            </div>
            <div className="f-panel-actions">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden-input"
                accept=".css,.html,.txt,.jsx,.tsx"
                onChange={handleFileUpload}
              />
              <button
                className="f-file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file" >
                <i className="fa-solid fa-upload"></i>
                <span className="f-btn-label">Upload</span>
              </button>
              <button
                className="secondary-button f-clear-btn-small"
                onClick={() => setInputs({ css: '', html: '', context: '' })}  >
                Clear
              </button>
            </div>
          </div>

          <div className="f-tabs-nav">
            {activeMode === 'html' && (
              <button
                className={`f-tab-item ${activeInputTab === 'html' ? 'active' : ''}`}
                onClick={() => setActiveInputTab('html')} >
                <i className="fa-brands fa-html5"></i> HTML
              </button>
            )}
            <button
              className={`f-tab-item ${activeInputTab === 'css' ? 'active' : ''}`}
              onClick={() => setActiveInputTab('css')} >
              <i className="fab fa-css3-alt"></i> CSS
            </button>
            <button
              className={`f-tab-item ${activeInputTab === 'context' ? 'active' : ''}`}
              onClick={() => setActiveInputTab('context')} >
              <i className="fa-solid fa-wand-magic-sparkles"></i> Context
            </button>
          </div>

          <div className="f-panel-content">
            <div className="f-editor-wrapper">
              {activeInputTab === 'context' ? (
                <textarea
                  className="f-code-textarea"
                  value={inputs.context}
                  onChange={(e) => handleInputChange('context', e.target.value)}
                  placeholder="Enter specific instructions (e.g., 'Use REM units', 'Primary color is blue')..."
                  spellCheck="false"
                />
              ) : (
                <CodeEditor
                  value={inputs[activeInputTab]}
                  onValueChange={(value) => handleInputChange(activeInputTab, value)}
                  language={getEditorLanguage(activeInputTab)}
                  placeholder={
                    activeInputTab === 'css'
                      ? '/* Paste CSS here */\n.btn { ... }'
                      : "<div class='card'>...</div>"
                  }
                  lineNumbers={true}
                />
              )}
            </div>
          </div>

          <div className="f-panel-footer">
            <button
              className="primary-button"
              onClick={handleConvert}
              disabled={status === 'loading' || (!inputs.css && !inputs.html)}
              style={{ width: '100%' }} >
              {status === 'loading' ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
              ) : (
                <>Convert to {targetLabel} <i className="fa-solid fa-arrow-right"></i></>
              )}
            </button>
            {error && (
              <div className="error-message has-error"
                style={{ marginTop: '0.5rem' }}>
                <i className="fa-solid fa-circle-exclamation"></i> {error}
              </div>
            )}
          </div>
        </div>

        <div className="f-converter-panel">
          <div className="f-panel-header">
            <div className="f-panel-title">
              <i className="fa-solid fa-bolt"></i> Output
            </div>
            <div className="f-view-toggles">
              <button
                className={`f-view-btn ${activeOutputTab === 'code' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('code')}>
                Code
              </button>
              <button
                className={`f-view-btn ${activeOutputTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('preview')}
                disabled={activeMode === 'css' && !inputs.html} >
                Preview
              </button>
              <button
                className={`f-view-btn ${activeOutputTab === 'extra' ? 'active' : ''}`}
                onClick={() => setActiveOutputTab('extra')}
                disabled={!data?.extra} >
                Extra
              </button>
            </div>
          </div>

          <div className="f-panel-content">
            {!data ? (
              <EmptyState
                isLoading={status === 'loading'}
                condition={!data}
                icon="fab fa-css3-alt"
                title="Awaiting Style Declarations"
                description="Input your layout markup or custom CSS sheets to convert native layout definitions into optimized utility framework classes."
                hint={<>Toggle between <code>Tailwind</code>, <code>Bootstrap</code>, or <code>UnoCSS</code> presets inside the config tab on the fly.</>}
                loadingTitle="Mapping Atomic Layouts"
                loadingDescription="Parsing style cascading trees and matching native style variables against functional utilities..."
              />
            ) : (
              <>
                {activeOutputTab === 'preview' ? (
                  <div className="f-preview-pane-wrapper" style={{ height: '100%' }}>
                    <PreviewPane
                      inputHtml={inputs.html}
                      inputCss={inputs.css}
                      outputHtml={data.convertedHtml || inputs.html}
                      targetLang={targetLang}
                      loading={status === 'loading'}
                    />
                  </div>
                ) : activeOutputTab === "extra" ? (
                  <div className="f-results-scroll-area">
                    <div className="f-result-card" style={{ padding: '5px' }}>
                      <h4>Implementation Notes & Leftovers</h4>
                      {data.extra || "No extra implementation details provided."}
                    </div>
                  </div>
                ) : (
                  <div className="f-results-scroll-area">
                    {data.conversions && Array.isArray(data.conversions) ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                          <CopyButton codeToCopy={copyAll} className="secondary-button" label="Copy All" />
                        </div>

                        {data.conversions.map((item, idx) => (
                          <div key={idx} className="f-result-card">
                            <div className="f-result-header">
                              <span>{item.selector}</span>
                              <CopyButton className="f-copy-icon-btn" codeToCopy={item.tailwindClasses} iconOnly={true} />
                            </div>

                            <pre className="f-result-code-block">
                              <code className="language-css">{item.tailwindClasses}</code>
                            </pre>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="f-result-card">
                        <pre className="f-result-code-block" style={{ margin: 0 }}>
                          <code className={`language-${data.convertedHtml ? 'html' : 'css'}`}>
                            {data.convertedHtml || data.convertedCode || ''}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {activeOutputTab === 'code' && data && !Array.isArray(data.conversions) && (
            <div className="f-panel-footer">
              <CopyButton
                codeToCopy={data.convertedHtml || data.convertedCode}
                className="secondary-button"
                label="Copy"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
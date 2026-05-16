'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode } from '@/lib';
import { CopyButton } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context';
import JSON5 from 'json5';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

import './JsonFormatter.css';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState(false);
  const [viewMode, setViewMode] = useState('code');
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  
  const fileInputRef = useRef(null);
  const { moduleData, qualityMode } = useApp();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkTheme(mediaQuery.matches);
    
    const handleChange = (e) => setIsDarkTheme(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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

  const handleLocalFormat = () => {
    const sourceCode = outputCode.trim() || input.trim();
    if (!sourceCode) return;
    
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(sourceCode);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutputCode(formatted);
      setExplanation("Valid JSON: Formatted locally instantly.");
    } catch (strictError) {
      try {
        const looseParsed = JSON5.parse(sourceCode);
        const formatted = JSON.stringify(looseParsed, null, 2);
        setOutputCode(formatted);
        setExplanation("Loose JSON fixed locally via JSON5.");
      } catch (looseError) {
        const msg = looseError.message || strictError.message;
        const match = msg.match(/line (\d+) column (\d+)/) || msg.match(/position (\d+)/);
        const loc = match ? ` at ${match[0]}` : '';
        setErrorMsg(`Syntax Error${loc}: Click 'AI Fix & Format' to auto-repair.`);
      }
    }
  };

  const handleMinify = () => {
    const sourceCode = outputCode.trim() || input.trim();
    if (!sourceCode) return;
    
    setErrorMsg(null);
    try {
      const parsed = JSON5.parse(sourceCode);
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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
    e.target.value = '';
  };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setInput(event.target.result);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const loadSample = () => {
    setInput('{\n  "status": "broken",\n  "error": "missing quotes and commas"\n  unquoted_key: 123\n  "list": [1, 2, 3,]\n}');
    setErrorMsg(null);
  };

  const getJsonForTree = useCallback(() => {
    try {
      return outputCode ? JSON.parse(outputCode) : {};
    } catch (e) {
      return { error: "Parse error. Switch to Code view to fix." };
    }
  }, [outputCode]);

  const handleTreeEdit = (params) => {
    try {
      setOutputCode(JSON.stringify(params.src, null, 2));
    } catch (e) {
      console.error("Failed to sync tree edit.");
    }
  };

  return (
    <div className="module-container">
      <ModuleHeader 
        title="JSON Formatter & Validator"
        description="Format instantly, or use AI to automatically repair broken JSON structures."
        resultData={lastResult}
      />

      <div className="converter-grid json-flex-layout">
        <div className="panel flex-panel">
          <div className="panel-header-row">
            <h3>Input JSON</h3>
            <div className="header-actions">
              <input 
                type="file" 
                accept=".json,.txt,.js" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden-input"
                style={{ display: 'none' }}
              />
              <button className="file-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <i className="fa-solid fa-upload"></i> Upload
              </button>
              <button className="mode-btn" onClick={loadSample}>Load Sample</button>
            </div>
          </div>

          <div 
            className={`input-wrapper ${isDragging ? 'drag-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <textarea 
              value={input} 
              onChange={(e) => { setInput(e.target.value); setErrorMsg(null); }} 
              placeholder='Paste JSON here, or drag & drop a file...' 
              spellCheck="false"
              className={`json-textarea ${errorMsg ? 'has-error' : ''}`}
            />
            {input && (
              <button className="clear-input-btn" onClick={() => setInput('')} title="Clear Input">
                <i className="fa-solid fa-times"></i>
              </button>
            )}
            {isDragging && <div className="drag-overlay">Drop file to load</div>}
          </div>

          {errorMsg && <div className="error-message"><i className="fa-solid fa-circle-exclamation"></i> {errorMsg}</div>}
              
          <div className="action-row space-between">
            <button className="secondary-button" onClick={handleLocalFormat} disabled={!input.trim()}>
              <i className="fa-solid fa-bolt"></i> Format Locally
            </button>
            <button className="primary-button ai-glow" onClick={handleAiFix} disabled={loading || !input.trim()}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
              {loading ? 'Repairing...' : 'AI Fix Syntax'}
            </button>
          </div>
        </div>

        <div className="panel flex-panel">
          <div className="panel-header-row">
            <h3>Formatted Output</h3>
            <div className="controls-wrapper">
              <div className="view-mode-toggles">
                <button 
                  className={`view-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                  onClick={() => setViewMode('code')}>
                  <i className="fa-solid fa-code"></i> Code
                </button>
                <button 
                  className={`view-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                  onClick={() => setViewMode('tree')}
                  disabled={!outputCode || !!errorMsg}>
                  <i className="fa-solid fa-folder-tree"></i> Tree
                </button>
              </div>
              <div className="output-actions">
                <button title="Minify" className="action-btn" onClick={handleMinify} disabled={!outputCode && !input}><i className="fa-solid fa-compress"></i></button>
                <button title="Prettify" className="action-btn" onClick={handleLocalFormat} disabled={!outputCode && !input}><i className="fa-solid fa-align-left"></i></button>
              </div>
            </div>
          </div>

          <div className="results-container flex-results">
            {outputCode ? (
              <>
                <div className="output-wrapper json-output-box"> 
                  {viewMode === 'code' ? (
                    <>
                      <textarea 
                        value={outputCode} 
                        onChange={(e) => setOutputCode(e.target.value)}
                        className="output-textarea json-textarea"
                        spellCheck="false"
                      />
                      <CopyButton codeToCopy={outputCode} />
                    </>
                  ) : (
                    <div className="tree-view-container">
                      <JsonView 
                        src={getJsonForTree()} 
                        theme={isDarkTheme ? "ocean" : "rjv-default"}
                        iconStyle="triangle"
                        displayDataTypes={false}
                        enableClipboard={true}
                        editable={true}
                        onChange={handleTreeEdit}
                        onAdd={handleTreeEdit}
                        onDelete={handleTreeEdit}
                      />
                    </div>
                  )}
                </div>

                {explanation && (
                  <div className="ai-summary json-explanation">
                    <strong><i className="fa-solid fa-clipboard-check"></i> Output Log:</strong>
                    <div className="explanation-content">{explanation}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="placeholder-text">
                {loading ? (
                  <div className="processing-state">
                    <div className="pulse-ring"></div>
                    <p>AI is analyzing and rebuilding your JSON...</p>
                  </div>
                ) : 'Formatted JSON will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
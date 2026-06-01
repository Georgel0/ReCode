'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode } from '@/lib';
import { CopyButton } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';
import JSON5 from 'json5';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';

import './JsonFormatter.css';

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const TREE_DEBOUNCE_MS = 150;

/**
 * Sorts all object keys recursively in alphabetical order.
 * @param {unknown} value
 * @returns {unknown}
 */
const sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
};

/**
 * Extracts only the JSON content from a markdown code block.
 * Handles cases where the AI wraps the response in ```json ... ``` and also
 * emits conversational text before or after the block.
 * @param {string} raw
 * @returns {string}
 */
const extractJsonFromMarkdown = (raw) => {
  // Try to grab the content between ```json (or ```) fences first.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Fallback: strip any stray fence markers and trim.
  return raw.replace(/```json|```/g, '').trim();
};

/**
 * Triggers a browser download of a text file.
 * @param {string} content
 * @param {string} filename
 */
const downloadFile = (content, filename) => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

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
  const [sortKeys, setSortKeys] = useState(false);

  const treeDebounceRef = useRef(null);

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

  useEffect(() => {
    // Wipe output only if the user is actively re-typing fresh input.
    // We do NOT wipe when input is programmatically set from moduleData (handled above).
    setErrorMsg(null);
  }, [input]);


  const parseJsonResponse = (rawOutput) => {
    if (typeof rawOutput === 'object' && rawOutput !== null) {
      return {
        code: rawOutput.formattedJson || '',
        info: rawOutput.explanation || 'JSON formatted successfully.',
      };
    }
    try {
      const clean = extractJsonFromMarkdown(rawOutput || '');
      const parsed = JSON.parse(clean);
      return {
        code: parsed.formattedJson || rawOutput,
        info: parsed.explanation || 'JSON formatted and repaired.',
      };
    } catch {
      return { code: rawOutput || '', info: 'AI formatted the JSON.' };
    }
  };

  const handleLocalFormat = () => {
    const sourceCode = input.trim();
    if (!sourceCode) return;

    setErrorMsg(null);
    try {
      let parsed = JSON.parse(sourceCode);
      if (sortKeys) parsed = sortKeysDeep(parsed);
      setOutputCode(JSON.stringify(parsed, null, 2));
      setExplanation('Valid JSON – formatted locally.');
    } catch {
      try {
        let looseParsed = JSON5.parse(sourceCode);
        if (sortKeys) looseParsed = sortKeysDeep(looseParsed);
        setOutputCode(JSON.stringify(looseParsed, null, 2));
        setExplanation('Loose JSON fixed locally via JSON5.');
      } catch (looseError) {
        const msg = looseError.message || '';
        const match = msg.match(/line \d+ column \d+/) || msg.match(/position \d+/);
        const loc = match ? ` at ${match[0]}` : '';
        setErrorMsg(`Syntax Error${loc}: Click 'AI Fix & Format' to auto-repair.`);
      }
    }
  };

  const handleMinify = () => {
    const sourceCode = outputCode.trim() || input.trim();
    if (!sourceCode) return;

    setErrorMsg(null);
    // Fast path: native JSON.parse
    try {
      setOutputCode(JSON.stringify(JSON.parse(sourceCode)));
      setExplanation('JSON minified to a single line.');
      return;
    } catch {
      // Fall through to JSON5
    }
    // Slow path: JSON5 for lenient input
    try {
      setOutputCode(JSON.stringify(JSON5.parse(sourceCode)));
      setExplanation('JSON5 parsed and minified.');
    } catch {
      setErrorMsg('Invalid JSON: Minification requires valid syntax.');
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
        setLastResult({ type: 'json', input, output: result });
      }
    } catch (error) {
      alert(`Fix failed: ${error.message}`);
    }
    setLoading(false);
  };

  const handleDownload = () => {
    if (!outputCode.trim()) return;
    downloadFile(outputCode, 'output.json');
  };

  const readFile = (file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setInput(event.target.result);
      setOutputCode('');
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
    e.target.value = '';
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
    setInput(
      '{\n  "status": "broken",\n  "error": "missing quotes and commas"\n  unquoted_key: 123\n  "list": [1, 2, 3,]\n}'
    );
    setOutputCode('');
    setErrorMsg(null);
  };

  const getJsonForTree = useCallback(() => {
    try {
      return outputCode ? JSON.parse(outputCode) : {};
    } catch {
      return { error: 'Parse error. Switch to Code view to fix.' };
    }
  }, [outputCode]);

  /**
   * Debounced tree edit handler to avoid heavy JSON.stringify on every keystroke
   * in large deeply-nested objects.
   */
  const handleTreeEdit = (params) => {
    if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current);
    treeDebounceRef.current = setTimeout(() => {
      try {
        setOutputCode(JSON.stringify(params.src, null, 2));
      } catch {
        console.error('Failed to sync tree edit.');
      }
    }, TREE_DEBOUNCE_MS);
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
                style={{ display: 'none' }}
                aria-label="Upload JSON file"
              />
              <button
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload a JSON file from your device"
              >
                <i className="fa-solid fa-upload" aria-hidden="true"></i> Upload
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
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste JSON here, or drag & drop a file…"
              spellCheck="false"
              className={`json-textarea ${errorMsg ? 'has-error' : ''}`}
              aria-label="JSON input"
              aria-describedby={errorMsg ? 'json-error-msg' : undefined}
            />
            {input && (
              <button
                className="clear-input-btn"
                onClick={() => { setInput(''); setOutputCode(''); }}
                title="Clear input"
                aria-label="Clear JSON input"
              >
                <i className="fa-solid fa-times" aria-hidden="true"></i>
              </button>
            )}
            {isDragging && (
              <div className="drag-overlay" aria-hidden="true">Drop file to load</div>
            )}
          </div>

          {errorMsg && (
            <div className="error-message" id="json-error-msg" role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errorMsg}
            </div>
          )}

          <label className="sort-keys-toggle">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              aria-label="Sort JSON keys alphabetically when formatting"
            />
            <span>Sort keys alphabetically</span>
          </label>

          <div className="action-row space-between">
            <button
              className="secondary-button"
              onClick={handleLocalFormat}
              disabled={!input.trim()}
              aria-label="Format JSON locally without AI"
            >
              <i className="fa-solid fa-bolt" aria-hidden="true"></i> Format Locally
            </button>
            <button
              className="primary-button ai-glow"
              onClick={handleAiFix}
              disabled={loading || !input.trim()}
              aria-label={loading ? 'AI is repairing JSON…' : 'Use AI to fix and format JSON syntax errors'}
            >
              <i
                className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}
                aria-hidden="true"
              ></i>
              {loading ? 'Repairing…' : 'AI Fix Syntax'}
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
                  onClick={() => setViewMode('code')}
                  aria-pressed={viewMode === 'code'}
                  aria-label="Switch to code view"
                >
                  <i className="fa-solid fa-code" aria-hidden="true"></i> Code
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                  onClick={() => setViewMode('tree')}
                  disabled={!outputCode || !!errorMsg}
                  aria-pressed={viewMode === 'tree'}
                  aria-label="Switch to interactive tree view"
                >
                  <i className="fa-solid fa-folder-tree" aria-hidden="true"></i> Tree
                </button>
              </div>
              <div className="output-actions">
                <button
                  title="Minify JSON"
                  aria-label="Minify JSON to a single line"
                  className="action-btn"
                  onClick={handleMinify}
                  disabled={!outputCode && !input}
                >
                  <i className="fa-solid fa-compress" aria-hidden="true"></i>
                </button>
                <button
                  title="Prettify JSON"
                  aria-label="Prettify and indent JSON"
                  className="action-btn"
                  onClick={handleLocalFormat}
                  disabled={!outputCode && !input}
                >
                  <i className="fa-solid fa-align-left" aria-hidden="true"></i>
                </button>
                <button
                  title="Download JSON"
                  aria-label="Download formatted JSON as a file"
                  className="action-btn download-btn"
                  onClick={handleDownload}
                  disabled={!outputCode}
                >
                  <i className="fa-solid fa-download" aria-hidden="true"></i>
                </button>
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
                        aria-label="Formatted JSON output"
                      />
                      <div className="output-copy-row">
                        <CopyButton codeToCopy={outputCode} />
                        <button
                          className="secondary-button"
                          onClick={handleDownload}
                          aria-label="Download formatted JSON file"
                          title="Download JSON"
                        >
                          <i className="fa-solid fa-download" aria-hidden="true"></i> Download
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="tree-view-container" role="region" aria-label="Interactive JSON tree">
                      <JsonView
                        src={getJsonForTree()}
                        theme={isDarkTheme ? 'ocean' : 'rjv-default'}
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
                  <div className="ai-summary json-explanation" role="status" aria-live="polite">
                    <strong>
                      <i className="fa-solid fa-clipboard-check" aria-hidden="true"></i> Output Log:
                    </strong>
                    <div className="explanation-content">{explanation}</div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                isLoading={loading}
                condition={!outputCode}
                icon="fas fa-list-alt"
                title="Awaiting JSON Payload"
                description="Beautifully indented JSON files and interactive collapsible syntax tree nodes will map out here."
                hint={
                  <>
                    You can paste raw <code>JSON5</code> objects—the parser will automatically
                    append missing quotes and remove illegal comments.
                  </>
                }
                loadingTitle="Structuring Hierarchies"
                loadingDescription="Analyzing tokens, repairing missing properties, and preparing interactive object trees…"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
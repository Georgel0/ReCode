'use client';

import { useRef, useEffect } from 'react';
import { convertCode } from '@/lib';
import { CopyButton } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import { useJsonFormatter } from './useJsonFormatter';

import './JsonFormatter.css';

export default function JsonFormatter() {
  const { moduleData, qualityMode } = useApp();
  const fileInputRef = useRef(null);

  // Initialize the massive state/handler hook
  const {
    input, setInput,
    outputCode, setOutputCode,
    explanation,
    loading,
    errorMsg, setErrorMsg,
    lastResult,
    viewMode, setViewMode,
    isDragging,
    isDarkTheme,
    sortKeys, setSortKeys,
    indentSize, setIndentSize,
    autoFormat, setAutoFormat,
    jsonSchemaText, setJsonSchemaText,
    schemaErrors,
    jsonPathQuery, setJsonPathQuery,
    jsonPathResult,
    diffInput, setDiffInput,
    diffResult,
    zodOutput, setZodOutput,
    zodLoading,
    urlInput, setUrlInput,
    urlLoading,
    history,
    showHistory, setShowHistory,
    conversionResult, setConversionResult,
    convertLoading,
    outputCounts,

    handleLocalFormat,
    handleMinify,
    handleAiFix,
    handlePaste,
    handleDownload,
    handleFileUpload,
    onDragOver,
    onDragLeave,
    onDrop,
    loadSample,
    handleUrlImport,
    handleConvert,
    handleGenerateZod,
    handleZodToExample,
    getJsonForTree,
    handleTreeEdit,
    handleRestoreHistory,
    handleDeleteHistory,
  } = useJsonFormatter({ convertCode, qualityMode, moduleData });

  return (
    <div className="module-container">
      <ModuleHeader
        title="JSON Formatter & Validator"
        description="Format instantly, validate against schemas, run JSONPath, or use AI to repair structures."
        resultData={lastResult}
      />

      <div className="converter-grid json-flex-layout">
        
        {/* ── LEFT PANEL: INPUT ── */}
        <div className="panel flex-panel">
          <div className="panel-header-row">
            <h3>Input JSON</h3>
            <div className="header-actions">
              <input
                type="file"
                accept=".json,.txt,.js,.yaml,.yml,.toml"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                aria-label="Upload file"
              />
              <button
                className="icon-btn-sm"
                onClick={() => setShowHistory(!showHistory)}
                title="View History"
              >
                <i className="fa-solid fa-clock-rotate-left"></i> History
              </button>
              <button
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload JSON, YAML, or TOML"
              >
                <i className="fa-solid fa-upload"></i> Upload
              </button>
              <button className="mode-btn" onClick={loadSample}>Sample</button>
            </div>
          </div>

          <div className="url-import-bar">
            <input
              className="url-import-input"
              placeholder="Paste a URL or cURL command..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
            />
            <button
              className="secondary-button url-fetch-btn"
              onClick={handleUrlImport}
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-cloud-arrow-down" />}
              Fetch
            </button>
          </div>

          {showHistory && (
            <div className="history-panel">
              <div className="history-panel-header">
                <span><i className="fa-solid fa-clock-rotate-left"></i> Recent Sessions</span>
                <button className="history-clear-btn" onClick={() => { setInput(''); handleDeleteHistory(history[0]?.id); }}>
                  Clear All
                </button>
              </div>
              <div className="history-list">
                {history.length ? history.map((entry) => (
                  <div key={entry.id} className="history-item">
                    <div className="history-item-preview" onClick={() => handleRestoreHistory(entry)}>
                      {entry.input}
                    </div>
                    <div className="history-item-meta">
                      <span className="history-item-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      <button className="history-restore-btn" onClick={() => handleRestoreHistory(entry)}>Restore</button>
                    </div>
                  </div>
                )) : (
                  <div className="history-empty">No history recorded yet.</div>
                )}
              </div>
            </div>
          )}

          <div
            className={`input-wrapper ${isDragging ? 'drag-active' : ''} mt-2`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste JSON, YAML, TOML here, or drag & drop a file…"
              spellCheck="false"
              className={`json-textarea ${errorMsg ? 'has-error' : ''}`}
            />
            {input && (
              <button className="clear-input-btn" onClick={() => { setInput(''); setOutputCode(''); }}>
                <i className="fa-solid fa-times"></i>
              </button>
            )}
            {isDragging && <div className="drag-overlay">Drop file to load & parse</div>}
          </div>

          {errorMsg && (
            <div className="error-message mt-2">
              <i className="fa-solid fa-circle-exclamation"></i> {errorMsg}
            </div>
          )}

          <div className="action-row space-between mt-3">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label className="custom-check" title="Sort JSON keys alphabetically">
                <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Sort keys</span>
              </label>
              
              <label className="auto-format-toggle" title="Automatically format JSON upon pasting">
                <input type="checkbox" checked={autoFormat} onChange={(e) => setAutoFormat(e.target.checked)} />
                Auto-format on paste
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="secondary-button"
                onClick={() => handleLocalFormat(input)}
                disabled={!input.trim()}
              >
                <i className="fa-solid fa-bolt"></i> Format
              </button>
              <button
                className="primary-button ai-glow"
                onClick={handleAiFix}
                disabled={loading || !input.trim()}
              >
                <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                {loading ? 'Repairing…' : 'AI Fix Syntax'}
              </button>
            </div>
          </div>
        </div>


        {/* ── RIGHT PANEL: OUTPUT & TOOLS ── */}
        <div className="panel flex-panel">
          
          <div className="output-tabs">
            <button className={`output-tab-btn ${viewMode === 'code' ? 'active' : ''}`} onClick={() => setViewMode('code')}>
              <i className="fa-solid fa-code"></i> Code
            </button>
            <button className={`output-tab-btn ${viewMode === 'tree' ? 'active' : ''}`} onClick={() => setViewMode('tree')} disabled={!outputCode || !!errorMsg}>
              <i className="fa-solid fa-folder-tree"></i> Tree
            </button>
            <button className={`output-tab-btn ${viewMode === 'diff' ? 'active' : ''}`} onClick={() => setViewMode('diff')}>
              <i className="fa-solid fa-not-equal"></i> Diff
            </button>
            <button className={`output-tab-btn zod-tab ${viewMode === 'zod' ? 'active' : ''}`} onClick={() => { setViewMode('zod'); if (!zodOutput) handleGenerateZod(); }} disabled={!outputCode}>
              <i className="fa-solid fa-cubes"></i> Zod Schema
            </button>
          </div>

          <div className="results-container flex-results">
            {viewMode === 'code' && (
              <>
                <div className="output-header">
                  <div className="indent-toggle">
                    <span className="indent-toggle-label">Indent:</span>
                    {['2', '4', 'tab'].map(v => (
                      <button key={v} className={`indent-btn ${indentSize === v ? 'active' : ''}`} onClick={() => setIndentSize(v)}>{v}</button>
                    ))}
                  </div>
                  <div className="conversion-bar" style={{ padding: 0, marginLeft: '0.5rem' }}>
                    <button className="convert-btn yaml-btn" onClick={() => handleConvert('yaml')} disabled={!outputCode || convertLoading}>YAML</button>
                    <button className="convert-btn toml-btn" onClick={() => handleConvert('toml')} disabled={!outputCode || convertLoading}>TOML</button>
                    <button className="convert-btn csv-btn" onClick={() => handleConvert('csv')} disabled={!outputCode || convertLoading}>CSV</button>
                  </div>
                  <div className="output-stats">
                    <span className="stat-badge chars">{outputCounts.chars} chars</span>
                    <span className="stat-badge tokens">~{outputCounts.tokens} tokens</span>
                  </div>
                </div>

                <div className="jsonpath-bar">
                  <input
                    className="jsonpath-input"
                    placeholder="JSONPath query (e.g., $.users[*].id)"
                    value={jsonPathQuery}
                    onChange={(e) => setJsonPathQuery(e.target.value)}
                    disabled={!outputCode}
                  />
                  {jsonPathResult?.values?.length > 0 && (
                    <span className="jsonpath-result-count">{jsonPathResult.values.length} matches</span>
                  )}
                </div>

                {jsonPathQuery && jsonPathResult?.values?.length > 0 && (
                  <div className="jsonpath-results-panel">
                    <div className="jsonpath-results-header">
                      <span>Query Results</span>
                    </div>
                    <div className="jsonpath-results-body">
                      {jsonPathResult.values.map((val, idx) => (
                        <div key={idx} className="jsonpath-result-item">
                          <span style={{ color: '#a78bfa', marginRight: '8px' }}>{jsonPathResult.paths[idx]}</span>
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {conversionResult ? (
                  <div className="converted-output-panel">
                    <div className="action-row space-between" style={{ paddingBottom: '0.5rem' }}>
                      <span className={`converted-format-badge ${conversionResult.format}`}>
                        {conversionResult.format} Output
                      </span>
                      <button className="icon-btn-sm" onClick={() => setConversionResult(null)}>
                        <i className="fa-solid fa-arrow-left"></i> Back to JSON
                      </button>
                    </div>
                    <textarea value={conversionResult.content} readOnly className="output-textarea json-textarea" />
                    <div className="output-copy-row">
                      <CopyButton codeToCopy={conversionResult.content} />
                      <button className="secondary-button" onClick={() => downloadFile(conversionResult.content, `output.${conversionResult.format}`)}>
                        <i className="fa-solid fa-download"></i> Download {conversionResult.format.toUpperCase()}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="output-wrapper json-output-box" style={{ marginTop: '0.5rem' }}>
                    <textarea
                      value={outputCode}
                      onChange={(e) => setOutputCode(e.target.value)}
                      className="output-textarea json-textarea"
                      spellCheck="false"
                      placeholder="Formatted JSON will appear here..."
                    />
                    <div className="output-copy-row">
                      <CopyButton codeToCopy={outputCode} />
                      <button className="icon-btn-sm" onClick={handleMinify} title="Minify JSON" disabled={!outputCode}>
                        <i className="fa-solid fa-compress"></i>
                      </button>
                      <button className="secondary-button" onClick={handleDownload} disabled={!outputCode}>
                        <i className="fa-solid fa-download"></i> Download
                      </button>
                    </div>
                  </div>
                )}

                <div className="schema-validation-panel">
                  <div className="schema-validation-header" onClick={() => !jsonSchemaText && setJsonSchemaText('{\n  "type": "object",\n  "properties": {}\n}')}>
                    <div className="header-left">
                      <div className={`schema-status-dot ${schemaErrors.length ? 'invalid' : jsonSchemaText && outputCode ? 'valid' : 'idle'}`} />
                      JSON Schema Validation
                    </div>
                    <i className={`fa-solid fa-chevron-${jsonSchemaText ? 'down' : 'right'}`} style={{ color: 'var(--text-secondary)' }}></i>
                  </div>
                  {jsonSchemaText !== '' && (
                    <div className="schema-validation-body">
                      <textarea
                        className="schema-textarea"
                        placeholder="Paste JSON Schema here to validate your output..."
                        value={jsonSchemaText}
                        onChange={(e) => setJsonSchemaText(e.target.value)}
                      />
                      {schemaErrors.length > 0 ? (
                        <div className="schema-errors-list">
                          {schemaErrors.map((err, i) => (
                            <div key={i} className="schema-error-item">
                              <span className="schema-error-path">{err.path}</span>
                              <span className="schema-error-msg">{err.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : jsonSchemaText && outputCode && (
                        <div className="schema-valid-msg">
                          <i className="fa-solid fa-circle-check"></i> Passes validation
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {viewMode === 'tree' && (
              <div className="tree-view-container">
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

            {viewMode === 'diff' && (
              <div className="diff-container">
                <div className="diff-input-col">
                  <div className="diff-label left">Original Output (A)</div>
                  <textarea value={outputCode} readOnly className="json-textarea" style={{ minHeight: '150px' }} />
                </div>
                <div className="diff-input-col">
                  <div className="diff-label right">Compare Against (B)</div>
                  <textarea 
                    value={diffInput} 
                    onChange={(e) => setDiffInput(e.target.value)} 
                    className="json-textarea" 
                    style={{ minHeight: '150px' }}
                    placeholder="Paste JSON here to find differences..." 
                  />
                </div>
              </div>
            )}
            
            {viewMode === 'diff' && diffInput && (
              <div className="diff-result-panel mt-3">
                {diffResult?.length > 0 ? diffResult.map((diff, i) => (
                  <div key={i} className={`diff-line ${diff.type}`}>
                    <div className="diff-gutter">
                      {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~'}
                    </div>
                    <div className="diff-content">
                      <strong>{diff.path}</strong>:{' '}
                      {diff.type === 'added' ? JSON.stringify(diff.b) : 
                       diff.type === 'removed' ? JSON.stringify(diff.a) : 
                       `${JSON.stringify(diff.a)} → ${JSON.stringify(diff.b)}`}
                    </div>
                  </div>
                )) : (
                  <div className="diff-empty-msg">No structural differences found.</div>
                )}
              </div>
            )}

            {viewMode === 'zod' && (
              <div className="zod-output-panel">
                <div className="zod-meta-bar">
                  <span className="zod-meta-badge">Zod Definition</span>
                  <button className="zod-generate-json-btn" onClick={handleGenerateZod} disabled={!outputCode || zodLoading}>
                    {zodLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-rotate"></i>} Regenerate
                  </button>
                  <button className="zod-generate-json-btn" onClick={handleZodToExample} disabled={!zodOutput} style={{ marginLeft: 'auto' }}>
                    <i className="fa-solid fa-vial"></i> Gen Example JSON
                  </button>
                </div>
                <textarea value={zodOutput} readOnly className="output-textarea json-textarea" placeholder="Zod schema will be inferred here..." />
                <div className="output-copy-row">
                  <CopyButton codeToCopy={zodOutput} />
                  <button className="secondary-button" onClick={() => downloadFile(zodOutput, 'schema.ts')}>
                    <i className="fa-brands fa-js"></i> Save .ts
                  </button>
                </div>
              </div>
            )}

            {explanation && (
              <div className="ai-summary json-explanation mt-3">
                <strong><i className="fa-solid fa-clipboard-check"></i> Action Log:</strong>
                <div className="explanation-content">{explanation}</div>
              </div>
            )}
            
            {!outputCode && viewMode === 'code' && !conversionResult && (
              <EmptyState
                isLoading={loading}
                condition={!outputCode}
                icon="fas fa-list-alt"
                title="Awaiting JSON Payload"
                description="Indented JSON, tree nodes, schema validations, and TypeScript interface generation will map out here."
                hint={<>You can paste raw <code>JSON5</code> objects—the parser will append quotes and strip comments automatically.</>}
                loadingTitle="Structuring Hierarchies"
                loadingDescription="Analyzing tokens, repairing properties, and preparing data nodes…"
              />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
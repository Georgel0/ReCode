'use client';

import { useRef } from 'react';
import { convertCode } from '@/lib';
import { CopyButton } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import { useJsonFormatter } from './useJsonFormatter';
import { downloadFile } from './jsonFormatter.utils';

import './JsonFormatter.base.css';
import './JsonFormatter.panels.css';

export default function JsonFormatter() {
  const { moduleData, qualityMode } = useApp();
  const fileInputRef = useRef(null);

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

  const diffCounts = diffResult?.reduce(
    (acc, d) => {
      if (d.type === 'added') acc.added++;
      else if (d.type === 'removed') acc.removed++;
      else acc.same++;
      return acc;
    },
    { added: 0, removed: 0, same: 0 }
  ) ?? null;

  const handleClearAllHistory = () => {
    history.forEach((entry) => handleDeleteHistory(entry.id));
  };

  return (
    <div className="module-container">
      <ModuleHeader
        title="JSON Formatter & Validator"
        description="Format instantly, validate against schemas, run JSONPath, or use AI to repair structures."
        resultData={lastResult}
      />

      <div className="converter-grid json-flex-layout">

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
                title="View history"
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                <span>History</span>
              </button>
              <button
                className="icon-btn-sm"
                onClick={() => fileInputRef.current?.click()}
                title="Upload JSON, YAML, or TOML"
              >
                <i className="fa-solid fa-upload"></i>
                <span>Upload</span>
              </button>
              <button className="icon-btn-sm" onClick={loadSample}>
                Sample
              </button>
            </div>
          </div>

          <div className="url-import-bar">
            <input
              className="url-import-input"
              placeholder="Paste a URL or cURL command…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
            />
            <button
              className="secondary-button url-fetch-btn"
              onClick={handleUrlImport}
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading
                ? <i className="fa-solid fa-spinner fa-spin"></i>
                : <i className="fa-solid fa-cloud-arrow-down"></i>}
              Fetch
            </button>
          </div>

          {showHistory && (
            <div className="history-panel">
              <div className="history-panel-header">
                <span>
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Recent Sessions
                </span>
                <button
                  className="history-clear-btn"
                  onClick={handleClearAllHistory}
                >
                  Clear All
                </button>
              </div>
              <div className="history-list">
                {history.length ? history.map((entry) => (
                  <div key={entry.id} className="history-item">
                    <div
                      className="history-item-preview"
                      onClick={() => handleRestoreHistory(entry)}
                      title="Click to restore"
                    >
                      {entry.input}
                    </div>
                    <div className="history-item-meta">
                      <span className="history-item-time">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <div className="history-item-actions">
                        <button
                          className="history-restore-btn"
                          onClick={() => handleRestoreHistory(entry)}
                        >
                          Restore
                        </button>
                        <button
                          className="history-delete-btn"
                          onClick={() => handleDeleteHistory(entry.id)}
                          title="Delete entry"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="history-empty">No history recorded yet.</div>
                )}
              </div>
            </div>
          )}

          <div
            className={`input-wrapper${isDragging ? ' drag-active' : ''}`}
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
              className={`json-textarea${errorMsg ? ' has-error' : ''}`}
            />
            {input && (
              <button
                className="clear-input-btn"
                onClick={() => { setInput(''); setOutputCode(''); setErrorMsg(null); }}
                title="Clear input"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            )}
            {isDragging && (
              <div className="drag-overlay">Drop file to load & parse</div>
            )}
          </div>

          {errorMsg && (
            <div className="error-message">
              <i className="fa-solid fa-circle-exclamation"></i>
              {errorMsg}
            </div>
          )}

          <div className="action-row input-controls-row">
            <div className="controls-left">
              <label className="custom-check" title="Sort JSON keys alphabetically">
                <input
                  type="checkbox"
                  checked={sortKeys}
                  onChange={(e) => setSortKeys(e.target.checked)}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Sort keys</span>
              </label>
              <label className="toggle-label" title="Automatically format JSON upon pasting">
                <input
                  type="checkbox"
                  checked={autoFormat}
                  onChange={(e) => setAutoFormat(e.target.checked)}
                />
                <span>Auto-format on paste</span>
              </label>
            </div>
            <div className="controls-right">
              <button
                className="secondary-button"
                onClick={() => handleLocalFormat(input)}
                disabled={!input.trim()}
              >
                <i className="fa-solid fa-bolt"></i>
                Format
              </button>
              <button
                className="primary-button ai-glow"
                onClick={handleAiFix}
                disabled={loading || !input.trim()}
              >
                <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                {loading ? 'Repairing…' : 'AI Fix'}
              </button>
            </div>
          </div>

        </div>

        <div className="panel flex-panel">

          <div className="output-tabs">
            <button
              className={`output-tab-btn${viewMode === 'code' ? ' active' : ''}`}
              onClick={() => setViewMode('code')}
            >
              <i className="fa-solid fa-code"></i>
              Code
            </button>
            <button
              className={`output-tab-btn${viewMode === 'tree' ? ' active' : ''}`}
              onClick={() => setViewMode('tree')}
              disabled={!outputCode || !!errorMsg}
            >
              <i className="fa-solid fa-folder-tree"></i>
              Tree
            </button>
            <button
              className={`output-tab-btn${viewMode === 'diff' ? ' active' : ''}`}
              onClick={() => setViewMode('diff')}
            >
              <i className="fa-solid fa-not-equal"></i>
              Diff
            </button>
            <button
              className={`output-tab-btn zod-tab${viewMode === 'zod' ? ' active' : ''}`}
              onClick={() => { setViewMode('zod'); if (!zodOutput) handleGenerateZod(); }}
              disabled={!outputCode}
            >
              <i className="fa-solid fa-cubes"></i>
              Zod
            </button>
          </div>

          <div className="results-container flex-results">

            {viewMode === 'code' && (
              <>
                <div className="output-header">
                  <div className="indent-toggle">
                    <span className="indent-toggle-label">Indent:</span>
                    {['2', '4', 'tab'].map((v) => (
                      <button
                        key={v}
                        className={`indent-btn${indentSize === v ? ' active' : ''}`}
                        onClick={() => setIndentSize(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  <div className="conversion-bar">
                    <button
                      className="convert-btn yaml-btn"
                      onClick={() => handleConvert('yaml')}
                      disabled={!outputCode || convertLoading}
                    >
                      YAML
                    </button>
                    <button
                      className="convert-btn toml-btn"
                      onClick={() => handleConvert('toml')}
                      disabled={!outputCode || convertLoading}
                    >
                      TOML
                    </button>
                    <button
                      className="convert-btn csv-btn"
                      onClick={() => handleConvert('csv')}
                      disabled={!outputCode || convertLoading}
                    >
                      CSV
                    </button>
                  </div>

                  {outputCode && (
                    <div className="output-stats">
                      <span className="stat-badge chars">{outputCounts.chars.toLocaleString()} chars</span>
                      <span className="stat-badge tokens">~{outputCounts.tokens.toLocaleString()} tokens</span>
                    </div>
                  )}
                </div>

                <div className="jsonpath-bar">
                  <input
                    className="jsonpath-input"
                    placeholder="JSONPath query (e.g. $.users[*].id)"
                    value={jsonPathQuery}
                    onChange={(e) => setJsonPathQuery(e.target.value)}
                    disabled={!outputCode}
                  />
                  {jsonPathResult?.values?.length > 0 && (
                    <span className="jsonpath-result-count">
                      {jsonPathResult.values.length} match{jsonPathResult.values.length !== 1 ? 'es' : ''}
                    </span>
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
                          <span className="jsonpath-result-path">{jsonPathResult.paths[idx]}</span>
                          <span className="jsonpath-result-value">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {conversionResult ? (
                  <div className="converted-output-panel">
                    <div className="converted-output-header">
                      <span className={`converted-format-badge ${conversionResult.format}`}>
                        {conversionResult.format.toUpperCase()} Output
                      </span>
                      <button
                        className="icon-btn-sm"
                        onClick={() => setConversionResult(null)}
                      >
                        <i className="fa-solid fa-arrow-left"></i>
                        Back to JSON
                      </button>
                    </div>
                    <textarea
                      value={conversionResult.content}
                      readOnly
                      className="json-textarea output-textarea"
                    />
                    <div className="output-copy-row">
                      <CopyButton codeToCopy={conversionResult.content} />
                      <button
                        className="secondary-button"
                        onClick={() => downloadFile(
                          conversionResult.content,
                          `output.${conversionResult.format}`
                        )}
                      >
                        <i className="fa-solid fa-download"></i>
                        Download {conversionResult.format.toUpperCase()}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="output-wrapper json-output-box">
                    <textarea
                      value={outputCode}
                      onChange={(e) => setOutputCode(e.target.value)}
                      className="json-textarea output-textarea"
                      spellCheck="false"
                      placeholder="Formatted JSON will appear here…"
                    />
                    <div className="output-copy-row">
                      <CopyButton codeToCopy={outputCode} />
                      <button
                        className="icon-btn-sm"
                        onClick={handleMinify}
                        title="Minify JSON"
                        disabled={!outputCode}
                      >
                        <i className="fa-solid fa-compress"></i>
                        Minify
                      </button>
                      <button
                        className="secondary-button"
                        onClick={handleDownload}
                        disabled={!outputCode}
                      >
                        <i className="fa-solid fa-download"></i>
                        Download
                      </button>
                    </div>
                  </div>
                )}

                <div className="schema-validation-panel">
                  <div
                    className="schema-validation-header"
                    onClick={() => {
                      if (!jsonSchemaText) {
                        setJsonSchemaText('{\n  "type": "object",\n  "properties": {}\n}');
                      } else {
                        setJsonSchemaText('');
                      }
                    }}
                  >
                    <div className="header-left">
                      <div
                        className={`schema-status-dot ${
                          schemaErrors.length
                            ? 'invalid'
                            : jsonSchemaText && outputCode
                            ? 'valid'
                            : 'idle'
                        }`}
                      />
                      JSON Schema Validation
                    </div>
                    <i
                      className={`fa-solid fa-chevron-${jsonSchemaText ? 'down' : 'right'}`}
                    ></i>
                  </div>
                  {jsonSchemaText !== '' && (
                    <div className="schema-validation-body">
                      <textarea
                        className="schema-textarea"
                        placeholder="Paste JSON Schema here to validate your output…"
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
                      ) : jsonSchemaText && outputCode ? (
                        <div className="schema-valid-msg">
                          <i className="fa-solid fa-circle-check"></i>
                          Passes validation
                        </div>
                      ) : null}
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
              <>
                <div className="diff-container">
                  <div className="diff-input-col">
                    <div className="diff-label left">
                      <i className="fa-solid fa-circle-minus"></i>
                      Original (A)
                    </div>
                    <textarea
                      value={outputCode}
                      readOnly
                      className="json-textarea diff-textarea"
                      placeholder="Format JSON first to populate A…"
                    />
                  </div>
                  <div className="diff-input-col">
                    <div className="diff-label right">
                      <i className="fa-solid fa-circle-plus"></i>
                      Compare Against (B)
                    </div>
                    <textarea
                      value={diffInput}
                      onChange={(e) => setDiffInput(e.target.value)}
                      className="json-textarea diff-textarea"
                      placeholder="Paste JSON here to find differences…"
                    />
                  </div>
                </div>

                {diffInput && diffResult && (
                  <>
                    {diffCounts && (
                      <div className="diff-summary">
                        <span className="diff-badge added">+{diffCounts.added} added</span>
                        <span className="diff-badge removed">−{diffCounts.removed} removed</span>
                        {diffCounts.same > 0 && (
                          <span className="diff-badge same">{diffCounts.same} changed</span>
                        )}
                      </div>
                    )}
                    <div className="diff-result-panel">
                      {diffResult.length > 0 ? diffResult.map((diff, i) => (
                        <div key={i} className={`diff-line ${diff.type}`}>
                          <div className="diff-gutter">
                            {diff.type === 'added' ? '+' : diff.type === 'removed' ? '−' : '~'}
                          </div>
                          <div className="diff-content">
                            <strong>{diff.path}</strong>
                            {': '}
                            {diff.type === 'added'
                              ? JSON.stringify(diff.b)
                              : diff.type === 'removed'
                              ? JSON.stringify(diff.a)
                              : `${JSON.stringify(diff.a)} → ${JSON.stringify(diff.b)}`}
                          </div>
                        </div>
                      )) : (
                        <div className="diff-empty-msg">
                          <i className="fa-solid fa-circle-check"></i>
                          No structural differences found.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {viewMode === 'zod' && (
              <div className="zod-output-panel">
                <div className="zod-meta-bar">
                  <span className="zod-meta-badge">Zod Schema</span>
                  <button
                    className="zod-action-btn"
                    onClick={handleGenerateZod}
                    disabled={!outputCode || zodLoading}
                  >
                    {zodLoading
                      ? <i className="fa-solid fa-spinner fa-spin"></i>
                      : <i className="fa-solid fa-rotate"></i>}
                    Regenerate
                  </button>
                  <button
                    className="zod-action-btn"
                    onClick={handleZodToExample}
                    disabled={!zodOutput}
                  >
                    <i className="fa-solid fa-vial"></i>
                    Gen Example JSON
                  </button>
                  {zodOutput && (
                    <div className="zod-actions-right">
                      <CopyButton codeToCopy={zodOutput} />
                      <button
                        className="secondary-button"
                        onClick={() => downloadFile(zodOutput, 'schema.ts', 'text/plain')}
                      >
                        <i className="fa-solid fa-file-code"></i>
                        Save .ts
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  value={zodOutput}
                  readOnly
                  className="json-textarea output-textarea zod-textarea"
                  placeholder="Zod schema will be inferred here…"
                />
              </div>
            )}

            {explanation && (
              <div className="ai-summary json-explanation">
                <strong>
                  <i className="fa-solid fa-clipboard-check"></i>
                  Action Log
                </strong>
                <div className="explanation-content">{explanation}</div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
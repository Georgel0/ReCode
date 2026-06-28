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
    <div className="j-module-container">
      <ModuleHeader
        title="JSON Formatter & Validator"
        description="Format instantly, validate against schemas, run JSONPath, or use AI to repair structures."
        resultData={lastResult}
      />

      <div className="j-toolbar top-actions-bar">
        <div className="j-toolbar-group j-toolbar-primary">
          <button
            className="secondary-button"
            onClick={() => handleLocalFormat(input)}
            disabled={!input.trim()}
          >
            <i className="fa-solid fa-bolt"></i>
            <span>Format</span>
          </button>
          <button
            className="primary-button j-ai-glow"
            onClick={handleAiFix}
            disabled={loading || !input.trim()}
          >
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            <span>{loading ? 'Repairing…' : 'AI Fix'}</span>
          </button>
        </div>

        <div className="j-toolbar-group j-toolbar-secondary">
          <input
            type="file"
            accept=".json,.txt,.js,.yaml,.yml,.toml"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            aria-label="Upload file"
          />
          <button
            className="j-icon-btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload JSON, YAML, or TOML"
          >
            <i className="fa-solid fa-upload"></i>
            <span>Upload</span>
          </button>
          <button className="j-icon-btn-sm" onClick={loadSample}>
            <i className="fa-solid fa-flask"></i>
            <span>Sample</span>
          </button>
          <button
            className={`j-icon-btn-sm${showHistory ? ' j-active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
            title="View history"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>History</span>
          </button>
        </div>
      </div>

      <div className="j-panels-grid">

        <div className="j-panel">

          <div className="j-panel-head">
            <h3><i className="fa-solid fa-keyboard"></i> Input JSON</h3>
            <div className="j-panel-toggles">
              <label className="custom-check" title="Sort JSON keys alphabetically">
                <input
                  type="checkbox"
                  checked={sortKeys}
                  onChange={(e) => setSortKeys(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check"></i></div>
                <span className="label-text">Sort keys</span>
              </label>
              <label className="custom-check" title="Automatically format JSON upon pasting">
                <input
                  type="checkbox"
                  checked={autoFormat}
                  onChange={(e) => setAutoFormat(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check"></i></div>
                <span className="label-text">Auto-format on paste</span>
              </label>
            </div>
          </div>

          <div className="j-url-import-bar">
            <input
              className="j-url-import-input"
              placeholder="Paste a URL or cURL command…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
            />
            <button
              className="secondary-button j-url-fetch-btn"
              onClick={handleUrlImport}
              disabled={urlLoading || !urlInput.trim()}
            >
              {urlLoading
                ? <i className="fa-solid fa-spinner fa-spin"></i>
                : <i className="fa-solid fa-cloud-arrow-down"></i>}
              <span>Fetch</span>
            </button>
          </div>

          {showHistory && (
            <div className="j-history-panel">
              <div className="j-history-panel-header">
                <span>
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  Recent Sessions
                </span>
                <button
                  className="j-history-clear-btn"
                  onClick={handleClearAllHistory}
                >
                  Clear All
                </button>
              </div>
              <div className="j-history-list">
                {history.length ? history.map((entry) => (
                  <div key={entry.id} className="j-history-item">
                    <div
                      className="j-history-item-preview"
                      onClick={() => handleRestoreHistory(entry)}
                      title="Click to restore"
                    >
                      {entry.input}
                    </div>
                    <div className="j-history-item-meta">
                      <span className="j-history-item-time">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <div className="j-history-item-actions">
                        <button
                          className="j-history-restore-btn"
                          onClick={() => handleRestoreHistory(entry)}
                        >
                          Restore
                        </button>
                        <button
                          className="j-history-delete-btn"
                          onClick={() => handleDeleteHistory(entry.id)}
                          title="Delete entry"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="j-history-empty">No history recorded yet.</div>
                )}
              </div>
            </div>
          )}

          <div className="j-panel-body">
            <div
              className={`j-input-wrapper${isDragging ? ' j-drag-active' : ''}`}
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
                className={`j-json-textarea${errorMsg ? ' j-has-error' : ''}`}
              />
              {input && (
                <button
                  className="j-clear-input-btn"
                  onClick={() => { setInput(''); setOutputCode(''); setErrorMsg(null); }}
                  title="Clear input"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              )}
              {isDragging && (
                <div className="j-drag-overlay">Drop file to load & parse</div>
              )}
            </div>

            {errorMsg && (
              <div className="j-error-message">
                <i className="fa-solid fa-circle-exclamation"></i>
                {errorMsg}
              </div>
            )}
          </div>

        </div>

        <div className="j-panel">

          <div className="j-output-tabs">
            <button
              className={`j-output-tab-btn${viewMode === 'code' ? ' j-active' : ''}`}
              onClick={() => setViewMode('code')}
            >
              <i className="fa-solid fa-code"></i>
              Code
            </button>
            <button
              className={`j-output-tab-btn${viewMode === 'tree' ? ' j-active' : ''}`}
              onClick={() => setViewMode('tree')}
              disabled={!outputCode || !!errorMsg}
            >
              <i className="fa-solid fa-folder-tree"></i>
              Tree
            </button>
            <button
              className={`j-output-tab-btn${viewMode === 'diff' ? ' j-active' : ''}`}
              onClick={() => setViewMode('diff')}
            >
              <i className="fa-solid fa-not-equal"></i>
              Diff
            </button>
            <button
              className={`j-output-tab-btn j-zod-tab${viewMode === 'zod' ? ' j-active' : ''}`}
              onClick={() => { setViewMode('zod'); if (!zodOutput) handleGenerateZod(); }}
              disabled={!outputCode}
            >
              <i className="fa-solid fa-cubes"></i>
              Zod
            </button>
          </div>

          <div className="j-panel-body">
            <div className="j-results-container">

              {viewMode === 'code' && (
                <>
                  <div className="j-output-header">
                    <div className="j-indent-toggle">
                      <span className="j-indent-toggle-label">Indent:</span>
                      {['2', '4', 'tab'].map((v) => (
                        <button
                          key={v}
                          className={`j-indent-btn${indentSize === v ? ' j-active' : ''}`}
                          onClick={() => setIndentSize(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <div className="j-conversion-bar">
                      <button
                        className="j-convert-btn j-yaml-btn"
                        onClick={() => handleConvert('yaml')}
                        disabled={!outputCode || convertLoading}
                      >
                        YAML
                      </button>
                      <button
                        className="j-convert-btn j-toml-btn"
                        onClick={() => handleConvert('toml')}
                        disabled={!outputCode || convertLoading}
                      >
                        TOML
                      </button>
                      <button
                        className="j-convert-btn j-csv-btn"
                        onClick={() => handleConvert('csv')}
                        disabled={!outputCode || convertLoading}
                      >
                        CSV
                      </button>
                    </div>

                    {outputCode && (
                      <div className="j-output-stats">
                        <span className="j-stat-badge j-chars">{outputCounts.chars.toLocaleString()} chars</span>
                        <span className="j-stat-badge j-tokens">~{outputCounts.tokens.toLocaleString()} tokens</span>
                      </div>
                    )}
                  </div>

                  <div className="j-jsonpath-bar">
                    <input
                      className="j-jsonpath-input"
                      placeholder="JSONPath query (e.g. $.users[*].id)"
                      value={jsonPathQuery}
                      onChange={(e) => setJsonPathQuery(e.target.value)}
                      disabled={!outputCode}
                    />
                    {jsonPathResult?.values?.length > 0 && (
                      <span className="j-jsonpath-result-count">
                        {jsonPathResult.values.length} match{jsonPathResult.values.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {jsonPathQuery && jsonPathResult?.values?.length > 0 && (
                    <div className="j-jsonpath-results-panel">
                      <div className="j-jsonpath-results-header">
                        <span>Query Results</span>
                      </div>
                      <div className="j-jsonpath-results-body">
                        {jsonPathResult.values.map((val, idx) => (
                          <div key={idx} className="j-jsonpath-result-item">
                            <span className="j-jsonpath-result-path">{jsonPathResult.paths[idx]}</span>
                            <span className="j-jsonpath-result-value">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {conversionResult ? (
                    <div className="j-converted-output-panel">
                      <div className="j-converted-output-header">
                        <span className={`j-converted-format-badge j-${conversionResult.format}`}>
                          {conversionResult.format.toUpperCase()} Output
                        </span>
                        <button
                          className="j-icon-btn-sm"
                          onClick={() => setConversionResult(null)}
                        >
                          <i className="fa-solid fa-arrow-left"></i>
                          <span>Back to JSON</span>
                        </button>
                      </div>
                      <textarea
                        value={conversionResult.content}
                        readOnly
                        className="j-json-textarea j-output-textarea"
                      />
                      <div className="j-output-copy-row">
                        <CopyButton codeToCopy={conversionResult.content} />
                        <button
                          className="secondary-button"
                          onClick={() => downloadFile(
                            conversionResult.content,
                            `output.${conversionResult.format}`
                          )}
                        >
                          <i className="fa-solid fa-download"></i>
                          <span>Download {conversionResult.format.toUpperCase()}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="j-json-output-box">
                      <textarea
                        value={outputCode}
                        onChange={(e) => setOutputCode(e.target.value)}
                        className="j-json-textarea j-output-textarea"
                        spellCheck="false"
                        placeholder="Formatted JSON will appear here…"
                      />
                      <div className="j-output-copy-row">
                        <CopyButton codeToCopy={outputCode} />
                        <button
                          className="j-icon-btn-sm"
                          onClick={handleMinify}
                          title="Minify JSON"
                          disabled={!outputCode}
                        >
                          <i className="fa-solid fa-compress"></i>
                          <span>Minify</span>
                        </button>
                        <button
                          className="secondary-button"
                          onClick={handleDownload}
                          disabled={!outputCode}
                        >
                          <i className="fa-solid fa-download"></i>
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="j-schema-validation-panel">
                    <div
                      className="j-schema-validation-header"
                      onClick={() => {
                        if (!jsonSchemaText) {
                          setJsonSchemaText('{\n  "type": "object",\n  "properties": {}\n}');
                        } else {
                          setJsonSchemaText('');
                        }
                      }}
                    >
                      <div className="j-header-left">
                        <div
                          className={`j-schema-status-dot j-${
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
                      <div className="j-schema-validation-body">
                        <textarea
                          className="j-schema-textarea"
                          placeholder="Paste JSON Schema here to validate your output…"
                          value={jsonSchemaText}
                          onChange={(e) => setJsonSchemaText(e.target.value)}
                        />
                        {schemaErrors.length > 0 ? (
                          <div className="j-schema-errors-list">
                            {schemaErrors.map((err, i) => (
                              <div key={i} className="j-schema-error-item">
                                <span className="j-schema-error-path">{err.path}</span>
                                <span className="j-schema-error-msg">{err.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : jsonSchemaText && outputCode ? (
                          <div className="j-schema-valid-msg">
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
                <div className="j-tree-view-container">
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
                  <div className="j-diff-container">
                    <div className="j-diff-input-col">
                      <div className="j-diff-label j-left">
                        <i className="fa-solid fa-circle-minus"></i>
                        Original (A)
                      </div>
                      <textarea
                        value={outputCode}
                        readOnly
                        className="j-json-textarea j-diff-textarea"
                        placeholder="Format JSON first to populate A…"
                      />
                    </div>
                    <div className="j-diff-input-col">
                      <div className="j-diff-label j-right">
                        <i className="fa-solid fa-circle-plus"></i>
                        Compare Against (B)
                      </div>
                      <textarea
                        value={diffInput}
                        onChange={(e) => setDiffInput(e.target.value)}
                        className="j-json-textarea j-diff-textarea"
                        placeholder="Paste JSON here to find differences…"
                      />
                    </div>
                  </div>

                  {diffInput && diffResult && (
                    <>
                      {diffCounts && (
                        <div className="j-diff-summary">
                          <span className="j-diff-badge j-added">+{diffCounts.added} added</span>
                          <span className="j-diff-badge j-removed">−{diffCounts.removed} removed</span>
                          {diffCounts.same > 0 && (
                            <span className="j-diff-badge j-same">{diffCounts.same} changed</span>
                          )}
                        </div>
                      )}
                      <div className="j-diff-result-panel">
                        {diffResult.length > 0 ? diffResult.map((diff, i) => (
                          <div key={i} className={`j-diff-line j-${diff.type}`}>
                            <div className="j-diff-gutter">
                              {diff.type === 'added' ? '+' : diff.type === 'removed' ? '−' : '~'}
                            </div>
                            <div className="j-diff-content">
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
                          <div className="j-diff-empty-msg">
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
                <div className="j-zod-output-panel">
                  <div className="j-zod-meta-bar">
                    <span className="j-zod-meta-badge">Zod Schema</span>
                    <button
                      className="j-zod-action-btn"
                      onClick={handleGenerateZod}
                      disabled={!outputCode || zodLoading}
                    >
                      {zodLoading
                        ? <i className="fa-solid fa-spinner fa-spin"></i>
                        : <i className="fa-solid fa-rotate"></i>}
                      <span>Regenerate</span>
                    </button>
                    <button
                      className="j-zod-action-btn"
                      onClick={handleZodToExample}
                      disabled={!zodOutput}
                    >
                      <i className="fa-solid fa-vial"></i>
                      <span>Gen Example JSON</span>
                    </button>
                    {zodOutput && (
                      <div className="j-zod-actions-right">
                        <CopyButton codeToCopy={zodOutput} />
                        <button
                          className="secondary-button"
                          onClick={() => downloadFile(zodOutput, 'schema.ts', 'text/plain')}
                        >
                          <i className="fa-solid fa-file-code"></i>
                          <span>Save .ts</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea
                    value={zodOutput}
                    readOnly
                    className="j-json-textarea j-output-textarea j-zod-textarea"
                    placeholder="Zod schema will be inferred here…"
                  />
                </div>
              )}

              {explanation && (
                <div className="j-json-explanation">
                  <strong>
                    <i className="fa-solid fa-clipboard-check"></i>
                    Action Log
                  </strong>
                  <div className="j-explanation-content">{explanation}</div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
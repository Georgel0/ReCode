'use client';

import { useRef, useEffect, useState } from 'react';
import { convertCode } from '@/lib';
import { CopyButton } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import { useJsonFormatter } from './useJsonFormatter';
import { downloadFile } from './jsonFormatter.utils';
import { HighlightedCode, HighlightedEditor } from './HighlightedJson';

import './JsonFormatter.base.css';
import './JsonFormatter.panels.css';

export default function JsonFormatter() {
  const { moduleData, qualityMode } = useApp();
  const fileInputRef = useRef(null);
  const historyBtnRef = useRef(null);
  const schemaBtnRef = useRef(null);
  const downloadBtnRef = useRef(null);
  const [showSchemaPanel, setShowSchemaPanel] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const json = useJsonFormatter({ convertCode, qualityMode, moduleData });

  // Close history/schema/download dropdowns on outside click
  useEffect(() => {
    if (!json.showHistory && !showSchemaPanel && !showDownloadMenu) return;
    const handler = (e) => {
      if (json.showHistory && historyBtnRef.current && !historyBtnRef.current.closest('.j-dropdown-anchor').contains(e.target)) {
        json.setShowHistory(false);
      }
      if (showSchemaPanel && schemaBtnRef.current && !schemaBtnRef.current.closest('.j-dropdown-anchor').contains(e.target)) {
        setShowSchemaPanel(false);
      }
      if (showDownloadMenu && downloadBtnRef.current && !downloadBtnRef.current.closest('.j-dropdown-anchor').contains(e.target)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [json.showHistory, showSchemaPanel, showDownloadMenu]);

  const diffCounts = json.diffResult?.reduce(
    (acc, d) => {
      if (d.type === 'added') acc.added++;
      else if (d.type === 'removed') acc.removed++;
      else acc.same++;
      return acc;
    },
    { added: 0, removed: 0, same: 0 }
  ) ?? null;

  const handleClearAllHistory = () => {
    json.history.forEach((entry) => json.handleDeleteHistory(entry.id));
  };

  return (
    <div className="module-container">
      <ModuleHeader
        title="JSON Formatter & Validator"
        description="Format instantly, validate against schemas, run JSONPath, or use AI to repair structures."
        resultData={json.lastResult}
      />

      <div className="j-toolbar top-actions-bar">
        <div className="j-toolbar-group j-toolbar-primary">
          <button
            className="primary-button j-ai-glow"
            onClick={json.handleAiFix}
            disabled={json.loading || !json.input.trim()}
          >
            <i className={`fa-solid ${json.loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            <span>{json.loading ? 'Repairing…' : 'AI Fix'}</span>
          </button>
        </div>

        <div className="j-toolbar-group j-toolbar-secondary">
          <input
            type="file"
            accept=".json,.txt,.js,.yaml,.yml,.toml"
            ref={fileInputRef}
            onChange={json.handleFileUpload}
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
          <button className="j-icon-btn-sm" onClick={json.loadSample}>
            <i className="fa-solid fa-flask"></i>
            <span>Sample</span>
          </button>

          <div className="j-dropdown-anchor" ref={downloadBtnRef} style={{ position: 'relative' }}>
            <button
              className={`j-icon-btn-sm${showDownloadMenu ? ' j-active' : ''}`}
              onClick={() => setShowDownloadMenu((v) => !v)}
              disabled={!json.outputCode}
              title="Download"
            >
              <i className="fa-solid fa-download"></i>
              <span>Download</span>
            </button>
            {showDownloadMenu && (
              <div className="j-toolbar-dropdown j-download-dropdown">
                <div className="j-toolbar-dropdown-header">
                  <div className="j-header-left">
                    <i className="fa-solid fa-download"></i>
                    Download
                  </div>
                </div>
                <div className="j-download-menu-list">
                  <button
                    className="j-download-menu-item"
                    onClick={() => { json.handleDownload(); setShowDownloadMenu(false); }}
                    disabled={!json.outputCode}
                  >
                    <i className="fa-solid fa-file-code"></i>
                    <span>Download JSON</span>
                  </button>
                  {json.conversionResult && (
                    <button
                      className="j-download-menu-item"
                      onClick={() => {
                        downloadFile(
                          json.conversionResult.content,
                          `output.${json.conversionResult.format}`
                        );
                        setShowDownloadMenu(false);
                      }}
                    >
                      <i className="fa-solid fa-file-export"></i>
                      <span>Download {json.conversionResult.format.toUpperCase()}</span>
                    </button>
                  )}
                  <button
                    className="j-download-menu-item"
                    onClick={() => {
                      downloadFile(json.zodOutput, 'schema.ts', 'text/plain');
                      setShowDownloadMenu(false);
                    }}
                    disabled={!json.zodOutput}
                  >
                    <i className="fa-solid fa-cubes"></i>
                    <span>Download Zod Schema (.ts)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="j-dropdown-anchor" ref={schemaBtnRef} style={{ position: 'relative' }}>
            <button
              className={`j-icon-btn-sm${showSchemaPanel ? ' j-active' : ''}`}
              onClick={() => setShowSchemaPanel((v) => !v)}
              title="JSON Schema Validation"
            >
              <i className="fa-solid fa-shield-halved"></i>
              <span>Schema</span>
              {(json.schemaErrors.length > 0) && (
                <span className="j-dropdown-badge j-dropdown-badge--error">{json.schemaErrors.length}</span>
              )}
              {json.schemaErrors.length === 0 && json.jsonSchemaText && json.outputCode && (
                <span className="j-dropdown-badge j-dropdown-badge--ok">✓</span>
              )}
            </button>
            {showSchemaPanel && (
              <div className="j-toolbar-dropdown j-schema-dropdown">
                <div className="j-toolbar-dropdown-header">
                  <div className="j-header-left">
                    <div className={`j-schema-status-dot j-${json.schemaErrors.length ? 'invalid' : json.jsonSchemaText && json.outputCode ? 'valid' : 'idle'}`} />
                    JSON Schema Validation
                  </div>
                  <button
                    className="j-history-clear-btn"
                    onClick={() => { json.setJsonSchemaText(''); }}
                    title="Clear schema"
                  >
                    Clear
                  </button>
                </div>
                <div className="j-schema-validation-body">
                  <HighlightedEditor
                    className="j-schema-textarea"
                    placeholder="Paste JSON Schema here to validate your output…"
                    value={json.jsonSchemaText}
                    onChange={(e) => json.setJsonSchemaText(e.target.value)}
                    onFocus={() => { if (!json.jsonSchemaText) json.setJsonSchemaText('{\n  "type": "object",\n  "properties": {}\n}'); }}
                  />
                  {json.schemaErrors.length > 0 ? (
                    <div className="j-schema-errors-list">
                      {json.schemaErrors.map((err, i) => (
                        <div key={i} className="j-schema-error-item">
                          <span className="j-schema-error-path">{err.path}</span>
                          <span className="j-schema-error-msg">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : json.jsonSchemaText && json.outputCode ? (
                    <div className="j-schema-valid-msg">
                      <i className="fa-solid fa-circle-check"></i>
                      Passes validation
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="j-dropdown-anchor" ref={historyBtnRef} style={{ position: 'relative' }}>
            <button
              className={`j-icon-btn-sm${json.showHistory ? ' j-active' : ''}`}
              onClick={() => json.setShowHistory(!json.showHistory)}
              title="View history"
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
              <span>History</span>
              {mounted && json.history.length > 0 && (
                <span className="j-dropdown-badge">{json.history.length}</span>
              )}
            </button>
            {json.showHistory && (
              <div className="j-toolbar-dropdown j-history-dropdown">
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
                  {json.history.length ? json.history.map((entry) => (
                    <div key={entry.id} className="j-history-item">
                      <div
                        className="j-history-item-preview"
                        onClick={() => { json.handleRestoreHistory(entry); json.setShowHistory(false); }}
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
                            onClick={() => { json.handleRestoreHistory(entry); json.setShowHistory(false); }}
                          >
                            Restore
                          </button>
                          <button
                            className="j-history-delete-btn"
                            onClick={() => json.handleDeleteHistory(entry.id)}
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
          </div>
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
                  checked={json.sortKeys}
                  onChange={(e) => json.setSortKeys(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check"></i></div>
                <span className="label-text">Sort keys</span>
              </label>
              <label className="custom-check" title="Automatically format JSON upon pasting">
                <input
                  type="checkbox"
                  checked={json.autoFormat}
                  onChange={(e) => json.setAutoFormat(e.target.checked)}
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
              value={json.urlInput}
              onChange={(e) => json.setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && json.handleUrlImport()}
            />
            <button
              className="secondary-button j-url-fetch-btn"
              onClick={json.handleUrlImport}
              disabled={json.urlLoading || !json.urlInput.trim()}
            >
              {json.urlLoading
                ? <i className="fa-solid fa-spinner fa-spin"></i>
                : <i className="fa-solid fa-cloud-arrow-down"></i>}
              <span>Fetch</span>
            </button>
          </div>


          <div className="j-panel-body">
            <div
              className={`j-input-wrapper${json.isDragging ? ' j-drag-active' : ''}`}
              onDragOver={json.onDragOver}
              onDragLeave={json.onDragLeave}
              onDrop={json.onDrop}
            >
              <HighlightedEditor
                value={json.input}
                onChange={(e) => json.setInput(e.target.value)}
                onPaste={json.handlePaste}
                placeholder="Paste JSON, YAML, TOML here, or drag & drop a file…"
                spellCheck="false"
                className={`j-json-textarea${json.errorMsg ? ' j-has-error' : ''}`}
              />
              {json.input && (
                <button
                  className="j-clear-input-btn"
                  onClick={() => { json.setInput(''); json.setOutputCode(''); json.setErrorMsg(null); }}
                  title="Clear input"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              )}
              {json.isDragging && (
                <div className="j-drag-overlay">Drop file to load & parse</div>
              )}
            </div>

            {json.errorMsg && (
              <div className="j-error-message">
                <i className="fa-solid fa-circle-exclamation"></i>
                {json.errorMsg}
              </div>
            )}
          </div>

        </div>

        <div className="j-panel">

          <div className="j-output-tabs">
            <div>
              <button
                className={`j-output-tab-btn${json.viewMode === 'code' ? ' j-active' : ''}`}
                onClick={() => json.setViewMode('code')}
              >
                <i className="fa-solid fa-code"></i>
                Code
              </button>
              <button
                className={`j-output-tab-btn${json.viewMode === 'tree' ? ' j-active' : ''}`}
                onClick={() => json.setViewMode('tree')}
                disabled={!json.outputCode || !!json.errorMsg}
              >
                <i className="fa-solid fa-folder-tree"></i>
                Tree
              </button>
              <button
                className={`j-output-tab-btn${json.viewMode === 'diff' ? ' j-active' : ''}`}
                onClick={() => json.setViewMode('diff')}
              >
                <i className="fa-solid fa-not-equal"></i>
                Diff
              </button>
              <button
                className={`j-output-tab-btn j-zod-tab${json.viewMode === 'zod' ? ' j-active' : ''}`}
                onClick={() => { json.setViewMode('zod'); if (!json.zodOutput) json.handleGenerateZod(); }}
                disabled={!json.outputCode}
              >
                <i className="fa-solid fa-cubes"></i>
                Zod
              </button>
            </div>
            <div>
              <button
                className="j-output-tab-btn j-minify-btn"
                onClick={json.handleMinify}
                disabled={!json.outputCode}
                title="Minify JSON"
              >
                <i className="fa-solid fa-compress"></i>
                Minify
              </button>
              <button
                className="j-output-tab-btn j-minify-btn"
                onClick={() => json.handleLocalFormat(json.outputCode)}
                disabled={!json.outputCode}
                title="Prettify JSON"
              >
                <i className="fa-solid fa-align-left"></i>
                Prettify
              </button>
            </div>
          </div>

          <div className="j-panel-body">
            <div className="j-results-container">

              {json.viewMode === 'code' && (
                <>
                  <div className="j-output-header">
                    <div className="j-indent-toggle">
                      <span className="j-indent-toggle-label">Indent:</span>
                      {['2', '4', 'tab'].map((v) => (
                        <button
                          key={v}
                          className={`j-indent-btn${json.indentSize === v ? ' j-active' : ''}`}
                          onClick={() => json.setIndentSize(v)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <div className="j-conversion-bar">
                      <button
                        className="j-convert-btn j-json-btn"
                        onClick={() => json.setConversionResult(null)}
                        disabled={!json.outputCode || json.convertLoading}
                        title="JSON View"
                      >
                        JSON
                      </button>
                      <button
                        className="j-convert-btn j-yaml-btn"
                        onClick={() => json.handleConvert('yaml')}
                        disabled={!json.outputCode || json.convertLoading}
                        title="YAML View"
                      >
                        YAML
                      </button>
                      <button
                        className="j-convert-btn j-toml-btn"
                        onClick={() => json.handleConvert('toml')}
                        disabled={!json.outputCode || json.convertLoading}
                        title="TOML View"
                      >
                        TOML
                      </button>
                      <button
                        className="j-convert-btn j-csv-btn"
                        onClick={() => json.handleConvert('csv')}
                        disabled={!json.outputCode || json.convertLoading}
                        title="CSV View"
                      >
                        CSV
                      </button>
                    </div>

                    {json.outputCode && (
                      <div className="j-output-stats">
                        <span className="j-stat-badge j-chars">{json.outputCounts.chars.toLocaleString()} chars</span>
                        <span className="j-stat-badge j-tokens">~{json.outputCounts.tokens.toLocaleString()} tokens</span>
                      </div>
                    )}
                  </div>

                  <div className="j-jsonpath-bar">
                    <input
                      className="j-jsonpath-input"
                      placeholder="JSONPath query (e.g. $.users[*].id)"
                      value={json.jsonPathQuery}
                      onChange={(e) => json.setJsonPathQuery(e.target.value)}
                      disabled={!json.outputCode}
                    />
                    {json.jsonPathResult?.values?.length > 0 && (
                      <span className="j-jsonpath-result-count">
                        {json.jsonPathResult.values.length} match{json.jsonPathResult.values.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {json.jsonPathQuery && json.jsonPathResult?.values?.length > 0 && (
                    <div className="j-jsonpath-results-panel">
                      <div className="j-jsonpath-results-header">
                        <span>Query Results</span>
                      </div>
                      <div className="j-jsonpath-results-body">
                        {json.jsonPathResult.values.map((val, idx) => (
                          <div key={idx} className="j-jsonpath-result-item">
                            <span className="j-jsonpath-result-path">{json.jsonPathResult.paths[idx]}</span>
                            <span className="j-jsonpath-result-value">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {json.conversionResult ? (
                    <div className="j-converted-output-panel">
                      <CopyButton codeToCopy={json.conversionResult?.content} />
                      <HighlightedCode
                        value={json.conversionResult.content}
                        className="j-json-textarea j-output-textarea"
                      />
                    </div>
                  ) : (
                    <div className="j-json-output-box">
                      <HighlightedEditor
                        value={json.outputCode}
                        onChange={(e) => json.setOutputCode(e.target.value)}
                        className="j-json-textarea j-output-textarea"
                        spellCheck="false"
                        placeholder="Formatted JSON will appear here…"
                      />
                      <div className="j-output-copy-row">
                        <CopyButton codeToCopy={json.outputCode} />
                      </div>
                    </div>
                  )}

                </>
              )}

              {json.viewMode === 'tree' && (() => {
                const treeData = json.getJsonForTree();
                const hasData = treeData !== null && treeData !== undefined;
                return (
                  <div className="j-tree-view-container">
                    {hasData ? (
                      <JsonView
                        src={treeData}
                        theme={json.isDarkTheme ? 'ocean' : 'rjv-default'}
                        iconStyle="triangle"
                        displayDataTypes={false}
                        enableClipboard={true}
                        editable={true}
                        onChange={json.handleTreeEdit}
                        onAdd={json.handleTreeEdit}
                        onDelete={json.handleTreeEdit}
                      />
                    ) : (
                      <div className="j-history-empty">
                        Tree is empty — paste JSON in the input and format it first.
                      </div>
                    )}
                  </div>
                );
              })()}

              {json.viewMode === 'diff' && (
                <>
                  <div className="j-diff-container">
                    <div className="j-diff-input-col">
                      <div className="j-diff-label j-left">
                        <i className="fa-solid fa-circle-minus"></i>
                        Original (A)
                      </div>
                      <HighlightedCode
                        value={json.outputCode}
                        className="j-json-textarea j-diff-textarea"
                        placeholder="Format JSON first to populate A…"
                      />
                    </div>
                    <div className="j-diff-input-col">
                      <div className="j-diff-label j-right">
                        <i className="fa-solid fa-circle-plus"></i>
                        Compare Against (B)
                      </div>
                      <HighlightedEditor
                        value={json.diffInput}
                        onChange={(e) => json.setDiffInput(e.target.value)}
                        className="j-json-textarea j-diff-textarea"
                        placeholder="Paste JSON here to find differences…"
                      />
                    </div>
                  </div>

                  {json.diffInput && json.diffResult && (
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
                        {json.diffResult.length > 0 ? json.diffResult.map((diff, i) => (
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

              {json.viewMode === 'zod' && (
                <div className="j-zod-output-panel">
                  <div className="j-zod-meta-bar">
                    <span className="j-zod-meta-badge">Zod Schema</span>
                    <button
                      className="j-zod-action-btn"
                      onClick={json.handleGenerateZod}
                      disabled={!json.outputCode || json.zodLoading}
                    >
                      {json.zodLoading
                        ? <i className="fa-solid fa-spinner fa-spin"></i>
                        : <i className="fa-solid fa-rotate"></i>}
                      <span>Regenerate</span>
                    </button>
                    <button
                      className="j-zod-action-btn"
                      onClick={json.handleZodToExample}
                      disabled={!json.zodOutput}
                    >
                      <i className="fa-solid fa-vial"></i>
                      <span>Gen Example JSON</span>
                    </button>
                    {json.zodOutput && (
                      <div className="j-zod-actions-right">
                        <CopyButton codeToCopy={json.zodOutput}/>
                      </div>
                    )}
                  </div>
                  <HighlightedCode
                    value={json.zodOutput}
                    className="j-json-textarea j-output-textarea j-zod-textarea"
                    placeholder="Zod schema will be inferred here…"
                  />
                </div>
              )}

              {json.explanation && (
                <div className="j-json-explanation">
                  <strong>
                    <i className="fa-solid fa-clipboard-check"></i>
                    Action Log
                  </strong>
                  <div className="j-explanation-content">{json.explanation}</div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
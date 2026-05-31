'use client';

import React, { useRef, useEffect } from 'react';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import {
  useApiMocksTab,
  FRAMEWORK_OPTIONS,
  PAGINATION_OPTIONS,
  AUTH_OPTIONS,
  SPEC_TEMPLATES,
  FORMAT_LABELS,
  FORMAT_ICONS,
  getMethodMeta,
} from '../hooks/useApiMocksTab';

function MethodBadge({ method }) {
  const { cls, label } = getMethodMeta(method);
  return <span className={`method-badge ${cls}`}>{label}</span>;
}

function StatusBadge({ code }) {
  const n = Number(code);
  let cls = 'status-badge';
  if (n >= 200 && n < 300) cls += ' status-badge--ok';
  else if (n >= 400 && n < 500) cls += ' status-badge--client';
  else if (n >= 500) cls += ' status-badge--server';
  return <span className={cls}>{code}</span>;
}

/**
 * Read-only syntax-highlighted code block.
 * Uses a `<pre>` with prism-dark styling so it's consistent with the app's
 * existing code display pattern from Modules.css / index.css.
 */
function CodeDisplay({ code, language = 'typescript' }) {
  const preRef = useRef(null);

  // Apply prism highlighting if available in the page context
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Prism && preRef.current) {
      window.Prism.highlightElement(preRef.current);
    }
  }, [code]);

  return (
    <div className="api-code-display">
      <pre
        ref={preRef}
        className={`language-${language} prism-dark`}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

// Fixture JSON preview panel — pretty-prints the fixture response object.
function FixtureDisplay({ handler }) {
  if (!handler?.fixtureData) {
    return (
      <div className="fixture-empty">
        <i className="fas fa-inbox" />
        <p>No fixture data available for this handler.</p>
      </div>
    );
  }

  return (
    <div className="api-code-display">
      <div className="fixture-meta-row">
        <MethodBadge method={handler.method} />
        <span className="fixture-path">{handler.path}</span>
        <StatusBadge code={handler.statusCode ?? 200} />
        {handler.delayMs > 0 && (
          <span className="fixture-delay-tag">
            <i className="fas fa-clock" /> {handler.delayMs}ms
          </span>
        )}
      </div>
      <pre className="prism-dark fixture-json">
        <code className="language-json">
          {JSON.stringify(handler.fixtureData, null, 2)}
        </code>
      </pre>
    </div>
  );
}

// Summary pill strip shown when data is available.
function MethodSummaryPills({ methodCounts }) {
  return (
    <div className="method-summary-pills">
      {Object.entries(methodCounts).map(([method, count]) => {
        const { cls } = getMethodMeta(method);
        return (
          <span key={method} className={`method-pill ${cls}`}>
            {method} <strong>{count}</strong>
          </span>
        );
      })}
    </div>
  );
}

export default function ApiMocksTab({ onDataUpdate, isActive }) {
  const api = useApiMocksTab({ onDataUpdate, isActive });

  const {
    specInput, setSpecInput,
    framework, setFramework,
    endpointCount, setEndpointCount,
    delayMs, setDelayMs,
    errorRate, setErrorRate,
    paginationStyle, setPaginationStyle,
    authStyle, setAuthStyle,
    includeTypes, setIncludeTypes,
    includeAnalysis, setIncludeAnalysis,
    isDropdownOpen, setIsDropdownOpen,
    detectedFormat,

    isLoading,
    generatedData,
    activeHandlerIdx, setActiveHandlerIdx,
    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    filteredHandlers,
    activeHandler,
    parsedSpecFeedback,
    methodCounts,
    copyFlash,

    savedSpecs, specsVisible, setSpecsVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newSpecName, setNewSpecName,
    saveSpecError, setSaveSpecError,

    modalConfig, setModalConfig,

    handleGenerate,
    handleCopyActiveHandler,
    handleCopyAll,
    triggerExportModal,
    handleSaveSpec,
    executeSaveSpec,
    handleDeleteSpec,
  } = api;

  const selectedFramework = FRAMEWORK_OPTIONS.find(f => f.value === framework);

  return (
    <>
      <div className="mock-factory-container">
        <div className="mock-sidebar">
          <div className="mock-sidebar-content">

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className={`fas ${FORMAT_ICONS[detectedFormat]}`} />
                  Specification
                  {detectedFormat !== 'auto' && (
                    <span className="detected-format-tag">
                      {FORMAT_LABELS[detectedFormat]}
                    </span>
                  )}
                </div>
                <button
                  className="icon-text-btn"
                  onClick={() => setSpecsVisible(!specsVisible)}
                  disabled={savedSpecs.length === 0}
                  title={savedSpecs.length === 0 ? 'Save a spec first' : 'Toggle Saved Specs'}
                >
                  <i className={`fas ${specsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                  {savedSpecs.length > 0 && (
                    <span className="badge-count">{savedSpecs.length}</span>
                  )}
                </button>
              </div>

              {specsVisible && savedSpecs.length > 0 && (
                <div className="schema-library-panel">
                  {savedSpecs.map((s, i) => (
                    <div key={i} className="schema-library-item">
                      <div
                        className="schema-library-item-name"
                        onClick={() => {
                          setSpecInput(s.spec);
                          if (s.framework) setFramework(s.framework);
                          setSpecsVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code" />
                        {s.name}
                      </div>
                      <button
                        className="library-item-delete-btn"
                        title="Delete saved spec"
                        onClick={e => { e.stopPropagation(); handleDeleteSpec(i); }}
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mock-form-group">
                <select
                  className="theme-select-dropdown"
                  value=""
                  onChange={e => {
                    if (e.target.value) setSpecInput(e.target.value);
                  }}
                >
                  <option value="" disabled>+ Load Example Spec...</option>
                  {SPEC_TEMPLATES.map(t => (
                    <option key={t.label} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="editor-wrapper-box">
                <CodeEditor
                  value={specInput}
                  onValueChange={setSpecInput}
                  language={detectedFormat === 'auto' ? 'graphql' : detectedFormat === 'typescript' ? 'typescript' : detectedFormat === 'json' ? 'json' : 'graphql'}
                  placeholder={`Paste a GraphQL SDL, OpenAPI definition, TypeScript interfaces, or plain REST spec…\n\nExamples:\n  type User { id: ID!, name: String! }\n  GET /api/users\n  { "id": 1, "name": "Alice" }`}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button btn-small full-width"
                  onClick={handleSaveSpec}
                  disabled={!specInput.trim()}
                >
                  <i className="fas fa-save" /> Save to Library
                </button>
              </div>
            </div>

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className="fas fa-sliders-h" /> Handler Config
                </div>
              </div>

              <div className="mock-form-group">
                <label className="input-label">Output Framework</label>
                <div className="framework-card-grid">
                  {FRAMEWORK_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`framework-card ${framework === opt.value ? 'active' : ''}`}
                      onClick={() => setFramework(opt.value)}
                      title={opt.label}
                    >
                      <i className={`fas ${opt.icon}`} />
                      <span className="framework-card-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid-2">
                <div className="mock-form-group">
                  <label className="input-label">Endpoints</label>
                  <div className="slider-row">
                    <input
                      type="range" min="1" max="20"
                      className="styled-slider"
                      value={endpointCount}
                      onChange={e => setEndpointCount(parseInt(e.target.value, 10))}
                    />
                    <div className="slider-value-display">{endpointCount}</div>
                  </div>
                  <span className="slider-hint">
                    {endpointCount <= 3 ? 'Minimal' : endpointCount <= 8 ? 'Standard' : 'Full Coverage'}
                  </span>
                </div>

                <div className="mock-form-group">
                  <label className="input-label">Pagination</label>
                  <select
                    className="theme-select-dropdown"
                    value={paginationStyle}
                    onChange={e => setPaginationStyle(e.target.value)}
                  >
                    {PAGINATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mock-form-group">
                <label className="input-label">Auth Simulation</label>
                <select
                  className="theme-select-dropdown"
                  value={authStyle}
                  onChange={e => setAuthStyle(e.target.value)}
                >
                  {AUTH_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className="fas fa-flask" /> Response Behaviour
                </div>
              </div>

              <div className="form-grid-2">
                <div className="mock-form-group">
                  <label className="input-label">Delay</label>
                  <div className="slider-row">
                    <input
                      type="range" min="0" max="3000" step="50"
                      className="styled-slider"
                      value={delayMs}
                      onChange={e => setDelayMs(parseInt(e.target.value, 10))}
                    />
                    <div className="slider-value-display">{delayMs}ms</div>
                  </div>
                  <span className="slider-hint">
                    {delayMs === 0 ? 'Instant' : delayMs < 500 ? 'Fast' : delayMs < 1500 ? 'Realistic' : 'Slow'}
                  </span>
                </div>

                <div className="mock-form-group">
                  <label className="input-label">Error Rate</label>
                  <div className="slider-row">
                    <input
                      type="range" min="0" max="50" step="5"
                      className="styled-slider"
                      value={errorRate}
                      onChange={e => setErrorRate(parseInt(e.target.value, 10))}
                    />
                    <div className="slider-value-display">{errorRate}%</div>
                  </div>
                  <span className="slider-hint">
                    {errorRate === 0 ? 'No Errors' : errorRate < 20 ? 'Low Failure Rate' : 'Chaos Mode'}
                  </span>
                </div>
              </div>

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={includeTypes}
                  onChange={e => setIncludeTypes(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check" /></div>
                <span className="label-text">Include TypeScript Type Definitions</span>
              </label>

              <label className="custom-check check-margin-top">
                <input
                  type="checkbox"
                  checked={includeAnalysis}
                  onChange={e => setIncludeAnalysis(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check" /></div>
                <span className="label-text">Generate Explanation & Coverage Analysis</span>
              </label>

              {/* Parsed spec feedback */}
              {parsedSpecFeedback.length > 0 && (
                <div className="rules-feedback">
                  <strong>Resolved Endpoints:</strong>
                  <ul>
                    {parsedSpecFeedback.map((r, i) => (
                      <li key={i}><i className="fas fa-check-circle" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          <div className="mock-sidebar-footer">
            <button
              className={`primary-button fabricate-action-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={isLoading || !specInput.trim()}
            >
              {isLoading
                ? <><div className="spinner-small" /> Generating Handlers…</>
                : <><i className="fas fa-wand-magic-sparkles" /> Generate Mock Handlers</>}
            </button>
          </div>
        </div>

        <div className="mock-main">
          <div className="mock-toolbar">

            <div className="tabs-navigation-row">
              <div className="tabs-scroll-wrapper">
                <div className="api-tabs-container">
                  {filteredHandlers.map((handler, idx) => {
                    const { cls } = getMethodMeta(handler.method);
                    return (
                      <button
                        key={idx}
                        className={`tab-btn handler-tab ${activeHandlerIdx === idx ? 'active' : ''}`}
                        onClick={() => setActiveHandlerIdx(idx)}
                        title={handler.description}
                      >
                        <span className={`handler-tab-method ${cls}`}>
                          {handler.method?.toUpperCase()}
                        </span>
                        <span className="handler-tab-path">{handler.path}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="tabs-dropdown-wrapper">
                {generatedData && (
                  <button
                    className={`tab-dropdown-toggle ${isDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    title="Show all endpoints"
                  >
                    <i className="fas fa-list" />
                  </button>
                )}

                {isDropdownOpen && (
                  <>
                    <div
                      className="dropdown-backdrop"
                      onClick={() => setIsDropdownOpen(false)}
                    />

                    <div className="tabs-dropdown-menu">
                      {filteredHandlers.map((handler, idx) => {
                        const { cls } = getMethodMeta(handler.method);
                        return (
                          <button
                            key={`drop-${idx}`}
                            className={`dropdown-item ${activeHandlerIdx === idx ? 'active' : ''}`}
                            onClick={() => {
                              setActiveHandlerIdx(idx);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span className={`handler-tab-method ${cls}`}>
                              {handler.method?.toUpperCase()}
                            </span>
                            <span className="handler-tab-path">{handler.path}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="toolbar-right">
              {generatedData && (
                <>
                  <div className="toolbar-filter-wrap">
                    <i className="fas fa-search toolbar-filter-icon" />
                    <input
                      type="text"
                      className="toolbar-filter-input"
                      placeholder="Filter endpoints..."
                      value={filterQuery}
                      onChange={e => { setFilterQuery(e.target.value); setActiveHandlerIdx(0); }}
                    />
                    {filterQuery && (
                      <button
                        className="toolbar-filter-clear"
                        onClick={() => setFilterQuery('')}
                        title="Clear filter"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  <div className="view-mode-toggles">
                    <button
                      className={`view-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                      onClick={() => setViewMode('code')}
                      title="Handler code"
                    >
                      <i className="fas fa-code" /> Code
                    </button>
                    <button
                      className={`view-toggle-btn ${viewMode === 'fixture' ? 'active' : ''}`}
                      onClick={() => setViewMode('fixture')}
                      title="Fixture JSON preview"
                    >
                      <i className="fas fa-brackets-curly" /> Fixture
                    </button>
                  </div>

                  <div className="mock-export-group">
                    <button
                      className="secondary-button icon-only tool-btn"
                      title={copyFlash === 'handler' ? 'Copied!' : 'Copy active handler'}
                      onClick={handleCopyActiveHandler}
                      disabled={!activeHandler}
                    >
                      <i className={`fas ${copyFlash === 'handler' ? 'fa-check' : 'fa-clipboard'}`} />
                    </button>

                    <button
                      className="secondary-button icon-only tool-btn"
                      title={copyFlash === 'all' ? 'Copied!' : 'Copy all handler code'}
                      onClick={handleCopyAll}
                      disabled={!generatedData}
                    >
                      <i className={`fas ${copyFlash === 'all' ? 'fa-check' : 'fa-copy'}`} />
                    </button>

                    <select
                      className="theme-select-dropdown action-select"
                      value=""
                      onChange={e => { if (e.target.value) triggerExportModal(e.target.value); }}
                      disabled={!generatedData}
                    >
                      <option value="">Export As…</option>
                      <option value="all-ts">All Handlers (.ts)</option>
                      <option value="fixtures-json">JSON Fixtures</option>
                      <option value="active-ts">Active Handler (.ts)</option>
                      <option value="postman">Postman Collection (.json)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mock-preview-area">

            <EmptyState
              isLoading={isLoading}
              condition={!generatedData}
              icon="fas fa-network-wired"
              title="Awaiting Specification"
              description="Paste a GraphQL SDL, OpenAPI definition, TypeScript interfaces, or a plain REST spec to generate fully functional mock handlers."
              hint={
                <>
                  Supports <code>GET /api/users</code>, <code>type User &#123; … &#125;</code>, and OpenAPI YAML.
                </>
              }
              loadingTitle="Synthesizing Handlers"
              loadingDescription={`Building ${selectedFramework?.label ?? 'mock'} handlers with realistic fixture data…`}
            />

            {activeHandler && !isLoading && (
              <div className="handler-detail-container">
                <div className="handler-header-card">
                  <div className="handler-header-left">
                    <MethodBadge method={activeHandler.method} />
                    <span className="handler-path-display">{activeHandler.path}</span>
                    <StatusBadge code={activeHandler.statusCode ?? 200} />
                    {activeHandler.delayMs > 0 && (
                      <span className="fixture-delay-tag">
                        <i className="fas fa-hourglass-half" /> {activeHandler.delayMs}ms
                      </span>
                    )}
                  </div>
                  <div className="handler-header-right">
                    {generatedData && <MethodSummaryPills methodCounts={methodCounts} />}
                    <span className="handler-name-tag">
                      <i className="fas fa-tag" /> {activeHandler.name}
                    </span>
                  </div>
                </div>

                {activeHandler.description && (
                  <p className="handler-description">{activeHandler.description}</p>
                )}

                <div className="handler-code-pane">
                  {viewMode === 'code'
                    ? <CodeDisplay
                      code={activeHandler.code}
                      language="typescript"
                      key={activeHandler.name}
                    />
                    : <FixtureDisplay
                      handler={activeHandler}
                      key={activeHandler.name}
                    />
                  }
                </div>

              </div>
            )}

            {generatedData?.explanation && !isLoading && (
              <div className="panel explanation-panel">
                <h3 className="explanation-title">
                  <i className="fas fa-robot" /> Generation Analysis
                </h3>
                <div
                  className="explanation-body"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedData.explanation) }}
                />
              </div>
            )}

          </div>
        </div>

      </div>

      <ConfirmModal
        {...modalConfig}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="modal-content save-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-cloud-upload-alt" /> Save Spec Template</h2>
            </div>
            <p className="modal-desc">
              Store this API specification in your local library for quick reuse across mocking sessions.
            </p>
            <div className="mock-form-group">
              <label className="input-label">Template Name</label>
              <input
                type="text"
                className="text-input full-width"
                placeholder="e.g., Users REST CRUD v2"
                value={newSpecName}
                onChange={e => { setNewSpecName(e.target.value); setSaveSpecError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && executeSaveSpec()}
              />
              {saveSpecError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-triangle" /> {saveSpecError}
                </div>
              )}
            </div>
            <div className="modal-footer split-footer">
              <button
                className="secondary-button modal-btn"
                onClick={() => setIsSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button modal-btn"
                onClick={executeSaveSpec}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
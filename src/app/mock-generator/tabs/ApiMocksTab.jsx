'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import {
  useApiMocksTab, getMethodMeta,
  FRAMEWORK_OPTIONS, PAGINATION_OPTIONS, AUTH_OPTIONS, ENV_PREFIX_OPTIONS, SPEC_TEMPLATES, FORMAT_LABELS, FORMAT_ICONS,
} from '../hooks/useApiMocksTab';
import { MethodBadge, StatusBadge, CodeDisplay, FixtureDisplay, MethodSummaryPills, 
  HistoryDropdown, ErrorVariantPanel, FixtureShapeWarning } from '../components/ApiMocksTabComponents';

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
    envPrefix, setEnvPrefix,
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

    editingHandlerIdx, editingField, editDraft, setEditDraft,
    handlerDirty,
    startEdit, cancelEdit, commitEdit,

    regeneratingIdx,
    isAddEndpointOpen, setIsAddEndpointOpen,
    addEndpointInput, setAddEndpointInput,
    handleRegenerateHandler,
    handleAddEndpoint,

    isDragOver,
    handleDrop, handleDragOver, handleDragLeave,
    handleFileUpload,

    generationHistory,
    historyOpen, setHistoryOpen,
    handleRestoreHistory,

    activeErrorVariant,
    setErrorVariantForHandler,

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
  const fileInputRef = useRef(null);

  // Derive the handler + variant to actually display
  const globalHandlerIdx = generatedData?.handlers?.indexOf(activeHandler);
  const variantIdx = activeErrorVariant[globalHandlerIdx];
  const displayHandler = variantIdx != null
    ? { ...activeHandler, ...(activeHandler?.errorVariants?.[variantIdx] ?? {}) }
    : activeHandler;

  const isEditing = editingHandlerIdx === globalHandlerIdx;

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

              <div
                className={`spec-dropzone ${isDragOver ? 'dragover' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                title="Drop an OpenAPI / Swagger YAML or JSON file here"
              >
                <i className="fas fa-file-arrow-up" />
                <span>Drop openapi.yaml / swagger.json or <strong>click to browse</strong></span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".yaml,.yml,.json"
                  style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files?.[0])}
                />
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

              <div className="mock-form-group">
                <label className="input-label">
                  Env Var Prefix
                  <span className="optional-tag">base URLs &amp; auth tokens</span>
                </label>
                <select
                  className="theme-select-dropdown"
                  value={envPrefix}
                  onChange={e => setEnvPrefix(e.target.value)}
                >
                  {ENV_PREFIX_OPTIONS.map(o => (
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

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={includeAnalysis}
                  onChange={e => setIncludeAnalysis(e.target.checked)}
                />
                <div className="box"><i className="fas fa-check" /></div>
                <span className="label-text">Generate Explanation &amp; Coverage Analysis</span>
              </label>

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
                    const globalIdx = generatedData?.handlers?.indexOf(handler);
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
                        {handlerDirty[globalIdx] && (
                          <span className="handler-dirty-dot" title="Edited locally" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {generatedData && (
                <button
                  className="tab-btn add-endpoint-tab-btn"
                  onClick={() => setIsAddEndpointOpen(true)}
                  title="Add a new endpoint"
                >
                  <i className="fas fa-plus" style={{marginRight: 0}} />
                </button>
              )}

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

                  <div className="tabs-dropdown-wrapper">
                    <button
                      className={`tab-dropdown-toggle ${historyOpen ? 'active' : ''}`}
                      onClick={() => setHistoryOpen(!historyOpen)}
                      title="Generation history"
                      disabled={generationHistory.length === 0}
                    >
                      <i className="fas fa-history" />
                    </button>
                    {historyOpen && (
                      <HistoryDropdown
                        history={generationHistory}
                        onRestore={handleRestoreHistory}
                        onClose={() => setHistoryOpen(false)}
                      />
                    )}
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
                      <option value="zip">Project Structure (.zip)</option>
                      <option value="vscode-snippets">VS Code Snippets</option>
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

            {isAddEndpointOpen && (
              <div className="modal-overlay" onClick={() => setIsAddEndpointOpen(false)}>
                <div className="modal-content save-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2><i className="fas fa-plus-circle" /> Add Endpoint</h2>
                  </div>
                  <p className="modal-desc">
                    Describe a new route — it will be generated and appended to the existing handler set.
                  </p>
                  <div className="mock-form-group">
                    <label className="input-label">Endpoint Description</label>
                    <input
                      type="text"
                      className="text-input full-width"
                      placeholder="e.g. POST /api/products — create a new product"
                      value={addEndpointInput}
                      onChange={e => setAddEndpointInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddEndpoint()}
                    />
                  </div>
                  <div className="modal-footer split-footer">
                    <button
                      className="secondary-button modal-btn"
                      onClick={() => setIsAddEndpointOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button modal-btn"
                      onClick={handleAddEndpoint}
                      disabled={isLoading || !addEndpointInput.trim()}
                    >
                      {isLoading ? <><div className="spinner-small" /> Generating…</> : 'Add Endpoint'}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    <FixtureShapeWarning handler={activeHandler} />
                    {handlerDirty[globalHandlerIdx] && (
                      <span className="handler-dirty-tag">
                        <i className="fas fa-pencil" /> Edited
                      </span>
                    )}
                  </div>
                  <div className="handler-header-right">
                    {generatedData && <MethodSummaryPills methodCounts={methodCounts} />}
                    <span className="handler-name-tag">
                      <i className="fas fa-tag" /> {activeHandler.name}
                    </span>

                    {!isEditing && (
                      <button
                        className="secondary-button btn-small"
                        onClick={() => startEdit(globalHandlerIdx, viewMode === 'fixture' ? 'fixtureData' : 'code')}
                        title={viewMode === 'fixture' ? 'Edit fixture data' : 'Edit handler code'}
                      >
                        <i className="fas fa-pencil" /> Edit
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button className="primary-button btn-small" onClick={commitEdit}>
                          <i className="fas fa-check" /> Save
                        </button>
                        <button className="secondary-button btn-small" onClick={cancelEdit}>
                          <i className="fas fa-xmark" /> Cancel
                        </button>
                      </>
                    )}

                    <button
                      className="secondary-button btn-small"
                      onClick={() => handleRegenerateHandler(globalHandlerIdx)}
                      disabled={regeneratingIdx === globalHandlerIdx}
                      title="Regenerate just this handler"
                    >
                      {regeneratingIdx === globalHandlerIdx
                        ? <><div className="spinner-small" /> Regenerating…</>
                        : <><i className="fas fa-rotate" /> Regenerate</>}
                    </button>
                  </div>
                </div>

                {activeHandler.description && (
                  <p className="handler-description">{activeHandler.description}</p>
                )}

                <ErrorVariantPanel
                  handler={activeHandler}
                  activeVariant={activeErrorVariant[globalHandlerIdx]}
                  onSelectVariant={(idx) => setErrorVariantForHandler(globalHandlerIdx, idx)}
                />

                <div className="handler-code-pane">
                  {isEditing ? (
                    <div className="api-code-display handler-edit-pane">
                      <div className="handler-edit-header">
                        <span className="handler-edit-title">
                          <i className="fas fa-pencil" />
                          Editing {editingField === 'fixtureData' ? 'Fixture Data' : 'Handler Code'}
                        </span>
                        <span className="handler-edit-hint">
                          {editingField === 'fixtureData' ? 'Must be valid JSON' : 'TypeScript / JS'}
                        </span>
                      </div>
                      <textarea
                        className="handler-edit-textarea"
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        spellCheck={false}
                        autoFocus
                      />
                    </div>
                  ) : viewMode === 'code'
                    ? <CodeDisplay
                      code={displayHandler?.code ?? activeHandler.code}
                      language="typescript"
                      key={`${activeHandler.name}-${variantIdx ?? 'success'}`}
                    />
                    : <FixtureDisplay
                      handler={displayHandler ?? activeHandler}
                      key={`${activeHandler.name}-${variantIdx ?? 'success'}`}
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
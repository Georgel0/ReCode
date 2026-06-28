'use client';

import React, { useRef, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import {
  useApiMocksTab, getMethodMeta,
  FRAMEWORK_OPTIONS, PAGINATION_OPTIONS, AUTH_OPTIONS, ENV_PREFIX_OPTIONS, SPEC_TEMPLATES, FORMAT_LABELS, FORMAT_ICONS,
} from './useApiMocksTab';
import {
  MethodBadge, StatusBadge, CodeDisplay, FixtureDisplay, MethodSummaryPills,
  HistoryDropdown, ErrorVariantPanel, FixtureShapeWarning
} from './ApiMocksTabComponents';

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

  const globalHandlerIdx = activeHandler
    ? generatedData?.handlers?.findIndex(
      h => h.name === activeHandler.name && h.path === activeHandler.path
    ) ?? -1
    : -1;
  const variantIdx = activeErrorVariant[globalHandlerIdx];
  const displayHandler = variantIdx != null
    ? { ...activeHandler, ...(activeHandler?.errorVariants?.[variantIdx] ?? {}) }
    : activeHandler;

  const isEditing = editingHandlerIdx === globalHandlerIdx;

  return (
    <>
      <div className="m-factory-container">
        <div className="m-sidebar">
          <div className="m-sidebar-content">

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className={`fas ${FORMAT_ICONS[detectedFormat]}`} />
                  Specification
                  {detectedFormat !== 'auto' && (
                    <span className="m-detected-format-tag">
                      {FORMAT_LABELS[detectedFormat]}
                    </span>
                  )}
                </div>
                <button
                  className="m-icon-text-btn"
                  onClick={() => setSpecsVisible(!specsVisible)}
                  disabled={savedSpecs.length === 0}
                  title={savedSpecs.length === 0 ? 'Save a spec first' : 'Toggle Saved Specs'}
                >
                  <i className={`fas ${specsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                  {savedSpecs.length > 0 && (
                    <span className="m-badge-count">{savedSpecs.length}</span>
                  )}
                </button>
              </div>

              {specsVisible && savedSpecs.length > 0 && (
                <div className="m-schema-library-panel">
                  {savedSpecs.map((s, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
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
                        className="m-library-item-delete-btn"
                        title="Delete saved spec"
                        onClick={e => { e.stopPropagation(); handleDeleteSpec(i); }}
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="m-form-group">
                <select
                  className="m-theme-select-dropdown"
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
                className={`m-spec-dropzone ${isDragOver ? 'm-dragover' : ''}`}
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

              <div className="m-editor-wrapper-box">
                <CodeEditor
                  value={specInput}
                  lineNumbers={false}
                  onValueChange={setSpecInput}
                  language={detectedFormat === 'auto' ? 'graphql' : detectedFormat === 'typescript' ? 'typescript' : detectedFormat === 'json' ? 'json' : 'graphql'}
                  placeholder={`Paste a GraphQL SDL, OpenAPI definition, TypeScript interfaces, or plain REST spec…\n\nExamples:\n  type User { id: ID!, name: String! }\n  GET /api/users\n  { "id": 1, "name": "Alice" }`}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button m-btn-small m-full-width"
                  onClick={handleSaveSpec}
                  disabled={!specInput.trim()}
                >
                  <i className="fas fa-save" /> Save to Library
                </button>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-sliders-h" /> Handler Config
                </div>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">Output Framework</label>
                <div className="m-framework-card-grid">
                  {FRAMEWORK_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`m-framework-card ${framework === opt.value ? 'm-active' : ''}`}
                      onClick={() => setFramework(opt.value)}
                      title={opt.label}
                    >
                      <i className={`fas ${opt.icon}`} />
                      <span className="m-framework-card-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="m-form-grid-2">
                <div className="m-form-group">
                  <label className="m-input-label">Endpoints</label>
                  <div className="m-slider-row">
                    <input
                      type="range" min="1" max="15"
                      className="m-styled-slider"
                      value={endpointCount}
                      onChange={e => setEndpointCount(parseInt(e.target.value, 10))}
                    />
                    <div className="m-slider-value-display">{endpointCount}</div>
                  </div>
                  <span className="m-slider-hint">
                    {endpointCount <= 3 ? 'Minimal' : endpointCount <= 6 ? 'Standard' : 'Full Coverage'}
                  </span>
                </div>

                <div className="m-form-group">
                  <label className="m-input-label">Pagination</label>
                  <select
                    className="m-theme-select-dropdown"
                    value={paginationStyle}
                    onChange={e => setPaginationStyle(e.target.value)}
                  >
                    {PAGINATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">Auth Simulation</label>
                <select
                  className="m-theme-select-dropdown"
                  value={authStyle}
                  onChange={e => setAuthStyle(e.target.value)}
                >
                  {AUTH_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">
                  Env Var Prefix
                  <span className="m-optional-tag">base URLs &amp; auth tokens</span>
                </label>
                <select
                  value={envPrefix}
                  onChange={e => setEnvPrefix(e.target.value)}
                >
                  {ENV_PREFIX_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-flask" /> Response Behaviour
                </div>
              </div>

              <div className="m-form-grid-2">
                <div className="m-form-group">
                  <label className="m-input-label">Delay</label>
                  <div className="m-slider-row">
                    <input
                      type="range" min="0" max="2250" step="38"
                      className="m-styled-slider"
                      value={delayMs}
                      onChange={e => setDelayMs(parseInt(e.target.value, 10))}
                    />
                    <div className="m-slider-value-display">{delayMs}ms</div>
                  </div>
                  <span className="m-slider-hint">
                    {delayMs === 0 ? 'Instant' : delayMs < 375 ? 'Fast' : delayMs < 1125 ? 'Realistic' : 'Slow'}
                  </span>
                </div>

                <div className="m-form-group">
                  <label className="m-input-label">Error Rate</label>
                  <div className="m-slider-row">
                    <input
                      type="range" min="0" max="38" step="4"
                      className="m-styled-slider"
                      value={errorRate}
                      onChange={e => setErrorRate(parseInt(e.target.value, 10))}
                    />
                    <div className="m-slider-value-display">{errorRate}%</div>
                  </div>
                  <span className="m-slider-hint">
                    {errorRate === 0 ? 'No Errors' : errorRate < 15 ? 'Low Failure Rate' : 'Chaos Mode'}
                  </span>
                </div>
              </div>

              <label className="m-custom-check">
                <input
                  type="checkbox"
                  checked={includeTypes}
                  onChange={e => setIncludeTypes(e.target.checked)}
                />
                <div className="m-box"><i className="fas fa-check" /></div>
                <span className="m-label-text">Include TypeScript Type Definitions</span>
              </label>

              <label className="m-custom-check">
                <input
                  type="checkbox"
                  checked={includeAnalysis}
                  onChange={e => setIncludeAnalysis(e.target.checked)}
                />
                <div className="m-box"><i className="fas fa-check" /></div>
                <span className="m-label-text">Generate Explanation &amp; Coverage Analysis</span>
              </label>

              {parsedSpecFeedback.length > 0 && (
                <div className="m-rules-feedback">
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

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={isLoading || !specInput.trim()}
            >
              {isLoading
                ? <><div className="m-spinner-small" /> Generating Handlers…</>
                : <><i className="fas fa-wand-magic-sparkles" /> Generate Mock Handlers</>}
            </button>
          </div>
        </div>

        <div className="m-main">
          <div className="m-toolbar">

            <div className="m-tabs-navigation-row">
              <div className="m-tabs-scroll-wrapper">
                <div className="m-api-tabs-container">
                  {filteredHandlers.map((handler, idx) => {
                    const { cls } = getMethodMeta(handler.method);
                    const globalIdx = generatedData?.handlers?.indexOf(handler);
                    return (
                      <button
                        key={handler.name ?? `${handler.method}-${handler.path}`}
                        className={`m-tab-btn m-handler-tab ${activeHandlerIdx === idx ? 'm-active' : ''}`}
                        onClick={() => setActiveHandlerIdx(idx)}
                        title={handler.description}
                      >
                        <span className={`m-handler-tab-method m-${cls}`}>
                          {handler.method?.toUpperCase()}
                        </span>
                        <span className="m-handler-tab-path">{handler.path}</span>
                        {handlerDirty[globalIdx] && (
                          <span className="m-handler-dirty-dot" title="Edited locally" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {generatedData && (
                <button
                  className="m-tab-btn m-add-endpoint-tab-btn"
                  onClick={() => setIsAddEndpointOpen(true)}
                  title="Add a new endpoint"
                >
                  <i className="fas fa-plus" style={{ marginRight: 0 }} />
                </button>
              )}

              <div className="m-tabs-dropdown-wrapper">
                {generatedData && (
                  <button
                    className={`m-tab-dropdown-toggle ${isDropdownOpen ? 'm-active' : ''}`}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    title="Show all endpoints"
                  >
                    <i className="fas fa-list" />
                  </button>
                )}

                {isDropdownOpen && (
                  <>
                    <div
                      className="m-dropdown-backdrop"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="m-tabs-dropdown-menu">
                      {filteredHandlers.map((handler, idx) => {
                        const { cls } = getMethodMeta(handler.method);
                        return (
                          <button
                            key={`drop-${idx}`}
                            className={`m-dropdown-item ${activeHandlerIdx === idx ? 'm-active' : ''}`}
                            onClick={() => {
                              setActiveHandlerIdx(idx);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <span className={`m-handler-tab-method m-${cls}`}>
                              {handler.method?.toUpperCase()}
                            </span>
                            <span className="m-handler-tab-path">{handler.path}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="m-toolbar-right">
              {generatedData && (
                <>
                  <div className="m-toolbar-filter-wrap">
                    <i className="fas fa-search m-toolbar-filter-icon" />
                    <input
                      type="text"
                      className="m-toolbar-filter-input"
                      placeholder="Filter endpoints..."
                      value={filterQuery}
                      onChange={e => { setFilterQuery(e.target.value); setActiveHandlerIdx(0); }}
                    />
                    {filterQuery && (
                      <button
                        className="m-toolbar-filter-clear"
                        onClick={() => setFilterQuery('')}
                        title="Clear filter"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  <div className="m-view-mode-toggles">
                    <button
                      className={`m-view-toggle-btn ${viewMode === 'code' ? 'm-active' : ''}`}
                      onClick={() => setViewMode('code')}
                      title="Handler code"
                    >
                      <i className="fas fa-code" /> Code
                    </button>
                    <button
                      className={`m-view-toggle-btn ${viewMode === 'fixture' ? 'm-active' : ''}`}
                      onClick={() => setViewMode('fixture')}
                      title="Fixture JSON preview"
                    >
                      <i className="fas fa-brackets-curly" /> Fixture
                    </button>
                  </div>

                  <div className="m-tabs-dropdown-wrapper">
                    <button
                      className={`m-tab-dropdown-toggle ${historyOpen ? 'm-active' : ''}`}
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

                  <div className="m-export-group">
                    <button
                      className="secondary-button m-icon-only m-tool-btn"
                      title={copyFlash === 'handler' ? 'Copied!' : 'Copy active handler'}
                      onClick={handleCopyActiveHandler}
                      disabled={!activeHandler}
                    >
                      <i className={`fas ${copyFlash === 'handler' ? 'fa-check' : 'fa-clipboard'}`} />
                    </button>

                    <button
                      className="secondary-button m-icon-only m-tool-btn"
                      title={copyFlash === 'all' ? 'Copied!' : 'Copy all handler code'}
                      onClick={handleCopyAll}
                      disabled={!generatedData}
                    >
                      <i className={`fas ${copyFlash === 'all' ? 'fa-check' : 'fa-copy'}`} />
                    </button>

                    <select
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

          <div className="m-preview-area">

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
                <div className="modal-content m-save-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2><i className="fas fa-plus-circle" /> Add Endpoint</h2>
                  </div>
                  <p className="modal-desc">
                    Describe a new route — it will be generated and appended to the existing handler set.
                  </p>
                  <div className="m-form-group">
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
                  <div className="modal-footer m-split-footer">
                    <button
                      className="secondary-button m-modal-btn"
                      onClick={() => setIsAddEndpointOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button m-modal-btn"
                      onClick={handleAddEndpoint}
                      disabled={isLoading || !addEndpointInput.trim()}
                    >
                      {isLoading ? <><div className="m-spinner-small" /> Generating…</> : 'Add Endpoint'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeHandler && !isLoading && (
              <div className="m-handler-detail-container">
                <div className="m-handler-header-card">
                  <div className="m-handler-header-left">
                    <MethodBadge method={activeHandler.method} />
                    <span className="m-handler-path-display">{activeHandler.path}</span>
                    <StatusBadge code={activeHandler.statusCode ?? 200} />
                    {activeHandler.delayMs > 0 && (
                      <span className="m-fixture-delay-tag">
                        <i className="fas fa-hourglass-half" /> {activeHandler.delayMs}ms
                      </span>
                    )}
                    <FixtureShapeWarning handler={activeHandler} />
                    {handlerDirty[globalHandlerIdx] && (
                      <span className="m-handler-dirty-tag">
                        <i className="fas fa-pencil" /> Edited
                      </span>
                    )}
                  </div>
                  <div className="m-handler-header-right">
                    {generatedData && <MethodSummaryPills methodCounts={methodCounts} />}
                    <span className="m-handler-name-tag">
                      <i className="fas fa-tag" /> {activeHandler.name}
                    </span>

                    {!isEditing && (
                      <button
                        className="secondary-button m-btn-small"
                        onClick={() => startEdit(globalHandlerIdx, viewMode === 'fixture' ? 'fixtureData' : 'code')}
                        title={viewMode === 'fixture' ? 'Edit fixture data' : 'Edit handler code'}
                      >
                        <i className="fas fa-pencil" /> Edit
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button className="primary-button m-btn-small" onClick={commitEdit}>
                          <i className="fas fa-check" /> Save
                        </button>
                        <button className="secondary-button m-btn-small" onClick={cancelEdit}>
                          <i className="fas fa-xmark" /> Cancel
                        </button>
                      </>
                    )}

                    <button
                      className="secondary-button m-btn-small"
                      onClick={() => handleRegenerateHandler(globalHandlerIdx)}
                      disabled={regeneratingIdx === globalHandlerIdx}
                      title="Regenerate just this handler"
                    >
                      {regeneratingIdx === globalHandlerIdx
                        ? <><div className="m-spinner-small" /> Regenerating…</>
                        : <><i className="fas fa-rotate" /> Regenerate</>}
                    </button>
                  </div>
                </div>

                {activeHandler.description && (
                  <p className="m-handler-description">{activeHandler.description}</p>
                )}

                <ErrorVariantPanel
                  handler={activeHandler}
                  activeVariant={activeErrorVariant[globalHandlerIdx]}
                  onSelectVariant={(idx) => setErrorVariantForHandler(globalHandlerIdx, idx)}
                />

                <div className="m-handler-code-pane">
                  {isEditing ? (
                    <div className="m-api-code-display m-handler-edit-pane">
                      <div className="m-handler-edit-header">
                        <span className="m-handler-edit-title">
                          <i className="fas fa-pencil" />
                          Editing {editingField === 'fixtureData' ? 'Fixture Data' : 'Handler Code'}
                        </span>
                        <span className="m-handler-edit-hint">
                          {editingField === 'fixtureData' ? 'Must be valid JSON' : 'TypeScript / JS'}
                        </span>
                      </div>
                      <textarea
                        className="m-handler-edit-textarea"
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
              <div className="m-panel m-explanation-panel">
                <h3 className="m-explanation-title">
                  <i className="fas fa-robot" /> Generation Analysis
                </h3>
                <div
                  className="m-explanation-body"
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
          <div className="modal-content m-save-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-cloud-upload-alt" /> Save Spec Template</h2>
            </div>
            <p className="modal-desc">
              Store this API specification in your local library for quick reuse across mocking sessions.
            </p>
            <div className="m-form-group">
              <label className="m-input-label">Template Name</label>
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
            <div className="modal-footer m-split-footer">
              <button
                className="secondary-button m-modal-btn"
                onClick={() => setIsSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button m-modal-btn"
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
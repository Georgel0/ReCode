'use client';

import { Tooltip } from 'react-tooltip';
import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal, CopyButton } from '@/components/ui';
import { CodeHighlightAnalyzer } from '@/components/widgets';
import { EmptyState } from '@/components/layout';
import { useApiMocks } from './useApiMocks';
import {
  FRAMEWORK_OPTIONS, PAGINATION_OPTIONS, AUTH_OPTIONS,
  ENV_PREFIX_OPTIONS, SPEC_TEMPLATES, FORMAT_LABELS,
  FORMAT_ICONS, getMethodMeta, MOCK_DURATION_OPTIONS
} from './constants';
import {
  MethodBadge, StatusBadge, CodeDisplay, FixtureDisplay, MethodSummaryPills,
  HistoryDropdown, ErrorVariantPanel, FixtureShapeWarning
} from './components';

const getAuthTooltipText = (style) => {
  if (style === 'bearer') return "Simulation Mode: The mock server only checks that the header starts with 'Bearer '. You can pass any dummy token (e.g., 'Bearer test') in Postman.";
  if (style === 'apikey') return "Simulation Mode: The mock server only checks for the presence of the 'x-api-key' header. Any dummy value will work.";
  if (style === 'session') return "Simulation Mode: The mock server accepts any username/password combination under standard HTTP Basic Auth.";
  return "";
};

export default function ApiMocksTab({ onDataUpdate, onShareStateChange, isActive }) {
  const api = useApiMocks({ onDataUpdate, isActive });
  const fileInputRef = useRef(null);

  const selectedFramework = FRAMEWORK_OPTIONS.find(f => f.value === api.outputConfig.framework);

  const globalHandlerIdx = api.activeHandler
    ? api.generatedData?.handlers?.findIndex(
      h => h.name === api.activeHandler.name && h.path === api.activeHandler.path
    ) ?? -1
    : -1;

  const variantIdx = api.activeErrorVariant[globalHandlerIdx];
  const displayHandler = variantIdx != null
    ? { ...api.activeHandler, ...(api.activeHandler?.errorVariants?.[variantIdx] ?? {}) }
    : api.activeHandler;

  const isEditing = api.editingHandlerIdx === globalHandlerIdx;

  useEffect(() => {
    onShareStateChange?.({
      share: api.share,
      shareCopied: api.shareCopied,
      resultData: api.resultData,
      shareDisabled: api.shareDisabled
    });
  }, [api.share, api.shareCopied, api.resultData, api.shareDisabled, onShareStateChange]);

  return (
    <>
      <div className="m-factory-container">
        <div className="m-sidebar">
          <div className="m-sidebar-content">

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className={`fas ${FORMAT_ICONS[api.detectedFormat]}`} />
                  Specification
                  {api.detectedFormat !== 'auto' && (
                    <span className="ma-detected-format-tag">
                      {FORMAT_LABELS[api.detectedFormat]}
                    </span>
                  )}
                </div>
                <div className="m-section-header-actions">
                  <button
                    className="m-icon-text-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload an OpenAPI / Swagger YAML or JSON file"
                  >
                    <i className="fas fa-file-arrow-up" />
                  </button>
                  <button
                    className="m-icon-text-btn"
                    onClick={() => api.setSpecsVisible(!api.specsVisible)}
                    disabled={api.savedSpecs.length === 0}
                    title={api.savedSpecs.length === 0 ? 'Save a spec first' : 'Toggle Saved Specs'}
                  >
                    <i className={`fas ${api.specsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                    {api.savedSpecs.length > 0 && (
                      <span className="m-badge-count">{api.savedSpecs.length}</span>
                    )}
                  </button>
                </div>
              </div>

              {api.specsVisible && api.savedSpecs.length > 0 && (
                <div className="m-schema-library-panel">
                  {api.savedSpecs.map((s, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
                        onClick={() => {
                          api.setSpecInput(s.spec);
                          if (s.framework) api.updateOutputConfig('framework', s.framework);
                          api.setSpecsVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code" />
                        {s.name}
                      </div>
                      <button
                        className="m-library-item-delete-btn"
                        title="Delete saved spec"
                        onClick={e => { e.stopPropagation(); api.handleDeleteSpec(i); }}
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="m-form-group reset-btn">
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) api.setSpecInput(e.target.value);
                  }}
                >
                  <option value="" disabled>+ Load Example Spec...</option>
                  {SPEC_TEMPLATES.map(t => (
                    <option key={t.label} value={t.value}>{t.label}</option>
                  ))}
                </select>

                <button className="secondary-button btn-danger" onClick={api.resetConfig} title="Reset Output Config">
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>

              <div
                className={`editor-container ma-editor-dropzone ${api.isDragOver ? 'ma-dragover' : ''}`}
                onDrop={api.handleDrop}
                onDragEnter={api.handleDragEnter}
                onDragOver={api.handleDragOver}
                onDragLeave={api.handleDragLeave}
                title="Drop an OpenAPI / Swagger YAML or JSON file here"
              >
                <CodeEditor
                  value={api.specInput}
                  lineNumbers={false}
                  onValueChange={api.setSpecInput}
                  language={api.detectedFormat === 'auto' ? 'graphql' : api.detectedFormat === 'typescript' ? 'typescript' : api.detectedFormat === 'json' ? 'json' : 'graphql'}
                  placeholder={`Paste a GraphQL SDL, OpenAPI definition, TypeScript interfaces, or plain REST spec…\n\nExamples:\n  type User { id: ID!, name: String! }\n  GET /api/users\n  { "id": 1, "name": "Alice" }`}
                />

                {api.isDragOver && (
                  <div className="ma-editor-drop-overlay">
                    <div className="ma-editor-drop-overlay-card">
                      <i className="fas fa-file-arrow-up" />
                      <span>Drop <strong>openapi.yaml</strong> / <strong>swagger.json</strong> to load spec</span>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".yaml,.yml,.json"
                  style={{ display: 'none' }}
                  onChange={e => api.handleFileUpload(e.target.files?.[0])}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button m-btn-small m-full-width"
                  onClick={api.handleSaveSpec}
                  disabled={!api.specInput.trim()}
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
                <select
                  value={api.outputConfig.framework}
                  onChange={e => api.updateOutputConfig('framework', e.target.value)}
                >
                  {FRAMEWORK_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="m-form-grid-2">
                <div className="m-form-group">
                  <label className="m-input-label">Endpoints</label>
                  <div className="ma-slider-row">
                    <input
                      type="range" min="1" max="15"
                      className="m-styled-slider"
                      value={api.outputConfig.endpointCount}
                      onChange={e => api.updateOutputConfig('endpointCount', parseInt(e.target.value, 10))}
                    />
                    <div className="ma-slider-value-display">{api.outputConfig.endpointCount}</div>
                  </div>
                  <span className="m-slider-hint">
                    {api.outputConfig.endpointCount <= 3 ? 'Minimal' : api.outputConfig.endpointCount <= 6 ? 'Standard' : 'Full Coverage'}
                  </span>
                </div>

                <div className="m-form-group">
                  <label className="m-input-label">Pagination</label>
                  <select
                    value={api.outputConfig.paginationStyle}
                    onChange={e => api.updateOutputConfig('paginationStyle', e.target.value)}
                  >
                    {PAGINATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">Live Server Duration</label>
                <select
                  value={api.outputConfig.mockDuration}
                  onChange={e => api.updateOutputConfig('mockDuration', parseInt(e.target.value, 10))}
                >
                  {MOCK_DURATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">
                  Auth Simulation

                  {api.outputConfig.authStyle && api.outputConfig.authStyle !== 'none' && (
                    <span className="code-analysis-info-wrapper">
                      <i
                        className="fa-solid fa-circle-info code-analysis-info-icon"
                        data-tooltip-id="auth-simulation-tooltip"
                      ></i>
                      <Tooltip
                        id="auth-simulation-tooltip"
                        place="top"
                        className="custom-analysis-tooltip api"
                      >
                        {getAuthTooltipText(api.outputConfig.authStyle)}
                      </Tooltip>
                    </span>
                  )}
                </label>
                <select
                  value={api.outputConfig.authStyle}
                  onChange={e => api.updateOutputConfig('authStyle', e.target.value)}
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
                  value={api.outputConfig.envPrefix}
                  onChange={e => api.updateOutputConfig('envPrefix', e.target.value)}
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
                  <div className="ma-slider-row">
                    <input
                      type="range" min="0" max="2250" step="38"
                      className="m-styled-slider"
                      value={api.outputConfig.delayMs}
                      onChange={e => api.updateOutputConfig('delayMs', parseInt(e.target.value, 10))}
                    />
                    <div className="ma-slider-value-display">{api.outputConfig.delayMs}ms</div>
                  </div>
                  <span className="m-slider-hint">
                    {api.outputConfig.delayMs === 0 ? 'Instant' : api.outputConfig.delayMs < 375 ? 'Fast' : api.outputConfig.delayMs < 1125 ? 'Realistic' : 'Slow'}
                  </span>
                </div>

                <div className="m-form-group">
                  <label className="m-input-label">Error Rate</label>
                  <div className="ma-slider-row">
                    <input
                      type="range" min="0" max="38" step="4"
                      className="m-styled-slider"
                      value={api.outputConfig.errorRate}
                      onChange={e => api.updateOutputConfig('errorRate', parseInt(e.target.value, 10))}
                    />
                    <div className="ma-slider-value-display">{api.outputConfig.errorRate}%</div>
                  </div>
                  <span className="m-slider-hint">
                    {api.outputConfig.errorRate === 0 ? 'No Errors' : api.outputConfig.errorRate < 15 ? 'Low Failure Rate' : 'Chaos Mode'}
                  </span>
                </div>
              </div>

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={api.outputConfig.includeTypes}
                  onChange={e => api.updateOutputConfig('includeTypes', e.target.checked)}
                />
                <div className="box"><i className="fas fa-check" /></div>
                <span className="label-text">Include TypeScript Type Definitions</span>
              </label>

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={api.outputConfig.includeAnalysis}
                  onChange={e => api.updateOutputConfig('includeAnalysis', e.target.checked)}
                />
                <div className="box"><i className="fas fa-check" /></div>
                <span className="label-text">Generate Explanation &amp; Coverage Analysis</span>
              </label>

              {api.parsedSpecFeedback.length > 0 && (
                <div className="m-rules-feedback">
                  <strong>Resolved Endpoints:</strong>
                  <ul>
                    {api.parsedSpecFeedback.map((r, i) => (
                      <li key={i}><i className="fas fa-check-circle" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${api.isLoading ? 'loading' : ''}`}
              onClick={api.handleGenerate}
              disabled={api.isLoading || !api.specInput.trim()}
            >
              {api.isLoading
                ? <><div className="m-spinner-small" /> Generating…</>
                : <><i className="fas fa-wand-magic-sparkles" /> Generate Mock</>}
            </button>

            <button className="secondary-button btn-danger" onClick={api.clearWorkspace} title="Clear Workspace">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="m-main">
          <div className="m-toolbar">

            <div className="ma-tabs-navigation-row">
              <div className="ma-tabs-scroll-wrapper">
                <div className="ma-api-tabs-container">
                  {api.filteredHandlers.map((handler, idx) => {
                    const { cls } = getMethodMeta(handler.method);
                    const localGlobalIdx = api.generatedData?.handlers?.indexOf(handler);
                    return (
                      <button
                        key={handler.name ?? `${handler.method}-${handler.path}`}
                        className={`ma-handler-tab ${api.activeHandlerIdx === idx ? 'ma-active' : ''}`}
                        onClick={() => api.setActiveHandlerIdx(idx)}
                        title={handler.description}
                      >
                        <span className={`ma-handler-tab-method ${cls}`}>
                          {handler.method?.toUpperCase()}
                        </span>
                        <span className="ma-handler-tab-path">{handler.path}</span>
                        {api.handlerDirty[localGlobalIdx] && (
                          <span className="ma-handler-dirty-dot" title="Edited locally" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {api.generatedData && (
                <button
                  className="ma-add-endpoint-tab-btn"
                  onClick={() => api.setIsAddEndpointOpen(true)}
                  title="Add a new endpoint"
                >
                  <i className="fas fa-plus" />
                </button>
              )}

              <div className="ma-tabs-dropdown-wrapper">
                {api.generatedData && (
                  <button
                    className={`ma-tab-dropdown-toggle ${api.isDropdownOpen ? 'ma-active' : ''}`}
                    onClick={() => api.setIsDropdownOpen(!api.isDropdownOpen)}
                    title="Show all endpoints"
                  >
                    <i className="fas fa-list" />
                  </button>
                )}

                {api.isDropdownOpen && (
                  <>
                    <div
                      className="ma-dropdown-backdrop"
                      onClick={() => api.setIsDropdownOpen(false)}
                    />
                    <div className="ma-tabs-dropdown-menu">
                      {api.filteredHandlers.map((handler, idx) => {
                        const { cls } = getMethodMeta(handler.method);
                        return (
                          <button
                            key={`drop-${idx}`}
                            className={`ma-dropdown-item ${api.activeHandlerIdx === idx ? 'ma-active' : ''}`}
                            onClick={() => {
                              api.setActiveHandlerIdx(idx);
                              api.setIsDropdownOpen(false);
                            }}
                          >
                            <span className={`ma-handler-tab-method ${cls}`}>
                              {handler.method?.toUpperCase()}
                            </span>
                            <span className="ma-handler-tab-path">{handler.path}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="m-toolbar-right">
              {api.generatedData && (
                <>
                  <div className="ma-toolbar-filter-wrap">
                    <i className="fas fa-search ma-toolbar-filter-icon" />
                    <input
                      type="text"
                      className="ma-toolbar-filter-input"
                      placeholder="Filter endpoints..."
                      value={api.filterQuery}
                      onChange={e => { api.setFilterQuery(e.target.value); api.setActiveHandlerIdx(0); }}
                    />
                    {api.filterQuery && (
                      <button
                        className="ma-toolbar-filter-clear"
                        onClick={() => api.setFilterQuery('')}
                        title="Clear filter"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  <div className="m-view-mode-toggles">
                    <button
                      className={`m-view-toggle-btn ${api.viewMode === 'code' ? 'm-active' : ''}`}
                      onClick={() => api.setViewMode('code')}
                      title="Handler code"
                    >
                      <i className="fas fa-code" /> Code
                    </button>
                    <button
                      className={`m-view-toggle-btn ${api.viewMode === 'fixture' ? 'm-active' : ''}`}
                      onClick={() => api.setViewMode('fixture')}
                      title="Fixture JSON preview"
                    >
                      <i className="fas fa-brackets-curly" /> Fixture
                    </button>
                    <button
                      className={`m-view-toggle-btn ${api.viewMode === 'test' ? 'm-active' : ''}`}
                      onClick={() => api.setViewMode('test')}
                      title="Test Endpoint"
                    >
                      <i className="fas fa-play" /> Test
                    </button>
                  </div>

                  <div className="ma-tabs-dropdown-wrapper">
                    <button
                      className={`ma-tab-dropdown-toggle ${api.historyOpen ? 'ma-active' : ''}`}
                      onClick={() => api.setHistoryOpen(!api.historyOpen)}
                      title="Generation history"
                      disabled={api.generationHistory.length === 0}
                    >
                      <i className="fas fa-history" />
                    </button>
                    {api.historyOpen && (
                      <HistoryDropdown
                        history={api.generationHistory}
                        onRestore={api.handleRestoreHistory}
                        onClose={() => api.setHistoryOpen(false)}
                      />
                    )}
                  </div>

                  <div className="m-export-group">
                    <button
                      className="secondary-button m-icon-only m-tool-btn"
                      title={api.copyFlash === 'handler' ? 'Copied!' : 'Copy active handler'}
                      onClick={api.handleCopyActiveHandler}
                      disabled={!api.activeHandler}
                    >
                      <i className={`fas ${api.copyFlash === 'handler' ? 'fa-check' : 'fa-clipboard'}`} />
                    </button>

                    <button
                      className="secondary-button m-icon-only m-tool-btn"
                      title={api.copyFlash === 'all' ? 'Copied!' : 'Copy all handler code'}
                      onClick={api.handleCopyAll}
                      disabled={!api.generatedData}
                    >
                      <i className={`fas ${api.copyFlash === 'all' ? 'fa-check' : 'fa-copy'}`} />
                    </button>

                    <select
                      value=""
                      onChange={e => { if (e.target.value) api.triggerExportModal(e.target.value); }}
                      disabled={!api.generatedData}
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

            {api.generatedData?.mockId && (
              <div className={`ma-live-banner ${api.isHibernating ? 'ma-hibernating' : 'ma-live'}`}>
                <div className="ma-live-banner-content">
                  <div className="ma-live-banner-header">
                    <h4 className="ma-live-banner-title">
                      <i className="fas fa-server" /> Mock Server URL
                    </h4>
                    <span className={`ma-live-status-badge ${api.isHibernating ? 'ma-status-hibernating' : 'ma-status-live'}`}>
                      {api.isHibernating ? (
                        <><i className="fas fa-moon" /> Hibernating (Click to Wake Up)</>
                      ) : (
                        <><i className="fas fa-satellite-dish" /> Live (Expires in {api.formattedTimeRemaining})</>
                      )}
                    </span>
                  </div>
                  <p className="ma-live-banner-desc">
                    {api.isHibernating
                      ? 'This server cache expired. Wake it up to continue using the exact same URL!'
                      : 'Copy this base URL into Postman or your code to fetch your API for real:'}
                  </p>
                  {!api.isHibernating && (
                    <code className="ma-live-url">
                      {typeof window !== 'undefined' ? `${window.location.origin}/m/${api.generatedData.mockId}` : ''}
                      <CopyButton className="primary-button copy-btn" codeToCopy={`${window.location.origin}/m/${api.generatedData.mockId}`} />
                    </code>
                  )}
                </div>

                <div className="ma-live-banner-actions">
                  {api.isHibernating ? (
                    <>
                      <select
                        className="ma-wake-duration-select"
                        value={api.outputConfig.mockDuration}
                        onChange={e => api.updateOutputConfig('mockDuration', parseInt(e.target.value, 10))}
                        title="How long the revived server should stay live"
                      >
                        {MOCK_DURATION_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        className="primary-button"
                        onClick={api.handleWakeUp}
                        disabled={api.isLoading}
                      >
                        {api.isLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-bolt" />} Wake Up
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="ma-tabs-dropdown-wrapper">
                        <button
                          className={`ma-tab-dropdown-toggle ${api.linksDropdownOpen ? 'ma-active' : ''}`}
                          onClick={() => api.setLinksDropdownOpen(!api.linksDropdownOpen)}
                          title="All endpoint URLs"
                        >
                          <i className="fas fa-link" />
                        </button>
                        {api.linksDropdownOpen && (
                          <>
                            <div className="ma-dropdown-backdrop" onClick={() => api.setLinksDropdownOpen(false)} />
                            <div className="ma-tabs-dropdown-menu ma-links-dropdown">
                              <div className="ma-history-dropdown-header">
                                <i className="fas fa-link" /> Endpoint URLs
                              </div>
                              {api.mockLinks.map(link => (
                                <button
                                  key={link.key}
                                  className="ma-dropdown-item ma-link-item"
                                  onClick={() => api.handleCopyLink(link.key, link.url)}
                                  title={api.copyFlash === link.key ? 'Copied!' : link.url}
                                >
                                  {link.method ? (
                                    <MethodBadge method={link.method} />
                                  ) : (
                                    <span className="ma-link-root-tag"><i className="fas fa-house" /> Base</span>
                                  )}
                                  <span className="ma-link-item-url">{link.url}</span>
                                  <i className={`fas ${api.copyFlash === link.key ? 'fa-check' : 'fa-copy'} ma-link-copy-icon`} />
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        className="secondary-button btn-danger"
                        onClick={api.triggerStopModal}
                        disabled={api.isLoading}
                        title="Turn off this mock server"
                      >
                        <i className="fas fa-power-off" /> Turn Off
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <EmptyState
              isLoading={api.isLoading}
              condition={!api.generatedData}
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

            {api.isAddEndpointOpen && (
              <div className="modal-overlay" onClick={() => api.setIsAddEndpointOpen(false)}>
                <div className="modal-content m-save-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2><i className="fas fa-plus-circle" /> Add Endpoint</h2>
                  </div>
                  <p className="modal-desc">
                    Describe a new route — it will be generated and appended to the existing handler set.
                  </p>
                  <div className="m-form-group">
                    <label className="m-input-label">Endpoint Description</label>
                    <input
                      type="text"
                      className="m-text-input"
                      placeholder="e.g. POST /api/products — create a new product"
                      value={api.addEndpointInput}
                      onChange={e => api.setAddEndpointInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && api.handleAddEndpoint()}
                    />
                  </div>
                  <div className="modal-footer m-split-footer">
                    <button
                      className="secondary-button m-modal-btn"
                      onClick={() => api.setIsAddEndpointOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button m-modal-btn"
                      onClick={api.handleAddEndpoint}
                      disabled={api.isLoading || !api.addEndpointInput.trim()}
                    >
                      {api.isLoading ? <><div className="m-spinner-small" /> Generating…</> : 'Add Endpoint'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {api.activeHandler && !api.isLoading && (
              <div className="ma-handler-detail-container">
                <div className="ma-handler-header-card">
                  <div className="ma-handler-header-left">
                    <MethodBadge method={api.activeHandler.method} />
                    <span className="ma-handler-path-display">{api.activeHandler.path}</span>
                    <StatusBadge code={api.activeHandler.statusCode ?? 200} />
                    {api.activeHandler.delayMs > 0 && (
                      <span className="ma-fixture-delay-tag">
                        <i className="fas fa-hourglass-half" /> {api.activeHandler.delayMs}ms
                      </span>
                    )}
                    <FixtureShapeWarning handler={api.activeHandler} />
                    {api.handlerDirty[globalHandlerIdx] && (
                      <span className="ma-handler-dirty-tag">
                        <i className="fas fa-pencil" /> Edited
                      </span>
                    )}
                  </div>
                  <div className="ma-handler-header-right">
                    {api.generatedData && <MethodSummaryPills methodCounts={api.methodCounts} />}
                    <span className="ma-handler-name-tag">
                      <i className="fas fa-tag" /> {api.activeHandler.name}
                    </span>

                    <ErrorVariantPanel
                      handler={api.activeHandler}
                      activeVariant={api.activeErrorVariant[globalHandlerIdx]}
                      onSelectVariant={(idx) => api.setErrorVariantForHandler(globalHandlerIdx, idx)}
                    />

                    {!isEditing && (
                      <button
                        className="secondary-button"
                        onClick={() => api.startEdit(globalHandlerIdx, api.viewMode === 'fixture' ? 'fixtureData' : 'code')}
                        title={api.viewMode === 'fixture' ? 'Edit fixture data' : 'Edit handler code'}
                      >
                        <i className="fas fa-pencil" /> Edit
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button className="primary-button" onClick={api.commitEdit}>
                          <i className="fas fa-check" /> Save
                        </button>
                        <button className="secondary-button" onClick={api.cancelEdit}>
                          <i className="fas fa-xmark" /> Cancel
                        </button>
                      </>
                    )}

                    <button
                      className="secondary-button"
                      onClick={() => api.handleRegenerateHandler(globalHandlerIdx)}
                      disabled={api.regeneratingIdx === globalHandlerIdx}
                      title="Regenerate just this handler"
                    >
                      {api.regeneratingIdx === globalHandlerIdx
                        ? <><div className="m-spinner-small" /> Regenerating…</>
                        : <><i className="fas fa-rotate" /> Regenerate</>}
                    </button>
                  </div>
                </div>

                {api.activeHandler.description && (
                  <p className="ma-handler-description">{api.activeHandler.description}</p>
                )}

                <div className="ma-handler-code-pane">
                  {isEditing ? (
                    <div className="ma-api-code-display">
                      <div className="ma-handler-edit-header">
                        <span className="ma-handler-edit-title">
                          <i className="fas fa-pencil" />
                          Editing {api.editingField === 'fixtureData' ? 'Fixture Data' : 'Handler Code'}
                        </span>
                        <span className="ma-handler-edit-hint">
                          {api.editingField === 'fixtureData' ? 'Must be valid JSON' : 'TypeScript / JS'}
                        </span>
                      </div>
                      <CodeEditor
                        value={api.editDraft}
                        onValueChange={api.setEditDraft}
                        language={api.editingField === 'fixtureData' ? 'json' : 'typescript'}
                        lineNumbers={true}
                      />
                    </div>
                  ) : api.viewMode === 'test' ? (
                    <div className="ma-api-test-pane">
                      <div className="m-form-group">
                        <label className="m-input-label">Live Request URL</label>
                        <div className="ma-test-url-row">
                          <MethodBadge method={api.activeHandler.method} />
                          <input
                            type="text"
                            className="m-text-input ma-test-url-input"
                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/m/${api.generatedData.mockId}${api.activeHandler.path.replace(/[:{\[][a-zA-Z0-9_]+[}\]]?/g, '123')}`}
                            readOnly
                          />
                          <button
                            className="primary-button"
                            onClick={() => api.executeTestRequest(globalHandlerIdx)}
                            disabled={api.isTesting[globalHandlerIdx]}
                          >
                            {api.isTesting[globalHandlerIdx] ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />} Send
                          </button>
                        </div>
                      </div>

                      {['POST', 'PUT', 'PATCH'].includes(api.activeHandler.method.toUpperCase()) && (
                        <div className="m-form-group ma-test-body-group">
                          <label className="m-input-label">Request Body (JSON)</label>
                          <textarea
                            className="m-text-input ma-test-body-textarea"
                            value={api.testPayloads[globalHandlerIdx] ?? '{\n  \n}'}
                            onChange={e => api.updateTestPayload(globalHandlerIdx, e.target.value)}
                            placeholder="Enter JSON payload here..."
                          />
                        </div>
                      )}

                      {api.testResponses[globalHandlerIdx] && (
                        <div className="ma-test-response-section">
                          <div className="ma-test-response-header">
                            <h4 className="m-input-label ma-test-response-title">Response</h4>
                            <div className="ma-test-response-meta">
                              <StatusBadge code={api.testResponses[globalHandlerIdx].status} />
                              <span className="ma-test-response-time">
                                <i className="fas fa-clock" /> {api.testResponses[globalHandlerIdx].time}ms
                              </span>
                            </div>
                          </div>
                          <div className="ma-test-response-body">
                            <pre className="ma-test-response-pre">
                              {api.testResponses[globalHandlerIdx].error
                                ? `Error: ${api.testResponses[globalHandlerIdx].error}`
                                : JSON.stringify(api.testResponses[globalHandlerIdx].data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : api.viewMode === 'code'
                    ? <CodeDisplay
                      code={displayHandler?.code ?? api.activeHandler.code}
                      language="typescript"
                      key={`${api.activeHandler.name}-${variantIdx ?? 'success'}`}
                    />
                    : <FixtureDisplay
                      handler={displayHandler ?? api.activeHandler}
                      key={`${api.activeHandler.name}-${variantIdx ?? 'success'}`}
                    />
                  }
                </div>

              </div>
            )}

            {api.generatedData?.explanation && !api.isLoading && (
              <div className="m-panel m-explanation-panel">
                <h3 className="m-explanation-title">
                  <i className="fas fa-robot" /> Generation Analysis
                </h3>
                <div
                  className="m-explanation-body"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(api.generatedData.explanation) }}
                />
              </div>
            )}

          </div>
        </div>

      </div>

      <ConfirmModal
        {...api.modalConfig}
        onCancel={() => api.setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {api.isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => api.setIsSaveModalOpen(false)}>
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
                className="m-text-input"
                placeholder="e.g., Users REST CRUD v2"
                value={api.newSpecName}
                onChange={e => { api.setNewSpecName(e.target.value); api.setSaveSpecError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && api.executeSaveSpec()}
              />
              {api.saveSpecError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-triangle" /> {api.saveSpecError}
                </div>
              )}
            </div>
            <div className="modal-footer m-split-footer">
              <button
                className="secondary-button m-modal-btn"
                onClick={() => api.setIsSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button m-modal-btn"
                onClick={api.executeSaveSpec}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      <CodeHighlightAnalyzer />
    </>
  );
}
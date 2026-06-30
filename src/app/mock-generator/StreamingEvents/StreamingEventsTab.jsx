'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import {
  CorrelatedView, ReplayView,
  inferEventBadges, RuleValidationPanel, DistributionChart,
  EditableCell, EventColBadge
} from './StreamingEventsComponents';
import {
  useStreamingEventsTab,
  STREAM_RULE_TEMPLATES, EVENT_FORMATS,
  STREAM_PARADIGMS, SAMPLE_TEMPLATES,
} from './useStreamingEventsTab';

export default function StreamingEventsTab({ onDataUpdate, isActive }) {
  const st = useStreamingEventsTab({ onDataUpdate, isActive });

  const {
    schemaInput, setSchemaInput, rules, setRules,
    eventFormat, setEventFormat, streamParadigm, setStreamParadigm,
    eventCount, setEventCount, seed, setSeed,
    dataQuality, setDataQuality, includeAnalysis, setIncludeAnalysis,
    includeStateMachine, setIncludeStateMachine,
    isLoading, generatedData,
    activeStream, setActiveStream,
    parsedRulesFeedback, activeStreamData,
    viewMode, setViewMode, filterQuery, setFilterQuery,
    fieldFilters, setFieldFilters,
    currentPage, setCurrentPage, totalPages, paginatedEvents, filteredEvents,
    colKeys, colUniqueValues, rawJsonContent,
    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit, handleCopyCell,
    handleGenerate, triggerExportModal,
    savedTemplates, templatesVisible, setTemplatesVisible,
    isSaveModalOpen, setIsSaveModalOpen, newTemplateName, setNewTemplateName,
    saveTemplateError, setSaveTemplateError,
    executeSaveTemplate, handleDeleteTemplate, handleSaveTemplate,
    modalConfig, setModalConfig, handleLoadSample,
    replayIndex, replayPlaying, replaySpeed, setReplaySpeed,
    handleReplayPlay, handleReplayPause, handleReplayReset, handleReplayStep,
    distColumn, setDistColumn, distData,
    ruleValidation, correlatedView, generateCodeSnippet
  } = st;

  const sampleEvent = activeStreamData?.events?.[0] ?? {};
  const hasMultipleStreams = (generatedData?.streams?.length ?? 0) > 1;

  const getQualityLabel = (val) => {
    if (val === 100) return 'Perfect';
    if (val >= 80) return 'Minor Edge Cases';
    return 'Heavy Edge Cases';
  };

  const handleCopyAsCode = (format) => {
    if (!activeStreamData?.events) return;
    const snippet = generateCodeSnippet(activeStreamData.events, activeStreamData.streamName, format);
    navigator.clipboard.writeText(snippet).catch(() => { });
  };

  const activeFieldFilterCount = Object.values(fieldFilters).filter(v => v !== '').length;

  return (
    <>
      <div className="m-factory-container">

        <div className="m-sidebar">
          <div className="m-sidebar-content">
            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-stream" /> Event Schema
                </div>
                <button
                  className="m-icon-text-btn"
                  onClick={() => setTemplatesVisible(!templatesVisible)}
                  disabled={savedTemplates.length === 0}
                >
                  <i className={`fas ${templatesVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                  {savedTemplates.length > 0 && (
                    <span className="m-badge-count">{savedTemplates.length}</span>
                  )}
                </button>
              </div>

              <div className="m-form-group param-group">
                <select
                  className="m-theme-select-dropdown"
                  value=""
                  onChange={e => {
                    const selected = SAMPLE_TEMPLATES.find(s => s.label === e.target.value);
                    if (selected) handleLoadSample(selected);
                  }}
                >
                  <option value="" disabled>⚡ Load Starter Sample Stream...</option>
                  {SAMPLE_TEMPLATES.map(s => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>
              </div>

              {templatesVisible && savedTemplates.length > 0 && (
                <div className="m-schema-library-panel">
                  {savedTemplates.map((t, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
                        onClick={() => {
                          setSchemaInput(t.schema);
                          if (t.rules) setRules(t.rules);
                          if (t.eventFormat) setEventFormat(t.eventFormat);
                          if (t.streamParadigm) setStreamParadigm(t.streamParadigm);
                          setTemplatesVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code m-schema-library-item-icon" />
                        {t.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteTemplate(i); }}
                        className="m-library-item-delete-btn"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="editor-wrapper-box param-group">
                <CodeEditor
                  value={schemaInput}
                  lineNumbers={false}
                  onValueChange={setSchemaInput}
                  language="json"
                  placeholder={`{\n  "event_type": "page_view | click | purchase",\n  "user_id": "UUID",\n  "session_id": "string",\n  "timestamp": "ISO8601"\n}`}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button full-width-btn"
                  onClick={handleSaveTemplate}
                  disabled={!schemaInput.trim()}
                >
                  <i className="fas fa-save" /> Save to Library
                </button>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-cogs" /> Stream Config
                </div>
              </div>
              
              <div className="m-form-group param-group">
                <label className="m-input-label">Paradigm</label>
                <select
                  className="m-theme-select-dropdown"
                  value={streamParadigm}
                  onChange={e => setStreamParadigm(e.target.value)}
                >
                  {STREAM_PARADIGMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="m-form-group param-group">
                <label className="m-input-label">Output Format</label>
                <select
                  className="m-theme-select-dropdown"
                  value={eventFormat}
                  onChange={e => setEventFormat(e.target.value)}
                >
                  {EVENT_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-sliders-h" /> Parameters
                </div>
              </div>

              <div className="m-form-group param-group">
                <label className="m-input-label">
                  Event Count <span className="m-quality-value-badge">{eventCount}</span>
                </label>
                <input
                  type="range"
                  className="m-styled-slider"
                  min={5} max={200} step={5}
                  value={parseInt(eventCount, 10) || 25}
                  onChange={e => setEventCount(e.target.value)}
                />
                <div className="m-slider-hint">5 – 200 events per stream</div>
              </div>

              <div className="m-form-group param-group">
                <label className="m-input-label">
                  Seed <span className="m-optional-tag">optional</span>
                </label>
                <div className="m-input-with-icon">
                  <i className="fas fa-dice m-input-icon" />
                  <input
                    type="text"
                    className="m-text-input m-with-icon"
                    placeholder="e.g. replay-42"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                  />
                </div>
              </div>

              <div className="m-form-group param-group">
                <label className="m-input-label">
                  Data Quality{' '}
                  <span className="m-quality-value-badge">{getQualityLabel(dataQuality)}</span>
                </label>
                <input
                  type="range"
                  className="m-styled-slider"
                  min={60} max={100} step={10}
                  value={dataQuality}
                  onChange={e => setDataQuality(Number(e.target.value))}
                />
                <div className="m-slider-hint">60 = heavy edge cases · 100 = clean data</div>
              </div>

              <div className="m-form-group">
                <label className="custom-check">
                  <input
                    type="checkbox"
                    checked={includeStateMachine}
                    onChange={e => setIncludeStateMachine(e.target.checked)}
                  />
                  <div className="box"><i className="fa-solid fa-check"></i></div>
                  <span className="label-text">
                    <i className="fas fa-project-diagram" /> Generate State Machine
                  </span>
                </label>
                <label className="custom-check">
                  <input
                    type="checkbox"
                    checked={includeAnalysis}
                    onChange={e => setIncludeAnalysis(e.target.checked)}
                  />
                  <div className="box"><i className="fa-solid fa-check"></i></div>
                  <span className="label-text">
                    <i className="fas fa-robot" /> Include Generation Analysis
                  </span>
                </label>
              </div>
            </div>

            <div className="m-section m-section-expanded">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-balance-scale" /> Rules &amp; Constraints
                </div>
              </div>
              <div className="m-form-group m-form-group-expanded">
                <select
                  className="m-theme-select-dropdown param-group"
                  value=""
                  onChange={e => {
                    if (e.target.value)
                      setRules(prev => prev ? `${prev}\n${e.target.value}` : e.target.value);
                  }}
                >
                  <option value="" disabled>+ Insert Template Rule...</option>
                  {STREAM_RULE_TEMPLATES.map(t => (
                    <option key={t.label} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <textarea
                  className="m-rule-input"
                  placeholder="e.g., Timestamps must be monotonically increasing."
                  value={rules}
                  onChange={e => setRules(e.target.value)}
                />
                {parsedRulesFeedback.length > 0 && (
                  <div className="m-rules-feedback">
                    <strong><i className="fas fa-robot" /> Rules Applied</strong>
                    <ul>
                      {parsedRulesFeedback.map((r, i) => (
                        <li key={i}><i className="fas fa-check-circle" />{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {ruleValidation.length > 0 && (
                <RuleValidationPanel results={ruleValidation} />
              )}
            </div>
          </div>

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${isLoading ? 'm-loading' : ''}`}
              onClick={handleGenerate}
              disabled={isLoading || !schemaInput.trim()}
            >
              {isLoading
                ? <><i className="fas fa-spinner fa-spin" /> Synthesizing…</>
                : <><i className="fas fa-bolt" /> Generate Stream</>}
            </button>
          </div>
        </div>

        <div className="m-preview-area">
          {generatedData && !isLoading && (
            <div className="m-toolbar">
              <div className="tab-list-scrollable">
                {generatedData.streams.map((s, idx) => (
                  <button
                    key={idx}
                    className={`m-tab-btn ${activeStream === idx ? 'm-active' : ''}`}
                    onClick={() => setActiveStream(idx)}
                  >
                    <i className="fas fa-stream tab-icon" />
                    {s.streamName}
                    <span className="m-tab-count-badge">{s.events.length}</span>
                  </button>
                ))}
              </div>

              <div className="m-toolbar-right">
                <div className="m-view-mode-toggles">
                  <button
                    className={`m-view-toggle-btn ${viewMode === 'events' ? 'm-active' : ''}`}
                    onClick={() => setViewMode('events')}
                  >
                    <i className="fas fa-table" /> Table
                    {activeFieldFilterCount > 0 && (
                      <span className="m-tab-count-badge filter-count-badge">{activeFieldFilterCount}</span>
                    )}
                  </button>
                  <button
                    className={`m-view-toggle-btn ${viewMode === 'timeline' ? 'm-active' : ''}`}
                    onClick={() => setViewMode('timeline')}
                  >
                    <i className="fas fa-align-left" /> Timeline
                  </button>
                  <button
                    className={`m-view-toggle-btn ${viewMode === 'replay' ? 'm-active' : ''}`}
                    onClick={() => setViewMode('replay')}
                  >
                    <i className="fas fa-play-circle" /> Replay
                  </button>
                  {hasMultipleStreams && (
                    <button
                      className={`m-view-toggle-btn ${viewMode === 'correlated' ? 'm-active' : ''}`}
                      onClick={() => setViewMode('correlated')}
                    >
                      <i className="fas fa-random" /> Correlated
                    </button>
                  )}
                  <button
                    className={`m-view-toggle-btn ${viewMode === 'distribution' ? 'm-active' : ''}`}
                    onClick={() => setViewMode('distribution')}
                  >
                    <i className="fas fa-chart-bar" /> Dist
                  </button>
                  <button
                    className={`m-view-toggle-btn ${viewMode === 'raw' ? 'm-active' : ''}`}
                    onClick={() => setViewMode('raw')}
                  >
                    <i className="fas fa-code" /> Raw
                  </button>
                </div>

                <select
                  disabled={!generatedData}
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      triggerExportModal(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Export / Copy…</option>
                  <optgroup label="File export">
                    <option value="ndjson">NDJSON (All Streams)</option>
                    <option value="json">JSON (All Streams)</option>
                    <option value="csv">CSV (Active Stream)</option>
                    <option value="kafka">Kafka NDJSON</option>
                  </optgroup>
                  <optgroup label="Copy as code">
                    <option value="python_kafka">Python — Kafka producer</option>
                    <option value="python_requests">Python — requests</option>
                    <option value="js_fetch">JavaScript — fetch</option>
                    <option value="curl">cURL commands</option>
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          <EmptyState
            isLoading={isLoading}
            condition={!generatedData}
            icon="fas fa-stream"
            title="Awaiting Event Stream"
            description="Describe your event shape or state machine in the sidebar to generate time-series telemetry, access logs, customer journeys, and Kafka-ready event fixtures."
            hint={<>Use <code>@monotonic</code> to enforce strictly increasing timestamps.</>}
            loadingTitle="Synthesizing Event Stream"
            loadingDescription="Modeling state transitions and generating temporally coherent event sequences..."
          />

          <div className="stream-view-scroll-area">
            {activeStreamData && !isLoading && viewMode === 'events' && (
              <div className="m-table-wrapper">
                <div className="m-table-filter-bar">
                  <div className="m-table-filter-input-wrap">
                    <i className="fas fa-search m-table-filter-icon" />
                    <input
                      type="text"
                      className="m-table-filter-input"
                      placeholder={`Search ${activeStreamData.streamName}…`}
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                    />
                    {filterQuery && (
                      <button
                        className="m-table-filter-clear"
                        onClick={() => setFilterQuery('')}
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  {Object.entries(colUniqueValues).slice(0, 3).map(([col, vals]) => (
                    <select
                      key={col}
                      value={fieldFilters[col] || ''}
                      onChange={e => setFieldFilters(prev => ({ ...prev, [col]: e.target.value }))}
                    >
                      <option value="">{col}: all</option>
                      {vals.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ))}

                  {activeFieldFilterCount > 0 && (
                    <button
                      className="m-icon-text-btn"
                      onClick={() => setFieldFilters({})}
                    >
                      <i className="fas fa-filter-circle-xmark" /> Clear filters
                    </button>
                  )}

                  {(filterQuery || activeFieldFilterCount > 0) && (
                    <span className="m-table-filter-count">
                      {filteredEvents.length} match{filteredEvents.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <div className="m-table-controls-right">
                    <span className="m-table-meta-tag">
                      <i className="fas fa-info-circle" /> Triple-click cell to copy
                    </span>
                  </div>
                </div>

                <div className="m-table-scroll-container">
                  <table className="m-data-table">
                    <thead>
                      <tr>
                        {colKeys.map(key => {
                          const badges = inferEventBadges(key, sampleEvent[key]);
                          return (
                            <th key={key}>
                              <div className="m-th-content">
                                <span className="m-th-col-name">{key}</span>
                                <div className="m-th-badges">
                                  {badges.map(b => <EventColBadge key={b} label={b} />)}
                                </div>
                                <button
                                  className="col-dist-btn"
                                  onClick={() => {
                                    setDistColumn(prev => prev === key ? null : key);
                                    setViewMode('distribution');
                                  }}
                                >
                                  <i className="fas fa-chart-bar" />
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={colKeys.length} className="m-table-no-results">
                            <i className="fas fa-search-minus m-empty-search-icon" />
                            <p>No events match &ldquo;{filterQuery}&rdquo;</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedEvents.map((evt, rowIdx) => (
                          <tr key={rowIdx}>
                            {colKeys.map((colKey, colIdx) => {
                              const isEditing =
                                editingCell?.rowIdx === rowIdx &&
                                editingCell?.colKey === colKey;
                              return (
                                <EditableCell
                                  key={colIdx}
                                  value={evt[colKey]}
                                  isEditing={isEditing}
                                  editingValue={editingValue}
                                  onStartEdit={val => handleStartEdit(rowIdx, colKey, val)}
                                  onChange={setEditingValue}
                                  onCommit={handleCommitEdit}
                                  onCancel={handleCancelEdit}
                                  onCopy={handleCopyCell}
                                />
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="m-pagination-controls">
                    <button
                      className="m-page-btn"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="fas fa-chevron-left" /> Prev
                    </button>
                    <span className="m-page-indicator">
                      Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button
                      className="m-page-btn"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeStreamData && !isLoading && viewMode === 'timeline' && (
              <div className="stream-timeline-wrapper">
                <div className="stream-timeline-inner">
                  {activeStreamData.events.map((evt, i) => {
                    const ts = evt.timestamp || evt.ts || evt.event_time || evt.created_at;
                    const type = evt.event_type || evt.type || evt.name || evt.event_name || `event_${i + 1}`;
                    const isErr = String(type).toLowerCase().includes('error') || String(type).toLowerCase().includes('fail');
                    return (
                      <div key={`${evt.timestamp ?? ''}-${i}`} className={`timeline-event ${isErr ? 'timeline-event--error' : ''}`}>
                        <div className="timeline-dot" />
                        <div className="timeline-body">
                          <div className="timeline-header-row">
                            <span className="timeline-event-type">{type}</span>
                            {ts && <span className="timeline-ts">{ts}</span>}
                          </div>
                          <div className="timeline-payload">
                            {Object.entries(evt)
                              .filter(([k]) => k !== 'event_type' && k !== 'type' && k !== 'name' && k !== 'timestamp' && k !== 'ts' && k !== 'event_time' && k !== 'created_at')
                              .slice(0, 4)
                              .map(([k, v]) => (
                                <span key={k} className="timeline-kv">
                                  <span className="timeline-key">{k}</span>
                                  <span className="timeline-val">
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}
                                  </span>
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeStreamData && !isLoading && viewMode === 'replay' && (
              <ReplayView
                events={activeStreamData.events}
                replayIndex={replayIndex}
                replayPlaying={replayPlaying}
                replaySpeed={replaySpeed}
                setReplaySpeed={setReplaySpeed}
                onPlay={handleReplayPlay}
                onPause={handleReplayPause}
                onReset={handleReplayReset}
                onStep={handleReplayStep}
              />
            )}

            {generatedData && !isLoading && viewMode === 'correlated' && correlatedView && (
              <CorrelatedView correlatedView={correlatedView} streams={generatedData.streams} />
            )}

            {generatedData && !isLoading && viewMode === 'correlated' && !correlatedView && (
              <div className="empty-state correlated-empty-state">
                <i className="fas fa-random correlated-empty-icon" />
                <p className="correlated-empty-text">Generate multiple streams to see the correlation view.</p>
              </div>
            )}

            {activeStreamData && !isLoading && viewMode === 'distribution' && (
              <div className="dist-view-wrapper">
                <div className="dist-col-picker">
                  <span className="dist-picker-label"><i className="fas fa-chart-bar" /> Choose a column to analyse:</span>
                  <div className="dist-col-chips">
                    {colKeys.map(k => (
                      <button
                        key={k}
                        className={`dist-col-chip ${distColumn === k ? 'm-active' : ''}`}
                        onClick={() => setDistColumn(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {distColumn && distData ? (
                  <DistributionChart
                    distData={distData}
                    colKey={distColumn}
                    onClose={() => setDistColumn(null)}
                  />
                ) : (
                  <div className="dist-empty">
                    <i className="fas fa-hand-pointer" />
                    <p>Select a column above to see its distribution</p>
                  </div>
                )}
              </div>
            )}

            {activeStreamData && !isLoading && viewMode === 'raw' && (
              <div className="stream-raw-wrapper">
                <div className="stream-raw-toolbar">
                  <span className="m-table-meta-tag">
                    <i className="fas fa-file-alt" /> Newline-delimited JSON ({activeStreamData.events.length} events)
                  </span>
                  <div className="raw-actions">
                    <button
                      className="secondary-button"
                      onClick={() => navigator.clipboard.writeText(rawJsonContent)}
                    >
                      <i className="fas fa-copy" /> Copy NDJSON
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => handleCopyAsCode('python_kafka')}
                    >
                      <i className="fab fa-python" /> Python
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => handleCopyAsCode('js_fetch')}
                    >
                      <i className="fab fa-js-square" /> JS
                    </button>
                  </div>
                </div>
                <pre className="stream-raw-pre">{rawJsonContent}</pre>
              </div>
            )}
          </div>

          {!isLoading && (generatedData?.stateMachine || generatedData?.explanation) && (
            <div className="stream-analysis-panels">
              {generatedData.stateMachine && (
                <div className="m-explanation-panel">
                  <h3 className="m-explanation-title">
                    <i className="fas fa-project-diagram" /> State Machine
                  </h3>
                  <pre className="stream-state-machine">
                    {typeof generatedData.stateMachine === 'string'
                      ? generatedData.stateMachine
                      : JSON.stringify(generatedData.stateMachine, null, 2)}
                  </pre>
                </div>
              )}

              {generatedData.explanation && (
                <div className="m-explanation-panel">
                  <h3 className="m-explanation-title">
                    <i className="fas fa-robot" /> Generation Analysis
                  </h3>
                  <div
                    className="m-explanation-body"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(generatedData.explanation)
                    }} />
                </div>
              )}
            </div>
          )}
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
              <h2><i className="fas fa-cloud-upload-alt" /> Save Stream Template</h2>
            </div>
            <p className="modal-desc">
              Store this event schema in your local library for quick reuse across different streaming sessions.
            </p>
            <div className="m-form-group param-group">
              <label className="m-input-label">Template Name</label>
              <input
                type="text"
                className="m-text-input full-width-input"
                placeholder="e.g., E-commerce Checkout Journey"
                value={newTemplateName}
                onChange={e => { setNewTemplateName(e.target.value); setSaveTemplateError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && executeSaveTemplate()}
              />
              {saveTemplateError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-triangle" /> {saveTemplateError}
                </div>
              )}
            </div>
            <div className="m-split-footer">
              <button className="secondary-button m-modal-btn" onClick={() => setIsSaveModalOpen(false)}>
                Cancel
              </button>
              <button className="primary-button m-modal-btn" onClick={executeSaveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { CorrelatedView, ReplayView, 
  inferEventBadges, RuleValidationPanel, DistributionChart, 
  EditableCell, EventColBadge } from '../components/StreamingEventsComponents';
import {
  useStreamingEventsTab,
  STREAM_RULE_TEMPLATES, EVENT_FORMATS, 
  STREAM_PARADIGMS, ITEMS_PER_PAGE, SAMPLE_TEMPLATES,
} from '../hooks/useStreamingEventsTab';

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
    parsedRulesFeedback, allStreamNames, activeStreamData,

    viewMode, setViewMode, filterQuery, setFilterQuery,
    fieldFilters, setFieldFilters,
    currentPage, setCurrentPage, totalPages, paginatedEvents, filteredEvents,
    colKeys, colUniqueValues, rawJsonContent, rawFullContent,

    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit, handleCopyCell,

    handleGenerate, triggerExportModal,

    savedTemplates, templatesVisible, setTemplatesVisible,
    isSaveModalOpen, setIsSaveModalOpen, newTemplateName, setNewTemplateName,
    saveTemplateError, setSaveTemplateError,
    handleSaveTemplate, executeSaveTemplate, handleDeleteTemplate,

    modalConfig, setModalConfig, handleLoadSample,

    replayIndex, replayPlaying, replaySpeed, setReplaySpeed,
    handleReplayPlay, handleReplayPause, handleReplayReset, handleReplayStep,

    distColumn, setDistColumn, distData,
    ruleValidation,
    correlatedView,
    generateCodeSnippet
  } = st;

  const sampleEvent = activeStreamData?.events?.[0] ?? {};
  const hasMultipleStreams = (generatedData?.streams?.length ?? 0) > 1;

  const getQualityLabel = (val) => {
    if (val === 100) return 'Perfect';
    if (val >= 80) return 'Minor Edge Cases';
    return 'Heavy Edge Cases';
  };

  const selectedParadigmIcon = STREAM_PARADIGMS.find(p => p.value === streamParadigm)?.icon ?? 'fa-stream';

  // Copy-as-code handler
  const handleCopyAsCode = (format) => {
    if (!activeStreamData?.events) return;
    const snippet = generateCodeSnippet(activeStreamData.events, activeStreamData.streamName, format);
    navigator.clipboard.writeText(snippet).catch(() => {});
  };

  const activeFieldFilterCount = Object.values(fieldFilters).filter(v => v !== '').length;

  return (
    <>
      <div className="mock-factory-container">

        <div className="mock-sidebar">
          <div className="mock-sidebar-content">

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className="fas fa-stream" /> Event Schema
                </div>
                <button
                  className="icon-text-btn"
                  onClick={() => setTemplatesVisible(!templatesVisible)}
                  disabled={savedTemplates.length === 0}
                  title={savedTemplates.length === 0 ? 'Save a template first' : 'Toggle Saved Templates'}
                >
                  <i className={`fas ${templatesVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                  {savedTemplates.length > 0 && (
                    <span className="badge-count">{savedTemplates.length}</span>
                  )}
                </button>
              </div>

              <div className="mock-form-group">
                <select
                  className="theme-select-dropdown"
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
                <div className="schema-library-panel">
                  {savedTemplates.map((t, i) => (
                    <div key={i} className="schema-library-item">
                      <div
                        className="schema-library-item-name"
                        onClick={() => {
                          setSchemaInput(t.schema);
                          if (t.rules) setRules(t.rules);
                          if (t.eventFormat) setEventFormat(t.eventFormat);
                          if (t.streamParadigm) setStreamParadigm(t.streamParadigm);
                          setTemplatesVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code schema-library-item-icon" />
                        {t.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteTemplate(i); }}
                        className="library-item-delete-btn"
                        title="Delete template"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="editor-wrapper-box">
                <CodeEditor
                  value={schemaInput}
                  onValueChange={setSchemaInput}
                  language="json"
                  placeholder={`// Describe your event shape, state machine, or entity\n{\n  "event_type": "page_view | click | purchase",\n  "user_id": "UUID",\n  "session_id": "string",\n  "timestamp": "ISO8601"\n}`}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button btn-small full-width"
                  onClick={handleSaveTemplate}
                  disabled={!schemaInput.trim()}
                >
                  <i className="fas fa-save" /> Save to Library
                </button>
              </div>
            </div>

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className={`fas ${selectedParadigmIcon}`} /> Stream Paradigm
                </div>
              </div>
              <div className="mock-form-group">
                <select
                  className="theme-select-dropdown"
                  value={streamParadigm}
                  onChange={e => setStreamParadigm(e.target.value)}
                >
                  {STREAM_PARADIGMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <><i className="fas fa-balance-scale" /> Rules &amp; Distributions</>
                </div>
              </div>
              <div className="mock-form-group">
                <select
                  className="theme-select-dropdown"
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
                  className="mock-rule-input"
                  placeholder="e.g., Timestamps must be monotonically increasing in 1–5 second increments."
                  value={rules}
                  onChange={e => setRules(e.target.value)}
                />
                {parsedRulesFeedback.length > 0 && (
                  <div className="rules-feedback">
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

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className="fas fa-plug" /> Output Format
                </div>
              </div>
              <div className="mock-form-group">
                <select
                  className="theme-select-dropdown"
                  value={eventFormat}
                  onChange={e => setEventFormat(e.target.value)}
                >
                  {EVENT_FORMATS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mock-section">
              <div className="mock-section-header">
                <div className="mock-section-title">
                  <i className="fas fa-sliders-h" /> Parameters
                </div>
              </div>

              <div className="mock-form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">
                  Event Count <span className="quality-value-badge">{eventCount}</span>
                </label>
                <input
                  type="range"
                  className="styled-slider"
                  min={5} max={200} step={5}
                  value={parseInt(eventCount, 10) || 25}
                  onChange={e => setEventCount(e.target.value)}
                />
                <div className="slider-hint">5 – 200 events per stream</div>
              </div>

              <div className="mock-form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">
                  Seed <span className="optional-tag">optional</span>
                </label>
                <div className="input-with-icon">
                  <i className="fas fa-dice input-icon" />
                  <input
                    type="text"
                    className="text-input with-icon"
                    placeholder="e.g. replay-42"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                  />
                </div>
              </div>

              <div className="mock-form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="input-label">
                  Data Quality{' '}
                  <span className="quality-value-badge">{getQualityLabel(dataQuality)}</span>
                </label>
                <input
                  type="range"
                  className="styled-slider"
                  min={60} max={100} step={10}
                  value={dataQuality}
                  onChange={e => setDataQuality(Number(e.target.value))}
                />
                <div className="slider-hint">60 = heavy edge cases · 100 = clean data</div>
              </div>

              <div className="mock-form-group">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={includeStateMachine}
                    onChange={e => setIncludeStateMachine(e.target.checked)}
                  />
                  <span className="toggle-label">
                    <i className="fas fa-project-diagram" /> Generate State Machine
                  </span>
                </label>
                <label className="toggle-row" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={includeAnalysis}
                    onChange={e => setIncludeAnalysis(e.target.checked)}
                  />
                  <span className="toggle-label">
                    <i className="fas fa-robot" /> Include Generation Analysis
                  </span>
                </label>
              </div>
            </div>

          </div>

          <div className="mock-sidebar-footer">
            <button
              className={`primary-button fabricate-action-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleGenerate}
              disabled={isLoading || !schemaInput.trim()}
            >
              {isLoading
                ? <><i className="fas fa-spinner fa-spin" /> Synthesizing…</>
                : <><i className="fas fa-bolt" /> Generate Stream</>}
            </button>
          </div>
        </div>

        <div className="mock-preview-area">

          {generatedData && !isLoading && (
            <div className="mock-toolbar flex-row">

              <div className="tab-list" style={{ flex: 1, overflowX: 'auto', display: 'flex' }}>
                {generatedData.streams.map((s, idx) => (
                  <button
                    key={idx}
                    className={`tab-btn ${activeStream === idx ? 'active' : ''}`}
                    onClick={() => setActiveStream(idx)}
                  >
                    <i className="fas fa-stream" style={{ marginRight: '0.4rem', fontSize: '0.75rem' }} />
                    {s.streamName}
                    <span className="tab-count-badge">{s.events.length}</span>
                  </button>
                ))}
              </div>

              <div className="toolbar-right flex-row">
                <div className="view-mode-toggles">
                  <button
                    className={`view-toggle-btn ${viewMode === 'events' ? 'active' : ''}`}
                    onClick={() => setViewMode('events')}
                    title="Table view"
                  >
                    <i className="fas fa-table" /> Table
                    {activeFieldFilterCount > 0 && (
                      <span className="tab-count-badge" style={{ marginLeft: '0.3rem' }}>{activeFieldFilterCount}</span>
                    )}
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
                    onClick={() => setViewMode('timeline')}
                    title="Timeline view"
                  >
                    <i className="fas fa-align-left" /> Timeline
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'replay' ? 'active' : ''}`}
                    onClick={() => setViewMode('replay')}
                    title="Replay mode"
                  >
                    <i className="fas fa-play-circle" /> Replay
                  </button>
                  {hasMultipleStreams && (
                    <button
                      className={`view-toggle-btn ${viewMode === 'correlated' ? 'active' : ''}`}
                      onClick={() => setViewMode('correlated')}
                      title="Multi-stream correlation view"
                    >
                      <i className="fas fa-random" /> Correlated
                    </button>
                  )}
                  <button
                    className={`view-toggle-btn ${viewMode === 'distribution' ? 'active' : ''}`}
                    onClick={() => setViewMode('distribution')}
                    title="Column distributions"
                  >
                    <i className="fas fa-chart-bar" /> Dist
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
                    onClick={() => setViewMode('raw')}
                    title="Raw NDJSON"
                  >
                    <i className="fas fa-code" /> Raw
                  </button>
                </div>

                <select
                  className="theme-select-dropdown action-select"
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
              <div className="mock-table-wrapper">

                <div className="table-filter-bar">
                  <div className="table-filter-input-wrap">
                    <i className="fas fa-search table-filter-icon" />
                    <input
                      type="text"
                      className="table-filter-input"
                      placeholder={`Search ${activeStreamData.streamName}…`}
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                    />
                    {filterQuery && (
                      <button
                        className="table-filter-clear"
                        onClick={() => setFilterQuery('')}
                        title="Clear filter"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  {Object.entries(colUniqueValues).slice(0, 3).map(([col, vals]) => (
                    <select
                      key={col}
                      className="theme-select-dropdown action-select field-filter-select"
                      value={fieldFilters[col] || ''}
                      onChange={e => setFieldFilters(prev => ({ ...prev, [col]: e.target.value }))}
                      title={`Filter by ${col}`}
                    >
                      <option value="">{col}: all</option>
                      {vals.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ))}

                  {activeFieldFilterCount > 0 && (
                    <button
                      className="icon-text-btn"
                      onClick={() => setFieldFilters({})}
                      title="Clear all field filters"
                    >
                      <i className="fas fa-filter-circle-xmark" /> Clear filters
                    </button>
                  )}

                  {(filterQuery || activeFieldFilterCount > 0) && (
                    <span className="table-filter-count">
                      {filteredEvents.length} match{filteredEvents.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <div className="table-controls-right">
                    <span className="table-meta-tag">
                      <i className="fas fa-info-circle" /> Triple-click cell to copy
                    </span>
                  </div>
                </div>

                <div className="table-scroll-container">
                  <table className="mock-data-table">
                    <thead>
                      <tr>
                        {colKeys.map(key => {
                          const badges = inferEventBadges(key, sampleEvent[key]);
                          return (
                            <th key={key}>
                              <div className="th-content">
                                <span className="th-col-name">{key}</span>
                                <div className="th-badges">
                                  {badges.map(b => <EventColBadge key={b} label={b} />)}
                                </div>
                                <button
                                  className="col-dist-btn"
                                  title={`View distribution for ${key}`}
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
                          <td colSpan={colKeys.length} className="table-no-results">
                            <i className="fas fa-search-minus empty-search-icon" />
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
                  <div className="pagination-controls">
                    <button
                      className="page-btn"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="fas fa-chevron-left" /> Prev
                    </button>
                    <span className="page-indicator">
                      Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button
                      className="page-btn"
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
              <div className="mock-empty-state" style={{ padding: '3rem', flex: 1 }}>
                <i className="fas fa-random" style={{ fontSize: '2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Generate multiple streams to see the correlation view.</p>
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
                        className={`dist-col-chip ${distColumn === k ? 'active' : ''}`}
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
                  <span className="table-meta-tag">
                    <i className="fas fa-file-alt" /> Newline-delimited JSON ({activeStreamData.events.length} events)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="secondary-button btn-small"
                      onClick={() => navigator.clipboard.writeText(rawJsonContent)}
                    >
                      <i className="fas fa-copy" /> Copy NDJSON
                    </button>
                    <button
                      className="secondary-button btn-small"
                      onClick={() => handleCopyAsCode('python_kafka')}
                      title="Copy as Python Kafka producer"
                    >
                      <i className="fab fa-python" /> Python
                    </button>
                    <button
                      className="secondary-button btn-small"
                      onClick={() => handleCopyAsCode('js_fetch')}
                      title="Copy as JS fetch"
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
                <div className="panel explanation-panel">
                  <h3 className="explanation-title">
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
                <div className="panel explanation-panel">
                  <h3 className="explanation-title">
                    <i className="fas fa-robot" /> Generation Analysis
                  </h3>
                  <div
                    className="explanation-body"
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
          <div className="modal-content save-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-cloud-upload-alt" /> Save Stream Template</h2>
            </div>
            <p className="modal-desc">
              Store this event schema in your local library for quick reuse across different streaming sessions.
            </p>
            <div className="mock-form-group">
              <label className="input-label">Template Name</label>
              <input
                type="text"
                className="text-input full-width"
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
            <div className="modal-footer split-footer">
              <button className="secondary-button modal-btn" onClick={() => setIsSaveModalOpen(false)}>
                Cancel
              </button>
              <button className="primary-button modal-btn" onClick={executeSaveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
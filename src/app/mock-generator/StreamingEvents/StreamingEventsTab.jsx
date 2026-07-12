'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { EditableCell, EventColBadge } from './components/TableComponents';
import { CorrelatedView, ReplayView, RuleValidationPanel, DistributionChart } from './components/ViewComponents';
import { inferEventBadges } from './utils';
import { STREAM_RULE_TEMPLATES, EVENT_FORMATS, STREAM_PARADIGMS, SAMPLE_TEMPLATES } from './constants';
import { useStreamingEvents } from './useStreamingEvents';

export default function StreamingEventsTab({ onShareStateChange }) {
  const stream = useStreamingEvents();
  const fileInputRef = useRef(null);

  useEffect(() => {
    onShareStateChange?.({
      share: stream.share,
      shareCopied: stream.shareCopied,
      resultData: stream.resultData,
      shareDisabled: stream.shareDisabled,
    });
  }, [stream.share, stream.shareCopied, stream.resultData, stream.shareDisabled, onShareStateChange]);

  const sampleEvent = stream.activeStreamData?.events?.[0] ?? {};
  const hasMultipleStreams = (stream.generatedData?.streams?.length ?? 0) > 1;

  const getQualityLabel = (val) => {
    if (val === 100) return 'Perfect';
    if (val >= 80) return 'Minor Edge Cases';
    return 'Heavy Edge Cases';
  };

  const handleCopyAsCode = (format) => {
    if (!stream.activeStreamData?.events) return;
    const snippet = stream.generateCodeSnippet(stream.activeStreamData.events, stream.activeStreamData.streamName, format);
    navigator.clipboard.writeText(snippet).catch(() => { });
  };

  const activeFieldFilterCount = Object.values(stream.fieldFilters).filter(v => v !== '').length;

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
                <div className="m-section-header-actions">
                  <button
                    className="m-icon-text-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload a JSON schema file"
                  >
                    <i className="fas fa-file-arrow-up" />
                  </button>
                  <button
                    className="m-icon-text-btn"
                    onClick={() => stream.setTemplatesVisible(!stream.templatesVisible)}
                    disabled={stream.savedTemplates.length === 0}
                  >
                    <i className={`fas ${stream.templatesVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                    {stream.savedTemplates.length > 0 && (
                      <span className="m-badge-count">{stream.savedTemplates.length}</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="m-form-group param-group reset-btn">
                <select
                  value=""
                  onChange={e => {
                    const selected = SAMPLE_TEMPLATES.find(s => s.label === e.target.value);
                    if (selected) stream.handleLoadSample(selected);
                  }}
                >
                  <option value="" disabled>Load Starter Sample...</option>
                  {SAMPLE_TEMPLATES.map(s => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>

                <button className="secondary-button btn-danger" onClick={stream.resetConfig} title="Reset Output Config">
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>

              {stream.templatesVisible && stream.savedTemplates.length > 0 && (
                <div className="m-schema-library-panel">
                  {stream.savedTemplates.map((t, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
                        onClick={() => {
                          stream.setConfig(prev => ({
                            ...prev,
                            schemaInput: t.schema,
                            rules: t.rules || prev.rules,
                            eventFormat: t.eventFormat || prev.eventFormat,
                            streamParadigm: t.streamParadigm || prev.streamParadigm
                          }));
                          stream.setTemplatesVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code m-schema-library-item-icon" />
                        {t.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); stream.handleDeleteTemplate(i); }}
                        className="m-library-item-delete-btn"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`editor-wrapper-box param-group stream-editor-dropzone ${stream.isDragOver ? 'stream-dragover' : ''}`}
                onDrop={stream.handleDrop}
                onDragEnter={stream.handleDragEnter}
                onDragOver={stream.handleDragOver}
                onDragLeave={stream.handleDragLeave}
                title="Drop a JSON schema file here"
              >
                <CodeEditor
                  value={stream.config.schemaInput}
                  lineNumbers={false}
                  onValueChange={v => stream.updateConfig('schemaInput', v)}
                  language="json"
                  placeholder={`{\n  "event_type": "page_view | click | purchase",\n  "user_id": "UUID",\n  "session_id": "string",\n  "timestamp": "ISO8601"\n}`}
                />
                
                {stream.schemaError && (
                  <div className="error-message" style={{ color: 'var(--danger)', fontSize: '0.6rem', marginTop: '0.4rem', background: 'rgba(220, 38, 38, 0.1)', padding: '0.4rem', borderRadius: '4px' }}>
                    <i className="fas fa-exclamation-triangle" /> {stream.schemaError}
                  </div>
                )}

                {stream.isDragOver && (
                  <div className="stream-drop-overlay">
                    <div className="stream-drop-overlay-card">
                      <i className="fas fa-file-arrow-up" />
                      <span>Drop your <strong>schema.json</strong> to load it</span>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt"
                  style={{ display: 'none' }}
                  onChange={e => stream.handleFileUpload(e.target.files?.[0])}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button full-width-btn"
                  onClick={stream.handleSaveTemplate}
                  disabled={!stream.config.schemaInput.trim()}
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
                  value={stream.config.streamParadigm}
                  onChange={e => stream.updateConfig('streamParadigm', e.target.value)}
                >
                  {STREAM_PARADIGMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="m-form-group param-group">
                <label className="m-input-label">Output Format</label>
                <select
                  value={stream.config.eventFormat}
                  onChange={e => stream.updateConfig('eventFormat', e.target.value)}
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
                  Event Count <span className="m-quality-value-badge">{stream.config.eventCount}</span>
                </label>
                <input
                  type="range"
                  className="m-styled-slider"
                  min={5} max={200} step={5}
                  value={parseInt(stream.config.eventCount, 10) || 25}
                  onChange={e => stream.updateConfig('eventCount', e.target.value)}
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
                    value={stream.config.seed}
                    onChange={e => stream.updateConfig('seed', e.target.value)}
                  />
                </div>
              </div>

              <div className="m-form-group param-group">
                <label className="m-input-label">
                  Data Quality{' '}
                  <span className="m-quality-value-badge">{getQualityLabel(stream.config.dataQuality)}</span>
                </label>
                <input
                  type="range"
                  className="m-styled-slider"
                  min={60} max={100} step={10}
                  value={stream.config.dataQuality}
                  onChange={e => stream.updateConfig('dataQuality', Number(e.target.value))}
                />
                <div className="m-slider-hint">60 = heavy edge cases · 100 = clean data</div>
              </div>

              <div className="m-form-group">
                <label className="custom-check">
                  <input
                    type="checkbox"
                    checked={stream.config.includeStateMachine}
                    onChange={e => stream.updateConfig('includeStateMachine', e.target.checked)}
                  />
                  <div className="box"><i className="fa-solid fa-check"></i></div>
                  <span className="label-text">
                    <i className="fas fa-project-diagram" /> Generate State Machine
                  </span>
                </label>
                <label className="custom-check">
                  <input
                    type="checkbox"
                    checked={stream.config.includeAnalysis}
                    onChange={e => stream.updateConfig('includeAnalysis', e.target.checked)}
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
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      const newRule = stream.config.rules ? `${stream.config.rules}\n${e.target.value}` : e.target.value;
                      stream.updateConfig('rules', newRule);
                    }
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
                  value={stream.config.rules}
                  onChange={e => stream.updateConfig('rules', e.target.value)}
                />
                {stream.parsedRulesFeedback.length > 0 && (
                  <div className="m-rules-feedback">
                    <strong><i className="fas fa-robot" /> Rules Applied</strong>
                    <ul>
                      {stream.parsedRulesFeedback.map((r, i) => (
                        <li key={i}><i className="fas fa-check-circle" />{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {stream.ruleValidation.length > 0 && (
                <RuleValidationPanel results={stream.ruleValidation} />
              )}
            </div>
          </div>

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${stream.isLoading ? 'm-loading' : ''}`}
              onClick={stream.handleGenerate}
              disabled={stream.isLoading || !stream.config.schemaInput.trim()}
            >
              {stream.isLoading
                ? <><i className="fas fa-spinner fa-spin" /> Synthesizing…</>
                : <><i className="fas fa-bolt" /> Generate Stream</>}
            </button>

            <button className="secondary-button btn-danger" onClick={stream.clearWorkspace} title="Clear Workspace">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="m-preview-area">
          {stream.generatedData && !stream.isLoading && (
            <div className="m-toolbar">
              <div className="tab-list-scrollable">
                {stream.generatedData.streams.map((s, idx) => (
                  <button
                    key={idx}
                    className={`m-tab-btn ${stream.activeStream === idx ? 'm-active' : ''}`}
                    onClick={() => stream.setActiveStream(idx)}
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
                    className={`m-view-toggle-btn ${stream.viewMode === 'events' ? 'm-active' : ''}`}
                    onClick={() => stream.setViewMode('events')}
                  >
                    <i className="fas fa-table" /> Table
                    {activeFieldFilterCount > 0 && (
                      <span className="m-tab-count-badge filter-count-badge">{activeFieldFilterCount}</span>
                    )}
                  </button>
                  <button
                    className={`m-view-toggle-btn ${stream.viewMode === 'timeline' ? 'm-active' : ''}`}
                    onClick={() => stream.setViewMode('timeline')}
                  >
                    <i className="fas fa-align-left" /> Timeline
                  </button>
                  <button
                    className={`m-view-toggle-btn ${stream.viewMode === 'replay' ? 'm-active' : ''}`}
                    onClick={() => stream.setViewMode('replay')}
                  >
                    <i className="fas fa-play-circle" /> Replay
                  </button>
                  {hasMultipleStreams && (
                    <button
                      className={`m-view-toggle-btn ${stream.viewMode === 'correlated' ? 'm-active' : ''}`}
                      onClick={() => stream.setViewMode('correlated')}
                    >
                      <i className="fas fa-random" /> Correlated
                    </button>
                  )}
                  <button
                    className={`m-view-toggle-btn ${stream.viewMode === 'distribution' ? 'm-active' : ''}`}
                    onClick={() => stream.setViewMode('distribution')}
                  >
                    <i className="fas fa-chart-bar" /> Dist
                  </button>
                  <button
                    className={`m-view-toggle-btn ${stream.viewMode === 'raw' ? 'm-active' : ''}`}
                    onClick={() => stream.setViewMode('raw')}
                  >
                    <i className="fas fa-code" /> Raw
                  </button>
                </div>

                <select
                  disabled={!stream.generatedData}
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      stream.triggerExportModal(e.target.value);
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
            isLoading={stream.isLoading}
            condition={!stream.generatedData}
            icon="fas fa-stream"
            title="Awaiting Event Stream"
            description="Describe your event shape or state machine in the sidebar to generate time-series telemetry, access logs, customer journeys, and Kafka-ready event fixtures."
            hint={<>Use <code>@monotonic</code> to enforce strictly increasing timestamps.</>}
            loadingTitle="Synthesizing Event Stream"
            loadingDescription="Modeling state transitions and generating temporally coherent event sequences..."
          />

          <div className="stream-view-scroll-area">
            {stream.activeStreamData && !stream.isLoading && stream.viewMode === 'events' && (
              <div className="m-table-wrapper">
                <div className="m-table-filter-bar">
                  <div className="m-table-filter-input-wrap">
                    <i className="fas fa-search m-table-filter-icon" />
                    <input
                      type="text"
                      className="m-table-filter-input"
                      placeholder={`Search ${stream.activeStreamData.streamName}…`}
                      value={stream.filterQuery}
                      onChange={e => stream.setFilterQuery(e.target.value)}
                    />
                    {stream.filterQuery && (
                      <button
                        className="m-table-filter-clear"
                        onClick={() => stream.setFilterQuery('')}
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  {Object.entries(stream.colUniqueValues).slice(0, 3).map(([col, vals]) => (
                    <select
                      key={col}
                      value={stream.fieldFilters[col] || ''}
                      onChange={e => stream.setFieldFilters(prev => ({ ...prev, [col]: e.target.value }))}
                    >
                      <option value="">{col}: all</option>
                      {vals.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ))}

                  {activeFieldFilterCount > 0 && (
                    <button
                      className="m-icon-text-btn"
                      onClick={() => stream.setFieldFilters({})}
                    >
                      <i className="fas fa-filter-circle-xmark" /> Clear filters
                    </button>
                  )}

                  {(stream.filterQuery || activeFieldFilterCount > 0) && (
                    <span className="m-table-filter-count">
                      {stream.filteredEvents.length} match{stream.filteredEvents.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <div className="m-table-controls-right">
                    {stream.editHistory.length > 0 && (
                      <button 
                        className="m-icon-text-btn" 
                        onClick={stream.handleUndoEdit} 
                        title="Undo last edit"
                        style={{ marginRight: '0.5rem', color: 'var(--accent)' }}
                      >
                        <i className="fas fa-undo" /> Undo
                      </button>
                    )}
                    <span className="m-table-meta-tag">
                      <i className="fas fa-info-circle" /> Triple-click cell to copy
                    </span>
                  </div>
                </div>

                <div className="m-table-scroll-container">
                  <table className="m-data-table">
                    <thead>
                      <tr>
                        {stream.colKeys.map(key => {
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
                                    stream.setDistColumn(prev => prev === key ? null : key);
                                    stream.setViewMode('distribution');
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
                      {stream.paginatedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={stream.colKeys.length} className="m-table-no-results">
                            <i className="fas fa-search-minus m-empty-search-icon" />
                            <p>No events match &ldquo;{stream.filterQuery}&rdquo;</p>
                          </td>
                        </tr>
                      ) : (
                        stream.paginatedEvents.map((evt, rowIdx) => (
                          <tr key={rowIdx}>
                            {stream.colKeys.map((colKey, colIdx) => {
                              const isEditing =
                                stream.editingCell?.rowIdx === rowIdx &&
                                stream.editingCell?.colKey === colKey;
                              return (
                                <EditableCell
                                  key={colIdx}
                                  value={evt[colKey]}
                                  isEditing={isEditing}
                                  editingValue={stream.editingValue}
                                  onStartEdit={val => stream.handleStartEdit(rowIdx, colKey, val)}
                                  onChange={stream.setEditingValue}
                                  onCommit={stream.handleCommitEdit}
                                  onCancel={stream.handleCancelEdit}
                                  onCopy={stream.handleCopyCell}
                                />
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {stream.totalPages > 1 && (
                  <div className="m-pagination-controls">
                    <button
                      className="m-page-btn"
                      onClick={() => stream.setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={stream.currentPage === 1}
                    >
                      <i className="fas fa-chevron-left" /> Prev
                    </button>
                    <span className="m-page-indicator">
                      Page <strong>{stream.currentPage}</strong> of <strong>{stream.totalPages}</strong>
                    </span>
                    <button
                      className="m-page-btn"
                      onClick={() => stream.setCurrentPage(p => Math.min(stream.totalPages, p + 1))}
                      disabled={stream.currentPage === stream.totalPages}
                    >
                      Next <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {stream.activeStreamData && !stream.isLoading && stream.viewMode === 'timeline' && (
              <div className="stream-timeline-wrapper">
                <div className="stream-timeline-inner">
                  {stream.activeStreamData.events.map((evt, i) => {
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

            {stream.activeStreamData && !stream.isLoading && stream.viewMode === 'replay' && (
              <ReplayView
                events={stream.activeStreamData.events}
                replayIndex={stream.replayIndex}
                replayPlaying={stream.replayPlaying}
                replaySpeed={stream.replaySpeed}
                setReplaySpeed={stream.setReplaySpeed}
                onPlay={stream.handleReplayPlay}
                onPause={stream.handleReplayPause}
                onReset={stream.handleReplayReset}
                onStep={stream.handleReplayStep}
                liveEndpoint={stream.liveEndpoint}
                setLiveEndpoint={stream.setLiveEndpoint}
                isLivePushing={stream.isLivePushing}
                setIsLivePushing={stream.setIsLivePushing}
                continuousLoop={stream.continuousLoop}
                setContinuousLoop={stream.setContinuousLoop}
                pushMetrics={stream.pushMetrics}
                speedFactor={stream.speedFactor}
                setSpeedFactor={stream.setSpeedFactor}
                batchSize={stream.batchSize}
                setBatchSize={stream.setBatchSize}
                customHeaders={stream.customHeaders}
                headersMode={stream.headersMode}
                setHeadersMode={stream.setHeadersMode}
                headersJsonText={stream.headersJsonText}
                setHeadersJsonText={stream.setHeadersJsonText}
                headersError={stream.headersError}
                addHeaderRow={stream.addHeaderRow}
                updateHeaderRow={stream.updateHeaderRow}
                removeHeaderRow={stream.removeHeaderRow}
                isAlertTesting={stream.isAlertTesting}
                injectAlertBurst={stream.injectAlertBurst}
              />
            )}

            {stream.generatedData && !stream.isLoading && stream.viewMode === 'correlated' && stream.correlatedView && (
              <CorrelatedView correlatedView={stream.correlatedView} streams={stream.generatedData.streams} />
            )}

            {stream.generatedData && !stream.isLoading && stream.viewMode === 'correlated' && !stream.correlatedView && (
              <div className="empty-state correlated-empty-state">
                <i className="fas fa-random correlated-empty-icon" />
                <p className="correlated-empty-text">Generate multiple streams to see the correlation view.</p>
              </div>
            )}

            {stream.activeStreamData && !stream.isLoading && stream.viewMode === 'distribution' && (
              <div className="dist-view-wrapper">
                <div className="dist-col-picker">
                  <span className="dist-picker-label"><i className="fas fa-chart-bar" /> Choose a column to analyse:</span>
                  <div className="dist-col-chips">
                    {stream.colKeys.map(k => (
                      <button
                        key={k}
                        className={`dist-col-chip ${stream.distColumn === k ? 'm-active' : ''}`}
                        onClick={() => stream.setDistColumn(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                {stream.distColumn && stream.distData ? (
                  <DistributionChart
                    distData={stream.distData}
                    colKey={stream.distColumn}
                    onClose={() => stream.setDistColumn(null)}
                  />
                ) : (
                  <div className="dist-empty">
                    <i className="fas fa-hand-pointer" />
                    <p>Select a column above to see its distribution</p>
                  </div>
                )}
              </div>
            )}

            {stream.activeStreamData && !stream.isLoading && stream.viewMode === 'raw' && (
              <div className="stream-raw-wrapper">
                <div className="stream-raw-toolbar">
                  <span className="m-table-meta-tag">
                    <i className="fas fa-file-alt" /> Newline-delimited JSON ({stream.activeStreamData.events.length} events)
                  </span>
                  <div className="raw-actions">
                    <button
                      className="secondary-button"
                      onClick={() => navigator.clipboard.writeText(stream.rawJsonContent)}
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
                <pre className="stream-raw-pre">{stream.rawJsonContent}</pre>
              </div>
            )}
          </div>

          {!stream.isLoading && (stream.generatedData?.stateMachine || stream.generatedData?.explanation) && (
            <div className="stream-analysis-panels">
              {stream.generatedData.stateMachine && (
                <div className="m-explanation-panel">
                  <h3 className="m-explanation-title">
                    <i className="fas fa-project-diagram" /> State Machine
                  </h3>
                  <pre className="stream-state-machine">
                    {typeof stream.generatedData.stateMachine === 'string'
                      ? stream.generatedData.stateMachine
                      : JSON.stringify(stream.generatedData.stateMachine, null, 2)}
                  </pre>
                </div>
              )}

              {stream.generatedData.explanation && (
                <div className="m-explanation-panel">
                  <h3 className="m-explanation-title">
                    <i className="fas fa-robot" /> Generation Analysis
                  </h3>
                  <div
                    className="m-explanation-body"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(stream.generatedData.explanation)
                    }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        {...stream.modalConfig}
        onCancel={() => stream.setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {stream.isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => stream.setIsSaveModalOpen(false)}>
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
                value={stream.newTemplateName}
                onChange={e => { stream.setNewTemplateName(e.target.value); stream.setSaveTemplateError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && stream.executeSaveTemplate()}
              />
              {stream.saveTemplateError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-triangle" /> {stream.saveTemplateError}
                </div>
              )}
            </div>
            <div className="m-split-footer">
              <button className="secondary-button m-modal-btn" onClick={() => stream.setIsSaveModalOpen(false)}>
                Cancel
              </button>
              <button className="primary-button m-modal-btn" onClick={stream.executeSaveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
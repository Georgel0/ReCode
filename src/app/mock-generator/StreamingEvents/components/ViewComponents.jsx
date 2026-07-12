'use client';
import React, { useEffect, useRef, useMemo, useState } from "react";

export function CorrelatedView({ correlatedView, streams }) {
  const { combined, corrKey, tsKey } = correlatedView;
  const streamNames = streams.map(s => s.streamName);

  const groupBoundarySet = useMemo(() => {
    const set = new Set();
    let lastCorrVal = null;
    combined.forEach((evt, i) => {
      const corrVal = corrKey ? evt[corrKey] : null;
      if (corrKey && corrVal !== lastCorrVal) {
        set.add(i);
        lastCorrVal = corrVal;
      }
    });
    return set;
  }, [combined, corrKey]);

  return (
    <div className="correlated-wrapper">
      <div className="correlated-legend">
        {streamNames.map((name, i) => {
          return (
            <div key={name} className={`corr-legend-item stream-color-${i % 5}`}>
              <div className="corr-legend-dot" />
              <span className="corr-text-color">{name}</span>
            </div>
          );
        })}
        {corrKey && (
          <span className="corr-key-tag">
            <i className="fas fa-link" /> correlated by <code>{corrKey}</code>
          </span>
        )}
      </div>

      <div className="correlated-timeline">
        <div className="stream-timeline-inner">
          {combined.map((evt, i) => {
            const streamName = evt.__streamName;
            const streamIndex = streamNames.indexOf(streamName);
            const colorClass = `stream-color-${streamIndex % 5}`;
            const evtType = evt.event_type || evt.type || evt.name || evt.event_name || `event_${i + 1}`;
            const evtTs = tsKey ? evt[tsKey] : null;
            const isErr = String(evtType).toLowerCase().includes('error') || String(evtType).toLowerCase().includes('fail');
            const isNewGroup = groupBoundarySet.has(i);
            const corrVal = corrKey ? evt[corrKey] : null;

            return (
              <React.Fragment key={i}>
                {isNewGroup && corrVal && (
                  <div className="corr-group-divider">
                    <span className="corr-group-label">
                      <i className="fas fa-link" /> {corrKey}: {String(corrVal)}
                    </span>
                  </div>
                )}
                <div className={`timeline-event corr-timeline-event ${isErr ? 'timeline-event--error' : ''} ${colorClass}`}>
                  <div className="timeline-dot corr-dot" />
                  <div className="timeline-body corr-event-body">
                    <div className="timeline-header-row">
                      <span className="timeline-event-type corr-text-color">{evtType}</span>
                      <span className="corr-stream-chip">
                        {streamName}
                      </span>
                      {evtTs && <span className="timeline-ts">{evtTs}</span>}
                    </div>
                    <div className="timeline-payload">
                      {Object.entries(evt)
                        .filter(([k]) => !['event_type','type','name','timestamp','ts','event_time','created_at','__streamName','__streamIdx'].includes(k))
                        .slice(0, 5)
                        .map(([k, v]) => (
                          <span key={k} className="timeline-kv">
                            <span className="timeline-key">{k}</span>
                            <span className="timeline-val">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DistributionChart({ distData, colKey, onClose }) {
  if (!distData) return null;

  const maxCount = Math.max(...(distData.type === 'numeric'
    ? distData.bins.map(b => b.count)
    : distData.counts.map(c => c.count)), 1);

  const items = distData.type === 'numeric' ? distData.bins : distData.counts;

  return (
    <div className="dist-chart-panel">
      <div className="dist-chart-header">
        <span className="dist-chart-title">
          <i className="fas fa-chart-bar" /> Distribution: <code>{colKey}</code>
          {distData.type === 'numeric' && (
            <span className="dist-meta">
              min={distData.min?.toFixed(2)} · max={distData.max?.toFixed(2)} · mean={distData.mean?.toFixed(2)}
            </span>
          )}
        </span>
        <button className="m-icon-text-btn" onClick={onClose} title="Close">
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="dist-chart-bars">
        {items.map((item, i) => {
          const pct = Math.round((item.count / maxCount) * 100);
          const freqPct = ((item.count / distData.total) * 100).toFixed(1);
          return (
            <div key={i} className="dist-bar-row" title={`${item.label}: ${item.count} events (${freqPct}%)`}>
              <div className="dist-bar-label" title={item.label}>{item.label}</div>
              <div className="dist-bar-track">
                <div className="dist-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="dist-bar-count">{item.count}<span className="dist-bar-pct"> ({freqPct}%)</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RuleValidationPanel({ results }) {
  if (!results || results.length === 0) return null;

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;

  return (
    <div className="rule-validation-panel">
      <div className="rule-val-header">
        <span className="rule-val-title">
          <i className="fas fa-clipboard-check" /> Rule Validation
        </span>
        <div className="rule-val-summary">
          {passCount > 0 && <span className="rule-badge rule-badge--pass"><i className="fas fa-check" /> {passCount}</span>}
          {warnCount > 0 && <span className="rule-badge rule-badge--warn"><i className="fas fa-exclamation-triangle" /> {warnCount}</span>}
          {failCount > 0 && <span className="rule-badge rule-badge--fail"><i className="fas fa-times" /> {failCount}</span>}
        </div>
      </div>
      <div className="rule-val-list">
        {results.map((r, i) => (
          <div key={i} className={`rule-val-item rule-val-item--${r.status}`}>
            <i className={`fas ${r.status === 'pass' ? 'fa-check-circle' : r.status === 'fail' ? 'fa-times-circle' : 'fa-exclamation-circle'} rule-val-icon`} />
            <div>
              <div className="rule-val-name">{r.rule}</div>
              <div className="rule-val-msg">{r.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReplayView({
  events, replayIndex, replayPlaying, replaySpeed, setReplaySpeed,
  onPlay, onPause, onReset, onStep,
  liveEndpoint, setLiveEndpoint,
  isLivePushing, setIsLivePushing,
  continuousLoop, setContinuousLoop,
  pushMetrics,
  speedFactor, setSpeedFactor,
  batchSize, setBatchSize,
  customHeaders, headersMode, setHeadersMode,
  headersJsonText, setHeadersJsonText, headersError,
  addHeaderRow, updateHeaderRow, removeHeaderRow,
  isAlertTesting, injectAlertBurst,
}) {
  const endRef = useRef(null);
  const [headersOpen, setHeadersOpen] = useState(false);
  const activeHeaderCount = headersMode === 'grid'
    ? customHeaders.filter(h => h.key?.trim()).length
    : (headersJsonText.trim() && headersJsonText.trim() !== '{}' ? 1 : 0);
  const visibleEvents = events.slice(0, replayIndex + 1);
  const current = events[replayIndex];
  const ts = current
    ? current.timestamp || current.ts || current.event_time || current.created_at
    : null;
  const type = current
    ? current.event_type || current.type || current.name || current.event_name || `event_${replayIndex + 1}`
    : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [replayIndex]);

  const progressPct = events.length > 1 ? Math.round((replayIndex / (events.length - 1)) * 100) : 100;

  return (
    <div className="replay-wrapper">
      <div className="replay-controls-bar">
        <div className="replay-transport">
          <button className="replay-btn" onClick={onReset} title="Reset">
            <i className="fas fa-step-backward" />
          </button>
          {replayPlaying ? (
            <button className="replay-btn replay-btn--primary" onClick={onPause} title="Pause">
              <i className="fas fa-pause" />
            </button>
          ) : (
            <button className="replay-btn replay-btn--primary" onClick={onPlay} title="Play">
              <i className="fas fa-play" />
            </button>
          )}
          <button className="replay-btn" onClick={onStep} title="Step forward" disabled={replayIndex >= events.length - 1}>
            <i className="fas fa-step-forward" />
          </button>
        </div>

        <div className="replay-progress-wrap">
          <div className="replay-progress-track">
            <div className="replay-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="replay-counter">
            {replayIndex + 1} <span className="replay-counter-sep">/</span> {events.length}
          </span>
        </div>

        {ts && (
          <div className="replay-ts-display">
            <i className="fas fa-clock" />
            <span className="replay-ts-val">{ts}</span>
          </div>
        )}

        <div className="replay-speed-wrap">
          <div className="speed-factor-toggle" title="Scales the real gap between event timestamps (e.g. a 30s gap becomes 3s at ×10)">
            <span className="replay-speed-label">Speed</span>
            {[1, 5, 10].map(f => (
              <button
                key={f}
                type="button"
                className={`speed-factor-btn ${speedFactor === f ? 'm-active' : ''}`}
                onClick={() => setSpeedFactor(f)}
              >
                ×{f}
              </button>
            ))}
          </div>
          <select
            value={replaySpeed}
            onChange={e => setReplaySpeed(Number(e.target.value))}
            title="Fallback pacing used when events have no parseable timestamp field"
          >
            <option value={50}>Fallback: 50ms</option>
            <option value={100}>Fallback: 100ms</option>
            <option value={250}>Fallback: 250ms</option>
            <option value={500}>Fallback: 500ms</option>
            <option value={1000}>Fallback: 1s</option>
            <option value={2000}>Fallback: 2s</option>
          </select>
        </div>

        <div className="replay-batch-wrap">
          <span className="replay-speed-label">Batch</span>
          <select
            value={batchSize}
            onChange={e => setBatchSize(Number(e.target.value))}
            title="Advance and dispatch this many events per replay tick"
          >
            <option value={1}>Single event</option>
            <option value={5}>5 events</option>
            <option value={10}>10 events</option>
            <option value={50}>50 events</option>
          </select>
        </div>
      </div>

      <div className="live-push-bar" style={{ display: 'flex', gap: '0.75rem', padding: '0.57rem 0.75rem', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="toggle-row" onClick={() => setContinuousLoop(!continuousLoop)}>
          <input type="checkbox" checked={continuousLoop} readOnly />
          <span className="toggle-label">Infinite Loop</span>
        </div>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-satellite-dish" style={{ color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="m-text-input" 
            style={{ flex: 1, fontSize: '0.6rem' }} 
            placeholder="Webhook URL (e.g., http://localhost:8080/events)"
            value={liveEndpoint}
            onChange={e => setLiveEndpoint(e.target.value)}
            disabled={replayPlaying && isLivePushing}
          />
        </div>

        <button
          type="button"
          className={`secondary-button headers-toggle-btn ${headersOpen ? 'm-active' : ''}`}
          style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem' }}
          onClick={() => setHeadersOpen(!headersOpen)}
          title="Configure auth / custom headers for outgoing pushes"
        >
          <i className="fas fa-key" /> Headers
          {activeHeaderCount > 1 && <span className="m-badge-count">{activeHeaderCount - 1}</span>}
        </button>

        <button
          type="button"
          className="secondary-button alert-test-btn"
          style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem' }}
          onClick={() => injectAlertBurst(10)}
          disabled={!liveEndpoint || isAlertTesting}
          title="Fire a burst of synthetic error/spike events at the endpoint to verify downstream alerting (Datadog, PagerDuty, Slack, etc.)"
        >
          {isAlertTesting
            ? <><i className="fas fa-spinner fa-spin" /> Firing…</>
            : <><i className="fas fa-triangle-exclamation" /> Inject Alert Test</>}
        </button>

        <button 
          className={`primary-button ${isLivePushing ? 'btn-danger' : ''}`}
          style={{ padding: '0.2rem 0.6rem', fontSize: '0.6rem' }}
          onClick={() => {
            const willPush = !isLivePushing;
            setIsLivePushing(willPush);
            if (willPush && !replayPlaying) onPlay(); 
            if (!willPush && replayPlaying) onPause();
          }}
        >
          {isLivePushing ? <><i className="fas fa-stop" /> Stop Push</> : <><i className="fas fa-broadcast-tower" /> Arm & Fire</>}
        </button>

        <div className="metrics-display" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
          <span style={{ color: 'var(--accent)' }}>Sent: {pushMetrics?.sent || 0}</span>
          <span
            style={{ color: pushMetrics?.errors > 0 ? 'var(--danger)' : 'inherit', cursor: pushMetrics?.lastError ? 'help' : 'default' }}
            title={pushMetrics?.lastError || ''}
          >
            Errors: {pushMetrics?.errors || 0}
          </span>
        </div>
      </div>

      {headersOpen && (
        <div className="headers-config-panel">
          <div className="headers-config-header">
            <div className="headers-mode-toggle">
              <button
                type="button"
                className={`headers-mode-btn ${headersMode === 'grid' ? 'm-active' : ''}`}
                onClick={() => setHeadersMode('grid')}
              >
                <i className="fas fa-table-list" /> Key/Value
              </button>
              <button
                type="button"
                className={`headers-mode-btn ${headersMode === 'json' ? 'm-active' : ''}`}
                onClick={() => setHeadersMode('json')}
              >
                <i className="fas fa-code" /> JSON
              </button>
            </div>
            <span className="headers-config-hint">
              Sent with every push — e.g. <code>Authorization</code>, <code>X-API-Key</code>
            </span>
          </div>

          {headersMode === 'grid' ? (
            <div className="headers-grid">
              {customHeaders.map((h, i) => (
                <div key={i} className="headers-grid-row">
                  <input
                    type="text"
                    className="m-text-input"
                    placeholder="Header name (e.g. Authorization)"
                    value={h.key}
                    onChange={e => updateHeaderRow(i, 'key', e.target.value)}
                  />
                  <input
                    type="text"
                    className="m-text-input"
                    placeholder="Value (e.g. Bearer sk-...)"
                    value={h.value}
                    onChange={e => updateHeaderRow(i, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    className="m-icon-text-btn"
                    onClick={() => removeHeaderRow(i)}
                    title="Remove header"
                  >
                    <i className="fas fa-trash-alt" />
                  </button>
                </div>
              ))}
              <button type="button" className="secondary-button headers-add-btn" onClick={addHeaderRow}>
                <i className="fas fa-plus" /> Add Header
              </button>
            </div>
          ) : (
            <div className="headers-json-editor">
              <textarea
                className="m-rule-input headers-json-textarea"
                placeholder='{\n  "Authorization": "Bearer sk-...",\n  "X-API-Key": "..."\n}'
                value={headersJsonText}
                onChange={e => setHeadersJsonText(e.target.value)}
                spellCheck={false}
              />
              {headersError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-triangle" /> {headersError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pushMetrics?.tripped && (
        <div
          className="live-push-error-banner"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--danger)', fontSize: '0.65rem', borderBottom: '1px solid var(--border)' }}
        >
          <i className="fas fa-triangle-exclamation" />
          <span>{pushMetrics.lastError}</span>
        </div>
      )}

      {type && (
        <div className="replay-current-event">
          <span className="replay-event-label">Now playing:</span>
          <span className="replay-event-type">{type}</span>
          {current && Object.entries(current)
            .filter(([k]) => !['event_type','type','name','timestamp','ts','event_time','created_at'].includes(k))
            .slice(0, 5)
            .map(([k, v]) => (
              <span key={k} className="timeline-kv">
                <span className="timeline-key">{k}</span>
                <span className="timeline-val">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</span>
              </span>
            ))}
        </div>
      )}

      <div className="replay-stream-area">
        <div className="stream-timeline-inner">
          
          {visibleEvents.map((evt, i) => {
            const evtType = evt.event_type || evt.type || evt.name || evt.event_name || `event_${i + 1}`;
            const evtTs = evt.timestamp || evt.ts || evt.event_time || evt.created_at;
            const isErr = String(evtType).toLowerCase().includes('error') || String(evtType).toLowerCase().includes('fail');
            const isCurrent = i === replayIndex;

            return (
              <div
                key={i}
                className={`timeline-event ${isErr ? 'timeline-event--error' : ''} ${isCurrent ? 'timeline-event--current' : ''}`}
              >
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-header-row">
                    <span className="timeline-event-type">{evtType}</span>
                    {evtTs && <span className="timeline-ts">{evtTs}</span>}
                  </div>
                  <div className="timeline-payload">
                    {Object.entries(evt)
                      .filter(([k]) => !['event_type','type','name','timestamp','ts','event_time','created_at'].includes(k))
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <span key={k} className="timeline-kv">
                          <span className="timeline-key">{k}</span>
                          <span className="timeline-val">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
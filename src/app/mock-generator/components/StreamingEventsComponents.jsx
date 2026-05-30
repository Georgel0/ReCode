'use client';

import React, { useEffect, useRef, useMemo } from "react";

const STREAM_COLORS = [
  { bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.45)', text: '#38bdf8' },
  { bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.45)', text: '#a855f7' },
  { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.45)', text: '#22c55e' },
  { bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.45)', text: '#f97316' },
  { bg: 'rgba(236,72,153,0.10)', border: 'rgba(236,72,153,0.45)', text: '#ec4899' },
];

export function CorrelatedView({ correlatedView, streams }) {
  const { combined, corrKey, tsKey } = correlatedView;
  const streamNames = streams.map(s => s.streamName);

  const streamColorMap = useMemo(() => {
    const map = {};
    streamNames.forEach((name, i) => { map[name] = STREAM_COLORS[i % STREAM_COLORS.length]; });
    return map;
  }, [streamNames]);

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
          const c = STREAM_COLORS[i % STREAM_COLORS.length];
          return (
            <div key={name} className="corr-legend-item">
              <div className="corr-legend-dot" style={{ background: c.text }} />
              <span style={{ color: c.text, fontWeight: 600 }}>{name}</span>
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
            const color = streamColorMap[streamName] || STREAM_COLORS[0];
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
                <div className={`timeline-event corr-timeline-event ${isErr ? 'timeline-event--error' : ''}`}>
                  <div
                    className="timeline-dot corr-dot"
                    style={{ background: color.text, boxShadow: `0 0 0 2px ${color.text}` }}
                  />
                  <div
                    className="timeline-body corr-event-body"
                    style={{ borderColor: color.border, background: color.bg }}
                  >
                    <div className="timeline-header-row">
                      <span className="timeline-event-type" style={{ color: color.text }}>{evtType}</span>
                      <span className="corr-stream-chip" style={{ color: color.text, borderColor: color.border, background: color.bg }}>
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

export function inferEventBadges(colName, sampleValue) {
  const badges = [];
  const lower = colName.toLowerCase();
  const strVal = sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : '';

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(strVal)) badges.push('UUID');

  const tsKeys = ['timestamp', 'ts', 'time', 'created_at', 'occurred_at', 'event_time', 'datetime'];
  if (tsKeys.some(k => lower.includes(k))) badges.push('TIMESTAMP');
  else if (!badges.includes('UUID') && /^\d{4}-\d{2}-\d{2}T/.test(strVal)) badges.push('TIMESTAMP');

  if (lower === 'event_type' || lower === 'type' || lower === 'name' || lower === 'event_name') badges.push('EVENT');
  if (lower.includes('session') || lower.includes('trace') || lower.includes('correlation')) badges.push('CORR');
  if (strVal === 'true' || strVal === 'false') badges.push('BOOL');
  if (!badges.length && /^-?\d+$/.test(strVal) && strVal.length < 12) badges.push('INT');
  if (!badges.length && /^-?\d+\.\d+$/.test(strVal)) badges.push('FLOAT');

  return badges;
}

export function EventColBadge({ label }) {
  let cls = 'col-type-badge';
  if (label === 'UUID') cls += ' col-type-badge--uuid';
  if (label === 'TIMESTAMP') cls += ' col-type-badge--ts';
  if (label === 'EVENT') cls += ' col-type-badge--pk';
  if (label === 'CORR') cls += ' col-type-badge--fk';
  if (label === 'BOOL') cls += ' col-type-badge--bool';
  if (label === 'INT' || label === 'FLOAT') cls += ' col-type-badge--num';
  return <span className={cls}>{label}</span>;
}

export function EditableCell({ value, isEditing, editingValue, onStartEdit, onChange, onCommit, onCancel, onCopy }) {
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayVal = typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value ?? '');

  if (isEditing) {
    return (
      <td className="editable-cell editing-cell">
        <input
          ref={inputRef}
          className="cell-edit-input"
          value={editingValue}
          onChange={e => onChange(e.target.value)}
          onBlur={() => {
            // Only commit on blur if Escape was NOT the trigger
            if (!cancelledRef.current) onCommit();
            cancelledRef.current = false;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') {
              cancelledRef.current = true; // suppress the upcoming onBlur commit
              onCancel();
            }
          }}
        />
      </td>
    );
  }

  return (
    <td
      className="editable-cell"
      title="Double-click to edit · Triple-click to copy"
      onDoubleClick={() => onStartEdit(displayVal)}
      onClick={e => { if (e.detail === 3) onCopy(value); }}
    >
      <div className="cell-content-wrapper">
        <span className="cell-value">{displayVal}</span>
        <i className="fas fa-pencil-alt cell-edit-icon" />
      </div>
    </td>
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
        <button className="icon-text-btn" onClick={onClose} title="Close">
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
  events,
  replayIndex,
  replayPlaying,
  replaySpeed,
  setReplaySpeed,
  onPlay,
  onPause,
  onReset,
  onStep,
}) {
  const endRef = useRef(null);
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

  const speedLabel = replaySpeed <= 100 ? 'Fast' : replaySpeed <= 500 ? 'Normal' : 'Slow';
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
          <span className="replay-speed-label">{speedLabel}</span>
          <select
            className="theme-select-dropdown action-select"
            value={replaySpeed}
            onChange={e => setReplaySpeed(Number(e.target.value))}
          >
            <option value={50}>50ms (×20)</option>
            <option value={100}>100ms (×10)</option>
            <option value={250}>250ms (×4)</option>
            <option value={500}>500ms (×2)</option>
            <option value={1000}>1s (×1)</option>
            <option value={2000}>2s (slow)</option>
          </select>
        </div>
      </div>

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
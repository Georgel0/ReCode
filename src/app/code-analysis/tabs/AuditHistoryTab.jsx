"use client";

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

const STORAGE_KEY = 'codeaudit_history_v1';

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveAuditToHistory(entry) {
  // entry: { id, timestamp, fileName, language, score, summary, issueCount, code }
  try {
    const history = loadHistory();
    // Keep max 60 entries
    const updated = [entry, ...history].slice(0, 60);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch { return []; }
}

export function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function scoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function scoreBadgeClass(score) {
  if (score >= 80) return 'ah-score--good';
  if (score >= 60) return 'ah-score--warn';
  return 'ah-score--bad';
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="ah-chart-tip">
      <div className="ah-chart-tip-label">{label}</div>
      <div className="ah-chart-tip-row">
        <span className="ah-chart-tip-dot" style={{ background: scoreColor(p.value) }} />
        <span>Score</span>
        <strong style={{ color: scoreColor(p.value) }}>{p.value}</strong>
      </div>
      {p.payload?.fileName && (
        <div className="ah-chart-tip-file">{p.payload.fileName}</div>
      )}
    </div>
  );
}

export function AuditHistoryTab({ history, onClear, onLoad }) {
  const [selectedFile, setSelectedFile] = useState('__all__');
  const [expandedId, setExpandedId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Group by fileName for file filter
  const fileNames = useMemo(() => {
    const names = [...new Set(history.map(e => e.fileName || 'Unnamed'))];
    return names;
  }, [history]);

  const filtered = useMemo(() => {
    if (selectedFile === '__all__') return history;
    return history.filter(e => (e.fileName || 'Unnamed') === selectedFile);
  }, [history, selectedFile]);

  // Chart data — chronological (oldest first)
  const chartData = useMemo(() => {
    return [...filtered]
      .reverse()
      .map(e => ({
        date: new Date(e.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: e.score,
        fileName: e.fileName || 'Unnamed',
        id: e.id,
      }));
  }, [filtered]);

  // Delta vs previous entry for the same file
  const getDelta = (entry, idx) => {
    const later = filtered.slice(0, idx).find(e => e.fileName === entry.fileName);
    if (!later) return null;
    return entry.score - later.score;
  };

  if (history.length === 0) {
    return (
      <div className="ah-empty">
        <i className="fa-solid fa-clock-rotate-left" />
        <h3>No Audit History Yet</h3>
        <p>Run your first audit to start tracking score progress over time.</p>
      </div>
    );
  }

  return (
    <div className="ah-container">
      <div className="ah-toolbar">
        <div className="ah-file-filter">
          <i className="fa-solid fa-filter" />
          <select value={selectedFile} onChange={e => setSelectedFile(e.target.value)}>
            <option value="__all__">All Files ({history.length})</option>
            {fileNames.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
        </div>

        <div className="ah-toolbar-right">
          <span className="ah-entry-count">{filtered.length} audit{filtered.length !== 1 ? 's' : ''}</span>
          {confirmClear ? (
            <div className="ah-confirm-clear">
              <span>Clear all history?</span>
              <button className="ah-confirm-yes" onClick={() => { onClear(); setConfirmClear(false); }}>Yes, clear</button>
              <button className="ah-confirm-no" onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button className="ah-clear-btn" onClick={() => setConfirmClear(true)} title="Clear history">
              <i className="fa-solid fa-trash" /> Clear
            </button>
          )}
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="ah-chart-section">
          <div className="ah-section-label">
            <i className="fa-solid fa-chart-line" />
            Score Timeline
          </div>
          <div className="ah-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  dy={6}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  dx={-6}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.4} />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.4} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        key={payload.id}
                        cx={cx} cy={cy} r={5}
                        fill={scoreColor(payload.score)}
                        stroke="var(--bg-primary)"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 7, fill: 'var(--accent)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="ah-chart-legend">
            <span className="ah-legend-good"><span />≥80 Good</span>
            <span className="ah-legend-warn"><span />≥60 Warning</span>
            <span className="ah-legend-bad"><span />&lt;60 Critical</span>
          </div>
        </div>
      )}

      <div className="ah-section-label">
        <i className="fa-solid fa-list-ul" />
        Audit Log
      </div>
      <div className="ah-list">
        {filtered.map((entry, idx) => {
          const delta = getDelta(entry, idx);
          const isExpanded = expandedId === entry.id;

          return (
            <div key={entry.id} className={`ah-entry ${isExpanded ? 'ah-entry--open' : ''}`}>
              <div className="ah-entry-header" onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                <div className="ah-entry-left">
                  <div className={`ah-score-badge ${scoreBadgeClass(entry.score)}`}>
                    {entry.score}
                  </div>
                  <div className="ah-entry-meta">
                    <span className="ah-entry-file">
                      <i className="fa-solid fa-file-code" />
                      {entry.fileName || 'Unnamed'}
                    </span>
                    <span className="ah-entry-time">{formatDate(entry.timestamp)}</span>
                  </div>
                </div>

                <div className="ah-entry-right">
                  {delta !== null && (
                    <span className={`ah-delta ${delta > 0 ? 'ah-delta--up' : delta < 0 ? 'ah-delta--down' : 'ah-delta--flat'}`}>
                      <i className={`fa-solid ${delta > 0 ? 'fa-arrow-trend-up' : delta < 0 ? 'fa-arrow-trend-down' : 'fa-minus'}`} />
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                  {entry.issueCount != null && (
                    <span className="ah-entry-issues">
                      <i className="fa-solid fa-triangle-exclamation" />
                      {entry.issueCount} issue{entry.issueCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="ah-lang-chip">{entry.language || 'code'}</span>
                  <div className="ah-entry-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className="ah-load-btn"
                      onClick={() => onLoad(entry)}
                      title="Restore this audit"
                    >
                      <i className="fa-solid fa-rotate-left" /> Restore
                    </button>
                  </div>
                  <i className={`fa-solid fa-chevron-down ah-chevron ${isExpanded ? 'rotated' : ''}`} />
                </div>
              </div>

              {isExpanded && (
                <div className="ah-entry-body">
                  {entry.summary && (
                    <p className="ah-entry-summary">{entry.summary}</p>
                  )}
                  {entry.code && (
                    <div className="ah-entry-code-preview">
                      <div className="ah-code-preview-header">
                        <i className="fa-solid fa-code" /> Source snapshot
                        <span className="ah-code-lines">{entry.code.split('\n').length} lines</span>
                      </div>
                      <pre className="ah-code-block">{entry.code.slice(0, 600)}{entry.code.length > 600 ? '\n…' : ''}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
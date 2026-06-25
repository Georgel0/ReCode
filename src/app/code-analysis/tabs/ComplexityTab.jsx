"use client";

import { useMemo, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

const GHOST_LINES = [
  { key: 'o1', label: 'O(1)', color: '#22c55e', dash: '4 3' },
  { key: 'ologn', label: 'O(log n)', color: '#3b82f6', dash: '4 3' },
  { key: 'on', label: 'O(n)', color: '#a855f7', dash: '4 3' },
  { key: 'onlogn', label: 'O(n log n)', color: '#f59e0b', dash: '4 3' },
  { key: 'on2', label: 'O(n²)', color: '#ef4444', dash: '4 3' },
];

const computeGhost = (n) => ({
  o1: 1,
  ologn: Math.log2(n + 1),
  on: n,
  onlogn: n * Math.log2(n + 1),
  on2: n * n,
});

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const actual = payload.find(p => p.dataKey === 'operations');
  const ghosts = payload.filter(p => p.dataKey !== 'operations');

  return (
    <div className="a-chart-tooltip">
      <div className="a-chart-tooltip-label">{label}</div>
      {actual && (
        <div className="a-chart-tooltip-row a-chart-tooltip-actual">
          <span className="a-chart-tooltip-dot" style={{ background: 'var(--accent)' }} />
          <span>Your code</span>
          <strong>{actual.value} ops</strong>
        </div>
      )}
      {ghosts.map(g => (
        <div key={g.dataKey} className="a-chart-tooltip-row">
          <span className="a-chart-tooltip-dot" style={{ background: g.stroke }} />
          <span>{GHOST_LINES.find(l => l.key === g.dataKey)?.label}</span>
          <strong>{g.value} ops</strong>
        </div>
      ))}
    </div>
  );
};

const ChartLegend = ({ hoveredGhost, onHover, timeComplexity }) => (
  <div className="a-chart-legend">
    <span className="a-chart-legend-item a-chart-legend-actual">
      <span className="a-chart-legend-line" style={{ background: 'var(--accent)' }} />
      Your code {timeComplexity ? `(${timeComplexity})` : ''}
    </span>
    {GHOST_LINES.map(g => (
      <button
        key={g.key}
        className={`a-chart-legend-item a-chart-legend-ghost ${hoveredGhost === g.key ? 'a-chart-legend-ghost--active' : ''}`}
        onMouseEnter={() => onHover(g.key)}
        onMouseLeave={() => onHover(null)}
        style={{ '--ghost-color': g.color }}
      >
        <span className="a-chart-legend-line a-chart-legend-line--dashed" style={{ background: g.color }} />
        {g.label}
      </button>
    ))}
  </div>
);

export function ComplexityTab({ complexity }) {
  const [hoveredGhost, setHoveredGhost] = useState(null);

  const parseTimeStr = useCallback((time) => {
    return time.toLowerCase().replace(/[\s\(\)]/g, '').replace(/^o/, '');
  }, []);

  const chartData = useMemo(() => {
    if (!complexity?.time) return [];
    const timeStr = parseTimeStr(complexity.time);

    return Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      let ops = n;

      if (timeStr === '1') ops = 1;
      else if (timeStr === 'logn') ops = Math.log2(n + 1);
      else if (timeStr === 'n') ops = n;
      else if (timeStr === 'nlogn') ops = n * Math.log2(n + 1);
      else if (timeStr.includes('n^2') || timeStr.includes('n²')) ops = n * n;
      else if (timeStr.includes('n^3') || timeStr.includes('n³')) ops = n * n * n;
      else if (timeStr.includes('2^n')) ops = Math.pow(2, n);
      else if (timeStr.includes('n!')) {
        let fact = 1;
        for (let k = 2; k <= n; k++) fact *= k;
        ops = fact;
      }

      const ghost = computeGhost(n);
      return {
        inputElements: `n=${n}`,
        operations: Number(ops.toFixed(2)),
        ...Object.fromEntries(Object.entries(ghost).map(([k, v]) => [k, Number(v.toFixed(2))]))
      };
    });
  }, [complexity, parseTimeStr]);

  const getMetricClass = (value, type) => {
    if (value == null) return 'a-score-neutral';
    if (type === 'low-is-better') {
      if (value <= 10) return 'a-score-good';
      if (value <= 20) return 'a-score-warn';
      return 'a-score-bad';
    } else {
      if (value >= 80) return 'a-score-good';
      if (value >= 60) return 'a-score-warn';
      return 'a-score-bad';
    }
  };

  const ghostOpacity = (key) => {
    if (!hoveredGhost) return 0.18;
    return hoveredGhost === key ? 1 : 0.06;
  };

  const ghostWidth = (key) => (hoveredGhost === key ? 2.5 : 1.5);

  return (
    <div className="a-complexity-breakdown">
      <div className="a-complexity-breakdown-sub">
        <div className="a-complexity-grid">
          <div className="a-complexity-card">
            <div className="a-complexity-icon"><i className="fa-solid fa-clock" /></div>
            <div className="a-complexity-info"><h4>Time</h4><p>{complexity.time}</p></div>
          </div>
          <div className="a-complexity-card">
            <div className="a-complexity-icon"><i className="fa-solid fa-memory" /></div>
            <div className="a-complexity-info"><h4>Space</h4><p>{complexity.space}</p></div>
          </div>
        </div>

        <ul className="a-complexity-explanation-list">
          {(complexity?.explanation || []).map((item, i) => <li key={i}>{item}</li>)}
        </ul>

        {complexity?.bottleneck && (
          <div className="a-insight-box">
            <i className="fas fa-filter" />
            <div className="a-insight-content">
              <h4>Primary Bottleneck</h4>
              <p>{complexity.bottleneck}</p>
            </div>
          </div>
        )}

        {complexity?.tradeoffs && (
          <div className="a-insight-box">
            <i className="fa-solid fa-scale-balanced" />
            <div className="a-insight-content">
              <h4>Space-Time Tradeoffs</h4>
              <p>{complexity.tradeoffs}</p>
            </div>
          </div>
        )}
      </div>

      <div className="a-complexity-chart-wrapper">
        <ChartLegend 
          hoveredGhost={hoveredGhost} 
          onHover={setHoveredGhost} 
          timeComplexity={complexity?.time} 
        />
        <div className="a-complexity-chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />

              <XAxis
                dataKey="inputElements"
                axisLine tickLine={false}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                dy={12}
                label={{ value: 'Input Size (Elements)', position: 'insideBottom', offset: -18, fill: 'var(--text-secondary)', fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine tickLine={false}
                domain={[0, dataMax => Math.max(dataMax, 4)]}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                dx={-8}
                label={{ value: 'Operations', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 }}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />

              {GHOST_LINES.map(g => (
                <Line
                  key={g.key}
                  type="monotone"
                  dataKey={g.key}
                  name={g.label}
                  stroke={g.color}
                  strokeWidth={ghostWidth(g.key)}
                  strokeDasharray={g.dash}
                  strokeOpacity={ghostOpacity(g.key)}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  isAnimationActive={false}
                  style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
                />
              ))}

              <Line
                type="monotone"
                dataKey="operations"
                name="Your code"
                stroke="var(--accent)"
                strokeWidth={3.5}
                dot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent)', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: 'var(--accent)', stroke: 'var(--bg-primary)', strokeWidth: 3 }}
                animationDuration={1400}
                animationEasing="ease-out"
                legendType="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {complexity?.metrics && (
        <div className="a-metrics-container">
          <div className="a-metric-card">
            <div className="a-metric-header">
              <span className="a-metric-title">Cyclomatic</span>
              <span className={`a-metric-score ${getMetricClass(complexity.metrics.cyclomatic, 'low-is-better')}`}>
                {complexity.metrics.cyclomatic}
              </span>
            </div>
            <p className="a-metric-desc">Counts independent paths. Lower is easier to test.</p>
          </div>
          <div className="a-metric-card">
            <div className="a-metric-header">
              <span className="a-metric-title">Cognitive</span>
              <span className={`a-metric-score ${getMetricClass(complexity.metrics.cognitive, 'low-is-better')}`}>
                {complexity.metrics.cognitive}
              </span>
            </div>
            <p className="a-metric-desc">How difficult the control flow is for humans.</p>
          </div>
          <div className="a-metric-card">
            <div className="a-metric-header">
              <span className="a-metric-title">Maintainability</span>
              <span className={`a-metric-score ${getMetricClass(complexity.metrics.maintainability, 'high-is-better')}`}>
                {complexity.metrics.maintainability}
              </span>
            </div>
            <p className="a-metric-desc">Overall index (0-100). Higher is easier to modify.</p>
          </div>
        </div>
      )}
    </div>
  );
}
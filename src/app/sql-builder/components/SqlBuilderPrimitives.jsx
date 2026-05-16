'use client';

import { DIALECTS } from "./sqlForgeConstants";

export function DialectSelect({ value, onChange, className = 'combobox-input' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {DIALECTS.map((d) => (
        <option key={d.value} value={d.value}>{d.label}</option>
      ))}
    </select>
  );
}

export function ResultStatsBar({ totalRows, executionTime, isSimulated, formatExecTime }) {
  return (
    <div className="result-stats-bar">
      <span className="result-stat">
        <i className="fa-solid fa-table-list"></i>
        {totalRows} {totalRows === 1 ? 'row' : 'rows'} returned
      </span>
      {executionTime !== null && (
        <span className="result-stat">
          <i className="fa-solid fa-stopwatch"></i>
          {formatExecTime(executionTime)}
        </span>
      )}
      {isSimulated && (
        <span className="result-stat simulated-tag">
          <i className="fa-solid fa-robot"></i> AI Simulated
        </span>
      )}
    </div>
  );
}

export function ResultTable({ result, index, total }) {
  if (result.message) {
    return (
      <p className="empty-message">
        <i className="fa-solid fa-circle-check"></i> {result.message}
      </p>
    );
  }

  return (
    <div className="result-set-block">
      {total > 1 && <div className="result-set-label">Result Set {index + 1}</div>}
      <div className="table-responsive">
        <table className="sandbox-table">
          <thead>
            <tr>
              {result.columns.map((c, i) => <th key={i}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.values.length === 0 ? (
              <tr>
                <td colSpan={result.columns.length} className="empty-message">
                  No rows returned
                </td>
              </tr>
            ) : (
              result.values.map((row, ri) => (
                <tr key={ri}>
                  {row.map((val, ci) => (
                    <td key={ci}>
                      {val === null ? <em className="null-value">NULL</em> : String(val)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
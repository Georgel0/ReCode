'use client';

import { useEffect, useRef } from "react";
import { getMethodMeta } from "../hooks/useApiMocksTab";

export function MethodBadge({ method }) {
  const { cls, label } = getMethodMeta(method);
  return <span className={`method-badge ${cls}`}>{label}</span>;
}

export function StatusBadge({ code }) {
  const n = Number(code);
  let cls = 'status-badge';
  if (n >= 200 && n < 300) cls += ' status-badge--ok';
  else if (n >= 400 && n < 500) cls += ' status-badge--client';
  else if (n >= 500) cls += ' status-badge--server';
  return <span className={cls}>{code}</span>;
}

// Read-only syntax-highlighted code block.
export function CodeDisplay({ code, language = 'typescript' }) {
  const preRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Prism && preRef.current) {
      window.Prism.highlightElement(preRef.current);
    }
  }, [code]);

  return (
    <div className="api-code-display">
      <pre
        ref={preRef}
        className={`language-${language} prism-dark`}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

// Fixture JSON preview panel
export function FixtureDisplay({ handler }) {
  if (!handler?.fixtureData) {
    return (
      <div className="fixture-empty">
        <i className="fas fa-inbox" />
        <p>No fixture data available for this handler.</p>
      </div>
    );
  }

  return (
    <div className="api-code-display">
      <div className="fixture-meta-row">
        <MethodBadge method={handler.method} />
        <span className="fixture-path">{handler.path}</span>
        <StatusBadge code={handler.statusCode ?? 200} />
        {handler.delayMs > 0 && (
          <span className="fixture-delay-tag">
            <i className="fas fa-clock" /> {handler.delayMs}ms
          </span>
        )}
      </div>
      <pre className="prism-dark fixture-json">
        <code className="language-json">
          {JSON.stringify(handler.fixtureData, null, 2)}
        </code>
      </pre>
    </div>
  );
}

// Summary pill strip shown when data is available.
export function MethodSummaryPills({ methodCounts }) {
  return (
    <div className="method-summary-pills">
      {Object.entries(methodCounts).map(([method, count]) => {
        const { cls } = getMethodMeta(method);
        return (
          <span key={method} className={`method-pill ${cls}`}>
            {method} <strong>{count}</strong>
          </span>
        );
      })}
    </div>
  );
}

export function HistoryDropdown({ history, onRestore, onClose }) {
  return (
    <>
      <div className="dropdown-backdrop" onClick={onClose} />
      <div className="tabs-dropdown-menu history-dropdown">
        <div className="history-dropdown-header">
          <i className="fas fa-history" /> Generation History
        </div>
        {history.length === 0 ? (
          <div className="history-empty">No history yet</div>
        ) : history.map((entry, i) => (
          <button
            key={i}
            className="dropdown-item"
            onClick={() => onRestore(entry)}
          >
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--accent)', fontSize: '0.7rem' }} />
            <div className="history-item-content">
              <span className="history-item-label">{entry.label}</span>
              <span className="history-item-meta">{entry.data?.handlers?.length ?? 0} handlers</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

export function ErrorVariantPanel({ handler, activeVariant, onSelectVariant }) {
  const variants = handler?.errorVariants;
  if (!variants?.length) return null;

  return (
    <div className="error-variant-bar">
      <span className="error-variant-label">
        <i className="fas fa-triangle-exclamation" /> Error Variants:
      </span>
      <button
        className={`error-variant-btn ${activeVariant == null ? 'active' : ''}`}
        onClick={() => onSelectVariant(null)}
      >
        <StatusBadge code={handler.statusCode ?? 200} />
        <span>Success</span>
      </button>
      {variants.map((v, i) => (
        <button
          key={i}
          className={`error-variant-btn ${activeVariant === i ? 'active' : ''}`}
          onClick={() => onSelectVariant(i)}
        >
          <StatusBadge code={v.statusCode} />
          <span>{v.statusCode >= 500 ? 'Server Error' : v.statusCode >= 400 ? 'Client Error' : `${v.statusCode}`}</span>
        </button>
      ))}
    </div>
  );
}

export function FixtureShapeWarning({ handler }) {
  // Lightweight heuristic: check if the handler code mentions array/list patterns
  // but the fixtureData is a single object (not an array), and vice versa.
  if (!handler?.code || !handler?.fixtureData) return null;

  const code = handler.code;
  const fixture = handler.fixtureData;

  const codeImpliesList =
    /\[\s*\w/i.test(code) || /Array\b/.test(code) || /\blist\b/i.test(code) ||
    /\[\]/.test(code) || /\.map\(/.test(code);
  const fixtureIsArray = Array.isArray(fixture);
  const fixtureIsObject = fixture && typeof fixture === 'object' && !fixtureIsArray;

  // Warn if code implies array but fixture is single object
  if (codeImpliesList && fixtureIsObject && !fixture.data && !fixture.items) {
    return (
      <span className="fixture-shape-warning" title="Fixture shape may not match handler types: code implies a list but fixture is a single object">
        <i className="fas fa-triangle-exclamation" /> Shape Mismatch
      </span>
    );
  }

  return null;
}
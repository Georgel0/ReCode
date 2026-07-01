'use client';

import { useEffect, useRef } from "react";
import { getMethodMeta } from "../ApiMocks/useApiMocksTab";

export function MethodBadge({ method }) {
  const { cls, label } = getMethodMeta(method);
  return <span className={`ma-method-badge ${cls}`}>{label}</span>;
}

export function StatusBadge({ code }) {
  const n = Number(code);
  let cls = 'ma-status-badge';
  if (n >= 200 && n < 300) cls += ' ma-status-badge--ok';
  else if (n >= 400 && n < 500) cls += ' ma-status-badge--client';
  else if (n >= 500) cls += ' ma-status-badge--server';
  return <span className={cls}>{code}</span>;
}

export function CodeDisplay({ code, language = 'typescript' }) {
  const preRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Prism && preRef.current) {
      window.Prism.highlightElement(preRef.current);
    }
  }, [code, language]);

  return (
    <div className="ma-api-code-display">
      <pre
        ref={preRef}
        className={`language-${language} prism-dark`}
      >
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

export function FixtureDisplay({ handler }) {
  if (!handler?.fixtureData) {
    return (
      <div className="ma-fixture-empty">
        <i className="fas fa-inbox" />
        <p>No fixture data available for this handler.</p>
      </div>
    );
  }

  return (
    <div className="ma-api-code-display">
      <div className="ma-fixture-meta-row">
        <MethodBadge method={handler.method} />
        <span className="ma-fixture-path">{handler.path}</span>
        <StatusBadge code={handler.statusCode ?? 200} />
        {handler.delayMs > 0 && (
          <span className="ma-fixture-delay-tag">
            <i className="fas fa-clock" /> {handler.delayMs}ms
          </span>
        )}
      </div>
      <pre className="prism-dark ma-fixture-json">
        <code className="language-json">
          {JSON.stringify(handler.fixtureData, null, 2)}
        </code>
      </pre>
    </div>
  );
}

export function MethodSummaryPills({ methodCounts }) {
  return (
    <div className="ma-method-summary-pills">
      {Object.entries(methodCounts).map(([method, count]) => {
        const { cls } = getMethodMeta(method);
        return (
          <span key={method} className={`ma-method-pill ${cls}`}>
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
      <div className="ma-dropdown-backdrop" onClick={onClose} />
      <div className="ma-tabs-dropdown-menu ma-history-dropdown">
        <div className="ma-history-dropdown-header">
          <i className="fas fa-history" /> Generation History
        </div>
        {history.length === 0 ? (
          <div className="ma-history-empty">No history yet</div>
        ) : history.map((entry, i) => (
          <button
            key={i}
            className="ma-dropdown-item"
            onClick={() => onRestore(entry)}
          >
            <i className="fas fa-clock-rotate-left" style={{ color: 'var(--accent)', fontSize: '0.7rem' }} />
            <div className="ma-history-item-content">
              <span className="ma-history-item-label">{entry.label}</span>
              <span className="ma-history-item-meta">{entry.data?.handlers?.length ?? 0} handlers</span>
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
    <select
      style={{ width: 'auto', minWidth: '140px' }}
      value={activeVariant == null ? "null" : activeVariant.toString()}
      onChange={(e) => {
        const val = e.target.value;
        onSelectVariant(val === "null" ? null : parseInt(val, 10));
      }}
    >
      <option value="null">Success ({handler.statusCode ?? 200})</option>
      {variants.map((v, i) => (
        <option key={i} value={i.toString()}>
          {v.statusCode >= 500 ? 'Server Error' : v.statusCode >= 400 ? 'Client Error' : 'Variant'} ({v.statusCode})
        </option>
      ))}
    </select>
  );
}

export function FixtureShapeWarning({ handler }) {
  if (!handler?.code || !handler?.fixtureData) return null;

  const code = handler.code;
  const fixture = handler.fixtureData;

  const codeImpliesList =
    /\[\s*\w/i.test(code) || /Array\b/.test(code) || /\blist\b/i.test(code) ||
    /\[\]/.test(code) || /\.map\(/.test(code);
  const fixtureIsArray = Array.isArray(fixture);
  const fixtureIsObject = fixture && typeof fixture === 'object' && !fixtureIsArray;

  const ENVELOPE_KEYS = ['data', 'items', 'results', 'records', 'payload', 'list', 'rows', 'users', 'posts', 'entries'];
  const hasEnvelope = ENVELOPE_KEYS.some(k => Array.isArray(fixture[k]));
  
  if (codeImpliesList && fixtureIsObject && !hasEnvelope) {
    return (
      <span className="ma-fixture-shape-warning" title="Fixture shape may not match handler types: code implies a list but fixture is a single object">
        <i className="fas fa-triangle-exclamation" /> Shape Mismatch
      </span>
    );
  }

  return null;
}
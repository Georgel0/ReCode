"use client";

import { useState, useEffect, useCallback } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';

// Very lightweight diff — splits by lines, marks removed (-) vs added (+) lines
function computeDiff(before, after) {
  const bLines = before.split('\n');
  const aLines = after.split('\n');
  const result = [];

  let bi = 0, ai = 0;

  while (bi < bLines.length || ai < aLines.length) {
    const bLine = bLines[bi];
    const aLine = aLines[ai];

    if (bi >= bLines.length) {
      result.push({ type: 'add', text: aLine });
      ai++;
    } else if (ai >= aLines.length) {
      result.push({ type: 'remove', text: bLine });
      bi++;
    } else if (bLine === aLine) {
      result.push({ type: 'context', text: bLine });
      bi++;
      ai++;
    } else {
      let matched = false;
      for (let look = 1; look <= 3; look++) {
        if (bi + look < bLines.length && bLines[bi + look] === aLine) {
          for (let k = 0; k < look; k++) {
            result.push({ type: 'remove', text: bLines[bi + k] });
          }
          bi += look;
          matched = true;
          break;
        }
        if (ai + look < aLines.length && aLines[ai + look] === bLine) {
          for (let k = 0; k < look; k++) {
            result.push({ type: 'add', text: aLines[ai + k] });
          }
          ai += look;
          matched = true;
          break;
        }
      }
      if (!matched) {
        result.push({ type: 'remove', text: bLine });
        result.push({ type: 'add', text: aLine });
        bi++;
        ai++;
      }
    }
  }
  return result;
}

function DiffLine({ line }) {
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' ';
  return (
    <div className={`fdm-diff-line fdm-diff-${line.type}`}>
      <span className="fdm-diff-gutter">{prefix}</span>
      <code className="fdm-diff-code">{line.text || ' '}</code>
    </div>
  );
}

function DiffView({ before, after }) {
  const [view, setView] = useState('unified');
  const diff = computeDiff(before, after);

  return (
    <div className="fdm-diff-wrapper">
      <div className="fdm-diff-toolbar">
        <span className="fdm-diff-label">
          <i className="fa-solid fa-code-compare" /> Diff
        </span>
        <div className="fdm-view-toggle">
          <button
            className={`fdm-view-btn ${view === 'unified' ? 'active' : ''}`}
            onClick={() => setView('unified')}
          >Unified</button>
          <button
            className={`fdm-view-btn ${view === 'split' ? 'active' : ''}`}
            onClick={() => setView('split')}
          >Split</button>
        </div>
      </div>

      {view === 'unified' ? (
        <div className="fdm-diff-block">
          {diff.map((line, i) => <DiffLine key={i} line={line} />)}
        </div>
      ) : (
        <div className="fdm-split-view">
          <div className="fdm-split-pane">
            <div className="fdm-split-header fdm-split-before">
              <i className="fa-solid fa-minus" /> Before
            </div>
            <div className="fdm-diff-block">
              {before.split('\n').map((text, i) => (
                <div key={i} className="fdm-diff-line fdm-diff-remove">
                  <span className="fdm-diff-gutter">−</span>
                  <code className="fdm-diff-code">{text || ' '}</code>
                </div>
              ))}
            </div>
          </div>
          <div className="fdm-split-pane">
            <div className="fdm-split-header fdm-split-after">
              <i className="fa-solid fa-plus" /> After
            </div>
            <div className="fdm-diff-block">
              {after.split('\n').map((text, i) => (
                <div key={i} className="fdm-diff-line fdm-diff-add">
                  <span className="fdm-diff-gutter">+</span>
                  <code className="fdm-diff-code">{text || ' '}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FixDiffModal({ issue, sourceCode, language, onClose }) {
  const { qualityMode } = useApp();
  const [status, setStatus] = useState('idle');
  const [fixData, setFixData] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await convertCode('fix-diff', sourceCode, {
        qualityMode,
        language,
        severity: issue.severity || 'N/A',
        location: issue.location || 'N/A',
        issue: issue.issue,
        resolution: issue.resolution,
      });
      if (result) {
        setFixData(result);
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('FixDiff error:', err);
      setStatus('error');
    }
  }, [issue, sourceCode, language, qualityMode]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleCopyAfter = () => {
    if (!fixData?.after) return;
    navigator.clipboard.writeText(fixData.after).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fdm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fdm-modal" role="dialog" aria-modal="true">
        <div className="fdm-modal-header">
          <div className="fdm-modal-title">
            <div className="fdm-title-icon">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div>
              <h2>AI-Generated Fix</h2>
              <p className="fdm-subtitle">
                {issue.location && <span className="fdm-location-chip"><i className="fa-regular fa-file-code" /> {issue.location}</span>}
                {issue.severity && <span className={`fdm-sev-chip fdm-sev-${issue.severity.toLowerCase()}`}>{issue.severity}</span>}
              </p>
            </div>
          </div>
          <div className="fdm-header-actions">
            {status === 'done' && (
              <button className="fdm-copy-btn" onClick={handleCopyAfter} title="Copy fixed code">
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? 'Copied!' : 'Copy Fix'}
              </button>
            )}
            {status === 'error' && (
              <button className="fdm-retry-btn" onClick={generate}>
                <i className="fa-solid fa-rotate-right" /> Retry
              </button>
            )}
            <button className="fdm-close-btn" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        <div className="fdm-issue-summary">
          <div className="fdm-issue-row">
            <strong>Issue</strong>
            <p>{issue.issue}</p>
          </div>
          <div className="fdm-issue-row fdm-resolution-row">
            <strong><i className="fa-solid fa-wrench" /> Resolution</strong>
            <p>{issue.resolution}</p>
          </div>
        </div>

        <div className="fdm-modal-body">
          {status === 'loading' && (
            <div className="fdm-loading-state">
              <div className="fdm-loading-ring">
                <i className="fa-solid fa-circle-notch fa-spin" />
              </div>
              <p>Generating targeted fix…</p>
              <span>Analyzing context and applying the resolution</span>
            </div>
          )}

          {status === 'error' && (
            <div className="fdm-error-state">
              <i className="fa-solid fa-triangle-exclamation" />
              <p>Couldn't generate fix</p>
              <span>Check your connection and try again.</span>
            </div>
          )}

          {status === 'done' && fixData && (
            <div className="fdm-result">
              {fixData.explanation && (
                <div className="fdm-explanation">
                  <i className="fa-solid fa-circle-info" />
                  <p>{fixData.explanation}</p>
                </div>
              )}
              <DiffView before={fixData.before} after={fixData.after} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
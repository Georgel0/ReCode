"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { DiffView } from '@/components/widgets';

// `convertCode` can resolve in two shapes depending on the backend path:
//   1. { before, after, explanation }             — already flat
//   2. { convertedCode: "```json\n{ ... }\n```" } — fenced JSON string
// This normalizes both into a flat { before, after, explanation } object (or null).
function extractFixPayload(raw) {
  if (!raw) return null;

  if (typeof raw.before === 'string' && typeof raw.after === 'string') {
    return raw;
  }

  if (typeof raw.convertedCode === 'string') {
    let text = raw.convertedCode.trim();
    const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenceMatch) {
      text = fenceMatch[1];
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('[FixDiff] failed to JSON.parse convertedCode payload', { err, text });
      return null;
    }
  }

  return null;
}

export function FixDiffModal({ issue, sourceCode, language, cachedFix, onFixCached, onClose }) {
  const { qualityMode } = useApp();
  
  // If a cached result is passed in, start in the 'done' state immediately.
  const [status, setStatus] = useState(cachedFix ? 'done' : 'idle');
  const [fixData, setFixData] = useState(cachedFix ?? null);
  const [copied, setCopied] = useState(false);

  // Tracks the "current" request so a slow/older response can never clobber
  // a newer one (e.g. user mashes Retry, or props change mid-request).
  const requestIdRef = useRef(0);
  const copyTimeoutRef = useRef(null);

  const generate = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');

    const params = {
      qualityMode,
      language,
      severity: issue.severity || 'N/A',
      location: issue.location || 'N/A',
      issue: issue.issue,
      resolution: issue.resolution,
    };
    console.log('[FixDiff] generate() called', { requestId, sourceCodeLength: sourceCode?.length, params });

    try {
      const result = await convertCode('fix-diff', sourceCode, params);

      if (requestIdRef.current !== requestId) {
        return; // superseded by a newer request
      }

      const payload = extractFixPayload(result);
      console.log('[FixDiff] extracted payload', {
        requestId,
        payload,
        keys: payload ? Object.keys(payload) : null,
        beforeType: typeof payload?.before,
        afterType: typeof payload?.after,
      });

      if (payload && typeof payload.before === 'string' && typeof payload.after === 'string') {
        setFixData(payload);
        setStatus('done');
        // Persist to parent cache so re-opening skips the API call.
        onFixCached?.(payload);
      } else {
        setStatus('error');
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setStatus('error');
    }
    // Depend on primitive fields, not the `issue` object reference — if the
    // parent re-creates `issue` on every render (e.g. via .map()/.filter()),
    // depending on the object itself would re-trigger generate() endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCode, language, qualityMode, issue.severity, issue.location, issue.issue, issue.resolution]);

  useEffect(() => {
    // Skip the API call entirely if we already have a cached result.
    if (cachedFix) return;
    generate();
  }, [generate, cachedFix]);

  const handleCopyAfter = () => {
    if (!fixData?.after) return;
    navigator.clipboard.writeText(fixData.after).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      console.error('Copy to clipboard failed:', err);
    });
  };

  // Clear any pending "Copied!" timeout on unmount.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fdm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fdm-modal" role="dialog" aria-modal="true" aria-labelledby="fdm-modal-heading">
        <div className="fdm-modal-header">
          <div className="fdm-modal-title">
            <div className="fdm-title-icon">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div>
              <h2 id="fdm-modal-heading">AI-Generated Fix</h2>
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
              
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <DiffView 
                  sourceContent={fixData.before} 
                  targetContent={fixData.after} 
                  sourceLang={language} 
                  targetLang={language} 
                  leftLabel="Original Code"
                  rightLabel="AI Resolution"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState, useRef } from "react";

export function ConversionNotesPanel({ notes, activeTabId, open, onToggle }) {
  const activeNotes = notes[activeTabId] || notes['__global__'];
  if (!activeNotes) return null;

  return (
    <div className={`c-notes ${open ? 'is-open' : ''}`}>
      <button className="c-notes__toggle" onClick={onToggle}>
        <i className="fa-solid fa-chevron-right c-collapse-icon"></i>
        <i className="fa-solid fa-lightbulb"></i>
        Conversion Notes
        {!open && <span className="c-notes__count">{(activeNotes.match(/\n/g) || []).length + 1}</span>}
      </button>

      <div className="c-collapse-wrapper">
        <div className="c-collapse-inner">
          <div className="c-notes__body">
            <div className="c-notes__content">
              {activeNotes.split('\n').map((line, i) => (
                <span key={`note-${i}-${line.slice(0, 20)}`}>{line}<br /></span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel({ history, activeTabId, open, onToggle, onRestore }) {
  const entries = history[activeTabId] || [];
  if (entries.length === 0) return null;

  return (
    <div className={`c-history ${open ? 'is-open' : ''}`}>
      <button className="c-history__toggle" onClick={onToggle}>
        <i className="fa-solid fa-chevron-right c-collapse-icon"></i>
        <i className="fa-solid fa-clock-rotate-left"></i>
        Conversion History
        {!open && <span className="c-history__count">{entries.length}</span>}
      </button>

      <div className="c-collapse-wrapper">
        <div className="c-collapse-inner">
          <div className="c-history__entries">
            {entries.map((entry, idx) => (
              <div key={entry.timestamp} className="c-history__entry">
                <div className="c-history__meta">
                  <span className="c-history__badge">{entry.targetLang}</span>
                  {entry.targetFramework && entry.targetFramework !== 'none' && (
                    <span className="c-history__badge c-history__badge--sec">{entry.targetFramework}</span>
                  )}
                  {idx === 0 && <span className="c-history__current">current</span>}
                  <span className="c-history__time">
                    <i className="fa-regular fa-clock"></i>{' '}
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="c-history__preview">
                  <pre>{(entry.outputFile?.content || '').split('\n').slice(0, 3).join('\n')}</pre>
                </div>
                {idx !== 0 && (
                  <button className="secondary-button c-history__restore" onClick={() => onRestore(activeTabId, idx)}>
                    <i className="fa-solid fa-rotate-left"></i> Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LineSelector({ content, selectedRange, onRangeChange }) {
  const lines = (content || '').split('\n');
  const selectStartRef = useRef(null);
  const selectingRef = useRef(false);

  const handleLineMouseDown = (idx) => {
    selectingRef.current = true;
    selectStartRef.current = idx;
    onRangeChange({ start: idx, end: idx });
  };
  const handleLineMouseEnter = (idx) => {
    if (!selectingRef.current || selectStartRef.current === null) return;
    onRangeChange({ start: Math.min(selectStartRef.current, idx), end: Math.max(selectStartRef.current, idx) });
  };
  const handleMouseUp = () => { selectingRef.current = false; };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="c-line-selector">
      {lines.map((line, i) => {
        const inRange = selectedRange && i >= selectedRange.start && i <= selectedRange.end;
        return (
          <div
            key={`line-${i}`}
            className={`c-line-selector__row${inRange ? ' c-line-selector__row--selected' : ''}`}
            onMouseDown={() => handleLineMouseDown(i)}
            onMouseEnter={() => handleLineMouseEnter(i)}
          >
            <span className="c-line-selector__num">{i + 1}</span>
            <span className="c-line-selector__text">{line || '\u00A0'}</span>
          </div>
        );
      })}
    </div>
  );
}
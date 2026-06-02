'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { diffLines } from 'diff';

export function buildDiffRows(sourceText, targetText) {
  const changes = diffLines(sourceText || '', targetText || '');

  const srcRows = [];
  const tgtRows = [];
  let added = 0, removed = 0, unchanged = 0;

  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines.length === 0) continue;
    if (lines[lines.length - 1] === '') lines.pop();

    if (change.added) {
      added += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'phantom' });
        tgtRows.push({ type: 'add', text: line });
      });
    } else if (change.removed) {
      removed += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'remove', text: line });
        tgtRows.push({ type: 'phantom' });
      });
    } else {
      unchanged += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'same', text: line });
        tgtRows.push({ type: 'same', text: line });
      });
    }
  }

  return { srcRows, tgtRows, stats: { added, removed, unchanged } };
}

export function DiffView({ sourceContent, targetContent, targetLang }) {
  const { srcRows, tgtRows, stats } = buildDiffRows(sourceContent, targetContent);
  const [diffSyncScroll, setDiffSyncScroll] = useState(true);
  const srcScrollRef = useRef(null);
  const tgtScrollRef = useRef(null);
  const isSyncingRef = useRef(false);

  const handleColScroll = (e, otherRef) => {
    if (!diffSyncScroll || isSyncingRef.current) return;
    isSyncingRef.current = true;
    const { scrollTop, scrollLeft } = e.target;
    if (otherRef.current) {
      otherRef.current.scrollTop = scrollTop;
      otherRef.current.scrollLeft = scrollLeft;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  };

  const delta = Math.round(
    ((stats.added + stats.removed) / Math.max(stats.added + stats.removed + stats.unchanged, 1)) * 100
  );

  const renderRows = (rows) =>
    rows.map((row, i) => {
      if (row.type === 'phantom') {
        return (
          <div key={i} className="c-diff__line c-diff__line--phantom">
            <span className="c-diff__gutter" />
            <pre className="c-diff__text">&nbsp;</pre>
          </div>
        );
      }
      const cls = row.type === 'add'
        ? 'c-diff__line--add'
        : row.type === 'remove'
          ? 'c-diff__line--remove'
          : '';
      const glyph = row.type === 'add' ? '+' : row.type === 'remove' ? '−' : ' ';
      return (
        <div key={i} className={`c-diff__line${cls ? ` ${cls}` : ''}`}>
          <span className="c-diff__gutter">{glyph}</span>
          <pre className="c-diff__text">{row.text}</pre>
        </div>
      );
    });

  return (
    <div className="c-diff">
      <div className="c-diff__toolbar">
        <div className="c-diff__stats">
          <span className="c-diff__stat c-diff__stat--add"><i className="fa-solid fa-plus" /> {stats.added} added</span>
          <span className="c-diff__stat c-diff__stat--remove"><i className="fa-solid fa-minus" /> {stats.removed} removed</span>
          <span className="c-diff__stat c-diff__stat--unchanged"><i className="fa-solid fa-equals" /> {stats.unchanged} unchanged</span>
          <span className="c-diff__stat c-diff__stat--delta"><i className="fa-solid fa-code-branch" /> {delta}% delta</span>
        </div>
        <label className="custom-check c-sync-check">
          <input
            type="checkbox"
            checked={diffSyncScroll}
            onChange={e => setDiffSyncScroll(e.target.checked)}
          />
          <div className="box"><i className="fa-solid fa-check" /></div>
          <span className="label-text">Sync Scroll</span>
        </label>
      </div>

      <div className="c-diff__columns">
        <div className="c-diff__col">
          <div className="c-diff__col-header">
            <i className="fa-solid fa-file-code" /> Source
          </div>
          <div
            className="c-diff__lines"
            ref={srcScrollRef}
            onScroll={e => handleColScroll(e, tgtScrollRef)}
          >
            {renderRows(srcRows)}
          </div>
        </div>

        <div className="c-diff__col">
          <div className="c-diff__col-header">
            <i className="fa-solid fa-code-compare" /> Converted ({targetLang})
          </div>
          <div
            className="c-diff__lines"
            ref={tgtScrollRef}
            onScroll={e => handleColScroll(e, srcScrollRef)}
          >
            {renderRows(tgtRows)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversionNotesPanel({ notes, activeTabId, open, onToggle }) {
  const activeNotes = notes[activeTabId] || notes['__global__'];
  if (!activeNotes) return null;

  return (
    <div className="c-notes">
      <button className="c-notes__toggle" onClick={onToggle}>
        <i className={`fa-solid fa-chevron-${open ? 'down' : 'right'}`}></i>
        <i className="fa-solid fa-lightbulb"></i>
        Conversion Notes
        {!open && (
          <span className="c-notes__count">
            {(activeNotes.match(/\n/g) || []).length + 1} notes
          </span>
        )}
      </button>
      {open && (
        <div className="c-notes__body">
          <div
            className="c-notes__content"
            dangerouslySetInnerHTML={{ __html: activeNotes.replace(/\n/g, '<br/>') }}
          />
        </div>
      )}
    </div>
  );
}

export function HistoryPanel({ history, activeTabId, open, onToggle, onRestore }) {
  const entries = history[activeTabId] || [];
  if (entries.length === 0) return null;

  return (
    <div className="c-history">
      <button className="c-history__toggle" onClick={onToggle}>
        <i className={`fa-solid fa-chevron-${open ? 'down' : 'right'}`}></i>
        <i className="fa-solid fa-clock-rotate-left"></i>
        Conversion History
        {!open && <span className="c-history__count">{entries.length}</span>}
      </button>
      {open && (
        <div className="c-history__entries">
          {entries.map((entry, idx) => (
            <div key={idx} className="c-history__entry">
              <div className="c-history__meta">
                <span className="c-history__badge">{entry.targetLang}</span>
                {entry.targetFramework && entry.targetFramework !== 'none' && (
                  <span className="c-history__badge c-history__badge--sec">{entry.targetFramework}</span>
                )}
                <span className="c-history__time">
                  <i className="fa-regular fa-clock"></i>{' '}
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {idx === 0 && <span className="c-history__current">current</span>}
              </div>
              <div className="c-history__preview">
                <pre>{(entry.outputFile?.content || '').split('\n').slice(0, 3).join('\n')}</pre>
              </div>
              {idx !== 0 && (
                <button
                  className="secondary-button c-history__restore"
                  onClick={() => onRestore(activeTabId, idx)}
                >
                  <i className="fa-solid fa-rotate-left"></i> Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LineSelector({ content, selectedRange, onRangeChange }) {
  const lines = (content || '').split('\n');
  const [selecting, setSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState(null);

  const selectingRef = useRef(false);

  const handleLineMouseDown = (idx) => {
    selectingRef.current = true;
    setSelectStart(idx);
    onRangeChange({ start: idx, end: idx });
  };

  const handleLineMouseEnter = (idx) => {
    if (!selectingRef.current) return;
    if (!selecting) return;
    const start = Math.min(selectStart, idx);
    const end = Math.max(selectStart, idx);
    onRangeChange({ start, end });
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
            key={i}
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
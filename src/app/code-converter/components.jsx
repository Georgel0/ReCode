'use client';

import { useEffect, useState, useRef } from "react";
import { diffLines, diffChars } from 'diff';
import Prism from 'prismjs';

const PRISM_LANG_MAP = {
  javascript: 'javascript', typescript: 'typescript',
  jsx: 'jsx', tsx: 'tsx',
  python: 'python', java: 'java', csharp: 'csharp',
  cpp: 'cpp', c: 'c', go: 'go', rust: 'rust',
  ruby: 'ruby', php: 'php', swift: 'swift', kotlin: 'kotlin',
  scala: 'scala', html: 'html', css: 'css', scss: 'scss',
  json: 'json', yaml: 'yaml', bash: 'bash', shell: 'bash',
  sql: 'sql', graphql: 'graphql', markdown: 'markdown',
  plaintext: null,
};

// Highlight a single line of text; returns an HTML string
function highlightLine(text, lang) {
  const grammar = lang ? Prism.languages[PRISM_LANG_MAP[lang] || lang] : null;
  if (!grammar) return null; // fall back to plain text
  try {
    return Prism.highlight(text, grammar, PRISM_LANG_MAP[lang] || lang);
  } catch {
    return null;
  }
}

// Detect whether the current theme is light or dark for Prism class
function usePrismTheme() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const update = () => {
      const t = document.documentElement.getAttribute('data-theme') || '';
      const isLight = t === 'classic-light' || t === 'quartz' || t === 'mint';
      setTheme(isLight ? 'light' : 'dark');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function buildDiffRows(sourceText, targetText) {
  const changes = diffLines(sourceText || '', targetText || '');
  const srcRows = [], tgtRows = [];
  let added = 0, removed = 0, unchanged = 0;
  let srcLine = 1, tgtLine = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) continue;

    if (change.added) {
      added += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'phantom' });
        tgtRows.push({ type: 'add', text: line, lineNum: tgtLine++ });
      });
    } else if (change.removed) {
      removed += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'remove', text: line, lineNum: srcLine++ });
        tgtRows.push({ type: 'phantom' });
      });
    } else {
      unchanged += lines.length;
      lines.forEach(line => {
        srcRows.push({ type: 'same', text: line, lineNum: srcLine++ });
        tgtRows.push({ type: 'same', text: line, lineNum: tgtLine++ });
      });
    }
  }

  return { srcRows, tgtRows, stats: { added, removed, unchanged } };
}

// Highlighted line renderer
// For same/unchanged lines: just render highlighted HTML
// For add/remove: render highlighted HTML with char-diff marks overlaid.
// Strategy: highlight the full line, then wrap diffed char ranges in <mark>.
function HighlightedLine({ text, pairText, type, lang, prismTheme }) {
  const html = highlightLine(text, lang);

  // If no grammar or same line: just render highlighted (or plain) text
  if (!pairText || type === 'same' || type === 'phantom') {
    if (html !== null) {
      return (
        <code
          className={`language-${PRISM_LANG_MAP[lang] || lang}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return <span>{text}</span>;
  }

  // For changed lines: compute char-diff ranges, then inject <mark> tags
  // into the highlighted HTML at the correct text offsets.
  const charChanges = diffChars(
    type === 'remove' ? text : pairText,
    type === 'add' ? text : pairText
  );

  // Build an array of {start, end} ranges in the plain text that are changed
  const changedRanges = [];
  let offset = 0;
  for (const part of charChanges) {
    const isRelevant = type === 'remove' ? part.removed : part.added;
    if (isRelevant) {
      changedRanges.push({ start: offset, end: offset + part.value.length });
    }
    if (!part.added && !part.removed) offset += part.value.length;
    else if (type === 'remove' && part.removed) offset += part.value.length;
    else if (type === 'add' && part.added) offset += part.value.length;
  }

  if (changedRanges.length === 0) {
    if (html !== null) {
      return (
        <code
          className={`language-${PRISM_LANG_MAP[lang] || lang}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return <span>{text}</span>;
  }

  // Inject <mark> wrappers into the highlighted HTML by walking its
  // text nodes and inserting marks at char-diff boundaries.
  // We do this by building a shadow DOM via a temporary div.
  const markCls = type === 'remove' ? 'c-diff__inline--remove' : 'c-diff__inline--add';
  const injected = injectMarksIntoHTML(html !== null ? html : escapeHtml(text), changedRanges, markCls);

  return (
    <code
      className={html !== null ? `language-${PRISM_LANG_MAP[lang] || lang}` : undefined}
      dangerouslySetInnerHTML={{ __html: injected }}
    />
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Walk HTML string, tracking plain-text offset, and inject <mark> at diff ranges.
// Uses a simple state-machine parser (no DOM dependency) so it works in SSR too.
function injectMarksIntoHTML(html, ranges, markCls) {
  if (!ranges.length) return html;

  // Parse HTML into tokens: { type: 'tag'|'text', value }
  const tokens = [];
  const tagRe = /(<[^>]+>|&[a-z#0-9]+;)/gi;
  let last = 0, m;
  tagRe.lastIndex = 0;
  while ((m = tagRe.exec(html)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: html.slice(last, m.index) });
    const v = m[0];
    tokens.push({ type: v.startsWith('<') ? 'tag' : 'entity', value: v });
    last = m.index + v.length;
  }
  if (last < html.length) tokens.push({ type: 'text', value: html.slice(last) });

  // Walk tokens, tracking plain-text offset
  let plainOffset = 0;
  let rangeIdx = 0;
  let insideMark = false;
  const out = [];

  for (const tok of tokens) {
    if (tok.type === 'tag') {
      out.push(tok.value);
      continue;
    }
    // entity counts as 1 char
    if (tok.type === 'entity') {
      const charLen = 1;
      const tokEnd = plainOffset + charLen;
      const inRange = ranges.some(r => plainOffset >= r.start && plainOffset < r.end);
      if (inRange && !insideMark) { out.push(`<mark class="${markCls}">`); insideMark = true; }
      if (!inRange && insideMark) { out.push('</mark>'); insideMark = false; }
      out.push(tok.value);
      plainOffset = tokEnd;
      continue;
    }
    // text token — split at range boundaries
    let i = 0;
    while (i < tok.value.length) {
      const absPos = plainOffset + i;
      const inRange = rangeIdx < ranges.length && absPos >= ranges[rangeIdx].start && absPos < ranges[rangeIdx].end;

      // Advance rangeIdx if we've passed the current range
      if (rangeIdx < ranges.length && absPos >= ranges[rangeIdx].end) {
        rangeIdx++;
        if (insideMark) { out.push('</mark>'); insideMark = false; }
        continue;
      }

      if (inRange && !insideMark) { out.push(`<mark class="${markCls}">`); insideMark = true; }
      if (!inRange && insideMark) { out.push('</mark>'); insideMark = false; }

      // Find the next boundary
      let nextBoundary = tok.value.length;
      if (rangeIdx < ranges.length) {
        const r = ranges[rangeIdx];
        if (!inRange && r.start > absPos) nextBoundary = Math.min(nextBoundary, r.start - plainOffset);
        if (inRange) nextBoundary = Math.min(nextBoundary, r.end - plainOffset);
      }

      out.push(tok.value.slice(i, nextBoundary));
      i = nextBoundary;
    }
    if (insideMark && rangeIdx < ranges.length && plainOffset + tok.value.length >= ranges[rangeIdx].end) {
      out.push('</mark>'); insideMark = false; rangeIdx++;
    }
    plainOffset += tok.value.length;
  }
  if (insideMark) out.push('</mark>');

  return out.join('');
}

export function DiffView({ sourceContent, targetContent, targetLang, sourceLang }) {
  const { srcRows, tgtRows, stats } = buildDiffRows(sourceContent, targetContent);
  const [diffSyncScroll, setDiffSyncScroll] = useState(true);
  const srcScrollRef = useRef(null);
  const tgtScrollRef = useRef(null);
  const isSyncingRef = useRef(false);
  const prismTheme = usePrismTheme();

  // Build pair map for inline char-diff: adjacent remove/add lines
  const pairMap = useRef({});
  useEffect(() => {
    const map = {};
    let ri = 0, li = 0;
    while (ri < srcRows.length && li < tgtRows.length) {
      if (srcRows[ri].type === 'remove' && tgtRows[li].type === 'add') {
        map[`src-${ri}`] = tgtRows[li].text;
        map[`tgt-${li}`] = srcRows[ri].text;
        ri++; li++;
      } else { ri++; li++; }
    }
    pairMap.current = map;
  }, [srcRows, tgtRows]);

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

  const renderRows = (rows, side, lang) =>
    rows.map((row, i) => {
      const pairKey = `${side}-${i}`;
      const pairText = pairMap.current[pairKey];

      if (row.type === 'phantom') {
        return (
          <div key={i} className="c-diff__line c-diff__line--phantom">
            <span className="c-diff__gutter-strip" />
            <span className="c-diff__linenum" />
            <pre className="c-diff__text" />
          </div>
        );
      }

      const cls =
        row.type === 'add' ? ' c-diff__line--add'
          : row.type === 'remove' ? ' c-diff__line--remove'
            : '';

      const sign = row.type === 'add' ? '+' : row.type === 'remove' ? '−' : '';

      return (
        <div key={i} className={`c-diff__line${cls}`}>
          <span className="c-diff__gutter-strip" />
          <span className="c-diff__linenum">
            <span className="c-diff__linenum-num">{row.lineNum}</span>
            <span className="c-diff__linenum-sign">{sign}</span>
          </span>
          <pre className={`c-diff__text prism-${prismTheme}`}>
            <HighlightedLine
              text={row.text}
              pairText={pairText}
              type={row.type}
              lang={lang}
              prismTheme={prismTheme}
            />
          </pre>
        </div>
      );
    });

  return (
    <div className="c-diff">
      <div className="c-diff__toolbar">
        <div className="c-diff__stats">
          <span className="c-diff__stat c-diff__stat--add">+{stats.added}</span>
          <span className="c-diff__stat c-diff__stat--remove">−{stats.removed}</span>
          <span className="c-diff__stat c-diff__stat--unchanged">{stats.unchanged} unchanged</span>
          <span className="c-diff__stat c-diff__stat--delta">{delta}% delta</span>
        </div>
        <label className="custom-check c-sync-check">
          <input type="checkbox" checked={diffSyncScroll} onChange={e => setDiffSyncScroll(e.target.checked)} />
          <div className="box"><i className="fa-solid fa-check" /></div>
          <span className="label-text">Sync Scroll</span>
        </label>
      </div>

      <div className="c-diff__columns">
        <div className="c-diff__col">
          <div className="c-diff__col-header">
            <i className="fa-solid fa-circle c-diff__col-dot c-diff__col-dot--remove" />
            <span className="c-diff__col-filename">Source</span>
          </div>
          <div className="c-diff__lines" ref={srcScrollRef} onScroll={e => handleColScroll(e, tgtScrollRef)}>
            {renderRows(srcRows, 'src', sourceLang)}
          </div>
        </div>

        <div className="c-diff__col">
          <div className="c-diff__col-header">
            <i className="fa-solid fa-circle c-diff__col-dot c-diff__col-dot--add" />
            <span className="c-diff__col-filename">Converted ({targetLang})</span>
          </div>
          <div className="c-diff__lines" ref={tgtScrollRef} onScroll={e => handleColScroll(e, srcScrollRef)}>
            {renderRows(tgtRows, 'tgt', targetLang)}
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
            <div className="c-notes__content" dangerouslySetInnerHTML={{ __html: activeNotes.replace(/\n/g, '<br/>') }} />
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
              <div key={idx} className="c-history__entry">
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
  const [selecting, setSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState(null);
  const selectingRef = useRef(false);

  const handleLineMouseDown = (idx) => {
    selectingRef.current = true;
    setSelecting(true);
    setSelectStart(idx);
    onRangeChange({ start: idx, end: idx });
  };
  const handleLineMouseEnter = (idx) => {
    if (!selectingRef.current) return;
    onRangeChange({ start: Math.min(selectStart, idx), end: Math.max(selectStart, idx) });
  };
  const handleMouseUp = () => { selectingRef.current = false; setSelecting(false); };

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
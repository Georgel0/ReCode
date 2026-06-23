'use client';

import { useEffect, useState, useRef } from 'react';
import { diffLines, diffChars } from 'diff';
import Prism from 'prismjs';
import '@/styles/components/DiffViewer.css';

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

// Prism theme detection (watches data-theme attribute)
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

// Syntax highlight a single line → HTML string (or null for plaintext)
function highlightLine(text, lang) {
  const grammar = lang ? Prism.languages[PRISM_LANG_MAP[lang] || lang] : null;
  if (!grammar) return null;
  try {
    return Prism.highlight(text, grammar, PRISM_LANG_MAP[lang] || lang);
  } catch {
    return null;
  }
}

// HTML escape helper
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inject <mark> wrappers into an HTML string at plain-text char ranges.
// Uses a state-machine parser — no DOM, works in SSR.
function injectMarksIntoHTML(html, ranges, markCls) {
  if (!ranges.length) return html;

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

  let plainOffset = 0;
  let rangeIdx = 0;
  let insideMark = false;
  const out = [];

  for (const tok of tokens) {
    if (tok.type === 'tag') {
      out.push(tok.value);
      continue;
    }
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
    const tokLen = tok.value.length;
    while (i < tokLen) {
      const absPos = plainOffset + i;
      const inRange = rangeIdx < ranges.length && absPos >= ranges[rangeIdx].start && absPos < ranges[rangeIdx].end;

      if (rangeIdx < ranges.length && absPos >= ranges[rangeIdx].end) {
        rangeIdx++;
        if (insideMark) { out.push('</mark>'); insideMark = false; }
        continue;
      }

      if (inRange && !insideMark) { out.push(`<mark class="${markCls}">`); insideMark = true; }
      if (!inRange && insideMark) { out.push('</mark>'); insideMark = false; }

      let nextBoundary = tokLen;
      if (rangeIdx < ranges.length) {
        const r = ranges[rangeIdx];
        if (!inRange && r.start > absPos) nextBoundary = Math.min(nextBoundary, r.start - plainOffset);
        if (inRange) nextBoundary = Math.min(nextBoundary, r.end - plainOffset);
      }

      out.push(tok.value.slice(i, nextBoundary));
      i = nextBoundary;
    }
    if (insideMark && rangeIdx < ranges.length && plainOffset + tokLen >= ranges[rangeIdx].end) {
      out.push('</mark>'); insideMark = false; rangeIdx++;
    }
    plainOffset += tokLen;
  }
  if (insideMark) out.push('</mark>');

  return out.join('');
}

// HighlightedLine — renders a single diff line with Prism + char-diff marks
function HighlightedLine({ text, pairText, type, lang }) {
  const html = highlightLine(text, lang);

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

  const charChanges = diffChars(
    type === 'remove' ? text : pairText,
    type === 'add' ? text : pairText,
  );

  const changedRanges = [];
  let offset = 0;
  for (const part of charChanges) {
    const partLen = part.value.length;
    const isRelevant = type === 'remove' ? part.removed : part.added;
    if (isRelevant) changedRanges.push({ start: offset, end: offset + partLen });
    if (!part.added && !part.removed) offset += partLen;
    else if (type === 'remove' && part.removed) offset += partLen;
    else if (type === 'add' && part.added) offset += partLen;
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

  const markCls = type === 'remove' ? 'diff__inline--remove' : 'diff__inline--add';
  const injected = injectMarksIntoHTML(html !== null ? html : escapeHtml(text), changedRanges, markCls);

  return (
    <code
      className={html !== null ? `language-${PRISM_LANG_MAP[lang] || lang}` : undefined}
      dangerouslySetInnerHTML={{ __html: injected }}
    />
  );
}

// buildDiffRows — pure function, exported so callers can pre-compute
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

// DiffView — the main exported component
//
// Props:
//   sourceContent  string   left-hand (original) code
//   targetContent  string   right-hand (converted) code
//   sourceLang     string   language key for Prism (left column)
//   targetLang     string   language key for Prism (right column)
//   leftLabel      string?  column header label override  (default: "Source")
//   rightLabel     string?  column header label override  (default: "Converted ({targetLang})")
export function DiffView({
  sourceContent,
  targetContent,
  sourceLang,
  targetLang,
  leftLabel,
  rightLabel,
}) {
  const { srcRows, tgtRows, stats } = buildDiffRows(sourceContent, targetContent);
  const [diffSyncScroll, setDiffSyncScroll] = useState(true);
  const srcScrollRef = useRef(null);
  const tgtScrollRef = useRef(null);
  const isSyncingRef = useRef(false);
  const prismTheme = usePrismTheme();

  // Build pair-map: adjacent remove/add lines share their text for char-diff
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
    ((stats.added + stats.removed) / Math.max(stats.added + stats.removed + stats.unchanged, 1)) * 100,
  );

  const renderRows = (rows, side, lang) =>
    rows.map((row, i) => {
      if (row.type === 'phantom') {
        return (
          <div key={`${side}-phantom-${i}`} className="diff__line diff__line--phantom">
            <span className="diff__gutter-strip" />
            <span className="diff__linenum" />
            <pre className="diff__text" />
          </div>
        );
      }

      const cls = row.type === 'add' ? ' diff__line--add' : row.type === 'remove' ? ' diff__line--remove' : '';
      const sign = row.type === 'add' ? '+' : row.type === 'remove' ? '−' : '';
      const pairText = pairMap.current[`${side}-${i}`];

      return (
        <div key={`${side}-${row.type}-${row.lineNum}`} className={`diff__line${cls}`}>
          <span className="diff__gutter-strip" />
          <span className="diff__linenum">
            <span className="diff__linenum-num">{row.lineNum}</span>
            <span className="diff__linenum-sign">{sign}</span>
          </span>
          <pre className={`diff__text prism-${prismTheme}`}>
            <HighlightedLine
              text={row.text}
              pairText={pairText}
              type={row.type}
              lang={lang}
            />
          </pre>
        </div>
      );
    });

  const resolvedLeftLabel = leftLabel ?? 'Source';
  const resolvedRightLabel = rightLabel ?? `Converted (${targetLang})`;

  return (
    <div className="diff">
      <div className="diff__toolbar">
        <div className="diff__stats">
          <span className="diff__stat diff__stat--add">+{stats.added}</span>
          <span className="diff__stat diff__stat--remove">−{stats.removed}</span>
          <span className="diff__stat diff__stat--unchanged">{stats.unchanged} unchanged</span>
          <span className="diff__stat diff__stat--delta">{delta}% delta</span>
        </div>
        <label className="custom-check syncheck">
          <input
            type="checkbox"
            checked={diffSyncScroll}
            onChange={e => setDiffSyncScroll(e.target.checked)}
          />
          <div className="box"><i className="fa-solid fa-check" /></div>
          <span className="label-text">Sync Scroll</span>
        </label>
      </div>

      <div className="diff__columns">
        <div className="diff__col">
          <div className="diff__col-header">
            <i className="fa-solid fa-circle diff__col-dot diff__col-dot--remove" />
            <span className="diff__col-filename">{resolvedLeftLabel}</span>
          </div>
          <div
            className="diff__lines"
            ref={srcScrollRef}
            onScroll={e => handleColScroll(e, tgtScrollRef)}
          >
            <div className="diff__lines-inner">
              {renderRows(srcRows, 'src', sourceLang)}
            </div>
          </div>
        </div>

        <div className="diff__col">
          <div className="diff__col-header">
            <i className="fa-solid fa-circle diff__col-dot diff__col-dot--add" />
            <span className="diff__col-filename">{resolvedRightLabel}</span>
          </div>
          <div
            className="diff__lines"
            ref={tgtScrollRef}
            onScroll={e => handleColScroll(e, srcScrollRef)}
          >
            <div className="diff__lines-inner">
              {renderRows(tgtRows, 'tgt', targetLang)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
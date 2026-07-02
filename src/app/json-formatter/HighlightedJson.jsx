'use client';

import { useRef, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

const highlight = (code, language) => {
  const grammar = Prism.languages[language] || Prism.languages.json;
  try {
    return Prism.highlight(code || '', grammar, language);
  } catch {
    return code || '';
  }
};

// Read-only, Prism-highlighted code block.
export function HighlightedCode({ code, language = 'json', className = '', placeholder = '' }) {
  if (!code) {
    return (
      <div className={`j-highlight-pre j-highlight-static j-highlight-empty ${className}`}>
        {placeholder}
      </div>
    );
  }
  return (
    <pre className={`j-highlight-pre j-highlight-static ${className}`}>
      <code
        className={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlight(code, language) }}
      />
    </pre>
  );
}

// Editable, Prism-highlighted textarea.
export function HighlightedEditor({
  value,
  onChange,
  language = 'json',
  placeholder = '',
  spellCheck = false,
  className = '',
}) {
  const taRef = useRef(null);
  const preRef = useRef(null);

  const syncScroll = useCallback(() => {
    if (!taRef.current || !preRef.current) return;
    preRef.current.scrollTop = taRef.current.scrollTop;
    preRef.current.scrollLeft = taRef.current.scrollLeft;
  }, []);

  // A trailing newline collapses in a <pre>, which makes the textarea and
  // the pre drift apart by one line. Padding with a space keeps them in sync.
  const paddedValue = value?.endsWith('\n') ? value + ' ' : value;

  return (
    <div className={`j-highlight-wrapper ${className}`}>
      <pre ref={preRef} className="j-highlight-pre" aria-hidden="true">
        <code
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlight(paddedValue, language) }}
        />
      </pre>
      <textarea
        ref={taRef}
        value={value}
        onChange={onChange}
        onScroll={syncScroll}
        placeholder={placeholder}
        spellCheck={spellCheck}
        className="j-highlight-textarea"
      />
    </div>
  );
}
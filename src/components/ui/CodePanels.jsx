'use client';

import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-zig';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-sql';

import { useTheme } from '@/context';

const DARK_THEMES = ['recode-dark', 'midnight-gold', 'deep-sea'];

function getGrammar(lang) {
  if (languages[lang]) return languages[lang];
  if (lang === 'c' || lang === 'cpp') return languages.clike;
  return languages.plaintext || languages.js;
}

function makeHighlighter(language) {
  return (code) => {
    const highlighted = highlight(code, getGrammar(language), language);

    // Split on newlines produced by Prism.  An empty line must still emit a
    // span so the CSS counter increments for every source line — including
    // blank ones — keeping gutter numbers in sync with the textarea cursor.
    // A zero-width space is used for empty lines because a truly empty <span>
    // collapses to zero height in some browsers, visually swallowing the line.
    return highlighted
      .split('\n')
      .map((line) => `<span class="editor-line">${line || '\u200B'}</span>`)
      .join('\n');
  };
}

export const CodeEditor = forwardRef(function CodeEditor(
  { value, onValueChange, language = 'javascript', placeholder = "Paste/write your code here..." },
  ref
) {
  const { currentTheme } = useTheme();
  const isDarkTheme = DARK_THEMES.includes(currentTheme);
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => {
    return containerRef.current?.querySelector('textarea');
  }, []);

  return (
    <div className="editor-container" ref={containerRef}>
      <Editor
        value={value || ''}
        onValueChange={onValueChange}
        highlight={makeHighlighter(language)}
        padding={15}
        className={`code-editor ${isDarkTheme ? 'prism-dark' : 'prism-light'}`}
        placeholder={placeholder}
      />
    </div>
  );
});

export function CodeOutput({ content, language = 'javascript', scrollRef }) {
  const containerRef = useRef(null);

  const { currentTheme } = useTheme();
  const isDarkTheme = DARK_THEMES.includes(currentTheme);

    useEffect(() => {
    if (scrollRef) {
      scrollRef.current = containerRef.current?.querySelector('textarea');
    }
  }, [scrollRef]);

  return (
    <div className="editor-container" ref={containerRef}>
      <Editor
        value={content || ''}
        onValueChange={() => { }}
        highlight={makeHighlighter(language)}
        padding={15}
        className={`code-editor ${isDarkTheme ? 'prism-dark' : 'prism-light'}`}
        style={{ caretColor: 'transparent' }}
        readOnly
      />
    </div>
  );
};
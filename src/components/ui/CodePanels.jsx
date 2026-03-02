'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

import { useTheme } from '@/context';

export function CodeEditor({ value, onValueChange, language = 'javascript', placeholder = "Paste/write your code here..."
}) {
 
 const { currentTheme } = useTheme();
 const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);
 
 const getGrammar = (lang) => {
  if (languages[lang]) return languages[lang];
  if (lang === 'c' || lang === 'cpp') return languages.clike;
  return languages.plaintext || languages.js;
 };
 
 return (
  <div className="editor-container">
   <Editor
    value={value || ''}
    onValueChange={onValueChange}
    highlight={(code) => highlight(code, getGrammar(language), language)}
    padding={15}
    className={`code-editor ${isDarkTheme ? 'prism-dark' : 'prism-light'}`}
    placeholder={placeholder}
   />
  </div>
 );
}

export function OutputPanel({ content, language }) {
 
 const { currentTheme } = useTheme();
 const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);
 
 return (
  <SyntaxHighlighter 
   language={language} 
   style={isDarkTheme ? vscDarkPlus : vs}
   showLineNumbers
   customStyle={{ margin: 0, padding: '20px', borderRadius: '8px' }}
  >
   {content}
  </SyntaxHighlighter>
 );
};
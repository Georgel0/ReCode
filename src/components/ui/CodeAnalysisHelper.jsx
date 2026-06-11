"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

export function CodeHighlightAnalyzer() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const buttonRef = useRef(null);

  const { setModuleData } = useApp();
  const router = useRouter();

  useEffect(() => {
    const handleMouseUp = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;

      let text = '';
      let isCodeBlock = false;
      let rect = null;

      // Try finding the textarea directly from the event target or its parent
      const target = e.target;
      const textarea = target.tagName === 'TEXTAREA' ? target : target.closest('.editor-container, .code-editor')?.querySelector('textarea');

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) {
          text = textarea.value.substring(start, end).trim();
          isCodeBlock = true;

          // Use exact mouse coordinates relative to the viewport
          rect = {
            top: e.clientY,
            left: e.clientX,
            width: 0
          };
        }
      }

      // Fallback to standard DOM selection (for SyntaxHighlighter)
      if (!text) {
        const selection = window.getSelection();
        text = selection.toString().trim();

        if (text && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let container = range.commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;

          if (container.closest('pre, code, [class*="code"], [class*="hljs"], [class*="prism"]')) {
            isCodeBlock = true;
            const bounding = range.getBoundingClientRect();
            rect = {
              top: bounding.top,
              left: bounding.left,
              width: bounding.width
            };
          }
        }
      }

      if (isCodeBlock && text && rect) {
        // Switch to viewport-based coordinates to bypass parent layout traps
        setPosition({
          top: rect.top - 45,
          left: rect.left + (rect.width / 2),
        });
        setSelectedText(text);
        setVisible(true);
        return;
      }

      setVisible(false);
    };

    const handleMouseDown = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      setVisible(false);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleAnalyzeClick = () => {
    if (!selectedText) return;

    setModuleData({
      type: 'analysis',
      input: selectedText,
      sourceModule: 'converter',
    });

    setVisible(false);
    router.push('/code-analysis');
  };

  if (!visible) return null;

  return (
    <button
      ref={buttonRef}
      className="floating-analyze-btn"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={handleAnalyzeClick}
    >
      <i className="fa-solid fa-magnifying-glass-chart"></i> Analyze Snippet
    </button>
  );
}

export function CodeAnalysisInfoIcon() {
  return (
    <span className="code-analysis-info-wrapper">
      <i
        className="fa-solid fa-circle-info code-analysis-info-icon"
        data-tooltip-id="code-analysis-tooltip"
      ></i>
      <Tooltip
        id="code-analysis-tooltip"
        place="right"
        content={<p>Tip: Drag your mouse to highlight any snippet <br />
          of code on this page to quickly run a structural audit!</p>}
        className="custom-analysis-tooltip"
      />
    </span>
  );
}
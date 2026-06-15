"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '@/styles/components/CodeAnalysisHelper.css';

export function CodeHighlightAnalyzer() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const buttonRef = useRef(null);

  const { setModuleData } = useApp();
  const router = useRouter();

  useEffect(() => {
    // The main logic extracted so it can be called by multiple event types
    const checkSelection = (e) => {
      // If the event triggered inside our popup button, ignore it
      const target = e?.target || document.activeElement;
      if (buttonRef.current && buttonRef.current.contains(target)) return;

      let text = '';
      let isCodeBlock = false;
      let rect = null;

      // Try finding the textarea directly
      const textarea = target?.tagName === 'TEXTAREA'
        ? target
        : target?.closest?.('.editor-container, .code-editor')?.querySelector('textarea');

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) {
          text = textarea.value.substring(start, end).trim();
          isCodeBlock = true;

          // Safely extract coordinates: Mouse vs. Touch vs. Fallback
          const clientY = e?.clientY || e?.changedTouches?.[0]?.clientY || window.innerHeight / 2;
          const clientX = e?.clientX || e?.changedTouches?.[0]?.clientX || window.innerWidth / 2;

          rect = {
            top: clientY,
            left: clientX,
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

          // Ensure container exists before calling closest()
          if (container?.closest?.('pre, code, [class*="code"], [class*="hljs"], [class*="prism"]')) {
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
        setPosition({
          top: rect.top - 45,
          left: rect.left + (rect.width / 2),
        });
        setSelectedText(text);
        setVisible(true);
        return;
      }

      // Only hide if the text is truly empty to prevent flickering on mobile
      if (!text) {
        setVisible(false);
      }
    };

    const handlePointerDown = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      setVisible(false);
    };

    // Debounce the selectionchange event so the button doesn't jump wildly while dragging handles
    let timeoutId;
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => checkSelection(), 150);
    };

    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('touchend', checkSelection);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', checkSelection);
      document.removeEventListener('touchend', checkSelection);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
      clearTimeout(timeoutId);
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
      onTouchEnd={(e) => {
        e.preventDefault();
        handleAnalyzeClick();
      }}
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
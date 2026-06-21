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

          const matchesCodeSelector = (node) => {
            if (!node) return false;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            return !!node?.closest?.('pre, code, [class*="code"], [class*="hljs"], [class*="prism"]');
          };

          // commonAncestorContainer climbs above any match when a selection spans
          // multiple sibling <pre>/<code> blocks (e.g. the diff viewer renders one
          // <pre> per line, so selecting 2+ lines puts the common ancestor at
          // .diff__lines, not inside any pre/code) — fall back to checking the
          // selection's actual start/end points, which stay inside the per-line
          // pre/code even when the common ancestor doesn't.
          if (
            matchesCodeSelector(range.commonAncestorContainer) ||
            matchesCodeSelector(range.startContainer) ||
            matchesCodeSelector(range.endContainer)
          ) {
            isCodeBlock = true;

            // getBoundingClientRect() returns a zero rect for multi-line/multi-block
            // selections. getClientRects() returns one rect per line fragment — always reliable.
            const rects = Array.from(range.getClientRects());
            if (rects.length > 0) {
              const firstRect = rects[0];
              const minLeft = Math.min(...rects.map(r => r.left));
              const maxRight = Math.max(...rects.map(r => r.right));
              rect = {
                top: firstRect.top,
                left: minLeft,
                width: maxRight - minLeft,
              };
            } else {
              // Hard fallback — shouldn't happen but keeps the button visible
              const bounding = range.getBoundingClientRect();
              rect = { top: bounding.top, left: bounding.left, width: bounding.width };
            }
          }
        }
      }

      if (isCodeBlock && text && rect) {
        const BUTTON_CLEARANCE = 45;
        const top = rect.top > BUTTON_CLEARANCE
          ? rect.top - BUTTON_CLEARANCE  
          : rect.top + 22;               

        setPosition({
          top,
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
      // Don't hide yet — wait for mouseup/checkSelection to decide
      // Only hide if clicking on clearly non-code elements
      const target = e.target;
      const isCodeArea = target?.closest?.('pre, code, textarea, [class*="code"], [class*="editor"]');
      if (!isCodeArea) setVisible(false);
    };

    // Debounce the selectionchange event so the button doesn't jump wildly while dragging handles
    let timeoutId;
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.getSelection()?.toString().trim()) {
          checkSelection();
        }
      }, 250);
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
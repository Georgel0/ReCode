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
  // tracks whether the current selection came from a <textarea> (vs. a rendered code block)
  const positionFromTextareaRef = useRef(false);

  const { setModuleData } = useApp();
  const router = useRouter();

  useEffect(() => {
    // fired on mouseup / touchend — figures out where the selection is and whether it's inside code
    const checkSelection = (e) => {
      // ignore clicks on the floating button itself
      if (buttonRef.current && buttonRef.current.contains(e?.target)) return;

      let text = '';
      let isCodeBlock = false;
      let rect = null;
      let isFromTextarea = false;

      // path 1: selection inside a raw <textarea> (e.g. a code editor) ---
      const target = e?.target || document.activeElement;
      const textarea = target?.tagName === 'TEXTAREA'
        ? target
        : target?.closest?.('.editor-container, .code-editor')?.querySelector('textarea');

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (start !== end) {
          text = textarea.value.substring(start, end).trim();
          isCodeBlock = true;
          isFromTextarea = true;

          // use the pointer position as the anchor since textareas have no Range rects
          const clientY = e?.clientY ?? e?.changedTouches?.[0]?.clientY ?? window.innerHeight / 2;
          const clientX = e?.clientX ?? e?.changedTouches?.[0]?.clientX ?? window.innerWidth / 2;
          rect = { top: clientY, left: clientX, width: 0 };
        }
      }

      // path 2: selection inside a rendered code block (pre/code/hljs/prism) ---
      if (!text) {
        const selection = window.getSelection();
        text = selection.toString().trim();

        if (text && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          // checks whether a given DOM node is inside a recognised code container
          const matchesCodeSelector = (node) => {
            if (!node) return false;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            return !!node?.closest?.('pre, code, [class*="code"], [class*="hljs"], [class*="prism"]');
          };

          const anchorMatch = matchesCodeSelector(range.commonAncestorContainer);
          const startMatch  = matchesCodeSelector(range.startContainer);
          const endMatch    = matchesCodeSelector(range.endContainer);

          if (anchorMatch || startMatch || endMatch) {
            isCodeBlock = true;

            // compute a bounding rect that spans every line of the selection
            const rects = Array.from(range.getClientRects());
            if (rects.length > 0) {
              const firstRect = rects[0];
              const minLeft   = Math.min(...rects.map(r => r.left));
              const maxRight  = Math.max(...rects.map(r => r.right));
              rect = { top: firstRect.top, left: minLeft, width: maxRight - minLeft };
            } else {
              const bounding = range.getBoundingClientRect();
              rect = { top: bounding.top, left: bounding.left, width: bounding.width };
            }
          }
        }
      }

      // position the button centred above the selection; flip below if too close to the viewport top
      if (isCodeBlock && text && rect) {
        const BUTTON_CLEARANCE = 45;
        const top = rect.top > BUTTON_CLEARANCE ? rect.top - BUTTON_CLEARANCE : rect.top + 22;
        positionFromTextareaRef.current = isFromTextarea;
        setPosition({ top, left: rect.left + (rect.width / 2) });
        setSelectedText(text);
        setVisible(true);
        return;
      }

      // nothing selected — hide the button
      if (!text) {
        positionFromTextareaRef.current = false;
        setVisible(false);
      }
    };

    // hide the button when the user clicks outside a code/editor area
    const handlePointerDown = (e) => {
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      positionFromTextareaRef.current = false;
      const isCodeArea = e.target?.closest?.('pre, code, textarea, [class*="code"], [class*="editor"]');
      if (!isCodeArea) setVisible(false);
    };

    // keyboard-driven selection changes (arrow keys, shift+click, etc.)
    // debounced so it doesn't fire on every keystroke
    let timeoutId;
    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // skip: textarea selections are already handled by mouseup/touchend
        if (positionFromTextareaRef.current) return;
        if (window.getSelection()?.toString().trim()) checkSelection();
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

  // hide the button if the user scrolls more than THRESHOLD px after it appears
  // (avoids the button floating over unrelated content mid-scroll)
  useEffect(() => {
    if (!visible) return;

    const THRESHOLD = 80;

    // snapshot scroll positions for every scrollable element at the moment the button appears
    const snapshots = new Map();
    const collectScrollables = () => {
      snapshots.set(window, { scrollTop: window.scrollY, scrollLeft: window.scrollX });

      document.querySelectorAll('*').forEach((el) => {
        if (el.scrollTop !== 0 || el.scrollLeft !== 0) {
          snapshots.set(el, { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
          return;
        }
        const style = window.getComputedStyle(el);
        const ov = style.overflow + style.overflowY + style.overflowX;
        if (/auto|scroll/.test(ov) && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
          snapshots.set(el, { scrollTop: el.scrollTop, scrollLeft: el.scrollLeft });
        }
      });
    };

    collectScrollables();

    const onAnyScroll = (e) => {
      const target = e.target === document ? window : e.target;
      const snap = snapshots.get(target);

      const currentScrollTop  = target === window ? window.scrollY  : target.scrollTop;
      const currentScrollLeft = target === window ? window.scrollX  : target.scrollLeft;

      // element wasn't captured in the snapshot — hide if it has scrolled at all
      if (!snap) {
        if (currentScrollTop !== 0 || currentScrollLeft !== 0) {
          setVisible(false);
          positionFromTextareaRef.current = false;
        }
        return;
      }

      const driftY = Math.abs(currentScrollTop  - snap.scrollTop);
      const driftX = Math.abs(currentScrollLeft - snap.scrollLeft);

      if (driftY > THRESHOLD || driftX > THRESHOLD) {
        setVisible(false);
        positionFromTextareaRef.current = false;
      }
    };

    document.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener('scroll', onAnyScroll, { capture: true });
    };
  }, [visible, position]);

  // sends the highlighted snippet to the analysis module and navigates there
  const handleAnalyzeClick = () => {
    if (!selectedText) return;
    setModuleData({ type: 'analysis', input: selectedText, sourceModule: 'converter' });
    setVisible(false);
    router.push('/code-analysis');
  };

  return (
    <button
      ref={buttonRef}
      className={`floating-analyze-btn${visible ? ' floating-analyze-btn--visible' : ''}`}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={handleAnalyzeClick}
      onTouchEnd={(e) => { e.preventDefault(); handleAnalyzeClick(); }}
      aria-hidden={!visible}
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
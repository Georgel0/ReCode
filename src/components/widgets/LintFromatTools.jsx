'use client';
import { useState, useCallback } from 'react';
import { convertCode } from '@/lib';
import '@/styles/components/LintFormatTools.css';

// Languages where AI linting makes sense.
// Anything not in this set gets skipped rather than sending to AI.
const AI_LINTABLE = new Set([
  'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'ruby', 'go', 'rust', 'java', 'kotlin', 'swift',
  'css', 'scss', 'sass', 'sql', 'yaml', 'toml', 'xml',
  'php', 'c', 'cpp', 'csharp',
]);

function runNativeLint(code, lang) {
  if (lang === 'json') {
    try {
      JSON.parse(code);
      return { valid: true, errors: [], warnings: [], summary: 'Valid JSON.' };
    } catch (e) {
      const match = e.message.match(/line (\d+) column (\d+)/i);
      return {
        valid: false,
        errors: [{ line: match ? +match[1] : null, col: match ? +match[2] : null, message: e.message }],
        warnings: [],
        summary: 'Invalid JSON: 1 syntax error.',
      };
    }
  }

  if (lang === 'html') {
    const doc = new DOMParser().parseFromString(code, 'text/html');
    const errs = Array.from(doc.querySelectorAll('parsererror, parsererror *'))
      .reduce((acc, el) => {
        const text = el.textContent.trim();
        if (text) acc.push({ line: null, col: null, message: text });
        return acc;
      }, []);
    if (errs.length) return { valid: false, errors: errs, warnings: [], summary: `${errs.length} HTML parse error(s).` };
    return { valid: true, errors: [], warnings: [], summary: 'Well-formed HTML.' };
  }

  return null; // no native parser, fall through to AI
}


/**
 * Owns all lint, format, and toast state/logic for the CodeConverter.
 *
 * @param {object}        opts.activeFile       - Active source file { id, content, language, name }
 * @param {object|null}   opts.activeOutputFile - Active output file { sourceId, content, fileName }
 * @param {string}        opts.targetLang       - Target language key ('python', 'json', …)
 * @param {string}        opts.activeTabId      - ID of the active source tab
 * @param {function}      opts.updateFile       - (id, content) => void
 * @param {function}      opts.setOutputFiles   - React state setter for outputFiles
 */
export function useLintFormatTools({
  activeFile,
  activeOutputFile,
  targetLang,
  activeTabId,
  updateFile,
  setOutputFiles,
}) {
  const [formatting, setFormatting] = useState(false);
  const [linting,    setLinting]    = useState(false);
  const [lintResult, setLintResult] = useState(null);
  const [toasts,     setToasts]     = useState([]);


  const addToast = useCallback((type, message, detail = null) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message, detail }]);
    // Errors stay until dismissed; other toasts auto-clear after 15 s.
    if (type !== 'error') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 15000);
    }
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);


  const runLinter = useCallback(async () => {
    if (!activeOutputFile?.content) return;
    setLinting(true);
    setLintResult(null);

    const code = activeOutputFile.content;
    const lang = targetLang;

    // Try a fast, free native parser first.
    const nativeResult = runNativeLint(code, lang);
    if (nativeResult) {
      const status = nativeResult.valid ? 'success' : 'error';
      setLintResult({ status, ...nativeResult });
      addToast(status, nativeResult.valid ? 'Syntax check passed' : 'Syntax errors found', nativeResult.summary);
      setLinting(false);
      return;
    }

    // Only send to AI for languages where it's actually useful.
    if (!AI_LINTABLE.has(lang)) {
      const result = { status: 'warning', valid: true, errors: [], warnings: [], summary: `Syntax checking is not supported for ${lang}.` };
      setLintResult(result);
      addToast('warning', 'Not supported', result.summary);
      setLinting(false);
      return;
    }

    try {
      // pass the already-parsed object; the linter prompt uses input.code / input.lang.
      const result = await convertCode('linter', { code, lang }, { lang });
      if (!result) throw new Error('No response from linter');

      const status = result.valid ? 'success' : (result.errors?.length ? 'error' : 'warning');
      setLintResult({
        status,
        valid:    result.valid,
        errors:   result.errors   || [],
        warnings: result.warnings || [],
        summary:  result.summary  || (result.valid ? 'No errors found.' : 'Errors detected.'),
      });
      addToast(status, result.valid ? 'Syntax check passed' : 'Syntax errors found', result.summary);
    } catch (e) {
      addToast('error', 'Linter failed', e.message);
      setLintResult({ status: 'error', valid: false, errors: [], warnings: [], summary: 'Linter failed to run.' });
    } finally {
      setLinting(false);
    }
  }, [activeOutputFile, targetLang, addToast]);


  const formatActiveCode = useCallback(async (isOutput = false) => {
    const targetFile = isOutput ? activeOutputFile : activeFile;
    if (!targetFile?.content?.trim()) return;

    const lang = isOutput ? targetLang : (activeFile?.language || 'plaintext');

    // Consolidated JSON detection: language flag OR filename extension.
    const fileName = targetFile.fileName ?? targetFile.name ?? '';
    const isJson   = lang === 'json' || fileName.endsWith('.json');

    if (isJson) {
      try {
        const formatted = JSON.stringify(JSON.parse(targetFile.content), null, 2);
        if (isOutput) {
          setOutputFiles(prev => prev.map(f => f.sourceId === targetFile.sourceId ? { ...f, content: formatted } : f));
        } else {
          updateFile(targetFile.id || activeTabId, formatted);
        }
        addToast('success', 'Formatted', 'JSON pretty-printed successfully.');
      } catch {
        addToast('error', 'Format failed', 'Content is not valid JSON.');
      }
      return;
    }

    setFormatting(true);
    try {
      const result = await convertCode('formatter', targetFile.content, { lang });
      if (!result?.content) throw new Error('No output returned.');

      if (isOutput) {
        setOutputFiles(prev => prev.map(f => f.sourceId === targetFile.sourceId ? { ...f, content: result.content } : f));
      } else {
        updateFile(targetFile.id || activeTabId, result.content);
      }

      addToast('success', 'Formatted', result.changes?.length ? result.changes.slice(0, 3).join(' · ') : 'No changes needed.');
    } catch (e) {
      addToast('error', 'Format failed', e.message);
    } finally {
      setFormatting(false);
    }
  }, [activeFile, activeOutputFile, targetLang, activeTabId, updateFile, setOutputFiles, addToast]);

  return {
    formatting, linting, lintResult, toasts,
    setLintResult,
    addToast,      
    dismissToast, runLinter, formatActiveCode,
  };
}

export function FormatButton({ onClick, disabled, formatting }) {
  return (
    <button className="secondary-button" onClick={onClick} disabled={disabled} title="Format Code">
      {formatting
        ? <span className="btn-spinner" aria-hidden="true" />
        : <i className="fa-solid fa-wand-magic" aria-hidden="true" />}
      {' '}Format Code
    </button>
  );
}

export function SyntaxCheckerPanel({ runLinter, linting, lintResult }) {
  return (
    <div className="lint">
      <button className="secondary-button" onClick={runLinter} disabled={linting}>
        {linting
          ? <span className="btn-spinner" aria-hidden="true" />
          : <i className="fa-solid fa-stethoscope" aria-hidden="true" />}
        {' '}{linting ? 'Checking…' : 'Check Syntax'}
      </button>

      {lintResult && (
        <div className={`lint-result lint-result--${lintResult.status}`}>
          <div className="lint-result__header">
            <i className={`fa-solid ${
              lintResult.status === 'success' ? 'fa-check-circle'
              : lintResult.status === 'warning' ? 'fa-triangle-exclamation'
              : 'fa-circle-xmark'
            }`} aria-hidden="true"></i>
            <span>{lintResult.summary}</span>
          </div>

          {(lintResult.errors?.length > 0 || lintResult.warnings?.length > 0) && (
            <ul className="lint-result__list">
              {lintResult.errors?.map((e, i) => (
                <li key={`e-${e.line ?? i}-${e.message.slice(0, 30)}`} className="lint-result__item lint-result__item--error">
                  {e.line != null && <span className="lint-result__loc">L{e.line}{e.col != null ? `:${e.col}` : ''}</span>}
                  <span>{e.message}</span>
                </li>
              ))}
              {lintResult.warnings?.map((w, i) => (
                <li key={`w-${w.line ?? i}-${w.message.slice(0, 30)}`} className="lint-result__item lint-result__item--warning">
                  {w.line != null && <span className="lint-result__loc">L{w.line}{w.col != null ? `:${w.col}` : ''}</span>}
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ToastStack({ toasts, dismissToast }) {
  if (!toasts?.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <i className={`fa-solid ${
            t.type === 'success' ? 'fa-check-circle'
            : t.type === 'warning' ? 'fa-triangle-exclamation'
            : 'fa-circle-xmark'
          }`} aria-hidden="true"></i>
          <div className="toast__body">
            <span className="toast__msg">{t.message}</span>
            {t.detail && <span className="toast__detail">{t.detail}</span>}
          </div>
          <button className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      ))}
    </div>
  );
}
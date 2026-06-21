import React, { useState, useRef, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import { CopyButton, CodeOutput } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { DiffView } from '@/components/widgets';
import { REFACTOR_MODES } from './useCodeRefactor';
import { formatBytes } from '@/lib';

export const FileTabs = ({ files, activeTabId, setActiveTabId, removeFile, renameFile }) => {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  const startEdit = (e, file) => {
    e.stopPropagation();
    setEditingId(file.id);
    setEditValue(file.name || 'untitled');
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      renameFile(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e, index) => {
    if (editingId) return;
    if (e.key === 'ArrowRight') setActiveTabId(files[(index + 1) % files.length].id);
    else if (e.key === 'ArrowLeft') setActiveTabId(files[(index - 1 + files.length) % files.length].id);
    else if (e.key === 'Enter') setActiveTabId(files[index].id);
    else if (e.key === 'F2') startEdit(e, files[index]);
  };

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  return (
    <div className="r-tabs-bar" role="tablist" aria-label="Open files">
      {files.map((file, index) => (
        <button
          key={file.id}
          role="tab"
          aria-selected={activeTabId === file.id}
          tabIndex={0}
          className={`r-tab ${activeTabId === file.id ? 'r-active' : ''}`}
          onClick={() => setActiveTabId(file.id)}
          onDoubleClick={(e) => startEdit(e, file)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        >
          <i className="fa-solid fa-file-code" aria-hidden="true" />
          <span className="r-tab-name">
            {editingId === file.id ? (
              <input
                ref={inputRef}
                className="r-tab-rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                {file.name || 'untitled'}
                {file.size > 0 && (
                  <small className="r-file-size">({formatBytes(file.size)})</small>
                )}
              </>
            )}
          </span>
          <span
            className="r-tab-close"
            role="button"
            aria-label={`Close ${file.name}`}
            onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
};

export const OutputFileTabs = ({ outputFiles, inputFiles, activeTabId, setActiveTabId }) => {
  if (!outputFiles || outputFiles.length === 0) return null;

  // Build an ordered list matching inputFiles order (with fallback)
  const orderedTabs = inputFiles
    .map((f) => {
      const out = outputFiles.find((o) => o.sourceId === f.id || o.fileName === f.name);
      return out ? { ...out, displayName: out.fileName || f.name } : null;
    })
    .filter(Boolean);

  if (orderedTabs.length === 0) return null;

  return (
    <div className="r-tabs-bar" role="tablist" aria-label="Output files">
      {orderedTabs.map((out) => {
        const matchInput = inputFiles.find(
          (f) => f.id === out.sourceId || f.name === out.fileName,
        );
        const isActive = activeTabId === matchInput?.id;
        return (
          <button
            key={out.sourceId || out.fileName}
            role="tab"
            aria-selected={isActive}
            className={`r-tab ${isActive ? 'r-active' : ''}`}
            onClick={() => matchInput && setActiveTabId(matchInput.id)}
          >
            <i className="fa-solid fa-file-code" aria-hidden="true" />
            <span className="r-tab-name">{out.displayName}</span>
          </button>
        );
      })}
    </div>
  );
};

export const RefactorControls = ({ refactorMode, setRefactorMode, suggestedMode }) => (
  <div className="r-refactor-options">
    <span className="r-refactor-label">
      <i className="fa-solid fa-bullseye" aria-hidden="true" />
      Goal
    </span>
    <div className="r-mode-group" role="radiogroup" aria-label="Refactor goal">
      {REFACTOR_MODES.map((mode) => {
        const isSuggested = suggestedMode?.mode === mode.id;
        const suggestionReasons = isSuggested ? suggestedMode.reasons : [];
        const tooltipContent = isSuggested && suggestionReasons.length > 0
          ? `Suggested — ${suggestionReasons.join(' · ')}`
          : mode.desc;

        return (
          <button
            key={mode.id}
            role="radio"
            aria-checked={refactorMode === mode.id}
            className={`r-mode-btn ${refactorMode === mode.id ? 'r-selected' : ''}`}
            onClick={() => setRefactorMode(mode.id)}
            data-tooltip-id="r-refactor-tooltip"
            data-tooltip-content={tooltipContent}
          >
            <i className={mode.icon} aria-hidden="true" />
            <span className="r-mode-btn-label">{mode.label}</span>
            {isSuggested && (
              <span className="r-suggested-badge">
                <i className="fa-solid fa-star" aria-hidden="true" />
              </span>
            )}
          </button>
        );
      })}
    </div>
    <Tooltip id="r-refactor-tooltip" />
  </div>
);

export const ProjectContextInput = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        className={`r-context-btn secondary-button ${value.trim() ? 'r-context-btn--active' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
        Project Context
        {value.trim() && <span className="r-context-dot" aria-label="Context set" />}
      </button>

      {open && (
        <div
          className="modal-overlay r-context-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Project context"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="modal-content r-context-modal">
            <div className="modal-header">
              <h2>
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                Project Context
              </h2>
              <button
                className="r-context-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
            <p className="r-context-modal-desc">
              Tell the AI about your stack, conventions, or constraints so it can tailor refactors to your project.
            </p>
            <textarea
              className="r-context-textarea"
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, 500))}
              placeholder="e.g. Node.js + Express API · use Zod for validation · no class components"
              spellCheck={false}
              aria-label="Project context for the AI"
              rows={5}
              autoFocus
            />
            <div className="r-context-footer">
              <span className={`r-context-chars ${value.length > 450 ? 'r-context-chars--warn' : ''}`}>
                {value.length} / 500
              </span>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const ChangeSummary = ({ outputFile }) => {
  const [open, setOpen] = useState(false);
  const { summary, changes } = outputFile;
  if (!summary && (!changes || changes.length === 0)) return null;

  return (
    <div className="r-change-summary">
      <button
        className="r-change-summary-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="r-change-summary-title">
          <i className="fa-solid fa-list-check" aria-hidden="true" />
          What changed
          {changes?.length > 0 && (
            <span className="r-change-count">{changes.length}</span>
          )}
        </span>
        <i
          className={`fa-solid fa-chevron-down r-change-chevron ${open ? 'r-change-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className={`r-change-body-wrap ${open ? 'r-change-body-wrap--open' : ''}`}>
        <div className="r-change-body">
          {summary && <p className="r-change-overview">{summary}</p>}
          {changes?.length > 0 && (
            <ul className="r-change-list">
              {changes.map((change, i) => (
                <li key={i} className="r-change-item">
                  <span className={`r-change-tag r-change-tag--${change.type || 'info'}`}>
                    {change.type || 'change'}
                  </span>
                  <span className="r-change-text">{change.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export const Suggestions = ({ outputFile }) => {
  const [open, setOpen] = useState(false);
  const { suggestions } = outputFile;
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="r-change-summary">
      <button
        className="r-change-summary-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="r-change-summary-title">
          <i className="fa-solid fa-lightbulb" aria-hidden="true" />
          Suggestions
          <span className="r-change-count">{suggestions.length}</span>
        </span>
        <i
          className={`fa-solid fa-chevron-down r-change-chevron ${open ? 'r-change-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className={`r-change-body-wrap ${open ? 'r-change-body-wrap--open' : ''}`}>
        <div className="r-change-body">
          <ul className="r-change-list">
            {suggestions.map((s, i) => (
              <li key={i} className="r-change-item">
                <span className="r-change-tag r-change-tag--info">idea</span>
                <span className="r-change-text">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export const OutputPanel = React.memo(({
  activeFile,
  activeOutputFile,
  outputFiles,
  downloadSingleFile,
  loadingStage,
  targetScrollRef,
  targetLang
}) => {
  if (!activeOutputFile) {
    return (
      <div className="c-output-empty">
        <EmptyState
          isLoading={loadingStage !== 'idle'}
          condition={outputFiles.length === 0}
          icon="fas fa-wand-magic-sparkles"
          title="Awaiting Refactoring Target"
          description="Add your source files and select a transformation model to automatically update project code health."
          hint={
            <>
              Choose between <code>Clean Code</code>, <code>Performance Optimization</code>, or{' '}
              <code>Type Safety</code> variants in the controller layout.
            </>
          }
          loadingTitle="Refactoring Project Architecture"
          loadingDescription="Decoupling complex logical layers, resolving cyclical file dependencies, and rewriting code blocks…"
        />
      </div>
    );
  }

  return (
    <div className="r-output-panel">
      <div className="r-clean-output-view" ref={targetScrollRef}>
        <CodeOutput
          language={targetLang || 'javascript'}
          content={activeOutputFile.content}
        />
        <CopyButton codeToCopy={activeOutputFile.content} />
      </div>
    </div>
  );
});
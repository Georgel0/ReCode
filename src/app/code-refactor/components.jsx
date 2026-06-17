import React, { useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { CopyButton, CodeOutput } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { DiffView } from '@/components/widgets';
import { REFACTOR_MODES } from './useCodeRefactor';
import { formatBytes } from '@/lib';

export const FileTabs = ({ files, activeTabId, setActiveTabId, removeFile }) => {

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      setActiveTabId(files[(index + 1) % files.length].id);
    } else if (e.key === 'ArrowLeft') {
      setActiveTabId(files[(index - 1 + files.length) % files.length].id);
    } else if (e.key === 'Enter') {
      setActiveTabId(files[index].id);
    }
  };

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
          onKeyDown={(e) => handleKeyDown(e, index)}
        >
          <i className="fa-solid fa-file-code" aria-hidden="true" />
          <span className="r-tab-name">
            {file.name || 'untitled'}
            {file.size > 0 && (
              <small className="r-file-size">({formatBytes(file.size)})</small>
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

export const RefactorControls = ({ refactorMode, setRefactorMode, suggestedMode }) => (
  <div className="r-refactor-options">
    <div className="r-refactor-options-header">
      <i className="fa-solid fa-bullseye" aria-hidden="true" />
      Refactor Goal
    </div>

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
            title={mode.desc}
          >
            <span className="r-mode-title">
              <i className={mode.icon} aria-hidden="true" />
              {mode.label}
              {isSuggested && (
                <span
                  className="r-suggested-badge"
                  data-tooltip-id="r-refactor-tooltip"
                  data-tooltip-content={suggestionReasons.length > 0 ? suggestionReasons.join(' · ') : 'Matches patterns in your code'}
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="fa-solid fa-star" aria-hidden="true" />
                  Suggested
                </span>
              )}
            </span>
            <div
              role="button"
              tabIndex={0}
              className="r-info-btn"
              data-tooltip-id="r-refactor-tooltip"
              data-tooltip-content={tooltipContent}
              aria-label={`Info: ${mode.desc}`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <i className="fas fa-info-circle" aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </div>

    <Tooltip id="r-refactor-tooltip" />
  </div>
);

export const ProjectContextInput = ({ value, onChange }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="r-context-block">
      <button
        className="r-context-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="r-context-toggle-left">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          Project Context
          {value.trim() && <span className="r-context-dot" aria-label="Context set" />}
        </span>
        <i
          className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} r-context-chevron`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="r-context-body">
          <p className="r-context-hint">
            Tell the AI about your stack, conventions, or constraints.
          </p>
          <textarea
            className="r-context-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Node.js + Express API · use Zod for validation · no class components"
            spellCheck={false}
            aria-label="Project context for the AI"
          />
          <div className="r-context-chars">{value.length} / 500</div>
        </div>
      )}
    </div>
  );
};

const ChangeSummary = ({ outputFile }) => {
  const [open, setOpen] = useState(true);

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
          className={`fa-solid fa-chevron-${open ? 'up' : 'down'} r-change-chevron`}
          aria-hidden="true"
        />
      </button>

      {open && (
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
      )}
    </div>
  );
};

export const OutputPanel = React.memo(({
  activeFile,
  activeOutputFile,
  outputFiles,
  downloadSingleFile,
  loadingStage,
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
      <ChangeSummary outputFile={activeOutputFile} />
      <div className="r-clean-output-view">
        <CodeOutput
          language={activeFile.language || 'javascript'}
          content={activeOutputFile.content}
        />
        <CopyButton codeToCopy={activeOutputFile.content} />
      </div>
    </div>
  );
});
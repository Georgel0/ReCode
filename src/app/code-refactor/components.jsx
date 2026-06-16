import React from 'react';
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
      {REFACTOR_MODES.map((mode) => (
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
            {suggestedMode === mode.id && (
              <span className="r-suggested-badge">
                <i className="fa-solid fa-star" aria-hidden="true" />
                Suggested
              </span>
            )}
          </span>
          <div
            type="button"
            className="r-info-btn"
            data-tooltip-id="r-refactor-tooltip"
            data-tooltip-content={mode.desc}
            aria-label={`Info: ${mode.desc}`}
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fas fa-info-circle" aria-hidden="true" />
          </div>
        </button>
      ))}
    </div>

    <Tooltip id="r-refactor-tooltip" />
  </div>
);

export const OutputPanel = React.memo(({
  activeFile,
  activeOutputFile,
  targetLang,
  outputFiles,
  viewMode,
  setViewMode,
  downloadSingleFile,
  loadingStage,
}) => {
  if (!activeOutputFile) {
    return (
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
    );
  }

  return (
    <div className="r-output-panel">
      <div className="r-view-toggle" role="group" aria-label="Output view mode">
        <button
          className={`r-view-btn ${viewMode === 'final' ? 'r-active' : ''}`}
          onClick={() => setViewMode('final')}
        >
          <i className="fa-solid fa-file-lines" aria-hidden="true" />
          Final Output
        </button>
        <button
          className={`r-view-btn ${viewMode === 'split' ? 'r-active' : ''}`}
          onClick={() => setViewMode('split')}
        >
          <i className="fa-solid fa-table-columns" aria-hidden="true" />
          Split View (Diff)
        </button>
      </div>

      <div className="r-diff-container">
        {viewMode === 'final' ? (
          <>
            <CodeOutput
              language={activeFile.language || 'javascript'}
              content={activeOutputFile.content}
            />
            <CopyButton codeToCopy={activeOutputFile.content} />
          </>
        ) : (
          <DiffView
            sourceContent={activeFile?.content || ''}
            targetContent={activeOutputFile?.content || ''}
            sourceLang={activeFile?.language || 'plaintext'}
            targetLang={targetLang}
          />
        )}
      </div>

      <div className="r-output-action">
        <div className="action-row">
          <button className="primary-button" onClick={() => downloadSingleFile(activeOutputFile)}>
            <i className="fa-solid fa-download" aria-hidden="true" />
            Download File
          </button>
        </div>
      </div>
    </div>
  );
});
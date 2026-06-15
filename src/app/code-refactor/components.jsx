import React from 'react';
import { useState, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import { CopyButton, CodeOutput } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { useTheme } from '@/context';
import { REFACTOR_MODES } from './utils';
import { formatBytes } from '@/lib';
import ReactDiffViewer from 'react-diff-viewer-continued';

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
  activeSourceFile,
  outputFiles,
  viewMode,
  setViewMode,
  downloadSingleFile,
  loadingStage,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const { currentTheme } = useTheme();
  const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const activeOutput = outputFiles.find(
    (out) => out.sourceId === activeSourceFile?.id || out.name === activeSourceFile?.name,
  );

  if (!activeOutput) {
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
              language={activeSourceFile.language || 'javascript'}
              content={activeOutput.content}
            />
            <CopyButton codeToCopy={activeOutput.content} />
          </>
        ) : (
          <ReactDiffViewer
            oldValue={activeSourceFile.content}
            newValue={activeOutput.content}
            splitView={isMobile ? false : viewMode === 'split'}
            useDarkTheme={isDarkTheme}
            compareMethod="diffLines"
            leftTitle="Original"
            rightTitle="Refactored"
            styles={!isDarkTheme ? undefined : {
              variables: {
                diffViewerBackground: '#000000',
                addedBackground: 'rgba(55, 211, 94, 0.15)',
                addedGutterBackground: 'rgba(46, 160, 67, 0.25)',
                removedBackground: 'rgba(248, 81, 73, 0.15)',
                removedGutterBackground: 'rgba(248, 81, 73, 0.25)',
                wordAddedBackground: 'rgba(46, 160, 67, 0.35)',
                wordRemovedBackground: 'rgba(248, 81, 73, 0.35)',
              },
              contentText: {
                fontSize: '13px',
                lineHeight: '20px',
              },
            }}
          />
        )}
      </div>

      <div className="r-output-action">
        <div className="action-row">
          <button className="primary-button" onClick={() => downloadSingleFile(activeOutput)}>
            <i className="fa-solid fa-download" aria-hidden="true" />
            Download File
          </button>
        </div>
      </div>
    </div>
  );
});
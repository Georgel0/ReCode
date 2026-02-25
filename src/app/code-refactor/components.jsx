import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { REFACTOR_MODES, formatBytes } from './utils';

import { diffLines } from 'diff';
import ReactDiffViewer from 'react-diff-viewer-continued';

export const FileTabs = ({ files, activeTabId, setActiveTabId, removeFile }) => {
  // Arrow Key Navigation
  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowRight') {
      const next = files[(index + 1) % files.length];
      setActiveTabId(next.id);
    } else if (e.key === 'ArrowLeft') {
      const prev = files[(index - 1 + files.length) % files.length];
      setActiveTabId(prev.id);
    } else if (e.key === 'Enter') {
      setActiveTabId(files[index].id);
    }
  };
  
  return (
    <nav role="tablist" className="tabs-container" aria-label="Open files">
      {files.map((file, index) => (
        <div 
          key={file.id} 
          role="tab"
          aria-selected={activeTabId === file.id}
          tabIndex={0}
          className={`tab-btn ${activeTabId === file.id ? 'active' : ''}`} 
          onClick={() => setActiveTabId(file.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        >
          <i className="fa-solid fa-file-code"></i>
          <span className="tab-name">
             {file.name || 'untitled'}
             {file.size > 0 && <small className="file-size-badge"> ({formatBytes(file.size)})</small>}
          </span>
          <button 
            className="close-tab" 
            aria-label={`Close ${file.name}`}
            onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      ))}
    </nav>
  );
};

export const RefactorControls = ({ refactorMode, setRefactorMode, suggestedMode }) => (
  <div className="refactor-options">
    <span className="label-text"><i className="fa-solid fa-bullseye"></i> Refactor Goal:</span>
    <div className="mode-selector" role="radiogroup">
      {REFACTOR_MODES.map(mode => (
        <button 
          key={mode.id}
          role="radio"
          aria-checked={refactorMode === mode.id}
          className={`mode-btn ${refactorMode === mode.id ? 'selected' : ''}`}
          onClick={() => setRefactorMode(mode.id)}
          title={mode.desc}
        >
          {mode.label}
          {suggestedMode === mode.id && <span className="suggested-badge"><i className="fa-solid fa-star"></i> Suggested</span>}
        </button>
      ))}
    </div>
  </div>
);

export const OutputPanel = React.memo(({ activeSourceFile, outputFiles, viewMode, setViewMode, downloadSingleFile, loadingStage }) => {
  const activeOutput = outputFiles.find(out => out.sourceId === activeSourceFile?.id || out.name === activeSourceFile?.name);
  
  // 1. Safety Checks First
  if (loadingStage !== 'idle') {
    return (
      <div className="placeholder-container-inner">
        <div className="empty-state" aria-live="polite">
          <i className="fa-solid fa-wand-magic-sparkles fa-bounce"></i>
          <span>{loadingStage === 'analyzing' ? 'Analyzing code...' : loadingStage === 'optimizing' ? 'Applying optimizations...' : 'Validating changes...'}</span>
        </div>
      </div>
    );
  }
  
  if (!activeOutput) return (
    <div className="placeholder-container-inner">
      <div className="empty-state" aria-live="polite">
        <i className="fa-solid fa-code"></i>
        <span>Better code will appear here...</span>
      </div>
    </div>
  );
  
  return (
    <div className="output-panel-content flex-grow">
      <div className="view-toggle">
        <button 
          onClick={() => setViewMode('final')} 
          className={`view-toggle-btn ${viewMode === 'final' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-file-lines"></i> Final Output
        </button>
        <button 
          onClick={() => setViewMode('split')} 
          className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
        >
          <i className="fa-solid fa-table-columns"></i> Split View (Diff)
        </button>
      </div>

      <div className="diff-container">
        {viewMode === 'final' ? (
          <SyntaxHighlighter 
            language={activeSourceFile.language || 'javascript'} 
            style={vscDarkPlus}
            showLineNumbers
            customStyle={{ margin: 0, padding: '20px', borderRadius: '8px' }}
          >
            {activeOutput.content}
          </SyntaxHighlighter>
        ) : (
          <ReactDiffViewer
            oldValue={activeSourceFile.content}
            newValue={activeOutput.content}
            splitView={true}
            useDarkTheme={true}
            compareMethod="diffLines"
            leftTitle="Original"
            rightTitle="Refactored"
            styles={{
              variables: {
                diffViewerBackground: '#1e1e1e',
                addedBackground: 'rgba(46, 160, 67, 0.15)',
                addedGutterBackground: 'rgba(46, 160, 67, 0.25)',
                removedBackground: 'rgba(248, 81, 73, 0.15)',
                removedGutterBackground: 'rgba(248, 81, 73, 0.25)',
                wordAddedBackground: 'rgba(46, 160, 67, 0.35)',
                wordRemovedBackground: 'rgba(248, 81, 73, 0.35)',
              },
              contentText: {
                fontSize: '13px',
                lineHeight: '20px'
              }
            }}
          />
        )}
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={() => downloadSingleFile(activeOutput)}>
          <i className="fa-solid fa-download"></i> Download File
        </button>
        <button className="secondary-button" onClick={() => navigator.clipboard.writeText(activeOutput.content)}>
          <i className="fa-regular fa-copy"></i> Copy to Clipboard
        </button>
      </div>
    </div>
  );
});
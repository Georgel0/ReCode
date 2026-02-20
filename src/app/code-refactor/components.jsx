import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { REFACTOR_MODES } from './utils';

export const FileTabs = ({ files, activeTabId, setActiveTabId, removeFile }) => (
  <nav role="tablist" className="tabs-container" aria-label="Open files">
    {files.map(file => (
      <div 
        key={file.id} 
        role="tab"
        aria-selected={activeTabId === file.id}
        tabIndex={0}
        className={`tab-btn ${activeTabId === file.id ? 'active' : ''}`} 
        onClick={() => setActiveTabId(file.id)}
        onKeyDown={(e) => e.key === 'Enter' && setActiveTabId(file.id)}
      >
        <i className="fa-solid fa-file-code"></i>
        <span className="tab-name">{file.name || 'untitled'}</span>
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

export const OutputPanel = ({ activeSourceFile, outputFiles, viewMode, setViewMode, downloadSingleFile }) => {
  const activeOutput = outputFiles.find(out => out.sourceId === activeSourceFile?.id);
  
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

      <div className={`highlighter-wrapper ${viewMode === 'split' ? 'split-view' : ''}`}>
        {viewMode === 'split' && (
          <div className="split-pane original-pane">
            <div className="pane-header"><i className="fa-solid fa-clock-rotate-left"></i> Original</div>
            <SyntaxHighlighter language={activeSourceFile.language} style={vscDarkPlus} showLineNumbers>
              {activeSourceFile.content}
            </SyntaxHighlighter>
          </div>
        )}
        <div className="split-pane new-pane">
          {viewMode === 'split' && <div className="pane-header"><i className="fa-solid fa-wand-magic-sparkles"></i> Refactored</div>}
          <SyntaxHighlighter language={activeSourceFile.language} style={vscDarkPlus} showLineNumbers>
            {activeOutput.content}
          </SyntaxHighlighter>
        </div>
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
};
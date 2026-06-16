'use client';

import { ModuleHeader } from '@/components/layout';
import { CodeEditor } from '@/components/ui';
import { LANGUAGES } from '@/lib';
import { useCodeRefactor } from './useCodeRefactor';
import { FileTabs, RefactorControls, OutputPanel, ProjectContextInput } from './components';
import './codeRefactor.css';

export default function CodeRefactor() {
  const {
    files, activeFile, activeTabId, setActiveTabId,
    outputFiles, activeOutputFile, targetLang, lastResult,
    loadingStage, isLoading, hasContent, refactorMode, setRefactorMode,
    suggestedMode, viewMode, setViewMode, errorMsg, storageWarning,
    projectContext, setProjectContext, handleClearAll,
    fileInputRef, handleRefactor, handleLanguageChange, handleFileUpload,
    updateFile, removeFile, handleAddFile, downloadSingleFile, downloadZip,
  } = useCodeRefactor();

  return (
    <div className="r-module-container">
      <ModuleHeader
        title="AI Code Refactor"
        description="Optimize, clean, or document your project files with context-aware AI."
        resultData={lastResult}
      />

      {errorMsg && (
        <div className="r-banner r-error" role="alert">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {errorMsg}
        </div>
      )}
      {storageWarning && (
        <div className="r-banner r-warning" role="alert">
          <i className="fa-solid fa-hard-drive" aria-hidden="true" />
          Storage is full. Drafts will not be saved.
        </div>
      )}

      <div className="r-converter-grid">
        <div className="r-panel">
          <div className="r-panel-header">
            <h3>Source Files</h3>
            <div className="r-header-actions">
              <button className="secondary-button" onClick={() => fileInputRef.current.click()} title="Upload File">
                <i className="fas fa-upload" />
              </button>
              <button className="secondary-button" onClick={handleAddFile} title="Add Tab">
                <i className="fas fa-plus" />
              </button>
              <button className="secondary-button r-clear-all-btn" onClick={handleClearAll} title="Clear Workspace">
                <i className="fas fa-trash" />
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              hidden
              aria-hidden="true"
            />
          </div>

          <div className="r-lang-row">
            <label htmlFor="r-lang-select">Language</label>
            <select
              id="r-lang-select"
              value={activeFile?.language || 'javascript'}
              onChange={(e) => handleLanguageChange(activeTabId, e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <RefactorControls
            refactorMode={refactorMode}
            setRefactorMode={setRefactorMode}
            suggestedMode={suggestedMode}
          />

          <ProjectContextInput
            value={projectContext}
            onChange={setProjectContext}
          />

          <FileTabs
            files={files}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            removeFile={removeFile}
          />

          <div className="r-editor-wrap">
            <CodeEditor
              value={activeFile?.content || ''}
              onValueChange={(code) => updateFile(activeTabId, code)}
              language={activeFile?.language || 'javascript'}
            />
          </div>

          <div className="r-refactor-action">
            <button
              className="primary-button r-full-width"
              onClick={handleRefactor}
              disabled={isLoading || !hasContent}
            >
              <i
                className={isLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-wand-magic-sparkles'}
                aria-hidden="true"
              />
              {isLoading ? 'Processing…' : 'Refactor Project'}
            </button>
          </div>
        </div>

        <div className="r-panel">
          <div className="r-panel-header">
            <h3>
              <i className="fa-solid fa-square-check" aria-hidden="true" />
              Refactored Result
            </h3>
            {outputFiles.length > 0 && (
              <div className="r-header-actions">
                <button className="secondary-button" onClick={downloadZip} title="Download ZIP">
                  <i className="fa-solid fa-file-zipper" aria-hidden="true" /> ZIP
                </button>
                <button className="secondary-button" onClick={() => downloadSingleFile(activeOutputFile)} title="Download File">
                  <i className="fa-solid fa-download" aria-hidden="true" /> File
                </button>
              </div>
            )}
          </div>

          <OutputPanel
            activeFile={activeFile}
            activeOutputFile={activeOutputFile}
            targetLang={targetLang}
            outputFiles={outputFiles}
            viewMode={viewMode}
            setViewMode={setViewMode}
            loadingStage={loadingStage}
            downloadSingleFile={downloadSingleFile}
          />
        </div>
      </div>
    </div>
  );
}
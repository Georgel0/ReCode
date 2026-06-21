'use client';

import { useState } from 'react';
import { ModuleHeader } from '@/components/layout';
import { CodeEditor } from '@/components/ui';
import { useSyncScroll } from '@/components/effects';
import { DiffView } from '@/components/widgets';
import { LANGUAGES } from '@/lib';
import { useCodeRefactor } from './useCodeRefactor';
import { FileTabs, OutputFileTabs, RefactorControls, OutputPanel, ProjectContextInput, ChangeSummary, Suggestions } from './components';
import './codeRefactor.css';

export default function CodeRefactor() {
  const {
    files, activeFile, activeTabId, setActiveTabId,
    outputFiles, activeOutputFile, targetLang, lastResult,
    loadingStage, isLoading, hasContent, refactorMode, setRefactorMode,
    suggestedMode, errorMsg,
    projectContext, setProjectContext, handleClearAll,
    fileInputRef, handleRefactor, handleLanguageChange, handleFileUpload,
    updateFile, removeFile, handleAddFile, downloadSingleFile, downloadZip,
    renameFile,
  } = useCodeRefactor();

  const { sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll } =
    useSyncScroll({ deps: [outputFiles, activeTabId] });

  const [isDiffExpanded, setIsDiffExpanded] = useState(false);

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

      <div className="r-config-bar">
        <div className="r-config-cluster">
          <div className="r-lang-pill">
            <label htmlFor="r-lang-select" className="r-lang-label">
              <i className="fa-solid fa-code" aria-hidden="true" />
              Language
            </label>
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

          <button
            className="primary-button r-refactor-btn"
            onClick={handleRefactor}
            disabled={isLoading || !hasContent}
          >
            <i
              className={isLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-wand-magic-sparkles'}
              aria-hidden="true"
            />
            {isLoading ? 'Processing…' : 'Refactor'}
          </button>
        </div>

        <div className="r-config-divider" aria-hidden="true" />

        <RefactorControls
          refactorMode={refactorMode}
          setRefactorMode={setRefactorMode}
          suggestedMode={suggestedMode}
        />

        <div className="r-config-cluster">
          <ProjectContextInput
            value={projectContext}
            onChange={setProjectContext}
          />
          <button
            className={`secondary-button r-sync-btn ${syncScroll ? ' btn-active' : ''}`}
            onClick={() => setSyncScroll(s => !s)}
            title="Toggle Sync Scroll"
          >
            <i className={`fa-solid ${syncScroll ? 'fa-link' : 'fa-link-slash'}`} />
          </button>
        </div>
      </div>

      <div className="r-converter-grid">
        <div className="r-panel">
          <div className="r-panel-header">
            <h3 className="r-header-title">
              <i className="fas fa-file-code" aria-hidden="true" /> Source Files
            </h3>
            <div className="r-header-actions">
              <button className="secondary-button" onClick={() => fileInputRef.current.click()} title="Upload File">
                <i className="fas fa-upload" />
              </button>
              <button className="secondary-button" onClick={handleAddFile} title="Add Tab">
                <i className="fas fa-plus" />
              </button>
              <button className="secondary-button btn-danger" onClick={handleClearAll} title="Clear Workspace">
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

          <FileTabs
            files={files}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            removeFile={removeFile}
            renameFile={renameFile}
          />

          <div className="r-editor-wrap" ref={sourceScrollRef}>
            <CodeEditor
              value={activeFile?.content || ''}
              onValueChange={(code) => updateFile(activeTabId, code)}
              language={activeFile?.language || 'javascript'}
            />
          </div>
        </div>

        <div className="r-panel">
          <div className="r-panel-header">
            <h3 className="r-header-title">
              <i className="fa-solid fa-square-check" aria-hidden="true" /> Refactored Result
            </h3>
            {activeOutputFile && (
              <div className="r-header-actions">
                <button className="secondary-button" onClick={downloadZip} title="Download ZIP">
                  <i className="fa-solid fa-file-zipper" aria-hidden="true" />
                </button>
                <button className="secondary-button" onClick={() => downloadSingleFile(activeOutputFile)} title="Download File">
                  <i className="fa-solid fa-download" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <OutputFileTabs
            outputFiles={outputFiles}
            inputFiles={files}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
          />

          <OutputPanel
            activeFile={activeFile}
            activeOutputFile={activeOutputFile}
            targetLang={targetLang}
            outputFiles={outputFiles}
            loadingStage={loadingStage}
            downloadSingleFile={downloadSingleFile}
            targetScrollRef={targetScrollRef}
          />
        </div>
      </div>

      <div className="r-footer">
        {activeOutputFile && (
          <div className="r-footer-changes">
            <ChangeSummary outputFile={activeOutputFile} />
            <Suggestions outputFile={activeOutputFile} />
          </div>
        )}

        {outputFiles.length > 0 && activeOutputFile && (
          <div className="r-footer-diff">
            <button
              className={`secondary-button r-diff-expand-btn ${isDiffExpanded ? 'r-diff-active-state' : ''}`}
              onClick={() => setIsDiffExpanded(!isDiffExpanded)}
            >
              <i className={`fa-solid ${isDiffExpanded ? 'fa-angles-up' : 'fa-code-compare'}`} aria-hidden="true" />
              {isDiffExpanded ? 'Hide Diff' : 'Show Diff'}
            </button>

            {isDiffExpanded && (
              <div className="r-fullwidth-diff-panel">
                <div className="r-diff-panel-title">
                  <i className="fa-solid fa-code-compare" aria-hidden="true" />
                  Changes (Diff View)
                </div>
                <div className="r-diff-container">
                  <DiffView
                    sourceContent={activeFile?.content || ''}
                    targetContent={activeOutputFile?.content || ''}
                    sourceLang={activeFile?.language || 'plaintext'}
                    targetLang={targetLang}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
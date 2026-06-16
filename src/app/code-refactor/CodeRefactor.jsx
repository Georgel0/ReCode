'use client';

import { useState } from 'react';
import { ModuleHeader } from '@/components/layout';
import { CodeEditor } from '@/components/ui';
import { DiffView } from '@/components/widgets';
import { LANGUAGES } from '@/lib';
import { useCodeRefactor } from './useCodeRefactor';
import { FileTabs, RefactorControls, OutputPanel, ProjectContextInput } from './components';
import './codeRefactor.css';

export default function CodeRefactor() {
  const {
    files, activeFile, activeTabId, setActiveTabId,
    outputFiles, activeOutputFile, targetLang, lastResult,
    loadingStage, isLoading, hasContent, refactorMode, setRefactorMode,
    suggestedMode, errorMsg, storageWarning,
    projectContext, setProjectContext, handleClearAll,
    fileInputRef, handleRefactor, handleLanguageChange, handleFileUpload,
    updateFile, removeFile, handleAddFile, downloadSingleFile, downloadZip,
  } = useCodeRefactor();

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
      {storageWarning && (
        <div className="r-banner r-warning" role="alert">
          <i className="fa-solid fa-hard-drive" aria-hidden="true" />
          Storage is full. Drafts will not be saved.
        </div>
      )}

      {/* Modern Dashboard Options Header */}
      <div className="r-dashboard-config-card">
        <div className="r-config-left-group">
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
          <ProjectContextInput
            value={projectContext}
            onChange={setProjectContext}
          />
        </div>
        <div className="r-config-right-group">
          <RefactorControls
            refactorMode={refactorMode}
            setRefactorMode={setRefactorMode}
            suggestedMode={suggestedMode}
          />
        </div>
      </div>

      {/* Main Multi-File Code Editor & Code Output Layout Grid */}
      <div className="r-converter-grid">
        {/* Workspace Input Block */}
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

        {/* Workspace Output Block */}
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
            loadingStage={loadingStage}
            downloadSingleFile={downloadSingleFile}
          />
        </div>
      </div>

      {/* Rearranged Full Width Toggleable Diff Component Node */}
      {outputFiles.length > 0 && activeOutputFile && (
        <div className="r-diff-toggle-container">
          <button 
            className={`secondary-button r-diff-expand-btn ${isDiffExpanded ? 'r-diff-active-state' : ''}`}
            onClick={() => setIsDiffExpanded(!isDiffExpanded)}
          >
            <i className={`fa-solid ${isDiffExpanded ? 'fa-angles-up' : 'fa-code-compare'}`} aria-hidden="true" />
            {isDiffExpanded ? 'Hide Visual Diff Comparison' : 'Show Visual Diff Comparison'}
          </button>

          {isDiffExpanded && (
            <div className="r-fullwidth-diff-panel">
              <div className="r-diff-panel-title">
                <i className="fa-solid fa-code-compare" aria-hidden="true" />
                Line-by-Line Changes (Diff View)
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
  );
}
'use client';

import { ModuleHeader } from '@/components/layout';
import { CodeEditor } from '@/components/ui';
import { LANGUAGES } from '@/lib';
import { useCodeRefactor } from './useCodeRefactor';
import { FileTabs, RefactorControls, OutputPanel } from './components';
import './codeRefactor.css';

export default function CodeRefactor() {
  const {
    files, activeFile, activeTabId, setActiveTabId,
    outputFiles, activeOutputFile, targetLang, lastResult,
    loadingStage, isLoading, hasContent, refactorMode, setRefactorMode,
    suggestedMode, viewMode, setViewMode, errorMsg, storageWarning,
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
              <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
                <i className="fa-solid fa-upload" aria-hidden="true" /> Upload
              </button>
              <button className="secondary-button" onClick={handleAddFile}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add File
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
                <button className="secondary-button" onClick={downloadZip}>
                  <i className="fa-solid fa-file-zipper" aria-hidden="true" /> Download ZIP
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
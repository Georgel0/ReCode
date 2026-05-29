'use client';

import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor, CodeOutput, ConfirmModal, CodeAnalysisInfoIcon } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { ConverterTabs } from './ConverterTabs';
import { useCodeConverter } from './useCodeConverter';
import './CodeConverter.css';

const FRAMEWORKS = [
  { value: 'none', label: 'Vanilla' },
  { value: 'react', label: 'React' },
  { value: 'angular', label: 'Angular' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'express', label: 'Express.js' },
  { value: 'fastify', label: 'Fastify' }
];

export default function CodeConverter() {
  const {
    files, setFiles, outputFiles, activeTabId, setActiveTabId, activeFile, activeOutputFile,
    targetLang, setTargetLang, targetFramework, setTargetFramework, isPartialMode, setIsPartialMode,
    loading, lintStatus, pendingDraft, fileInputRef, sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll,
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    handleScrollSync, handleConvert, runLinter, formatActiveCode, downloadZip, downloadSingleFile,
    handleConfirmDraft, handleCancelDraft
  } = useCodeConverter();

  return (
    <div className="module-container">
      <ModuleHeader
        title="Universal Code Converter"
        description="Translate entire files or partial blocks between languages and frameworks."
      />

      <div className="converter-control-bar">

        <div className="control-bar-group">
          <span className="control-bar-label">
            <CodeAnalysisInfoIcon />
            <i className="fa-solid fa-file-code"></i> Source
          </span>
          <select
            value={activeFile?.language || 'javascript'}
            onChange={(e) =>
              setFiles(prev =>
                prev.map(f => f.id === activeTabId ? { ...f, language: e.target.value } : f)
              )
            }
            className="lang-select"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="secondary-button btn-icon-only" onClick={() => formatActiveCode(false)} title="Format source">
            <i className="fa-solid fa-wand-magic"></i>
          </button>
        </div>

        <div className="control-bar-cta">
          <label className="custom-check">
            <input
              type="checkbox"
              checked={isPartialMode}
              onChange={(e) => setIsPartialMode(e.target.checked)}
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Block only</span>
          </label>

          <button
            className="primary-button convert-btn"
            onClick={handleConvert}
            disabled={loading || files.every(f => !f.content.trim())}
          >
            {loading
              ? <><i className="fa-solid fa-spinner fa-spin"></i> Converting…</>
              : <><i className="fa-solid fa-wand-magic-sparkles"></i> Convert <i className="fa-solid fa-arrow-right convert-arrow"></i></>
            }
          </button>
        </div>

        <div className="control-bar-group control-bar-group--right">
          <span className="control-bar-label">
            <i className="fa-solid fa-code-compare"></i> Target
          </span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="lang-select"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select
            value={targetFramework}
            onChange={(e) => setTargetFramework(e.target.value)}
            className="lang-select"
          >
            {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button
            className="secondary-button btn-icon-only"
            onClick={() => formatActiveCode(true)}
            disabled={!outputFiles.length}
            title="Format output"
          >
            <i className="fa-solid fa-wand-magic"></i>
          </button>
        </div>
      </div>

      <div className="converter-grid">

        <div className="panel">
          <div className="panel-header-row">
            <h3><i className="fa-solid fa-file-code"></i> Source Files</h3>
            <div className="header-actions">
              <button className="secondary-button btn-danger" onClick={handleClearAll}>
                <i className="fa-solid fa-trash-can"></i>
              </button>
              <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="secondary-button" onClick={handleAddFile}>
                <i className="fa-solid fa-plus"></i> Add
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              multiple
            />
          </div>

          <ConverterTabs
            files={files}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            removeFile={removeFile}
            renameFile={renameFile}
          />

          <div
            className="sync-scroll-container"
            ref={sourceScrollRef}
            onScroll={(e) => handleScrollSync(e, targetScrollRef)}
          >
            <CodeEditor
              value={activeFile?.content || ''}
              onValueChange={(code) => updateFile(activeTabId, code)}
              language={activeFile?.language || 'javascript'}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header-row">
            <h3><i className="fa-solid fa-code-compare"></i> Converted Output</h3>
            <div className="header-actions">
              {outputFiles.length > 0 && (
                <>
                  <button className="secondary-button" onClick={downloadSingleFile}>
                    <i className="fa-solid fa-file-arrow-down"></i> File
                  </button>
                  <button className="file-upload-btn download-btn" onClick={downloadZip}>
                    <i className="fa-solid fa-file-zipper"></i> ZIP
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="results-container">
            {outputFiles.length > 0 ? (
              <div className="code-output-container">
                <ConverterTabs
                  files={outputFiles.map(f => ({ id: f.sourceId, name: f.fileName }))}
                  activeTabId={activeTabId}
                  setActiveTabId={setActiveTabId}
                  removeFile={() => {}}
                  readOnly={true}
                />

                <div
                  className="sync-scroll-container output-wrapper"
                  ref={targetScrollRef}
                  onScroll={(e) => handleScrollSync(e, sourceScrollRef)}
                >
                  <CodeOutput
                    language={targetLang}
                    content={activeOutputFile?.content || '// File not found'}
                  />
                  <CopyButton codeToCopy={activeOutputFile?.content || ''} />
                </div>

                <div className="action-row between center-y converter-output-footer">
                  <div className="lint-controls">
                    <button
                      className="secondary-button"
                      onClick={runLinter}
                      disabled={lintStatus === 'linting'}
                    >
                      <i className={`fa-solid ${lintStatus === 'linting' ? 'fa-spinner fa-spin' : 'fa-stethoscope'}`}></i>
                      {' '}Check Syntax
                    </button>
                    {lintStatus === 'success' && (
                      <span className="lint-badge success">
                        <i className="fa-solid fa-check-circle"></i> Clean
                      </span>
                    )}
                    {lintStatus === 'error' && (
                      <span className="lint-badge error">
                        <i className="fa-solid fa-triangle-exclamation"></i> Warnings
                      </span>
                    )}
                  </div>

                  <label className="custom-check">
                    <input
                      type="checkbox"
                      checked={syncScroll}
                      onChange={(e) => setSyncScroll(e.target.checked)}
                    />
                    <div className="box"><i className="fa-solid fa-check"></i></div>
                    <span className="label-text">Sync Scroll</span>
                  </label>
                </div>
              </div>
            ) : (
              <EmptyState
                isLoading={loading}
                condition={outputFiles.length === 0}
                icon="fas fa-sync-alt"
                title="Awaiting Code Translation"
                description="Your converted files will appear here after choosing a target environment and triggering the cross-compiler."
                hint={<>Enable <code>Sync Scroll</code> to perform precise side-by-side verification of source logic blocks.</>}
                loadingTitle="Rebuilding AST"
                loadingDescription="Parsing original language nodes, converting syntax structures, and preparing output streams..."
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!pendingDraft}
        title="Continue Previous Session?"
        message="You have unsaved files. Restore them?"
        confirmText="Restore Files"
        cancelText="Discard"
        onConfirm={handleConfirmDraft}
        onCancel={handleCancelDraft}
      />
    </div>
  );
}
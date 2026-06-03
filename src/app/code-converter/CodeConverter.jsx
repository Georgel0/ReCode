'use client';

import { useState } from 'react';
import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor, CodeOutput, ConfirmModal, CodeAnalysisInfoIcon } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { ConverterTabs } from './ConverterTabs';
import { useCodeConverter } from './useCodeConverter';
import { buildDiffRows, DiffView, ConversionNotesPanel, HistoryPanel, LineSelector } from './components';

import './styles/CodeConverter.layout.css';
import './styles/CodeConverter.widgets.css';

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
    selectedRange, setSelectedRange,
    loading, lintStatus, pendingDraft, fileInputRef, sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll,
    diffMode, setDiffMode,
    conversionNotes, notesOpen, setNotesOpen,
    feedbackText, setFeedbackText, handleReconvert,
    conversionHistory, historyPanelOpen, setHistoryPanelOpen, restoreHistoryEntry,
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    handleScrollSync, handleConvert, runLinter, formatActiveCode, downloadZip, downloadSingleFile,
    handleConfirmDraft, handleCancelDraft
  } = useCodeConverter();

  const [selectionMode, setSelectionMode] = useState(false);
  const hasOutput = outputFiles.length > 0;

  return (
    <div className="c-module">
      <ModuleHeader
        title="Universal Code Converter"
        description="Translate entire files or partial blocks between languages and frameworks."
      />

      <div className="c-control-bar">
        <div className="c-control-bar__group">
          <span className="c-control-bar__label">
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
            className="c-lang-select"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="secondary-button c-btn-icon" onClick={() => formatActiveCode(false)} title="Format source">
            <i className="fa-solid fa-wand-magic"></i>
          </button>
        </div>

        <div className="c-control-bar__cta">
          <label className="custom-check" title="Convert only highlighted lines">
            <input
              type="checkbox"
              checked={isPartialMode}
              onChange={(e) => {
                setIsPartialMode(e.target.checked);
                if (!e.target.checked) { setSelectedRange(null); setSelectionMode(false); }
                else setSelectionMode(true);
              }}
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Block only</span>
          </label>

          <button
            className="primary-button c-convert-btn"
            onClick={() => handleConvert()}
            disabled={loading || files.every(f => !f.content.trim())}
          >
            {loading
              ? <><i className="fa-solid fa-spinner fa-spin"></i> Converting…</>
              : <><i className="fa-solid fa-wand-magic-sparkles"></i> Convert <i className="fa-solid fa-arrow-right c-convert-btn__arrow"></i></>
            }
          </button>
        </div>

        <div className="c-control-bar__group c-control-bar__group--right">
          <span className="c-control-bar__label">
            <i className="fa-solid fa-code-compare"></i> Target
          </span>
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="c-lang-select">
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select value={targetFramework} onChange={(e) => setTargetFramework(e.target.value)} className="c-lang-select">
            {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button
            className="secondary-button c-btn-icon"
            onClick={() => formatActiveCode(true)}
            disabled={!hasOutput}
            title="Format output"
          >
            <i className="fa-solid fa-wand-magic"></i>
          </button>
          {hasOutput && (
            <button
              className={`secondary-button c-btn-icon${diffMode ? ' c-btn-active' : ''}`}
              onClick={() => setDiffMode(d => !d)}
              title="Toggle diff view"
            >
              <i className="fa-solid fa-code-branch"></i>
            </button>
          )}
        </div>
      </div>

      <div className="c-grid">

        <div className="c-panel">
          <div className="c-panel__header">
            <h3 className="c-panel__title"><i className="fa-solid fa-file-code"></i> Source Files</h3>
            <div className="c-panel__actions">
              <button className="secondary-button c-btn-icon c-btn-danger" onClick={handleClearAll}>
                <i className="fa-solid fa-trash-can"></i>
              </button>
              <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="secondary-button" onClick={handleAddFile}>
                <i className="fa-solid fa-plus"></i> Add
              </button>
            </div>
            <input type="file" ref={fileInputRef} className="c-file-input-hidden" onChange={handleFileUpload} multiple />
          </div>

          <ConverterTabs
            files={files}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
            removeFile={removeFile}
            renameFile={renameFile}
          />

          <div className="c-panel__body">
            {isPartialMode && selectionMode ? (
              <div className="c-scroll c-scroll--selection">
                <div className="c-selection-hint">
                  <i className="fa-solid fa-hand-pointer"></i> Drag to select lines for partial conversion
                  {selectedRange && (
                    <span className="c-selection-badge">
                      Lines {selectedRange.start + 1}–{selectedRange.end + 1}
                      <button className="c-selection-clear" onClick={() => setSelectedRange(null)}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  )}
                </div>
                <LineSelector
                  content={activeFile?.content || ''}
                  selectedRange={selectedRange}
                  onRangeChange={setSelectedRange}
                />
              </div>
            ) : (
              <div
                className="c-scroll"
                ref={sourceScrollRef}
                onScroll={(e) => handleScrollSync(e, targetScrollRef)}
              >
                <CodeEditor
                  value={activeFile?.content || ''}
                  onValueChange={(code) => updateFile(activeTabId, code)}
                  language={activeFile?.language || 'javascript'}
                />
              </div>
            )}
          </div>
        </div>

        <div className="c-panel">
          <div className="c-panel__header">
            <h3 className="c-panel__title"><i className="fa-solid fa-code-compare"></i> Converted Output</h3>
            <div className="c-panel__actions">
              {hasOutput && (
                <>
                  <button className="secondary-button" onClick={downloadSingleFile}>
                    <i className="fa-solid fa-file-arrow-down"></i> File
                  </button>
                  <button className="secondary-button" onClick={downloadZip}>
                    <i className="fa-solid fa-file-zipper"></i> ZIP
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="c-panel__body">
            {hasOutput ? (
              <div className="c-output">
                <ConverterTabs
                  files={outputFiles.map(f => ({ id: f.sourceId, name: f.fileName }))}
                  activeTabId={activeTabId}
                  setActiveTabId={setActiveTabId}
                  removeFile={() => {}}
                  readOnly={true}
                />

                <div className="c-output__inner">
                  <div
                    className="c-output__scroll"
                    ref={targetScrollRef}
                    onScroll={(e) => handleScrollSync(e, sourceScrollRef)}
                  >
                    <CodeOutput
                      language={targetLang}
                      content={activeOutputFile?.content || '// File not found'}
                    />
                  </div>
                  <CopyButton codeToCopy={activeOutputFile?.content || ''} />
                </div>

                <div className="c-output-footer">
                  <div className="c-lint">
                    <button
                      className="secondary-button"
                      onClick={runLinter}
                      disabled={lintStatus === 'linting'}
                    >
                      <i className={`fa-solid ${lintStatus === 'linting' ? 'fa-spinner fa-spin' : 'fa-stethoscope'}`}></i>
                      {' '}Check Syntax
                    </button>
                    {lintStatus === 'success' && (
                      <span className="c-lint__badge c-lint__badge--ok">
                        <i className="fa-solid fa-check-circle"></i> Clean
                      </span>
                    )}
                    {lintStatus === 'error' && (
                      <span className="c-lint__badge c-lint__badge--error">
                        <i className="fa-solid fa-triangle-exclamation"></i> Warnings
                      </span>
                    )}
                  </div>

                  <label className="custom-check c-sync-check">
                    <input
                      type="checkbox"
                      checked={syncScroll}
                      onChange={(e) => setSyncScroll(e.target.checked)}
                    />
                    <div className="box"><i className="fa-solid fa-check"></i></div>
                    <span className="label-text">Sync Scroll</span>
                  </label>
                </div>

                <ConversionNotesPanel
                  notes={conversionNotes}
                  activeTabId={activeTabId}
                  open={notesOpen}
                  onToggle={() => setNotesOpen(o => !o)}
                />

                <HistoryPanel
                  history={conversionHistory}
                  activeTabId={activeTabId}
                  open={historyPanelOpen}
                  onToggle={() => setHistoryPanelOpen(o => !o)}
                  onRestore={restoreHistoryEntry}
                />

                <div className="c-reconvert">
                  <div className="c-reconvert__header">
                    <i className="fa-solid fa-rotate"></i>
                    <span>Refine Conversion</span>
                  </div>
                  <div className="c-reconvert__row">
                    <input
                      className="c-reconvert__input"
                      type="text"
                      placeholder='e.g. "Use aiofiles instead of sync IO" or "rename snake_case to camelCase"'
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleReconvert()}
                    />
                    <button
                      className="primary-button c-reconvert__btn"
                      onClick={handleReconvert}
                      disabled={loading || !feedbackText.trim()}
                    >
                      {loading
                        ? <i className="fa-solid fa-spinner fa-spin"></i>
                        : <><i className="fa-solid fa-rotate"></i> Retry</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="c-output-empty">
                <EmptyState
                  isLoading={loading}
                  condition={!hasOutput}
                  icon="fas fa-sync-alt"
                  title="Awaiting Code Translation"
                  description="Your converted files will appear here after choosing a target environment and triggering the cross-compiler."
                  hint={<>Enable <code>Block only</code> + click lines to select a partial range. Enable <code>Sync Scroll</code> for side-by-side verification.</>}
                  loadingTitle="Rebuilding AST"
                  loadingDescription="Parsing language nodes, converting syntax structures, and preparing output streams..."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {diffMode && hasOutput && (
        <div className="c-diff-panel">
          <div className="c-diff-panel__header">
            <span><i className="fa-solid fa-code-branch"></i> Diff View — {activeFile?.name} → {activeOutputFile?.fileName || 'output'}</span>
            <button className="secondary-button c-btn-icon" onClick={() => setDiffMode(false)} title="Close diff">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <DiffView
            sourceContent={activeFile?.content || ''}
            targetContent={activeOutputFile?.content || ''}
            targetLang={targetLang}
          />
        </div>
      )}

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
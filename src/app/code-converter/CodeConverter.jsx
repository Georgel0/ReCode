'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor, CodeOutput } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { DiffView, FormatButton, SyntaxCheckerPanel, ToastStack, CodeAnalysisInfoIcon } from '@/components/widgets';
import { useSyncScroll } from '@/components/effects';
import { useApp } from '@/context';
import { ConverterTabs } from './ConverterTabs';
import { useCodeConverter } from './useCodeConverter';
import { ConversionNotesPanel, HistoryPanel, LineSelector } from './components';

import './styles/CodeConverter.layout.css';
import './styles/CodeConverter.widgets.css';

const FRAMEWORKS = [
  { value: 'none', label: 'Vanilla' },
  { value: 'react', label: 'React' },
  { value: 'angular', label: 'Angular' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'express', label: 'Express.js' },
  { value: 'fastify', label: 'Fastify' },
];

export default function CodeConverter() {
  const { setModuleData } = useApp();
  const router = useRouter();

  const {
    // file state
    files, setFiles, outputFiles, activeTabId, setActiveTabId, activeFile, activeOutputFile,
    // conversion settings
    targetLang, setTargetLang, targetFramework, setTargetFramework,
    isPartialMode, setIsPartialMode, selectedRange, setSelectedRange,
    // async flags
    loading, formatting, linting,
    // lint / toast state
    lintResult, toasts, dismissToast,
    // refs
    fileInputRef,
    // ui toggles
    diffMode, setDiffMode,
    conversionNotes, notesOpen, setNotesOpen,
    feedbackText, setFeedbackText,
    conversionHistory, historyPanelOpen, setHistoryPanelOpen,
    // file actions
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    // conversion actions
    handleConvert, handleReconvert,
    // lint / format actions
    runLinter, formatActiveCode,
    // history actions
    restoreHistoryEntry, removeHistoryEntry,
    // download actions
    downloadZip, downloadSingleFile,
  } = useCodeConverter();

  const { sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll } =
    useSyncScroll({ deps: [outputFiles, activeTabId] });

  const [selectionMode, setSelectionMode] = useState(false);
  const hasOutput = outputFiles.length > 0;

  const lastResult = useMemo(() => hasOutput
    ? {
      type: 'converter',
      input: files,
      sourceLang: activeFile?.language || null,
      targetLang,
      output: { outputFiles, targetLang, targetFramework, conversionNotes },
    }
    : null,
    [hasOutput, files, activeFile?.language, targetLang, outputFiles, targetFramework, conversionNotes]
  );

  const handleSendToAnalysis = () => {
    if (!activeFile?.content) return;
    setModuleData({
      type: 'analysis',
      input: activeOutputFile?.content || activeFile.content,
      sourceModule: 'converter',
    });
    router.push('/code-analysis');
  };

  const handleSendToRefactor = () => {
    if (!activeOutputFile?.content) return;
    const ext = LANGUAGES.find(l => l.value === targetLang)?.ext || '.txt';
    setModuleData({
      type: 'refactor',
      input: outputFiles.map(f => ({
        id: f.sourceId,
        name: f.fileName || `converted${ext}`,
        language: targetLang,
        content: f.content,
      })),
      sourceModule: 'converter',
    });
    router.push('/code-refactor');
  };

  return (
    <div className="c-module">
      <ModuleHeader
        title="Code Converter"
        description="Translate source files across languages and frameworks, with diff view, partial conversion, and syntax checking."
        resultData={lastResult}
      />

      <div className="c-control-bar top-actions-bar">
        <div className="c-control-bar__group">
          <span className="c-control-bar__label">
            <CodeAnalysisInfoIcon />
            <i className="fa-solid fa-file-code"></i> Source
          </span>
          <select
            value={activeFile?.language || 'javascript'}
            onChange={(e) =>
              setFiles(prev => prev.map(f => f.id === activeTabId ? { ...f, language: e.target.value } : f))
            }
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
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
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select value={targetFramework} onChange={(e) => setTargetFramework(e.target.value)}>
            {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          {hasOutput && (
            <button
              className={`secondary-button c-btn-icon${diffMode ? ' btn-active' : ''}`}
              onClick={() => setDiffMode(d => !d)}
              title="Toggle diff view"
            >
              <i className="fa-solid fa-code-branch"></i>
            </button>
          )}

          {hasOutput && (
            <button
              className={`secondary-button c-btn-icon${syncScroll ? ' btn-active' : ''} sync-btn`}
              onClick={() => setSyncScroll(s => !s)}
              title="Toggle Sync Scroll"
            >
              <i className={`fa-solid ${syncScroll ? 'fa-link' : 'fa-link-slash'}`}></i>
            </button>
          )}
        </div>
      </div>

      <div className="c-grid">
        <div className="c-panel">
          <div className="c-panel__header">
            <h3 className="c-panel__title"><i className="fas fa-file-code"></i> Source Files</h3>
            <div className="c-panel__actions">
              <button className="secondary-button btn-danger" onClick={handleClearAll} title="Clear Workspace">
                <i className="fa-solid fa-trash-can"></i>
              </button>
              <button className="secondary-button" onClick={() => fileInputRef.current.click()} title="Upload File">
                <i className="fa-solid fa-cloud-arrow-up"></i> <span className="c-text-to-hide">Upload</span>
              </button>
              <button className="secondary-button" onClick={handleAddFile} title="Add File Tab">
                <i className="fa-solid fa-plus"></i> <span className="c-text-to-hide">Add</span>
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
              <div className="c-scroll" ref={sourceScrollRef}>
                <CodeEditor
                  value={activeFile?.content || ''}
                  onValueChange={(code) => updateFile(activeTabId, code)}
                  language={activeFile?.language || 'javascript'}
                  onSubmit={handleConvert}
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
                  <button
                    className="secondary-button"
                    onClick={handleSendToAnalysis}
                    title="Audit converted output in Code Analysis"
                  >
                    <i className="fa-solid fa-magnifying-glass-chart"></i> <span className="c-text-to-hide">Audit</span>
                  </button>
                  <button
                    className="secondary-button"
                    onClick={handleSendToRefactor}
                    title="Refactor converted output"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> <span className="c-text-to-hide">Refactor</span>
                  </button>
                  <button className="secondary-button" onClick={downloadSingleFile} title="Download File">
                    <i className="fa-solid fa-file-arrow-down"></i> <span className="c-text-to-hide">File</span>
                  </button>
                  <button className="secondary-button" onClick={downloadZip} title="Download ZIP">
                    <i className="fa-solid fa-file-zipper"></i> <span className="c-text-to-hide">ZIP</span>
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
                  removeFile={() => { }}
                  readOnly={true}
                />
                <div className="c-output__inner">
                  <div className="c-output__scroll" ref={targetScrollRef}>
                    <CodeOutput
                      language={targetLang}
                      content={activeOutputFile?.content || '// File not found'}
                    />
                  </div>
                  <CopyButton codeToCopy={activeOutputFile?.content || ''} />
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

      <ToastStack toasts={toasts} dismissToast={dismissToast} />

      {hasOutput && (
        <div className="c-module-footer">
          <div className="c-module-footer__top-row">
            <FormatButton
              onClick={() => formatActiveCode(false)}
              disabled={formatting || !activeFile?.content?.trim()}
              formatting={formatting}
            />

            <SyntaxCheckerPanel
              runLinter={runLinter}
              linting={linting}
              lintResult={lintResult}
            />
          </div>

          <div className="c-module-footer__bottom-row">
            <div className="footer__sub-bottom-row">
              <HistoryPanel
                history={conversionHistory}
                activeTabId={activeTabId}
                open={historyPanelOpen}
                onToggle={() => setHistoryPanelOpen(o => !o)}
                onRestore={restoreHistoryEntry}
                onRemove={removeHistoryEntry}
              />
              <ConversionNotesPanel
                notes={conversionNotes}
                activeTabId={activeTabId}
                open={notesOpen}
                onToggle={() => setNotesOpen(o => !o)}
              />
            </div>

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
        </div>
      )}

      {diffMode && hasOutput && (
        <div className="c-diff-panel">
          <div className="c-diff-panel__header">
            <span>
              <i className="fa-solid fa-code-branch"></i> Diff View — {activeFile?.name} → {activeOutputFile?.fileName || 'output'}
            </span>
            <button className="secondary-button c-btn-icon" onClick={() => setDiffMode(false)} title="Close diff">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <DiffView
            sourceContent={activeFile?.content || ''}
            targetContent={activeOutputFile?.content || ''}
            sourceLang={activeFile?.language || 'plaintext'}
            targetLang={targetLang}
          />
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor, CodeOutput } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { DiffView, FormatButton, SyntaxCheckerPanel, ToastStack, CodeAnalysisInfoIcon, CodeHighlightAnalyzer } from '@/components/widgets';
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

  const convert = useCodeConverter();

  const { sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll } =
    useSyncScroll({ deps: [convert.outputFiles, convert.activeTabId] });

  const [selectionMode, setSelectionMode] = useState(false);
  const hasOutput = convert.outputFiles.length > 0;

  const lastResult = useMemo(() => hasOutput
    ? {
      type: 'converter',
      input: convert.files,
      sourceLang: convert.activeFile?.language || null,
      targetLang: convert.targetLang,
      output: { 
        outputFiles: convert.outputFiles, 
        targetLang: convert.targetLang, 
        targetFramework: convert.targetFramework, 
        conversionNotes: convert.conversionNotes 
      },
    }
    : null,
    [hasOutput, convert.files, convert.activeFile?.language, convert.targetLang, convert.outputFiles, convert.targetFramework, convert.conversionNotes]
  );

  const handleSendToAnalysis = useCallback(() => {
    if (!convert.activeFile?.content) return;
    setModuleData({
      type: 'analysis',
      input: convert.activeOutputFile?.content || convert.activeFile.content,
      sourceModule: 'converter',
    });
    router.push('/code-analysis');
  }, [convert.activeFile, convert.activeOutputFile, setModuleData, router]);

  const handleSendToRefactor = useCallback(() => {
    if (!convert.activeOutputFile?.content) return;
    const ext = LANGUAGES.find(l => l.value === convert.targetLang)?.ext || '.txt';
    setModuleData({
      type: 'refactor',
      input: convert.outputFiles.map(f => ({
        id: f.sourceId,
        name: f.fileName || `converted${ext}`,
        language: convert.targetLang,
        content: f.content,
      })),
      sourceModule: 'converter',
    });
    router.push('/code-refactor');
  }, [convert.activeOutputFile, convert.targetLang, convert.outputFiles, setModuleData, router]);

  return (
    <>
      <div className="module-container">
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
              value={convert.activeFile?.language || 'javascript'}
              onChange={(e) =>
                convert.setFiles(prev => prev.map(f => f.id === convert.activeTabId ? { ...f, language: e.target.value } : f))
              }
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="c-control-bar__cta">
            <label className="custom-check" title="Convert only highlighted lines">
              <input
                type="checkbox"
                checked={convert.isPartialMode}
                onChange={(e) => {
                  convert.setIsPartialMode(e.target.checked);
                  if (!e.target.checked) { convert.setSelectedRange(null); setSelectionMode(false); }
                  else setSelectionMode(true);
                }}
              />
              <div className="box"><i className="fa-solid fa-check"></i></div>
              <span className="label-text">Block only</span>
            </label>

            <button
              className="primary-button c-convert-btn"
              onClick={() => convert.handleConvert()}
              disabled={convert.loading || convert.files.every(f => !f.content.trim())}
            >
              {convert.loading
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Converting…</>
                : <><i className="fa-solid fa-wand-magic-sparkles"></i> Convert <i className="fa-solid fa-arrow-right c-convert-btn__arrow"></i></>
              }
            </button>
          </div>

          <div className="c-control-bar__group c-control-bar__group--right">
            <span className="c-control-bar__label">
              <i className="fa-solid fa-code-compare"></i> Target
            </span>
            <select value={convert.targetLang} onChange={(e) => convert.setTargetLang(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={convert.targetFramework} onChange={(e) => convert.setTargetFramework(e.target.value)}>
              {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            {hasOutput && (
              <button
                className={`secondary-button c-btn-icon${convert.diffMode ? ' btn-active' : ''}`}
                onClick={() => convert.setDiffMode(d => !d)}
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
                <button className="secondary-button btn-danger" onClick={convert.handleClearAll} title="Clear Workspace">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
                <button className="secondary-button" onClick={() => convert.fileInputRef.current.click()} title="Upload File">
                  <i className="fa-solid fa-cloud-arrow-up"></i> <span className="c-text-to-hide">Upload</span>
                </button>
                <button className="secondary-button" onClick={convert.handleAddFile} title="Add File Tab">
                  <i className="fa-solid fa-plus"></i> <span className="c-text-to-hide">Add</span>
                </button>
              </div>
              <input type="file" ref={convert.fileInputRef} className="c-file-input-hidden" onChange={convert.handleFileUpload} multiple />
            </div>

            <ConverterTabs
              files={convert.files}
              activeTabId={convert.activeTabId}
              setActiveTabId={convert.setActiveTabId}
              removeFile={convert.removeFile}
              renameFile={convert.renameFile}
            />

            <div className="c-panel__body">
              {convert.isPartialMode && selectionMode ? (
                <div className="c-scroll c-scroll--selection">
                  <div className="c-selection-hint">
                    <i className="fa-solid fa-hand-pointer"></i> Drag to select lines for partial conversion
                    {convert.selectedRange && (
                      <span className="c-selection-badge">
                        Lines {convert.selectedRange.start + 1}–{convert.selectedRange.end + 1}
                        <button className="c-selection-clear" onClick={() => convert.setSelectedRange(null)}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </span>
                    )}
                  </div>
                  <LineSelector
                    content={convert.activeFile?.content || ''}
                    selectedRange={convert.selectedRange}
                    onRangeChange={convert.setSelectedRange}
                  />
                </div>
              ) : (
                <div className="c-scroll" ref={sourceScrollRef}>
                  <CodeEditor
                    value={convert.activeFile?.content || ''}
                    onValueChange={(code) => convert.updateFile(convert.activeTabId, code)}
                    language={convert.activeFile?.language || 'javascript'}
                    onSubmit={convert.handleConvert}
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
                    <button className="secondary-button" onClick={convert.downloadSingleFile} title="Download File">
                      <i className="fa-solid fa-file-arrow-down"></i> <span className="c-text-to-hide">File</span>
                    </button>
                    <button className="secondary-button" onClick={convert.downloadZip} title="Download ZIP">
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
                    files={convert.outputFiles.map(f => ({ id: f.sourceId, name: f.fileName }))}
                    activeTabId={convert.activeTabId}
                    setActiveTabId={convert.setActiveTabId}
                    removeFile={() => { }}
                    readOnly={true}
                  />
                  <div className="c-output__inner">
                    <div className="c-output__scroll" ref={targetScrollRef}>
                      <CodeOutput
                        language={convert.targetLang}
                        content={convert.activeOutputFile?.content || '// File not found'}
                      />
                    </div>
                    <CopyButton codeToCopy={convert.activeOutputFile?.content || ''} />
                  </div>
                </div>
              ) : (
                <div className="c-output-empty">
                  <EmptyState
                    isLoading={convert.loading}
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

        <ToastStack toasts={convert.toasts} dismissToast={convert.dismissToast} />

        {hasOutput && (
          <div className="c-module-footer">
            <div className="c-module-footer__top-row">
              <FormatButton
                onClick={() => convert.formatActiveCode(false)}
                disabled={convert.formatting || !convert.activeFile?.content?.trim()}
                formatting={convert.formatting}
              />

              <SyntaxCheckerPanel
                runLinter={convert.runLinter}
                linting={convert.linting}
                lintResult={convert.lintResult}
              />
            </div>

            <div className="c-module-footer__bottom-row">
              <div className="footer__sub-bottom-row">
                <HistoryPanel
                  history={convert.conversionHistory}
                  activeTabId={convert.activeTabId}
                  open={convert.historyPanelOpen}
                  onToggle={() => convert.setHistoryPanelOpen(o => !o)}
                  onRestore={convert.restoreHistoryEntry}
                  onRemove={convert.removeHistoryEntry}
                />
                <ConversionNotesPanel
                  notes={convert.conversionNotes}
                  activeTabId={convert.activeTabId}
                  open={convert.notesOpen}
                  onToggle={() => convert.setNotesOpen(o => !o)}
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
                    value={convert.feedbackText}
                    onChange={(e) => convert.setFeedbackText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && convert.handleReconvert()}
                  />
                  <button
                    className="primary-button c-reconvert__btn"
                    onClick={convert.handleReconvert}
                    disabled={convert.loading || !convert.feedbackText.trim()}
                  >
                    {convert.loading
                      ? <i className="fa-solid fa-spinner fa-spin"></i>
                      : <><i className="fa-solid fa-rotate"></i> Retry</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {convert.diffMode && hasOutput && (
          <div className="c-diff-panel">
            <div className="c-diff-panel__header">
              <span>
                <i className="fa-solid fa-code-branch"></i> Diff View — {convert.activeFile?.name} → {convert.activeOutputFile?.fileName || 'output'}
              </span>
              <button className="secondary-button c-btn-icon" onClick={() => convert.setDiffMode(false)} title="Close diff">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <DiffView
              sourceContent={convert.activeFile?.content || ''}
              targetContent={convert.activeOutputFile?.content || ''}
              sourceLang={convert.activeFile?.language || 'plaintext'}
              targetLang={convert.targetLang}
            />
          </div>
        )}
      </div>

      <CodeHighlightAnalyzer />
    </>
  );
}
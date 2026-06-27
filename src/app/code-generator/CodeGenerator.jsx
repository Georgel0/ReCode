'use client';

import { useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useApp } from '@/context';
import { ModuleHeader } from '@/components/layout';
import { ConfirmModal } from '@/components/ui';
import { CodeAnalysisInfoIcon } from '@/components/widgets';
import ConfigTab from './ConfigTab';
import OutputPanel from './OutputPanel';
import PresetManager from './PresetManager';
import { useCodeGenerator } from './useCodeGenerator';
import './CodeGenerator.css';

export default function CodeGenerator() {
  const { moduleData } = useApp();

  const {
    input, setInput,
    files,
    activeFileIndex, setActiveFileIndex,
    config, setConfig,
    lastResult,
    loading,
    error,
    pendingDraft,
    handleGenerate,
    handleClearAll,
    handleConfirmDraft,
    handleCancelDraft,
  } = useCodeGenerator();

  useEffect(() => {
    if (moduleData && moduleData.type === 'generator') {
      setInput(moduleData.input || '');
    }
  }, [moduleData]);

  const draftSummary = pendingDraft
    ? [
      pendingDraft.input?.trim()
        ? `Prompt: "${pendingDraft.input.trim().slice(0, 80)}${pendingDraft.input.trim().length > 80 ? '…' : ''}"`
        : null,
      pendingDraft.files?.length > 0
        ? `${pendingDraft.files.length} generated file${pendingDraft.files.length !== 1 ? 's' : ''}`
        : null,
      pendingDraft.config?.language && pendingDraft.config.language !== 'Auto-Detect / Any'
        ? `Language: ${pendingDraft.config.language}`
        : null,
    ].filter(Boolean).join(' · ')
    : '';

  const activeFile = files[activeFileIndex] || null;

  const downloadSingleFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    saveAs(blob, activeFile.fileName);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.fileName, f.content));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  };

  return (
    <div className="g-module-container">
      <ModuleHeader
        title="Code Generator"
        description="Scaffold multi-file solutions from a plain-English description."
        resultData={lastResult}
      />

      <ConfirmModal
        isOpen={!!pendingDraft}
        icon="fa-floppy-disk"
        title="Restore Unsaved Draft?"
        message={
          draftSummary
            ? `You have an unsaved session — ${draftSummary}. Would you like to pick up where you left off?`
            : 'You have an unsaved session. Would you like to restore it?'
        }
        confirmText="Restore Draft"
        cancelText="Start Fresh"
        onConfirm={handleConfirmDraft}
        onCancel={handleCancelDraft}
      />

      <div className="g-top-bar top-actions-bar">
        <button
          className="primary-button"
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <><span className="spinner g-btn-spinner"></span> Building...</>
          ) : (
            <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate</>
          )}
        </button>

        <PresetManager config={config} onApply={setConfig} />

        <div className="g-spacer" />

        {files.length > 0 && (
          <button
            className="secondary-button g-top-btn"
            onClick={downloadSingleFile}
            title={`Download ${activeFile?.fileName || 'file'}`}
          >
            <i className="fa-solid fa-download"></i>
            <span className="g-top-btn-label">File</span>
          </button>
        )}
        {files.length > 1 && (
          <button
            className="secondary-button g-top-btn"
            onClick={downloadZip}
            title="Download all files as ZIP"
          >
            <i className="fa-solid fa-file-zipper"></i>
            <span className="g-top-btn-label">ZIP</span>
          </button>
        )}

        <button
          className="secondary-button btn-danger g-top-btn"
          onClick={handleClearAll}
          title="Clear everything"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>

      <div className="g-layout">
        <aside className="g-sidebar">
          <div className="g-sidebar-inner">
            <section className="g-section">
              <h3 className="g-heading">
                <CodeAnalysisInfoIcon />
                <i className="fa-solid fa-layer-group"></i>
                Requirements
              </h3>
              <textarea
                className="g-prompt-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="E.g., Create a React button component and a CSS file for styling..."
                spellCheck="true"
              />
              {error && <div className="g-error">{error}</div>}
            </section>

            <div className="g-divider" />

            <section className="g-section">
              <ConfigTab config={config} setConfig={setConfig} />
            </section>
          </div>
        </aside>

        <main className="g-output">
          <OutputPanel
            files={files}
            activeFileIndex={activeFileIndex}
            setActiveFileIndex={setActiveFileIndex}
            loading={loading}
          />
        </main>
      </div>
    </div>
  );
}
'use client';

import { useEffect } from 'react';
import { useApp } from '@/context';
import { ModuleHeader } from '@/components/layout';
import { ConfirmModal } from '@/components/ui';
import ConfigTab from './ConfigTab';
import OutputPanel from './OutputPanel';
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
    ]
      .filter(Boolean)
      .join(' · ')
    : '';

  return (
    <div className="module-container">
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

      <div className="generator-layout">
        <aside className="generator-sidebar">
          <section className="sidebar-section">
            <h3 className="sidebar-heading">
              <i className="fa-solid fa-layer-group"></i>
              Requirements
            </h3>
            <textarea
              className="sidebar-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Create a React button component and a CSS file for styling..."
              spellCheck="true"
            />
            {error && <div className="error-message sidebar-error">{error}</div>}
            <div className="sidebar-actions">
              <button className="secondary-button" onClick={handleClearAll}>
                Clear
              </button>
              <button
                className="primary-button"
                onClick={handleGenerate}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <><span className="spinner button-spinner"></span> Building...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate</>
                )}
              </button>
            </div>
          </section>

          <div className="sidebar-divider" />

          <section className="sidebar-section sidebar-config">
            <ConfigTab config={config} setConfig={setConfig} />
          </section>
        </aside>

        <main className="generator-output">
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
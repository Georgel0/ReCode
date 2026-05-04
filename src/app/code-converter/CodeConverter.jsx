'use client';

import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor, CodeOutput, ConfirmModal } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
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

      <div className="converter-grid">
        <div className="panel">
          <div className="panel-header-row">
            <h3><i className="fa-solid fa-file-code"></i> Source Files</h3>
            <div className="header-actions">
              <button className="secondary-button btn-danger" onClick={handleClearAll}>
                <i className="fa-solid fa-trash-can"></i> Clear All
              </button>
              <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <button className="secondary-button" onClick={handleAddFile}>
                <i className="fa-solid fa-plus"></i> Add
              </button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
          </div>
            
          <div className="selector-bar">
            <select 
              value={activeFile?.language || 'javascript'} 
              onChange={(e) => setFiles(prev => prev.map(f => f.id === activeTabId ? { ...f, language: e.target.value } : f))}
              className="lang-select" 
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <button className="secondary-button" onClick={() => formatActiveCode(false)}>
              <i className="fa-solid fa-wand-magic"></i> Format
            </button>
          </div>
        
          <ConverterTabs 
            files={files} activeTabId={activeTabId} 
            setActiveTabId={setActiveTabId} removeFile={removeFile} renameFile={renameFile} 
          />

          <div className="sync-scroll-container" ref={sourceScrollRef} onScroll={(e) => handleScrollSync(e, targetScrollRef)}>
            <CodeEditor 
              value={activeFile?.content || ''} 
              onValueChange={(code) => updateFile(activeTabId, code)} 
              language={activeFile?.language || 'javascript'} 
            />
          </div>
          
          <div className="action-row">
            <label className="custom-check">
              <input type="checkbox" checked={isPartialMode} onChange={(e) => setIsPartialMode(e.target.checked)} />
              <div className="box"><i className="fa-solid fa-check"></i></div>
              <span className="label-text">Targeted Block (No Boilerplate)</span>
            </label>

            <button className="primary-button" onClick={handleConvert} disabled={loading || files.every(f => !f.content.trim())}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Converting...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> Convert Project</>}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header-row">
            <h3><i className="fa-solid fa-code-compare"></i> Converted Output</h3>
            <div className="header-actions">
              {outputFiles.length > 0 && (
                <>
                  <button className="secondary-button" onClick={downloadSingleFile}><i className="fa-solid fa-file-arrow-down"></i> Current</button>
                  <button className="file-upload-btn download-btn" onClick={downloadZip}><i className="fa-solid fa-file-zipper"></i> ZIP</button>
                </>
              )}
            </div>
          </div>
        
          <div className="selector-bar">
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="lang-select">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select value={targetFramework} onChange={(e) => setTargetFramework(e.target.value)} className="lang-select">
              {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button className="secondary-button" onClick={() => formatActiveCode(true)} disabled={!outputFiles.length}>
              <i className="fa-solid fa-wand-magic"></i> Format
            </button>
          </div>

          <div className="results-container">
            {outputFiles.length > 0 ? (
              <div className="code-output-container"> 
                <ConverterTabs 
                  files={outputFiles.map(f => ({id: f.sourceId, name: f.fileName}))} 
                  activeTabId={activeTabId} setActiveTabId={setActiveTabId} 
                  removeFile={() => {}} readOnly={true} 
                />
                
                <div className="sync-scroll-container output-wrapper" ref={targetScrollRef} onScroll={(e) => handleScrollSync(e, sourceScrollRef)}>
                  <CodeOutput language={targetLang} content={activeOutputFile?.content || '// File not found'} />
                  <CopyButton codeToCopy={activeOutputFile?.content || ''} />
                </div>
                  
                <div className="action-row">
                  <div className="lint-controls">
                    <button className="secondary-button" onClick={runLinter} disabled={lintStatus === 'linting'}>
                      <i className={`fa-solid ${lintStatus === 'linting' ? 'fa-spinner fa-spin' : 'fa-stethoscope'}`}></i> Check Syntax
                    </button>
                    {lintStatus === 'success' && <span className="lint-badge success"><i className="fa-solid fa-check-circle"></i> Clean</span>}
                    {lintStatus === 'error' && <span className="lint-badge error"><i className="fa-solid fa-triangle-exclamation"></i> Warnings Found</span>}
                  </div>
                  
                  <label className="custom-check">
                    <input type="checkbox" checked={syncScroll} onChange={(e) => setSyncScroll(e.target.checked)} />
                    <div className="box"><i className="fa-solid fa-check"></i></div>
                    <span className="label-text">Sync Scrolling</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                {loading ? <span><i className="fa-solid fa-circle-notch fa-spin"></i> Rebuilding AST...</span> : <span><i className="fas fa-ghost"></i> Result will appear here...</span>}
              </div>
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
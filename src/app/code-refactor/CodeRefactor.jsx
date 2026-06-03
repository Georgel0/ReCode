'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import { ModuleHeader } from '@/components/layout';
import { CodeEditor, ConfirmModal, CodeAnalysisInfoIcon } from '@/components/ui';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import { sanitizeFilename, validateFile, suggestRefactorMode } from './utils';
import { FileTabs, RefactorControls, OutputPanel } from './components';
import { get, set } from 'idb-keyval';
import './codeRefactor.css';

export default function CodeRefactor() {
  const { moduleData, qualityMode } = useApp();

  const [files, setFiles] = useState([
    { id: crypto.randomUUID(), name: 'main.js', language: 'javascript', content: '', size: 0 },
  ]);
  const [activeTabId, setActiveTabId] = useState(files[0].id);
  const [outputFiles, setOutputFiles] = useState([]);
  const [lastResult, setLastResult] = useState(false);

  const [loadingStage, setLoadingStage] = useState('idle');
  const [refactorMode, setRefactorMode] = useState('clean');
  const [suggestedMode, setSuggestedMode] = useState(null);
  const [viewMode, setViewMode] = useState('final');
  const [errorMsg, setErrorMsg] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  const fileInputRef = useRef(null);
  const isRestoring = useRef(false);

  const activeFile = files.find((f) => f.id === activeTabId);

  useEffect(() => {
    if (moduleData && moduleData.type === 'refactor') {
      isRestoring.current = true;
      try {
        const savedInputs =
          typeof moduleData.input === 'string'
            ? JSON.parse(moduleData.input)
            : moduleData.input;
        const savedOutput =
          typeof moduleData.fullOutput === 'string'
            ? JSON.parse(moduleData.fullOutput)
            : moduleData.fullOutput;

        if (savedInputs && savedInputs.length > 0) {
          setFiles(savedInputs);
          setActiveTabId(savedInputs[0].id);
        }
        if (savedOutput) setOutputFiles(savedOutput);
        if (moduleData.refactorMode) setRefactorMode(moduleData.refactorMode);
      } catch (e) {
        console.error('Failed to restore history', e);
      }
      setTimeout(() => { isRestoring.current = false; }, 100);
    }
  }, [moduleData]);

  useEffect(() => {
    if (outputFiles.length > 0 && !isRestoring.current) {
      setLastResult({
        type: 'refactor',
        input: JSON.stringify(files),
        output: outputFiles,
        refactorMode,
        qualityMode,
      });
    }
  }, [outputFiles, files, refactorMode, qualityMode]);

  const saveDraft = useCallback(
    debounce(async (draftData) => {
      if (draftData.files.some((f) => f.content.trim())) {
        try {
          await set('refactor-draft-data', draftData);
          setStorageWarning(false);
        } catch (e) {
          console.error('IndexedDB Error:', e);
          setStorageWarning(true);
        }
      }
    }, 1500),
    [],
  );

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await get('refactor-draft-data');
        if (saved && saved.files && saved.files.length > 0 && saved.files.some((f) => f.content.trim())) {
          setPendingDraft(saved);
        }
      } catch (err) {
        console.error('Failed to load IndexedDB draft', err);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft({ files, outputFiles });
    return () => saveDraft.cancel();
  }, [files, outputFiles, saveDraft]);

  useEffect(() => {
    if (activeFile && activeFile.content.trim().length > 0) {
      setSuggestedMode(suggestRefactorMode(activeFile.content));
    } else {
      setSuggestedMode(null);
    }
  }, [activeTabId, files, activeFile?.content]);

  const handleRefactor = async () => {
    if (files.every((f) => !f.content.trim())) return;
    setLoadingStage('analyzing');
    setErrorMsg('');

    let optTimeout, valTimeout;
    try {
      optTimeout = setTimeout(() => setLoadingStage('optimizing'), 1500);
      valTimeout = setTimeout(() => setLoadingStage('validating'), 3000);

      const inputPayload = JSON.stringify(
        files.map((f) => ({ sourceId: f.id, name: f.name, content: f.content })),
      );
      const result = await convertCode('refactor', inputPayload, { mode: refactorMode, qualityMode });

      if (result && Array.isArray(result.files)) {
        setOutputFiles(result.files);
      } else {
        setErrorMsg(result?.error || 'Invalid format returned from the API.');
      }
    } catch {
      setErrorMsg('Failed to refactor code. Please check your connection.');
    } finally {
      clearTimeout(optTimeout);
      clearTimeout(valTimeout);
      setLoadingStage('idle');
    }
  };

  const handleLanguageChange = (id, newLangValue) => {
    const selectedLang = LANGUAGES.find((l) => l.value === newLangValue);
    if (!selectedLang) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const base = f.name.includes('.') ? f.name.substring(0, f.name.lastIndexOf('.')) : f.name;
        return { ...f, language: selectedLang.value, name: `${base}${selectedLang.ext}` };
      }),
    );
  };

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRefactor();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDraft({ files, outputFiles });
      }
    },
    [files, outputFiles, handleRefactor, saveDraft],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFileUpload = async (e) => {
    setErrorMsg('');
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    const validFiles = [];
    for (const file of uploadedFiles) {
      const { valid, error } = validateFile(file);
      if (!valid) { setErrorMsg(error); continue; }
      validFiles.push(file);
    }

    const promises = validFiles.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const name = sanitizeFilename(file.name);
            const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
            const matchedLang =
              LANGUAGES.find((l) => l.ext === ext) || LANGUAGES.find((l) => l.value === 'plaintext');
            resolve({
              id: crypto.randomUUID(),
              name,
              language: matchedLang.value,
              content: ev.target.result,
              size: file.size,
            });
          };
          reader.onerror = reject;
          reader.readAsText(file);
        }),
    );

    try {
      const newFiles = await Promise.all(promises);
      if (newFiles.length > 0) {
        setFiles((prev) =>
          prev.length === 1 && !prev[0].content.trim() ? newFiles : [...prev, ...newFiles],
        );
        setActiveTabId(newFiles[0].id);
      }
    } catch {
      setErrorMsg('Failed to read one or more files.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateFile = (id, content) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f)));

  const removeFile = (idToRemove) => {
    const remaining = files.filter((f) => f.id !== idToRemove);
    if (remaining.length === 0) {
      const newId = crypto.randomUUID();
      setFiles([{ id: newId, name: 'untitled.txt', language: 'plaintext', content: '', size: 0 }]);
      setActiveTabId(newId);
    } else {
      setFiles(remaining);
      if (activeTabId === idToRemove) setActiveTabId(remaining[0].id);
    }
  };

  const handleAddFile = () => {
    const ext = activeFile?.language
      ? LANGUAGES.find((l) => l.value === activeFile.language)?.ext ?? '.js'
      : '.js';
    const lang = activeFile?.language || 'javascript';
    const newFile = { id: crypto.randomUUID(), name: `new-file${ext}`, language: lang, content: '', size: 0 };
    setFiles((prev) => [...prev, newFile]);
    setActiveTabId(newFile.id);
  };

  const downloadSingleFile = (file) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName || file.name || 'refactored-file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    outputFiles.forEach((f) =>
      zip.file(sanitizeFilename(f.fileName || f.name || 'file.txt'), f.content),
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'refactored_project.zip');
  };

  const handleConfirmDraft = () => {
    setFiles(pendingDraft.files);
    setActiveTabId(pendingDraft.files[0]?.id);
    if (pendingDraft.outputFiles?.length > 0) setOutputFiles(pendingDraft.outputFiles);
    setPendingDraft(null);
  };

  const handleCancelDraft = async () => {
    await set('refactor-draft-data', null);
    setPendingDraft(null);
  };

  const isLoading = loadingStage !== 'idle';
  const hasContent = files.some((f) => f.content.trim());

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
                className={
                  isLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-wand-magic-sparkles'
                }
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
            activeSourceFile={files.find((f) => f.id === activeTabId)}
            outputFiles={outputFiles}
            viewMode={viewMode}
            setViewMode={setViewMode}
            loadingStage={loadingStage}
            downloadSingleFile={downloadSingleFile}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!pendingDraft}
        title="Unsaved Draft Found"
        message="We found an autosaved draft from your previous session. Would you like to continue where you left off, or start fresh?"
        confirmText="Restore Draft"
        cancelText="Start Fresh"
        icon="fa-clock-rotate-left"
        onConfirm={handleConfirmDraft}
        onCancel={handleCancelDraft}
      />
    </div>
  );
}
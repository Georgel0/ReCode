import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import { get, set } from 'idb-keyval';
import {
  sanitizeFilename,
  validateFile,
  suggestRefactorMode,
  getLanguageFromFilename,
  resolveRefactorMode,
  DEFAULT_REFACTOR_MODE,
} from './utils';

const DRAFT_KEY = 'refactor-draft-data';

const createEmptyFile = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: 'main.js',
  language: 'javascript',
  content: '',
  size: 0,
  ...overrides,
});

export function useCodeRefactor() {
  const { moduleData, qualityMode } = useApp();

  const [files, setFiles] = useState(() => [createEmptyFile()]);
  const [activeTabId, setActiveTabId] = useState(() => files[0].id);
  const [outputFiles, setOutputFiles] = useState([]);
  const [lastResult, setLastResult] = useState(false);

  const [loadingStage, setLoadingStage] = useState('idle');
  const [refactorMode, setRefactorMode] = useState(DEFAULT_REFACTOR_MODE);
  const [suggestedMode, setSuggestedMode] = useState(null);
  const [viewMode, setViewMode] = useState('final');
  const [errorMsg, setErrorMsg] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);

  const fileInputRef = useRef(null);
  const isRestoring = useRef(false);
  const historyLoaded = useRef(false);

  const activeFile = files.find((f) => f.id === activeTabId);

  const activeOutputFile = outputFiles.find(
    (out) => out.sourceId === activeFile?.id || out.fileName === activeFile?.name,
  );

  const targetLang = activeOutputFile
    ? getLanguageFromFilename(activeOutputFile.fileName, activeFile?.language || 'plaintext')
    : activeFile?.language || 'plaintext';

  // Restore a saved result from the history panel. Always wins over any
  // local draft, and re-applies whenever a different history entry is picked.
  useEffect(() => {
    if (!moduleData || moduleData.type !== 'refactor') return;

    isRestoring.current = true;
    historyLoaded.current = true;
    try {
      const savedInputs =
        typeof moduleData.input === 'string' ? JSON.parse(moduleData.input) : moduleData.input;
      const savedOutput =
        typeof moduleData.fullOutput === 'string' ? JSON.parse(moduleData.fullOutput) : moduleData.fullOutput;

      if (savedInputs?.length > 0) {
        setFiles(savedInputs);
        setActiveTabId(savedInputs[0].id);
      }
      setOutputFiles(savedOutput || []);
      setRefactorMode(resolveRefactorMode(moduleData.refactorMode));
    } catch (e) {
      console.error('Failed to restore history', e);
    }
    setTimeout(() => { isRestoring.current = false; }, 100);
  }, [moduleData]);

  // Auto-restore an autosaved draft on first load — no confirmation modal.
  // Skipped entirely if a history result is already loaded.
  useEffect(() => {
    if (moduleData?.type === 'refactor') return;

    let cancelled = false;
    (async () => {
      try {
        const saved = await get(DRAFT_KEY);
        if (cancelled || historyLoaded.current) return;
        if (saved?.files?.length > 0 && saved.files.some((f) => f.content.trim())) {
          isRestoring.current = true;
          setFiles(saved.files);
          setActiveTabId(saved.files[0].id);
          if (saved.outputFiles?.length > 0) setOutputFiles(saved.outputFiles);
          if (saved.refactorMode) setRefactorMode(resolveRefactorMode(saved.refactorMode));
          setTimeout(() => { isRestoring.current = false; }, 100);
        }
      } catch (err) {
        console.error('Failed to load IndexedDB draft', err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

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
          await set(DRAFT_KEY, draftData);
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
    if (isRestoring.current) return; // don't overwrite the draft while restoring
    saveDraft({ files, outputFiles, refactorMode });
    return () => saveDraft.cancel();
  }, [files, outputFiles, refactorMode, saveDraft]);

  useEffect(() => {
    setSuggestedMode(activeFile?.content?.trim() ? suggestRefactorMode(activeFile.content) : null);
  }, [activeTabId, activeFile?.content]);

  const handleRefactor = useCallback(async () => {
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
      const result = await convertCode('refactor', inputPayload, {
        mode: resolveRefactorMode(refactorMode),
        qualityMode,
      });

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
  }, [files, refactorMode, qualityMode]);

  const handleLanguageChange = useCallback((id, newLangValue) => {
    const selectedLang = LANGUAGES.find((l) => l.value === newLangValue);
    if (!selectedLang) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const base = f.name.includes('.') ? f.name.substring(0, f.name.lastIndexOf('.')) : f.name;
        return { ...f, language: selectedLang.value, name: `${base}${selectedLang.ext}` };
      }),
    );
  }, []);

  const handleFileUpload = useCallback(async (e) => {
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
            resolve({
              id: crypto.randomUUID(),
              name,
              language: getLanguageFromFilename(name, 'plaintext'),
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
  }, []);

  const updateFile = useCallback(
    (id, content) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f))),
    [],
  );

  const removeFile = useCallback((idToRemove) => {
    const remaining = files.filter((f) => f.id !== idToRemove);
    if (remaining.length === 0) {
      const fresh = createEmptyFile({ name: 'untitled.txt', language: 'plaintext' });
      setFiles([fresh]);
      setActiveTabId(fresh.id);
    } else {
      setFiles(remaining);
      if (activeTabId === idToRemove) setActiveTabId(remaining[0].id);
    }
  }, [files, activeTabId]);

  const handleAddFile = useCallback(() => {
    const ext = activeFile?.language
      ? LANGUAGES.find((l) => l.value === activeFile.language)?.ext ?? '.js'
      : '.js';
    const lang = activeFile?.language || 'javascript';
    const newFile = createEmptyFile({ name: `new-file${ext}`, language: lang });
    setFiles((prev) => [...prev, newFile]);
    setActiveTabId(newFile.id);
  }, [activeFile]);

  const downloadSingleFile = useCallback((file) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(file.fileName || file.name || 'refactored-file.txt');
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    outputFiles.forEach((f) =>
      zip.file(sanitizeFilename(f.fileName || f.name || 'file.txt'), f.content),
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'refactored_project.zip');
  }, [outputFiles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRefactor();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDraft({ files, outputFiles, refactorMode });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, outputFiles, refactorMode, handleRefactor, saveDraft]);

  return {
    files,
    activeFile,
    activeTabId,
    setActiveTabId,
    outputFiles,
    activeOutputFile,
    targetLang,
    lastResult,
    loadingStage,
    isLoading: loadingStage !== 'idle',
    hasContent: files.some((f) => f.content.trim()),
    refactorMode,
    setRefactorMode,
    suggestedMode,
    viewMode,
    setViewMode,
    errorMsg,
    storageWarning,
    fileInputRef,
    handleRefactor,
    handleLanguageChange,
    handleFileUpload,
    updateFile,
    removeFile,
    handleAddFile,
    downloadSingleFile,
    downloadZip,
  };
}
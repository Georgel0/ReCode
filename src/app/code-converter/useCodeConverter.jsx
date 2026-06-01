import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import { get, set, del } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function useCodeConverter() {
  const { qualityMode } = useApp();

  const [files, setFiles] = useState([{ id: crypto.randomUUID(), name: 'main.js', language: 'javascript', content: '', size: 0 }]);
  const [outputFiles, setOutputFiles] = useState([]);
  const [activeTabId, setActiveTabId] = useState(files[0].id);
  const activeFile = files.find(f => f.id === activeTabId);
  const activeOutputFile = outputFiles.find(f => f.sourceId === activeTabId);

  const [targetLang, setTargetLang] = useState('python');
  const [targetFramework, setTargetFramework] = useState('none');
  const [isPartialMode, setIsPartialMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [lintStatus, setLintStatus] = useState('idle');
  const [pendingDraft, setPendingDraft] = useState(null);

  const fileInputRef = useRef(null);
  const sourceScrollRef = useRef(null);
  const targetScrollRef = useRef(null);
  const [syncScroll, setSyncScroll] = useState(true);

  const saveDraft = useCallback(
    debounce(async (draftData) => {
      if (draftData.files.some(f => f.content.trim())) {
        try { await set('converter-draft-data', draftData); }
        catch (e) { console.error("IndexedDB Error:", e); }
      }
    }, 1500),
    []
  );

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await get('converter-draft-data');
        if (saved && saved.files?.length > 0 && saved.files.some(f => f.content.trim())) {
          setPendingDraft(saved);
        }
      } catch (err) {
        console.error("Draft load failed", err);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft({ files, outputFiles });
  }, [files, outputFiles, saveDraft]);

  useEffect(() => {
    return () => saveDraft.cancel();
  }, [saveDraft]);


  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    const MAX_FILE_SIZE = 1048576;
    const validFiles = [];

    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`Upload Skipped: "${file.name}" exceeds the 1MB file size limit.`);
      } else {
        validFiles.push(file);
      }
    }

    const newFilesPromises = validFiles.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        const matchedLang = LANGUAGES.find(l => l.ext === ext) || LANGUAGES.find(l => l.value === 'plaintext');
        resolve({ id: crypto.randomUUID(), name: file.name, language: matchedLang.value, content: event.target.result, size: file.size });
      };
      reader.readAsText(file);
    }));

    const newFiles = await Promise.all(newFilesPromises);
    if (newFiles.length > 0) {
      setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
      setActiveTabId(newFiles[0].id);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFile = (id, content) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
  };

  const renameFile = (id, newName) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const handleAddFile = () => {
    const newId = crypto.randomUUID();
    setFiles([...files, { id: newId, name: 'untitled.js', language: 'javascript', content: '', size: 0 }]);
    setActiveTabId(newId);
  };

  const handleClearAll = () => {
    const newId = crypto.randomUUID();
    setFiles([{ id: newId, name: 'untitled.js', language: 'javascript', content: '', size: 0 }]);
    setOutputFiles([]);
    setActiveTabId(newId);
    setLintStatus('idle');
  };

  const removeFile = (idToRemove) => {
    const newFiles = files.filter(f => f.id !== idToRemove);
    // Always clean up the corresponding output file
    setOutputFiles(prev => prev.filter(f => f.sourceId !== idToRemove));

    if (newFiles.length === 0) {
      handleClearAll();
    } else {
      setFiles(newFiles);
      if (activeTabId === idToRemove) setActiveTabId(newFiles[0].id);
    }
  };

  const handleScrollSync = (e, targetRef) => {
    if (!syncScroll || !targetRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const ratio = scrollTop / (scrollHeight - clientHeight);
    targetRef.current.scrollTop = ratio * (targetRef.current.scrollHeight - targetRef.current.clientHeight);
  };

  const handleConvert = async () => {
    if (files.every(f => !f.content.trim())) return;
    setLoading(true);
    setLintStatus('idle');

    try {
      const inputPayload = JSON.stringify(
        files.map(f => ({
          sourceId: f.id,
          name: f.name,
          content: f.content
        }))
      );

      const result = await convertCode('converter', inputPayload, {
        sourceLang: activeFile.language,
        targetLang,
        framework: targetFramework,
        isPartial: isPartialMode,
        qualityMode
      });

      if (result && Array.isArray(result.files)) {
        const mapped = result.files.map((rf, i) => ({
          ...rf,
          // If the LLM returned a wrong/numeric sourceId, fall back to
          // the original file order so tabs still resolve correctly.
          sourceId: files[i]?.id ?? rf.sourceId,
        }));
        setOutputFiles(mapped);
      } else {
        throw new Error("Invalid array structure returned.");
      }
    } catch (error) {
      alert(`Conversion failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Use a regex-based bracket check for ALL languages (same as the else branch)
  // and remove the new Function() call entirely.
  const runLinter = async () => {
    setLintStatus('linting');
    setTimeout(() => {
      if (!activeOutputFile) { setLintStatus('error'); return; }
      const code = activeOutputFile.content;
      try {
        if (targetLang === 'json') {
          JSON.parse(code);
        } else {
          // Safe bracket-balance check — no code execution
          const stack = [];
          const pairs = { '(': ')', '{': '}', '[': ']' };
          for (const char of code) {
            if (pairs[char]) stack.push(char);
            else if (Object.values(pairs).includes(char)) {
              if (!stack.length || pairs[stack.pop()] !== char)
                throw new Error(`Mismatched bracket: ${char}`);
            }
          }
          if (stack.length) throw new Error(`Unclosed: ${stack.pop()}`);
        }
        setLintStatus('success');
      } catch { setLintStatus('error'); }
    }, 500);
  };

  const formatActiveCode = (isOutput = false) => {
    const targetFile = isOutput ? activeOutputFile : activeFile;
    if (!targetFile || !targetFile.content) return;

    let formatted = targetFile.content;
    try {
      if (targetFile.language === 'json' || targetFile.name?.endsWith('.json')) {
        formatted = JSON.stringify(JSON.parse(formatted), null, 2);
      } else {
        let indentLevel = 0;
        formatted = formatted.split('\n').map(line => {
          const trimmed = line.trim();
          // Dedent BEFORE emitting closing brackets
          if (trimmed.startsWith('}') || trimmed.startsWith(']'))
            indentLevel = Math.max(0, indentLevel - 1);
          const out = '  '.repeat(indentLevel) + trimmed;
          // Indent AFTER emitting opening brackets
          if (trimmed.endsWith('{') || trimmed.endsWith('['))
            indentLevel++;
          return out;
        }).join('\n');
      }
    } catch {
      alert('Could not format: the content is not valid JSON.');
      return;
    }

    if (!isOutput) {
      updateFile(targetFile.id || activeTabId, formatted);
    } else {
      setOutputFiles(prev => prev.map(f => f.sourceId === targetFile.sourceId ? { ...f, content: formatted } : f));
    }
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    outputFiles.forEach(file => zip.file(file.fileName || 'file.txt', file.content));
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "converted_project.zip");
  };

  const downloadSingleFile = () => {
    if (!activeOutputFile) return;
    const blob = new Blob([activeOutputFile.content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, activeOutputFile.fileName || `converted_${activeFile?.name || 'file.txt'}`);
  };

  const handleConfirmDraft = () => {
    setFiles(pendingDraft.files);
    setActiveTabId(pendingDraft.files[0]?.id);
    if (pendingDraft.outputFiles?.length > 0) setOutputFiles(pendingDraft.outputFiles);
    setPendingDraft(null);
  };

  const handleCancelDraft = async () => {
    await del('converter-draft-data');
    setPendingDraft(null);
  };

  return {
    files, setFiles, outputFiles, activeTabId, setActiveTabId, activeFile, activeOutputFile,
    targetLang, setTargetLang, targetFramework, setTargetFramework, isPartialMode, setIsPartialMode,
    loading, lintStatus, pendingDraft, fileInputRef, sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll,
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    handleScrollSync, handleConvert, runLinter, formatActiveCode, downloadZip, downloadSingleFile,
    handleConfirmDraft, handleCancelDraft
  };
}
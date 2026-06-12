import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib';
import { useApp } from '@/context';
import { get, set, del } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const MAX_HISTORY_PER_FILE = 3;

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
  const [selectedRange, setSelectedRange] = useState(null); // { start, end } line indices

  const [loading, setLoading] = useState(false);
  const [lintStatus, setLintStatus] = useState('idle');
  const [pendingDraft, setPendingDraft] = useState(null);

  const [diffMode, setDiffMode] = useState(false);

  const [conversionNotes, setConversionNotes] = useState({}); // keyed by sourceId
  const [notesOpen, setNotesOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');

  const [conversionHistory, setConversionHistory] = useState({});
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const fileInputRef = useRef(null);
  const sourceScrollRef = useRef(null);
  const targetScrollRef = useRef(null);
  const [syncScroll, setSyncScroll] = useState(false);

  const isSyncingRef = useRef(false);

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
          // Restore target settings immediately so the UI reflects them even before confirming
          if (saved.targetLang) setTargetLang(saved.targetLang);
          if (saved.targetFramework) setTargetFramework(saved.targetFramework);
        }
      } catch (err) {
        console.error("Draft load failed", err);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft({ files, outputFiles, targetLang, targetFramework, activeTabId });
  }, [files, outputFiles, targetLang, targetFramework, saveDraft]);

  const saveHistoryToIdb = useCallback(
    debounce(async (history) => {
      try { await set('converter-history', history); }
      catch (e) { console.error("History save failed", e); }
    }, 800),
    []
  );

  useEffect(() => {
    return () => {
      saveDraft.cancel();
      saveHistoryToIdb.cancel();
    };
  }, []);

  // Load history from IDB on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await get('converter-history');
        if (saved) setConversionHistory(saved);
      } catch (e) { console.error("History load failed", e); }
    };
    loadHistory();
  }, []);

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
        const content = event.target.result;
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        const byExt = LANGUAGES.find(l => l.ext === ext);

        const language = byExt
          ? byExt.value
          : (LANGUAGES.some(l => l.value === detectLanguage(content))
            ? detectLanguage(content)
            : 'plaintext');

        resolve({ id: crypto.randomUUID(), name: file.name, language, content, size: file.size });
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
    setConversionNotes({});
    setConversionHistory({});
    setSelectedRange(null);
    setHistoryPanelOpen(false);
    setNotesOpen(false);
    setDiffMode(false);
  };

  const removeFile = (idToRemove) => {
    const newFiles = files.filter(f => f.id !== idToRemove);
    setOutputFiles(prev => prev.filter(f => f.sourceId !== idToRemove));

    if (newFiles.length === 0) {
      handleClearAll();
    } else {
      setFiles(newFiles);
      if (activeTabId === idToRemove) setActiveTabId(newFiles[0].id);
    }
  };

  useEffect(() => {
    const src = sourceScrollRef.current?.querySelector('.editor-container');
    const tgt = targetScrollRef.current?.querySelector('.editor-container');
    if (!src || !tgt) return;

    const syncFrom = (source, target) => () => {
      if (!syncScroll || isSyncingRef.current) return;
      isSyncingRef.current = true;

      const maxSrcTop = source.scrollHeight - source.clientHeight;
      const maxTgtTop = target.scrollHeight - target.clientHeight;

      if (maxSrcTop > 0 && maxTgtTop > 0) {
        target.scrollTop = Math.round((source.scrollTop / maxSrcTop) * maxTgtTop);
      } else if (maxTgtTop > 0) {
        target.scrollTop = 0;
      }

      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const srcHandler = syncFrom(src, tgt);
    const tgtHandler = syncFrom(tgt, src);

    src.addEventListener('scroll', srcHandler, { passive: true });
    tgt.addEventListener('scroll', tgtHandler, { passive: true });

    return () => {
      src.removeEventListener('scroll', srcHandler);
      tgt.removeEventListener('scroll', tgtHandler);
    };
  }, [outputFiles, syncScroll, activeTabId]);

  // Build the import graph for multi-file dependency awareness
  const buildImportGraph = (filesArray) => {
    const nameMap = {};
    filesArray.forEach(f => { nameMap[f.name] = f.id; });

    return filesArray.map(f => {
      const importMatches = [];
      const lines = f.content.split('\n');
      lines.forEach(line => {
        // match: import ... from './foo' or require('./foo')
        const m = line.match(/(?:import|require)\s*(?:\(?\s*['"]([^'"]+)['"]\s*\)?|[^'"]*from\s*['"]([^'"]+)['"])/);
        const importPath = m?.[1] || m?.[2];
        if (importPath) {
          const baseName = importPath.split('/').pop();
          // Try to find a matching file
          const matchedFile = filesArray.find(other =>
            other.id !== f.id && (
              other.name === baseName ||
              other.name.startsWith(baseName + '.') ||
              other.name === baseName + '.js' ||
              other.name === baseName + '.ts' ||
              other.name === baseName + '.jsx' ||
              other.name === baseName + '.tsx'
            )
          );
          if (matchedFile) importMatches.push({ path: importPath, resolvedId: matchedFile.id, resolvedName: matchedFile.name });
        }
      });
      return { ...f, imports: importMatches };
    });
  };

  const handleConvert = async (feedbackOverride = null) => {
    if (files.every(f => !f.content.trim())) return;
    setLoading(true);
    setLintStatus('idle');
    setConversionNotes({});

    try {
      const filesWithGraph = buildImportGraph(files);

      // Build input: include dependency graph info in the payload
      const inputPayload = JSON.stringify(
        filesWithGraph.map(f => {
          const base = {
            sourceId: f.id,
            name: f.name,
            content: isPartialMode && selectedRange
              ? f.id === activeTabId
                ? f.content.split('\n').slice(selectedRange.start, selectedRange.end + 1).join('\n')
                : f.content
              : f.content,
          };
          if (f.imports.length > 0) {
            base.dependsOn = f.imports.map(i => ({ importPath: i.path, resolvedFile: i.resolvedName }));
          }
          return base;
        })
      );

      const contextPayload = feedbackOverride
        ? `${inputPayload}\n\n--- CORRECTION INSTRUCTION ---\n${feedbackOverride}`
        : inputPayload;

      const result = await convertCode('converter', contextPayload, {
        sourceLang: activeFile.language,
        targetLang,
        framework: targetFramework,
        isPartial: isPartialMode,
        qualityMode,
      });

      if (result && Array.isArray(result.files)) {
        const mapped = result.files.map((rf, i) => ({
          ...rf,
          sourceId: rf.sourceId
            ?? files.find(f => f.name === rf.fileName)?.id
            ?? files[i]?.id  // positional fallback — same order as input
        }));
        setOutputFiles(mapped);

        // Extract notes if returned (notes field per file or top-level)
        const newNotes = {};
        mapped.forEach((rf, i) => {
          if (rf.notes) newNotes[rf.sourceId] = rf.notes;
        });
        if (result.notes) newNotes['__global__'] = result.notes;
        if (Object.keys(newNotes).length > 0) setConversionNotes(newNotes);

        // Save to history
        const timestamp = new Date().toISOString();
        setConversionHistory(prev => {
          const updated = { ...prev };
          mapped.forEach(rf => {
            const entry = {
              outputFile: rf,
              targetLang,
              targetFramework,
              timestamp,
              notes: newNotes[rf.sourceId] || null,
            };
            const existing = updated[rf.sourceId] || [];
            updated[rf.sourceId] = [entry, ...existing].slice(0, MAX_HISTORY_PER_FILE);
          });
          saveHistoryToIdb(updated);
          return updated;
        });

        setFeedbackText('');
      } else {
        throw new Error("Invalid array structure returned.");
      }
    } catch (error) {
      alert(`Conversion failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReconvert = () => {
    if (!feedbackText.trim()) return;
    handleConvert(feedbackText.trim());
  };

  const restoreHistoryEntry = (sourceId, entryIndex) => {
    const entry = conversionHistory[sourceId]?.[entryIndex];
    if (!entry) return;
    setOutputFiles(prev => {
      const withoutThis = prev.filter(f => f.sourceId !== sourceId);
      return [...withoutThis, entry.outputFile];
    });
    if (entry.notes) setConversionNotes(prev => ({ ...prev, [sourceId]: entry.notes }));
    setHistoryPanelOpen(false);
  };

  const runLinter = async () => {
    setLintStatus('linting');
    setTimeout(() => {
      if (!activeOutputFile) { setLintStatus('error'); return; }
      const code = activeOutputFile.content;
      try {
        if (targetLang === 'json') {
          JSON.parse(code);
        } else {
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
      if (targetLang === 'json' || targetFile.fileName?.endsWith('.json') || targetFile.name?.endsWith('.json')) {
        formatted = JSON.stringify(JSON.parse(formatted), null, 2);
      } else {
        let indentLevel = 0;
        formatted = formatted.split('\n').map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('}') || trimmed.startsWith(']'))
            indentLevel = Math.max(0, indentLevel - 1);
          const out = '  '.repeat(indentLevel) + trimmed;
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
    const ext = LANGUAGES.find(l => l.value === targetLang)?.ext ?? '.txt';
    const fallback = `converted_${activeFile?.name?.replace(/\.[^.]+$/, '') ?? 'file'}${ext}`;
    saveAs(blob, activeOutputFile.fileName || fallback);
  };

  const handleConfirmDraft = () => {
    setFiles(pendingDraft.files);
    setActiveTabId(pendingDraft.activeTabId ?? pendingDraft.files[0]?.id);
    if (pendingDraft.outputFiles?.length > 0) setOutputFiles(pendingDraft.outputFiles);
    if (pendingDraft.targetLang) setTargetLang(pendingDraft.targetLang);
    if (pendingDraft.targetFramework) setTargetFramework(pendingDraft.targetFramework);
    setPendingDraft(null);
  };

  const handleCancelDraft = async () => {
    await del('converter-draft-data');
    setPendingDraft(null);
  };

  return {
    files, setFiles, outputFiles, activeTabId, setActiveTabId, activeFile, activeOutputFile,
    targetLang, setTargetLang, targetFramework, setTargetFramework, isPartialMode, setIsPartialMode,
    selectedRange, setSelectedRange,
    loading, lintStatus, pendingDraft, fileInputRef, sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll,
    diffMode, setDiffMode,
    conversionNotes, notesOpen, setNotesOpen,
    feedbackText, setFeedbackText, handleReconvert,
    conversionHistory, historyPanelOpen, setHistoryPanelOpen, restoreHistoryEntry,
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    handleConvert, runLinter, formatActiveCode, downloadZip, downloadSingleFile,
    handleConfirmDraft, handleCancelDraft
  };
}
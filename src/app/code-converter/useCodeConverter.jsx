import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib';
import { useApp } from '@/context';
import { get, set, del } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const MAX_HISTORY_PER_FILE = 3;

function buildImportGraph(filesArray) {
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
}

const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));

function runNativeLint(code, lang) {
  // JSON
  if (lang === 'json') {
    try {
      JSON.parse(code);
      return { valid: true, errors: [], warnings: [], summary: 'Valid JSON.' };
    } catch (e) {
      // Extract line/col from the native error message where possible
      const match = e.message.match(/line (\d+) column (\d+)/i);
      return {
        valid: false,
        errors: [{ line: match ? +match[1] : null, col: match ? +match[2] : null, message: e.message }],
        warnings: [],
        summary: 'Invalid JSON: 1 syntax error.',
      };
    }
  }

  // HTML — DOMParser gives us real parse errors
  if (lang === 'html') {
    const doc = new DOMParser().parseFromString(code, 'text/html');
    const errs = Array.from(doc.querySelectorAll('parsererror, parsererror *'))
      .reduce((acc, el) => {
        const text = el.textContent.trim();
        if (text) acc.push({ line: null, col: null, message: text });
        return acc;
      }, []);
    if (errs.length) return { valid: false, errors: errs, warnings: [], summary: `${errs.length} HTML parse error(s).` };
    return { valid: true, errors: [], warnings: [], summary: 'Well-formed HTML.' };
  }

  return null; // no native parser for this language → fall through to AI
}

export function useCodeConverter() {
  const { qualityMode, moduleData, setModuleData } = useApp();

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
  const [formatting, setFormatting] = useState(false);
  // lintResult: null | { status: 'linting'|'success'|'error'|'warning', summary, errors, warnings }
  const [lintResult, setLintResult] = useState(null);
  const [linting, setLinting] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [diffMode, setDiffMode] = useState(false);

  const [conversionNotes, setConversionNotes] = useState({}); // keyed by sourceId
  const [notesOpen, setNotesOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');

  const [conversionHistory, setConversionHistory] = useState({});
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const fileInputRef = useRef(null);

  const saveDraft = useCallback(
    debounce(async (draftData) => {
      try {
        if (draftData.files.some(f => f.content.trim())) {
          await set('converter-draft-data', draftData);
        } else {
          await del('converter-draft-data');
        }
      } catch (e) {
        console.error("IndexedDB Error:", e);
      }
    }, 1500),
    []
  );

  useEffect(() => {
    const loadDraft = async () => {
      if (moduleData?.type === 'converter') return;

      try {
        const saved = await get('converter-draft-data');
        if (saved && saved.files?.length > 0 && saved.files.some(f => f.content.trim())) {
          // Apply draft state directly
          setFiles(saved.files);
          setActiveTabId(saved.activeTabId ?? saved.files[0]?.id);
          if (saved.outputFiles?.length > 0) setOutputFiles(saved.outputFiles);
          if (saved.targetLang) setTargetLang(saved.targetLang);
          if (saved.targetFramework) setTargetFramework(saved.targetFramework);
          if (saved.conversionNotes) setConversionNotes(saved.conversionNotes);
        }
      } catch (err) {
        console.error("Draft load failed", err);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft({ files, outputFiles, targetLang, targetFramework, activeTabId, conversionNotes });
  }, [files, outputFiles, targetLang, targetFramework, conversionNotes, saveDraft]);

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

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await get('converter-history');
        if (saved) setConversionHistory(saved);
      } catch (e) { console.error("History load failed", e); }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (!moduleData || moduleData.type !== 'converter') return;

    if (Array.isArray(moduleData.input) && moduleData.input.length > 0) {
      setFiles(moduleData.input);
      setActiveTabId(moduleData.input[0].id);
    }
    const out = moduleData.output ?? moduleData.fullOutput ?? moduleData;

    let newNotes = {};
    if (out.conversionNotes && Object.keys(out.conversionNotes).length > 0) {
      newNotes = out.conversionNotes;
      setConversionNotes(newNotes);
    }

    if (Array.isArray(out.outputFiles) && out.outputFiles.length > 0) {
      setOutputFiles(out.outputFiles);

      // Inject the loaded data into the conversion history as a baseline
      const timestamp = new Date().toISOString();
      setConversionHistory(prev => {
        const updated = { ...prev };
        out.outputFiles.forEach(rf => {
          const entry = {
            outputFile: rf,
            targetLang: out.targetLang,
            targetFramework: out.targetFramework,
            timestamp,
            notes: newNotes[rf.sourceId] || null,
          };
          const existing = updated[rf.sourceId] || [];
          // Only add if it's not already the most recent entry (prevents dupes on remount)
          if (existing[0]?.outputFile.content !== rf.content) {
            updated[rf.sourceId] = [entry, ...existing].slice(0, MAX_HISTORY_PER_FILE);
          }
        });
        saveHistoryToIdb(updated);
        return updated;
      });
    }

    if (out.targetLang) setTargetLang(out.targetLang);
    if (out.targetFramework) setTargetFramework(out.targetFramework);

    setModuleData(null);
  }, [moduleData]);

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
    setLintResult(null);
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

  const addToast = useCallback((type, message, detail = null) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message, detail }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 15000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleConvert = async (feedbackOverride = null) => {
    if (files.every(f => !f.content.trim())) return;
    setLoading(true);
    setLintResult(null);
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
        if (result.notes) newNotes['global'] = result.notes;
        if (Object.keys(newNotes).length > 0) setConversionNotes(newNotes);

        setModuleData(sanitize({
          type: 'converter',
          input: files,
          targetLang,
          sourceLang: activeFile?.language || null,
          output: { outputFiles: mapped, targetLang, targetFramework, conversionNotes: newNotes },
          timestamp: new Date().toISOString(),
        }));

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
    if (!activeOutputFile?.content) return;
    setLinting(true);
    setLintResult(null);

    const code = activeOutputFile.content;
    const lang = targetLang;

    const nativeResult = runNativeLint(code, lang);
    if (nativeResult) {
      const status = nativeResult.valid ? 'success' : 'error';
      setLintResult({ status, ...nativeResult });
      addToast(
        status,
        nativeResult.valid ? 'Syntax check passed' : 'Syntax errors found',
        nativeResult.summary
      );
      setLinting(false);
      return;
    }

    try {
      const result = await convertCode('linter', JSON.stringify({ code, lang }), { lang });
      if (!result) throw new Error('No response from linter');

      const status = result.valid ? 'success' : (result.errors?.length ? 'error' : 'warning');
      setLintResult({
        status,
        valid: result.valid,
        errors: result.errors || [],
        warnings: result.warnings || [],
        summary: result.summary || (result.valid ? 'No errors found.' : 'Errors detected.'),
      });
      addToast(
        status,
        result.valid ? 'Syntax check passed' : 'Syntax errors found',
        result.summary
      );
    } catch (e) {
      addToast('error', 'Linter failed', e.message);
      setLintResult({ status: 'error', valid: false, errors: [], warnings: [], summary: 'Linter failed to run.' });
    } finally {
      setLinting(false);
    }
  };

  const formatActiveCode = async (isOutput = false) => {
    const targetFile = isOutput ? activeOutputFile : activeFile;
    if (!targetFile?.content?.trim()) return;

    const lang = isOutput ? targetLang : (activeFile?.language || 'plaintext');
    const isJson = lang === 'json'
      || targetFile.fileName?.endsWith('.json')
      || targetFile.name?.endsWith('.json');

    // Fast path — JSON never needs an AI call
    if (isJson) {
      try {
        const formatted = JSON.stringify(JSON.parse(targetFile.content), null, 2);
        if (isOutput) {
          setOutputFiles(prev => prev.map(f => f.sourceId === targetFile.sourceId ? { ...f, content: formatted } : f));
        } else {
          updateFile(targetFile.id || activeTabId, formatted);
        }
        addToast('success', 'Formatted', 'JSON pretty-printed successfully.');
      } catch {
        addToast('error', 'Format failed', 'Content is not valid JSON.');
      }
      return;
    }

    // AI path for all other languages
    setFormatting(true);
    try {
      const result = await convertCode('formatter', targetFile.content, { lang });
      if (!result?.content) throw new Error('No output returned.');

      if (isOutput) {
        setOutputFiles(prev => prev.map(f =>
          f.sourceId === targetFile.sourceId ? { ...f, content: result.content } : f
        ));
      } else {
        updateFile(targetFile.id || activeTabId, result.content);
      }

      const detail = result.changes?.length
        ? result.changes.slice(0, 3).join(' · ')
        : 'No changes needed.';
      addToast('success', 'Formatted', detail);
    } catch (e) {
      addToast('error', 'Format failed', e.message);
    } finally {
      setFormatting(false);
    }
  };

  const removeHistoryEntry = (sourceId, entryIndex) => {
    setConversionHistory(prev => {
      const updated = { ...prev };
      if (updated[sourceId]) {
        updated[sourceId] = updated[sourceId].filter((_, i) => i !== entryIndex);
        if (updated[sourceId].length === 0) delete updated[sourceId];
      }
      saveHistoryToIdb(updated);
      return updated;
    });
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

  return {
    files, setFiles, outputFiles, activeTabId, setActiveTabId, activeFile, activeOutputFile,
    targetLang, setTargetLang, targetFramework, setTargetFramework, isPartialMode, setIsPartialMode,
    selectedRange, setSelectedRange,
    loading, formatting, linting, lintResult, toasts, dismissToast,
    fileInputRef, diffMode, setDiffMode,
    conversionNotes, notesOpen, setNotesOpen,
    feedbackText, setFeedbackText, handleReconvert,
    conversionHistory, historyPanelOpen, setHistoryPanelOpen, restoreHistoryEntry,
    handleFileUpload, updateFile, renameFile, handleAddFile, handleClearAll, removeFile,
    handleConvert, runLinter, formatActiveCode, downloadZip, downloadSingleFile, removeHistoryEntry
  };
}
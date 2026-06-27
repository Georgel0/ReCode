import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES, detectLanguage, useDraft } from '@/lib';
import { useApp } from '@/context';
import { set } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useLintFormatTools } from '@/components/widgets';

const MAX_HISTORY_PER_FILE = 3;

const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));

function buildImportGraph(filesArray) {
  const nameMap = {};
  filesArray.forEach(f => { nameMap[f.name] = f.id; });

  return filesArray.map(f => {
    const importMatches = [];
    const lines = f.content.split('\n');

    lines.forEach(line => {
      const m = line.match(/(?:import|require)\s*(?:\(?\s*['"]([^'"]+)['"]\s*\)?|[^'"]*from\s*['"]([^'"]+)['"])/);
      const importPath = m?.[1] || m?.[2];

      if (importPath) {
        const baseName = importPath.split('/').pop();
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
  const [selectedRange, setSelectedRange] = useState(null);

  const [loading, setLoading] = useState(false);
  const [diffMode, setDiffMode] = useState(false);

  const [conversionNotes, setConversionNotes] = useState({});
  const [notesOpen, setNotesOpen] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');

  const [conversionHistory, setConversionHistory] = useState({});
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const fileInputRef = useRef(null);

  const updateFile = useCallback((id, content) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
  }, []);

  const {
    formatting, linting, lintResult, toasts,
    setLintResult, addToast, dismissToast,
    runLinter, formatActiveCode,
  } = useLintFormatTools({ activeFile, activeOutputFile, targetLang, activeTabId, updateFile, setOutputFiles });

  useDraft(
    'converter-draft-data',
    { files, outputFiles, targetLang, targetFramework, activeTabId, conversionNotes, conversionHistory },
    (saved) => {
      if (saved.files?.length > 0 && saved.files.some(f => f.content.trim())) {
        setFiles(saved.files);
        setActiveTabId(saved.activeTabId ?? saved.files[0]?.id);
        if (saved.outputFiles?.length > 0) setOutputFiles(saved.outputFiles);
        if (saved.targetLang) setTargetLang(saved.targetLang);
        if (saved.targetFramework) setTargetFramework(saved.targetFramework);
        if (saved.conversionNotes) setConversionNotes(saved.conversionNotes);
        if (saved.conversionHistory) setConversionHistory(saved.conversionHistory);
      }
    },
    {
      isEmpty: (d) => d.files.every(f => !f.content.trim()),
      skip: moduleData?.type === 'converter',
    }
  );

  const saveHistoryToIdb = useRef(
    debounce(async (history) => {
      try { await set('converter-history', history); }
      catch (e) { console.error('History save failed', e); }
    }, 800)
  ).current;

  useEffect(() => {
    return () => saveHistoryToIdb.cancel();
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
          : (LANGUAGES.some(l => l.value === detectLanguage(content)) ? detectLanguage(content) : 'plaintext');
        resolve({ id: crypto.randomUUID(), name: file.name, language, content, size: file.size });
      };
      reader.readAsText(file);
    }));

    const newFiles = await Promise.all(newFilesPromises);
    if (newFiles.length > 0) {
      setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
      setActiveTabId(newFiles[0].id);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renameFile = (id, newName) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const handleAddFile = () => {
    const newId = crypto.randomUUID();
    setFiles(prev => [...prev, { id: newId, name: 'untitled.js', language: 'javascript', content: '', size: 0 }]);
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


  const handleConvert = async (feedbackOverride = null) => {
    if (files.every(f => !f.content.trim())) return;
    setLoading(true);
    setLintResult(null);
    setConversionNotes({});

    try {
      const filesWithGraph = buildImportGraph(files);

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
            ?? files[i]?.id,
        }));
        setOutputFiles(mapped);

        const newNotes = {};
        mapped.forEach(rf => { if (rf.notes) newNotes[rf.sourceId] = rf.notes; });
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

        const timestamp = new Date().toISOString();
        setConversionHistory(prev => {
          const updated = { ...prev };
          mapped.forEach(rf => {
            const entry = { outputFile: rf, targetLang, targetFramework, timestamp, notes: newNotes[rf.sourceId] || null };
            const existing = updated[rf.sourceId] || [];
            updated[rf.sourceId] = [entry, ...existing].slice(0, MAX_HISTORY_PER_FILE);
          });
          saveHistoryToIdb(updated);
          return updated;
        });

        setFeedbackText('');
      } else {
        throw new Error('Invalid array structure returned.');
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
    setOutputFiles(prev => [...prev.filter(f => f.sourceId !== sourceId), entry.outputFile]);
    if (entry.notes) setConversionNotes(prev => ({ ...prev, [sourceId]: entry.notes }));
    setHistoryPanelOpen(false);
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
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'converted_project.zip');
  };

  const downloadSingleFile = () => {
    if (!activeOutputFile) return;
    const blob = new Blob([activeOutputFile.content], { type: 'text/plain;charset=utf-8' });
    const ext = LANGUAGES.find(l => l.value === targetLang)?.ext ?? '.txt';
    const fallback = `converted_${activeFile?.name?.replace(/\.[^.]+$/, '') ?? 'file'}${ext}`;
    saveAs(blob, activeOutputFile.fileName || fallback);
  };


  return {
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
  };
}
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import { sanitizeFilename, validateFile, suggestRefactorMode, LANGUAGES } from './utils';
import { FileTabs, RefactorControls, OutputPanel } from './components';

import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';

import { get, set } from 'idb-keyval';

import './codeRefactor.css';

export default function CodeRefactor() {
 const { moduleData, qualityMode } = useApp();
 const [files, setFiles] = useState([{ id: crypto.randomUUID(), name: 'main.js', language: 'javascript', content: '', size: 0 }]);
 const [activeTabId, setActiveTabId] = useState(files[0].id);
 const [outputFiles, setOutputFiles] = useState([]);
 const [lastResult, setLastResult] = useState(false);
 
 const [loadingStage, setLoadingStage] = useState('idle');
 const [refactorMode, setRefactorMode] = useState('clean');
 const [suggestedMode, setSuggestedMode] = useState(null);
 const [viewMode, setViewMode] = useState('final');
 const [errorMsg, setErrorMsg] = useState('');
 const [storageWarning, setStorageWarning] = useState(false);
 const fileInputRef = useRef(null);
 const isRestoring = useRef(false);
 
 useEffect(() => {
  if (moduleData && moduleData.type === "refactor") {
   isRestoring.current = true;
   try {
    const savedInputs = typeof moduleData.input === 'string' ? JSON.parse(moduleData.input) : moduleData.input;
    const savedOutput = typeof moduleData.fullOutput === 'string' ? JSON.parse(moduleData.fullOutput) : moduleData.fullOutput;
    
    if (savedInputs && savedInputs.length > 0) {
     setFiles(savedInputs);
     setActiveTabId(savedInputs[0].id);
    }
    
    if (savedOutput) setOutputFiles(savedOutput);
    if (moduleData.refactorMode) setRefactorMode(moduleData.refactorMode);
   } catch (e) {
    console.error("Failed to restore history", e);
   }
   setTimeout(() => { isRestoring.current = false; }, 100);
  }
 }, [moduleData]);
 
 useEffect(() => {
  if (outputFiles.length > 0 && !isRestoring.current) {
   setLastResult({
    type: "refactor",
    input: JSON.stringify(files),
    output: outputFiles,
    refactorMode,
    qualityMode
   });
  }
 }, [outputFiles, files, refactorMode, qualityMode]);
 
 const saveDraft = useCallback(
  debounce(async (draftData) => {
   if (draftData.files.some(f => f.content.trim())) {
    try {
     await set('refactor-draft-data', draftData);
     setStorageWarning(false);
    } catch (e) {
     console.error("IndexedDB Error:", e);
     setStorageWarning(true);
    }
   }
  }, 1500),
  []
 );
 
 useEffect(() => {
  const loadDraft = async () => {
   try {
    const saved = await get('refactor-draft-data');
    
    if (saved && saved.files && saved.files.length > 0 && saved.files.some(f => f.content.trim())) {
     if (window.confirm("Continue from your previous draft?")) {
      setFiles(saved.files);
      setActiveTabId(saved.files[0]?.id);
      
      if (saved.outputFiles && saved.outputFiles.length > 0) {
       setOutputFiles(saved.outputFiles);
      }
     } else {
      await set('refactor-draft-data', null);
     }
    }
   } catch (err) {
    console.error("Failed to load IndexedDB draft", err);
   }
  };
  loadDraft();
 }, []);
 
 useEffect(() => {
  saveDraft({ files, outputFiles });
  return () => saveDraft.cancel();
 }, [files, outputFiles, saveDraft]);
 
 useEffect(() => {
  const activeFile = files.find(f => f.id === activeTabId);
  if (activeFile) {
   setSuggestedMode(suggestRefactorMode(activeFile.content));
  }
 }, [activeTabId, files]);
 
 const handleRefactor = async () => {
  if (files.every(f => !f.content.trim())) return;
  setLoadingStage('analyzing');
  setErrorMsg('');
  
  let optTimeout, valTimeout;
  try {
   optTimeout = setTimeout(() => setLoadingStage('optimizing'), 1500);
   valTimeout = setTimeout(() => setLoadingStage('validating'), 3000);
   
   const inputPayload = JSON.stringify(files.map(f => ({ sourceId: f.id, name: f.name, content: f.content })));
   const result = await convertCode('refactor', inputPayload, { mode: refactorMode, qualityMode });
   
   if (result && Array.isArray(result.files)) {
    setOutputFiles(result.files);
   } else {
    setErrorMsg(result?.error || "Invalid format returned from the API.");
   }
  } catch (error) {
   setErrorMsg("Failed to refactor code. Please check your connection.");
  } finally {
   clearTimeout(optTimeout); // Clear memory leak
   clearTimeout(valTimeout);
   setLoadingStage('idle');
  }
 };
 
 const handleLanguageChange = (id, newLangValue) => {
  const selectedLang = LANGUAGES.find(l => l.value === newLangValue);
  if (!selectedLang) return;
  
  setFiles(prev => prev.map(f => {
   if (f.id === id) {
    const nameWithoutExt = f.name.includes('.') ?
     f.name.substring(0, f.name.lastIndexOf('.')) : f.name;
    
    return {
     ...f,
     language: selectedLang.value,
     name: `${nameWithoutExt}${selectedLang.ext}`
    }
   };
   return f;
  }));
 };
 
 const handleKeyDown = useCallback((e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
   e.preventDefault();
   handleRefactor();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
   e.preventDefault();
   saveDraft(files, outputFiles);
  }
 }, [files, refactorMode, handleRefactor, saveDraft]);
 
 useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [handleKeyDown]);
 
 const handleFileUpload = async (e) => {
  setErrorMsg('');
  const uploadedFiles = Array.from(e.target.files);
  if (uploadedFiles.length === 0) return;
  
  const validFiles = [];
  for (const file of uploadedFiles) {
   const { valid, error } = validateFile(file);
   if (!valid) {
    setErrorMsg(error);
    continue;
   }
   validFiles.push(file);
  }
  
  const newFilesPromises = validFiles.map(file => new Promise((resolve, reject) => {
   const reader = new FileReader();
   
   reader.onload = (event) => {
    const name = sanitizeFilename(file.name);
    
    const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
    
    const matchedLang = LANGUAGES.find(l => l.ext === ext) || LANGUAGES.find(l => l.value === 'plaintext');
    
    resolve({
     id: crypto.randomUUID(),
     name: name,
     language: matchedLang.value,
     content: event.target.result,
     size: file.size
    });
   };
   reader.onerror = reject;
   reader.readAsText(file);
  }));
  
  try {
   const newFiles = await Promise.all(newFilesPromises);
   if (newFiles.length > 0) {
    setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
    setActiveTabId(newFiles[0].id);
   }
  } catch (err) {
   setErrorMsg("Failed to read one or more files.");
  } finally {
   if (fileInputRef.current) fileInputRef.current.value = "";
  }
 };
 
 const updateFile = (id, content) => {
  setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
 };
 
 const removeFile = (idToRemove) => {
  const newFiles = files.filter(f => f.id !== idToRemove);
  if (newFiles.length === 0) {
   const newId = crypto.randomUUID();
   setFiles([{ id: newId, name: 'untitled.txt', language: 'plaintext', content: '', size: 0 }]);
   setActiveTabId(newId);
  } else {
   setFiles(newFiles);
   if (activeTabId === idToRemove) setActiveTabId(newFiles[0].id);
  }
 };
 
 const downloadSingleFile = (file) => {
  const blob = new Blob([file.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  // Fallback cascade to ensure valid filename
  link.download = file.fileName || file.name || 'refactored-file.txt';
  link.click();
  URL.revokeObjectURL(url);
 };
 
 const downloadZip = async () => {
  const zip = new JSZip();
  outputFiles.forEach(file => zip.file(sanitizeFilename(file.fileName || file.name || 'file.txt'), file.content));
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "refactored_project.zip");
 };
 
 const activeFile = files.find(f => f.id === activeTabId);
 
 const getEditorLanguage = (lang) => {
  if (languages[lang]) return languages[lang];
  if (lang === 'c' || lang === 'cpp') return languages.clike;
  return languages.plaintext;
 };
 
 return (
  <div className="module-container">
   <ModuleHeader 
    title="AI Code Refactor" 
    description="Optimize, clean, or document your project files with context-aware AI."
    resultData={lastResult} 
   />

   {errorMsg && (
    <div className="error-banner">
     <i className="fa-solid fa-triangle-exclamation"></i>
     {errorMsg}
    </div>
   )}
      
   {storageWarning && (
    <div className="warning-banner">
     <i className="fa-solid fa-hard-drive"></i>
      Storage is full. Drafts will not be saved.
    </div>
   )}

   <div className="converter-grid">
    <div className="panel">
     <div className="panel-header-row">
      <h3><i className="fa-solid fa-file-code"></i> Source Files</h3>
      <div className="header-actions">
       <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
        <i className="fa-solid fa-upload"></i> Upload
       </button>
       <button 
        className="secondary-button" 
        onClick={() => {
        const currentExt = activeFile?.language ? LANGUAGES.find(l => l.value === activeFile.language)?.ext : '.js';
        const currentLang = activeFile?.language || 'javascript';
        const newFile = { id: crypto.randomUUID(), name: `new-file${currentExt}`, language: currentLang, content: '', size: 0 };
        setFiles([...files, newFile]);
        setActiveTabId(newFile.id);
        }} >
        <i className="fa-solid fa-plus"></i> Add File
       </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple hidden />
     </div>

     <RefactorControls 
      refactorMode={refactorMode} 
      setRefactorMode={setRefactorMode} 
      suggestedMode={suggestedMode} 
     />
          
     <div className="editor-toolbar">
      <h4>Language</h4>
      <select 
       value={activeFile?.language || 'javascript'} 
       onChange={(e) => handleLanguageChange(activeTabId, e.target.value)} >
       {LANGUAGES.map(lang => (
       <option key={lang.value} value={lang.value}>{lang.label}</option>
       ))}
      </select>
    </div>

    <FileTabs 
     files={files} 
     activeTabId={activeTabId} 
     setActiveTabId={setActiveTabId}
     removeFile={removeFile}
    />

   <div className="editor-container">
    <Editor
     value={activeFile?.content || ''}
     onValueChange={(code) => updateFile(activeTabId, code)}
     highlight={code => highlight(code, getEditorLanguage(activeFile?.language), activeFile?.language || 'javascript')}
     padding={15}
     className="code-editor"
     placeholder="Paste your code here..."
     style={{ fontFamily: '"Fira Code", "Courier New", monospace', fontSize: 14, }}
    />
   </div>

    <div className="action-row">
     <button 
      className="primary-button full-width" 
      onClick={handleRefactor} 
      disabled={loadingStage !== 'idle' || files.every(f => !f.content.trim())} >
      <i className={loadingStage !== 'idle' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-wand-magic-sparkles"}></i>
      {loadingStage !== 'idle' ? `Processing...` : 'Refactor Project'}
     </button>
    </div>
   </div>

    <div className="panel">
     <div className="panel-header-row">
      <h3><i className="fa-solid fa-square-check"></i> Refactored Result</h3>
      {outputFiles.length > 0 && (
       <button className="secondary-button" onClick={downloadZip}>
        <i className="fa-solid fa-file-zipper"></i> Download ZIP
       </button>
      )}
     </div>
          
     <OutputPanel 
      activeSourceFile={files.find(f => f.id === activeTabId)}
      outputFiles={outputFiles}
      viewMode={viewMode}
      setViewMode={setViewMode}
      loadingStage={loadingStage}
      downloadSingleFile={downloadSingleFile}
     />
    </div>
   </div>
  </div>
 );
}
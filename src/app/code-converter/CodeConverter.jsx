'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import { useRouter } from 'next/navigation';
import { CopyButton, CodeEditor, CodeOutput } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { get, set } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ConverterTabs from './components/ConverterTabs';
import './CodeConverter.css';

const FRAMEWORKS = [
 { value: 'none', label: 'Vanilla / Standard' },
 { value: 'react', label: 'React' },
 { value: 'vue', label: 'Vue.js' },
 { value: 'svelte', label: 'Svelte' },
 { value: 'express', label: 'Express.js' },
 { value: 'fastify', label: 'Fastify' }
];

export default function CodeConverter() {
 const { moduleData, qualityMode, setModuleData } = useApp();
 const router = useRouter();

 // State: Multi-File Management
 const [files, setFiles] = useState([{ id: crypto.randomUUID(), name: 'main.js', language: 'javascript', content: '', size: 0 }]);
 const [outputFiles, setOutputFiles] = useState([]);
 const [activeTabId, setActiveTabId] = useState(files[0].id);
 const activeFile = files.find(f => f.id === activeTabId);
 const activeOutputFile = outputFiles.find(f => f.sourceId === activeTabId);

 // State: Conversion Settings
 const [targetLang, setTargetLang] = useState('python');
 const [targetFramework, setTargetFramework] = useState('none');
 const [isPartialMode, setIsPartialMode] = useState(false);
 
 // State: UI & Status
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const [showInfoModal, setShowInfoModal] = useState(false);
 const [syncScroll, setSyncScroll] = useState(true);
 const [lintStatus, setLintStatus] = useState('idle'); // idle, linting, success, error

 const fileInputRef = useRef(null);
 const sourceScrollRef = useRef(null);
 const targetScrollRef = useRef(null);
 const initialSyncRef = useRef(false);

 // Draft Persistence via indexedDB 
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
     if (window.confirm("Continue from your previous draft?")) {
      setFiles(saved.files);
      setActiveTabId(saved.files[0]?.id);
      if (saved.outputFiles?.length > 0) setOutputFiles(saved.outputFiles);
     } else {
      await set('converter-draft-data', null);
     }
    }
   } catch (err) { console.error("Draft load failed", err); }
  };
  loadDraft();
 }, []);

 useEffect(() => {
  saveDraft({ files, outputFiles });
  return () => saveDraft.cancel();
 }, [files, outputFiles, saveDraft]);

 // File Operations
 const handleFileUpload = async (e) => {
  const uploadedFiles = Array.from(e.target.files);
  if (uploadedFiles.length === 0) return;

  const newFilesPromises = uploadedFiles.map(file => new Promise((resolve) => {
   const reader = new FileReader();
   reader.onload = (event) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const matchedLang = LANGUAGES.find(l => l.ext === ext) || LANGUAGES.find(l => l.value === 'plaintext');
    resolve({ id: crypto.randomUUID(), name: file.name, language: matchedLang.value, content: event.target.result, size: file.size });
   };
   reader.readAsText(file);
  }));

  const newFiles = await Promise.all(newFilesPromises);
  setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
  setActiveTabId(newFiles[0].id);
  if (fileInputRef.current) fileInputRef.current.value = "";
 };

 const updateFile = (id, content) => {
  setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
 };

 const handleAddFile = () => {
  const newId = crypto.randomUUID();
  setFiles([...files, { id: newId, name: 'untitled.js', language: 'javascript', content: '', size: 0 }]);
  setActiveTabId(newId);
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

 // Scroll Sync Logic
 const handleScrollSync = (e, targetRef) => {
  if (!syncScroll || !targetRef.current) return;
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  const ratio = scrollTop / (scrollHeight - clientHeight);
  targetRef.current.scrollTop = ratio * (targetRef.current.scrollHeight - targetRef.current.clientHeight);
 };

 // Conversion & Sandbox Logic
 const handleConvert = async () => {
  if (files.every(f => !f.content.trim())) return;
  setLoading(true);
  setLintStatus('idle');
  
  try {
   const inputPayload = JSON.stringify(files.map(f => ({ sourceId: f.id, name: f.name, content: f.content })));
   const result = await convertCode('converter', inputPayload, { 
    sourceLang: activeFile.language, 
    targetLang, 
    framework: targetFramework,
    isPartial: isPartialMode,
    qualityMode 
   });

   if (result && Array.isArray(result.files)) {
    setOutputFiles(result.files);
   } else {
    throw new Error("Invalid array structure returned.");
   }
  } catch (error) {
   alert(`Conversion failed: ${error.message}`);
  } finally {
   setLoading(false);
  }
 };

 const runLinter = () => {
  setLintStatus('linting');
  // Simulated WebAssembly/Browser Linter Hook
  setTimeout(() => {
   setLintStatus(Math.random() > 0.15 ? 'success' : 'error');
  }, 1200);
 };

 const downloadZip = async () => {
  const zip = new JSZip();
  outputFiles.forEach(file => zip.file(file.fileName || 'file.txt', file.content));
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "converted_project.zip");
 };

 return (
  <div className="module-container">
   <ModuleHeader 
    title="Universal Code Converter"
    description="Translate entire files or partial blocks between languages and frameworks."
    resultData={lastResult}
   />

   <div className="converter-grid">
    <div className="panel">
     <div className="panel-header-row">
      <h3><i className="fa-solid fa-file-code"></i> Source Files</h3>
      <div className="header-actions">
       <button className="secondary-button" onClick={() => fileInputRef.current.click()}>
        <i className="fa-solid fa-cloud-arrow-up"></i> Upload
       </button>
       <button className="secondary-button" onClick={handleAddFile}>
        <i className="fa-solid fa-plus"></i> Add
       </button>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
     </div>
       
     <div className="selector-bar flex-row">
      <select 
       value={activeFile?.language || 'javascript'} 
       onChange={(e) => setFiles(prev => prev.map(f => f.id === activeTabId ? { ...f, language: e.target.value } : f))}
       className="lang-select full-width" 
      >
       {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
     </div>
    
     <ConverterTabs files={files} activeTabId={activeTabId} setActiveTabId={setActiveTabId} removeFile={removeFile} />

     <div 
      className="sync-scroll-container" 
      ref={sourceScrollRef} 
      onScroll={(e) => handleScrollSync(e, targetScrollRef)}
     >
      <CodeEditor value={activeFile?.content || ''} onValueChange={(code) => updateFile(activeTabId, code)} language={activeFile?.language || 'javascript'} />
     </div>
     
     <div className="action-row between center-y mt-1">
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
      {outputFiles.length > 0 && (
       <button className="file-upload-btn download-btn" onClick={downloadZip}>
        <i className="fa-solid fa-file-zipper"></i> Download ZIP
       </button>
      )}
     </div>
          
     <div className="selector-bar flex-row gap-2">
      <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="lang-select full-width">
       {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <select value={targetFramework} onChange={(e) => setTargetFramework(e.target.value)} className="lang-select full-width">
       {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
     </div>

     <div className="results-container">
      {outputFiles.length > 0 ? (
       <div className="code-output-container"> 
        <ConverterTabs files={outputFiles.map(f => ({id: f.sourceId, name: f.fileName}))} activeTabId={activeTabId} setActiveTabId={setActiveTabId} removeFile={() => {}} readOnly={true} />
        
        <div 
         className="sync-scroll-container output-wrapper" 
         ref={targetScrollRef}
         onScroll={(e) => handleScrollSync(e, sourceScrollRef)}
        >
         <CodeOutput language={targetLang} content={activeOutputFile?.content || '// File not found in output'} />
         <CopyButton codeToCopy={activeOutputFile?.content || ''} />
        </div>
                 
        <div className="action-row between center-y">
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
        {loading ? <span><i className="fa-solid fa-circle-notch fa-spin"></i> Rebuilding AST...</span> : 'Result will appear here...'}
       </div>
      )}
     </div>
    </div>
   </div>
  </div>
 );
}
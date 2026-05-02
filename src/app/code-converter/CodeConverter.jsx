'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import { useRouter } from 'next/navigation';
import { CopyButton, CodeEditor, CodeOutput, ConfirmModal } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { get, set } from 'idb-keyval';
import debounce from 'lodash/debounce';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ConverterTabs } from './ConverterTabs';
import './CodeConverter.css';

const FRAMEWORKS = [
 { value: 'none', label: 'Vanilla / Standard' },
 { value: 'react', label: 'React' },
 { value: 'angular', label: 'Angular' },
 { value: 'vue', label: 'Vue.js' },
 { value: 'svelte', label: 'Svelte' },
 { value: 'express', label: 'Express.js' },
 { value: 'fastify', label: 'Fastify' }
];

export default function CodeConverter() {
 const { moduleData, qualityMode, setModuleData } = useApp();
 const router = useRouter();

 const [files, setFiles] = useState([{ id: crypto.randomUUID(), name: 'main.js', language: 'javascript', content: '', size: 0 }]);
 const [outputFiles, setOutputFiles] = useState([]);
 const [activeTabId, setActiveTabId] = useState(files[0].id);
 const activeFile = files.find(f => f.id === activeTabId);
 const activeOutputFile = outputFiles.find(f => f.sourceId === activeTabId);
 
 const [targetLang, setTargetLang] = useState('python');
 const [targetFramework, setTargetFramework] = useState('none');
 const [isPartialMode, setIsPartialMode] = useState(false);
 
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const [showInfoModal, setShowInfoModal] = useState(false);
 const [syncScroll, setSyncScroll] = useState(true);
 const [lintStatus, setLintStatus] = useState('idle');
 const [pendingDraft, setPendingDraft] = useState(null); 
 
 const fileInputRef = useRef(null);
 const sourceScrollRef = useRef(null);
 const targetScrollRef = useRef(null);
 
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
  return () => saveDraft.cancel();
 }, [files, outputFiles, saveDraft]);

 const handleFileUpload = async (e) => {
  const uploadedFiles = Array.from(e.target.files);
  if (uploadedFiles.length === 0) return;

  const MAX_FILE_SIZE = 1048576; // 1MB constraint
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

 const runLinter = async () => {
  setLintStatus('linting');
  
  setTimeout(() => {
    if (!activeOutputFile) {
      setLintStatus('error');
      return;
    }
    const code = activeOutputFile.content;
    
    try {
      if (targetLang === 'javascript' || targetLang === 'typescript') {
        new Function(code); 
      } else if (targetLang === 'json') {
        JSON.parse(code);
      } else {
        // Generic Bracket/Syntax Matcher for non-native JS environments
        const stack = [];
        const pairs = { '(': ')', '{': '}', '[': ']' };
        for (let char of code) {
          if (pairs[char]) stack.push(char);
          else if (Object.values(pairs).includes(char)) {
            if (stack.length === 0 || pairs[stack.pop()] !== char) {
              throw new Error(`Mismatched bracket: ${char}`);
            }
          }
        }
        if (stack.length > 0) throw new Error(`Unclosed bracket: ${stack.pop()}`);
      }
      setLintStatus('success');
    } catch (err) {
      console.error("Syntax Validation Error:", err);
      setLintStatus('error');
    }
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
        // Fallback block formatter
        let indentLevel = 0;
        formatted = formatted.split('\n').map(line => {
          let trimmed = line.trim();
          if (trimmed.startsWith('}')) indentLevel = Math.max(0, indentLevel - 1);
          let out = '  '.repeat(indentLevel) + trimmed;
          if (trimmed.endsWith('{')) indentLevel++;
          return out;
        }).join('\n');
     }
   } catch (err) {
     console.warn("Formatting failed, skipping.");
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
  if (pendingDraft.outputFiles?.length > 0) {
   setOutputFiles(pendingDraft.outputFiles);
  }
  setPendingDraft(null);
 };

 const handleCancelDraft = async () => {
  await set('converter-draft-data', null);
  setPendingDraft(null);
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
       <button className="secondary-button btn-danger" onClick={handleClearAll} title="Clear workspace">
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
       
     <div className="selector-bar flex-row">
      <select 
       value={activeFile?.language || 'javascript'} 
       onChange={(e) => setFiles(prev => prev.map(f => f.id === activeTabId ? { ...f, language: e.target.value } : f))}
       className="lang-select full-width" 
      >
       {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <button className="secondary-button format-btn" onClick={() => formatActiveCode(false)} title="Format current code">
        <i className="fa-solid fa-wand-magic"></i> Format
      </button>
     </div>
    
     <ConverterTabs 
       files={files} 
       activeTabId={activeTabId} 
       setActiveTabId={setActiveTabId} 
       removeFile={removeFile} 
       renameFile={renameFile} 
     />

     <div className="sync-scroll-container" ref={sourceScrollRef} onScroll={(e) => handleScrollSync(e, targetScrollRef)}>
      <CodeEditor 
        value={activeFile?.content || ''} 
        onValueChange={(code) => updateFile(activeTabId, code)} 
        language={activeFile?.language || 'javascript'} 
      />
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
      <div className="header-actions">
        {outputFiles.length > 0 && (
         <>
          <button className="secondary-button" onClick={downloadSingleFile} title="Download Active File Only">
           <i className="fa-solid fa-file-arrow-down"></i> Current
          </button>
          <button className="file-upload-btn download-btn" onClick={downloadZip} title="Download Full Project">
           <i className="fa-solid fa-file-zipper"></i> ZIP
          </button>
         </>
        )}
      </div>
     </div>
    
     <div className="selector-bar flex-row gap-2">
      <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="lang-select full-width">
       {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <select value={targetFramework} onChange={(e) => setTargetFramework(e.target.value)} className="lang-select full-width">
       {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <button className="secondary-button format-btn" onClick={() => formatActiveCode(true)} disabled={!outputFiles.length} title="Format output code">
        <i className="fa-solid fa-wand-magic"></i> Format
      </button>
     </div>

     <div className="results-container">
      {outputFiles.length > 0 ? (
       <div className="code-output-container"> 
        <ConverterTabs 
         files={outputFiles.map(f => ({id: f.sourceId, name: f.fileName}))} 
         activeTabId={activeTabId} 
         setActiveTabId={setActiveTabId} 
         removeFile={() => {}} 
         readOnly={true} 
        />
        
        <div className="sync-scroll-container output-wrapper" ref={targetScrollRef} onScroll={(e) => handleScrollSync(e, sourceScrollRef)}>
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
   
   <ConfirmModal 
    isOpen={!!pendingDraft}
    title="Continue Previous Session?"
    message="You have unsaved converted files from a previous session. Do you want to restore them?"
    confirmText="Restore Files"
    cancelText="Discard"
    icon="fa-box-archive"
    onConfirm={handleConfirmDraft}
    onCancel={handleCancelDraft}
   />
  </div>
 );
}
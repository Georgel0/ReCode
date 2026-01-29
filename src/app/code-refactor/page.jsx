'use client'; 

import { useState, useEffect, useRef } from 'react';
import { convertCode } from '@/services/api';
import ModuleHeader from '@/components/ModuleHeader';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export const metadata = {
  title: 'Code Refactor',
  description: 'Clean up technical debt, improve readability, and optimize your logic with AI.',
};

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'java', label: 'Java', ext: '.java' },
  { value: 'c', label: 'C', ext: '.c' },
  { value: 'csharp', label: 'C#', ext: '.cs' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
  { value: 'go', label: 'Go', ext: '.go' },
  { value: 'rust', label: 'Rust', ext: '.rs' },
  { value: 'php', label: 'PHP', ext: '.php' },
  { value: 'plaintext', label: 'Plain Text', ext: '.txt' }
];

const REFACTOR_MODES = [
  { id: 'clean', label: 'Clean & Readability', desc: 'Improves naming, structure, and formatting.' },
  { id: 'perf', label: 'Performance', desc: 'Optimizes loops, memory usage, and complexity.' },
  { id: 'modern', label: 'Modernize Syntax', desc: 'Updates legacy code (e.g., var to const, async/await).' },
  { id: 'comments', label: 'Add Comments', desc: 'Adds documentation and explanatory comments.' },
];

export default function CodeRefactor({ onLoadData, onSwitchModule, qualityMode }) {
  const [files, setFiles] = useState([{ id: 1, name: 'main.js', language: 'javascript', content: '' }]);
  const [activeTab, setActiveTab] = useState(1);
  const [outputFiles, setOutputFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refactorMode, setRefactorMode] = useState('clean');
  const fileInputRef = useRef(null);
  const [lastResult, setLastResult] = useState(false);
  
  useEffect(() => {
    if (onLoadData && onLoadData.type === 'refactor') {
      if (onLoadData.inputFiles) setFiles(onLoadData.inputFiles);
      if (onLoadData.fullOutput?.files) setOutputFiles(onLoadData.fullOutput.files);
    }
  }, [onLoadData]);
  
  // Sync index helper
  const activeFileIndex = files.findIndex(f => f.id === activeTab);
  const safeIndex = activeFileIndex === -1 ? 0 : activeFileIndex;
  
  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;
    
    setOutputFiles([]);
    
    const newFilesPromises = uploadedFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          let name = file.name;
          let extension = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';
          let matchedLang = LANGUAGES.find(l => l.ext === extension);
          
          if (!matchedLang) {
            name = name + (extension ? '' : '.txt');
            matchedLang = LANGUAGES.find(l => l.value === 'plaintext');
          }
          
          resolve({
            id: Date.now() + Math.random(),
            name: file.name,
            language: matchedLang ? matchedLang.value : 'javascript',
            content: event.target.result
          });
        };
        reader.readAsText(file);
      });
    });
    
    const newFiles = await Promise.all(newFilesPromises);
    setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
    setActiveTab(newFiles[0].id);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const updateFile = (id, field, value) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  
  const removeFile = (e, idToRemove) => {
    e.stopPropagation();
    if (files.length === 1) {
      handleClear();
      return;
    }
    const newFiles = files.filter(f => f.id !== idToRemove);
    setFiles(newFiles);
    setOutputFiles([]);
    if (idToRemove === activeTab) setActiveTab(newFiles[0].id);
  };
  
  const handleClear = () => {
    setFiles([{ id: Date.now(), name: 'untitled.js', language: 'javascript', content: '' }]);
    setActiveTab(files[0]?.id || 1);
    setOutputFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleRefactor = async () => {
    if (files.every(f => !f.content.trim())) return;
    setLoading(true);
    setOutputFiles([]);
    setLastResult(false);
    try {
      const inputFiles = JSON.stringify(files.map(f => ({
        name: f.name,
        content: f.content
      })));
      
      const result = await convertCode('refactor', inputFiles, { mode: refactorMode, qualityMode });
      
      if (result && result.files) {
        setOutputFiles(result.files);
        setLastResult({
          type: "refactor",
          input: inputFiles,
          output: result
        });
      } else if (result.error) {
        console.error("AI error: " + result.error);
      }
    } catch (error) {
      console.error("Refactor failed:", error);
      alert("Failed to refactor code. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const downloadSingleFile = (file) => {
    if (!file) return;
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, file.fileName || file.name);
  };
  
  const downloadZip = async () => {
    const zip = new JSZip();
    outputFiles.forEach(file => {
      zip.file(file.fileName || 'file.txt', file.content);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "refactored_project.zip");
  };
  
  const getLanguage = (name) => {
    if (!name) return 'javascript';
    const ext = `.${name.split('.').pop().toLowerCase()}`;
    return LANGUAGES.find(l => l.ext === ext)?.value || 'javascript';
  };
  
  const currentFile = files[safeIndex];
  const currentOutputFile = outputFiles[safeIndex];
  
  return (
    <div className="module-container">
      <ModuleHeader 
        title="Code Refactor"
        description="Refactor and optimize multiple files into modern, clean code simultaneously."
        resultData={lastResult}
      />
        <div className="refactor-options">
            <span className="label-text">Refactor Goal:</span>
            <div className="mode-selector">
                {REFACTOR_MODES.map(mode => (
                    <button 
                        key={mode.id}
                        className={`mode-btn ${refactorMode === mode.id ? 'selected' : ''}`}
                        onClick={() => setRefactorMode(mode.id)}
                        title={mode.desc}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>
        </div>

      <div className="converter-grid">
        <div className="panel">
          <div className="panel-header-row">
            <h3>Source Code</h3>
            <div className="header-actions">
              <button className="file-upload-btn" onClick={() => fileInputRef.current.click()}>
                Upload Files
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                multiple 
                onChange={handleFileUpload}
                accept=".js,.ts,.py,.java,.c,.cs,.cpp,.go,.rs,.php,.txt,text/plain"
              />
            </div>
          </div>

          <div className="tabs-container">
            {files.map(file => (
              <div 
                key={file.id} 
                className={`tab-btn ${activeTab === file.id ? 'active' : ''}`} 
                onClick={() => setActiveTab(file.id)}
              >
                <span className="tab-name">{file.name || 'untitled'}</span>
                <span className="close-tab" onClick={(e) => removeFile(e, file.id)}>×</span>
              </div>
            ))}
          </div>
          
          <div className="editor-container">
            <textarea 
                className="code-editor"
                value={currentFile?.content || ''}
                onChange={(e) => updateFile(currentFile.id, 'content', e.target.value)}
                placeholder="Paste your code here or upload files..."
                spellCheck="false"
            />
          </div>

          <div className="action-row">
            <button 
              className="primary-button action-btn" 
              onClick={handleRefactor} 
              disabled={loading || files.every(f => !f.content.trim())}
            >
              {loading ? 'Processing...' : 'Refactor Project'}
            </button>
            <button className="secondary-button clear-btn" onClick={handleClear}>
                Clear
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header-row">
            <h3>Refactored Result</h3>
            {outputFiles.length > 0 && (
               <div className="header-actions">
                  <button className="file-upload-btn download-btn" onClick={downloadZip}>Download All (ZIP)</button>
               </div>
            )}
          </div>

          {outputFiles.length > 0 ? (
            <>
              <div className="tabs-container">
                {outputFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className={`tab-btn ${safeIndex === idx ? 'active' : ''}`} 
                    onClick={() => files[idx] && setActiveTab(files[idx].id)}
                    style={{ cursor: files[idx] ? 'pointer' : 'not-allowed', opacity: files[idx] ? 1 : 0.5 }}
                  >
                    {file.fileName}
                  </div>
                ))}
              </div>

              <div className="highlighter-wrapper flex-grow">
                {currentOutputFile ? (
                    <SyntaxHighlighter 
                      language={getLanguage(currentOutputFile.fileName)} 
                      style={vscDarkPlus}
                      showLineNumbers={true}
                      customStyle={{ margin: 0, height: '100%', borderRadius: '0 0 8px 8px', fontSize: '0.85rem' }}
                    >
                      {currentOutputFile.content}
                    </SyntaxHighlighter>
                ) : (
                    <div className="placeholder-text">Select a source file to view its result.</div>
                )}
              </div>

              <div className="action-row">
                <button className="primary-button secondary-action-btn" onClick={() => downloadSingleFile(currentOutputFile)}>
                  Download File
                </button>
                <button className="primary-button" onClick={() => {
                  navigator.clipboard.writeText(currentOutputFile.content);
                }}>
                  Copy
                </button>
              </div>
            </>
          ) : (
            <div className="placeholder-container-inner">
                {loading ? (
                   <div className="processing-state">
                       <div className="pulse-ring"></div>
                       <p>AI is optimizing your files...</p>
                       <small>Mode: {REFACTOR_MODES.find(m => m.id === refactorMode)?.label}</small>
                   </div>
               ) : (
                   <div className="empty-state">
                       <p>Better code will appear here after refactoring...</p>
                   </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
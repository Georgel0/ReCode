import { useState, useEffect, useRef } from 'react';
import { convertCode } from '../services/api';
import { saveHistory } from '../services/firebase';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './Modules.css';

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
];

export default function CodeRefactor({ onLoadData, onSwitchModule }) {
  const [files, setFiles] = useState([]);
  const [activeTab, setActiveTab] = useState(1);
  const [outputFiles, setOutputFiles] = useState([]);
  const [activeOutputIdx, setActiveOutputIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    if (onLoadData && onLoadData.type === 'refactor') {
      if (onLoadData.inputFiles) setFiles(onLoadData.inputFiles);
      if (onLoadData.fullOutput?.files) setOutputFiles(onLoadData.fullOutput.files);
    }
  }, [onLoadData]);
  
  // Handle Multiple File Upload
  const handleFileUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;
    
    const newFilesPromises = uploadedFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const extension = '.' + file.name.split('.').pop().toLowerCase();
          const matchedLang = LANGUAGES.find(l => l.ext === extension);
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
    
    // If we only had the default empty file, replace it. Otherwise, append.
    setFiles(prev => (prev.length === 1 && !prev[0].content.trim()) ? newFiles : [...prev, ...newFiles]);
    setActiveTab(newFiles[0].id);
    
    // Reset file input so same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const updateFile = (id, field, value) => {
    setFiles(files.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  
  const handleClear = () => {
    if (window.confirm("Clear all files and output?")) {
      setFiles([{ id: 1, name: 'index.js', language: 'javascript', content: '' }]);
      setActiveTab(1);
      setOutputFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  const handleRefactor = async () => {
    if (files.some(f => !f.content.trim())) return;
    setLoading(true);
    try {
      const result = await convertCode('refactor', JSON.stringify(files));
      if (result && result.files) {
        setOutputFiles(result.files);
        setActiveOutputIdx(0);
        await saveHistory('refactor', JSON.stringify(files), result);
      }
    } catch (error) {
      console.error("Refactor failed:", error);
      alert("Failed to refactor code. Please try again.");
    }
    setLoading(false);
  };
  
  const downloadSingleFile = (file) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, file.fileName || file.name);
  };
  
  const downloadZip = async () => {
    const zip = new JSZip();
    outputFiles.forEach(file => {
      zip.file(file.fileName, file.content);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "refactored_project.zip");
  };
  
  const getLanguage = (name) => {
    const ext = name?.split('.').pop();
    return LANGUAGES.find(l => l.ext === `.${ext}`)?.value || 'javascript';
  };
  
  const currentFile = files.find(f => f.id === activeTab);
  const currentOutputFile = outputFiles[activeOutputIdx];
  
  return (
    <div className="module-container">
      <header className="module-header">
        <h1>Smart Code Refactor</h1>
        <p>Refactor and optimize multiple files into modern, clean code simultaneously.</p>
      </header>

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
                accept=".js,.ts,.py,.java,.c,.cs,.cpp,.go,.rs,.php"
              />
            </div>
          </div>

          <div className="tabs-container">
            {files.map(file => (
              <div key={file.id} className={`tab-btn ${activeTab === file.id ? 'active' : ''}`} onClick={() => setActiveTab(file.id)}>
                {file.name || 'untitled'}
              </div>
            ))}
          </div>
          
          <textarea 
            className="flex-grow"
            value={currentFile?.content || ''}
            onChange={(e) => updateFile(currentFile.id, 'content', e.target.value)}
            placeholder="Paste your code here or upload files..."
            spellCheck="false"
          />

          <div className="action-row">
            <button className="primary-button action-btn" onClick={handleRefactor} disabled={loading || files.every(f => !f.content.trim())}>
              {loading ? 'Processing...' : 'Refactor Project'}
            </button>
            <button className="primary-button secondary-action-btn" onClick={handleClear}>
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
                  <div key={idx} className={`tab-btn ${activeOutputIdx === idx ? 'active' : ''}`} onClick={() => setActiveOutputIdx(idx)}>
                    {file.fileName}
                  </div>
                ))}
              </div>

              <div className="highlighter-wrapper flex-grow">
                <SyntaxHighlighter 
                  language={getLanguage(currentOutputFile?.fileName)} 
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, height: '100%', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  {currentOutputFile?.content || ''}
                </SyntaxHighlighter>
              </div>

              <div className="action-row">
                <button className="primary-button secondary-action-btn" onClick={() => downloadSingleFile(currentOutputFile)}>
                  Download File
                </button>
                <button className="primary-button" onClick={() => {
                  navigator.clipboard.writeText(currentOutputFile.content);
                  alert("Copied to clipboard!");
                }}>
                  Copy
                </button>
              </div>
            </>
          ) : (
            <div className="placeholder-text">
              {loading ? 'AI is optimizing your files...' : 'Better code will appear here after refactoring...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
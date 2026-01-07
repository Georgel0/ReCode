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
 const [files, setFiles] = useState([{ id: 1, name: 'index.js', language: 'javascript', content: '' }]);
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
 
 const addTab = () => {
  const newId = Date.now();
  setFiles([...files, { id: newId, name: `file_${files.length + 1}.js`, language: 'javascript', content: '' }]);
  setActiveTab(newId);
 };
 
 const removeTab = (id, e) => {
  e.stopPropagation();
  if (files.length === 1) return;
  const newFiles = files.filter(f => f.id !== id);
  setFiles(newFiles);
  if (activeTab === id) setActiveTab(newFiles[0].id);
 };
 
 const updateFile = (id, field, value) => {
  setFiles(files.map(f => f.id === id ? { ...f, [field]: value } : f));
 };
 
 const handleClear = () => {
  if (window.confirm("Clear all files and output?")) {
   setFiles([{ id: 1, name: 'index.js', language: 'javascript', content: '' }]);
   setActiveTab(1);
   setOutputFiles([]);
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
   console.error(error);
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
        <p>Refactor and optimize multiple files into modern, clean code.</p>
      </header>

      <div className="converter-grid">
        <div className="panel">
          <div className="panel-header-row">
            <h3>Source Code</h3>
            <div className="header-actions">
              <button className="primary-button secondary-action-btn" onClick={handleClear}>Clear</button>
              <button className="primary-button" onClick={addTab}>+</button>
            </div>
          </div>

          <div className="tabs-container">
            {files.map(file => (
              <div key={file.id} className={`tab-btn ${activeTab === file.id ? 'active' : ''}`} onClick={() => setActiveTab(file.id)}>
                {file.name}
                <span className="close-tab" onClick={(e) => removeTab(file.id, e)}>×</span>
              </div>
            ))}
          </div>

          <div className="action-row start" style={{ marginBottom: '1rem', gap: '0.5rem' }}>
            <input 
              className="lang-select" 
              value={currentFile?.name} 
              onChange={(e) => updateFile(currentFile.id, 'name', e.target.value)} 
            />
            <select 
              value={currentFile?.language} 
              onChange={(e) => updateFile(currentFile.id, 'language', e.target.value)}
              className="lang-select"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          
          <textarea 
            className="flex-grow"
            value={currentFile?.content}
            onChange={(e) => updateFile(currentFile.id, 'content', e.target.value)}
            placeholder="Paste your old code here..."
            spellCheck="false"
          />

          <div className="action-row">
            <button className="primary-button" onClick={handleRefactor} disabled={loading}>
              {loading ? 'Processing...' : 'Refactor Project'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header-row">
            <h3>Refactored Result</h3>
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
                  customStyle={{ margin: 0, height: '100%', borderRadius: '8px' }}
                >
                  {currentOutputFile?.content || ''}
                </SyntaxHighlighter>
              </div>

              <div className="action-row">
                <button className="primary-button" onClick={() => downloadSingleFile(currentOutputFile)}>Download File</button>
                {outputFiles.length > 1 && (
                  <button className="primary-button" onClick={downloadZip}>Download ZIP</button>
                )}
                <button className="primary-button" onClick={() => navigator.clipboard.writeText(currentOutputFile.content)}>Copy</button>
              </div>
            </>
          ) : (
            <div className="placeholder-text">
              {loading ? 'AI is optimizing your files...' : 'Better code will appear here...'}
            </div>
          )}
        </div>
      </div>
    </div>
 );
}
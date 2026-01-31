'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/ModuleHeader';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useApp } from '@/context/AppContext'; 

export default function CodeGenerator({ onSwitchModule }) {
 const [input, setInput] = useState('');
 const [files, setFiles] = useState([]);
 const [activeFileIndex, setActiveFileIndex] = useState(0);
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const { moduleData, qualityMode } = useApp();
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'generator') {
   setInput(moduleData.input || '');
   const savedFiles = moduleData.fullOutput?.files || [];
   setFiles(savedFiles);
   setActiveFileIndex(0);
  }
 }, [moduleData]);
 
 const getLanguage = (fileName) => {
  if (!fileName) return 'javascript';
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
   js: 'javascript',
   jsx: 'react',
   ts: 'typescript',
   tsx: 'typescript',
   html: 'xml',
   css: 'css',
   json: 'json',
   md: 'markdown',
   py: 'python',
   c: 'c',
   cs: 'csharp',
   cpp: 'cpp',
   swift: 'swift',
   go: 'go',
   php: 'php',
   java: 'java',
   sql: 'sql',
   sh: 'bash',
   yml: 'yaml'
  };
  return map[ext] || 'javascript';
 };
 
 const handleGenerate = async () => {
  if (!input.trim()) return;
  setLoading(true);
  setFiles([]);
  setLastResult(false);
  
  try {
   let result = await convertCode('generator', input, { qualityMode });
   
   if (result && result.files && result.files.length === 1 && result.files[0].fileName === 'index.txt') {
    const rawContent = result.files[0].content;
    if (rawContent.trim().startsWith('{')) {
     try {
      const parsed = JSON.parse(rawContent);
      if (parsed.files) {
       result = parsed;
      }
     } catch (e) {
      console.warn("Frontend failsafe parse failed:", e);
     }
    }
   }
   
   if (result && result.files) {
    setFiles(result.files);
    setActiveFileIndex(0);
    setLastResult({
     type: 'generator',
     input: input,
     output: result
    });
   }
  } catch (error) {
   alert(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const handleClearAll = () => {
  setInput('');
  setFiles([]);
  setActiveFileIndex(0);
 };
 
 const downloadSingleFile = (file) => {
  if (!file) return;
  const blob = new Blob([file.content], { type: 'text/plain' });
  saveAs(blob, file.fileName);
 };
 
 const downloadZip = async () => {
  const zip = new JSZip();
  files.forEach(f => zip.file(f.fileName, f.content));
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'project.zip');
 };
 
 const activeFile = files[activeFileIndex] || null;
 
 const formatContent = (content) => {
  if (!content) return '';
  if (content.includes('\\n') && !content.includes('\n')) {
   return content.replace(/\\n/g, '\n');
  }
  return content;
 };
 
 return (
  <div className="module-container">
      <ModuleHeader 
        title="Code Generator"
        description="Describe your code snippet or project requirements and the AI will scaffold a multi-file solution for you."
        resultData={lastResult}
      />
      <p>Make sure your description its as detailed as possible.</p>

      <div className="converter-grid">
        <div className="panel">
          <h3>
            <i className="fa-solid fa-layer-group" style={{ marginRight: '8px' }}></i>
            Requirements
          </h3>
          <textarea 
            className="flex-grow"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="E.g., Create a React button component and a CSS file for styling..." 
            spellCheck="false"
          /> 
          <div className="action-row">
            <button className="secondary-button clear-btn" onClick={handleClearAll} disabled={loading || !input}>
              <i className="fa-solid fa-trash-can"></i> Clear
            </button>
            <button 
              className="primary-button" 
              onClick={handleGenerate} 
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <><i className="fa-solid fa-circle-notch fa-spin"></i> Generating...</>
              ) : (
                <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate Code</>
              )}
            </button> 
          </div>
        </div>

        <div className="panel">
          <h3>
            <i className="fa-solid fa-code" style={{ marginRight: '8px' }}></i>
            Generated Output
          </h3>
          
          <div className="results-container">
            {files.length > 0 ? (
              <div className="code-output-container">
                
                <div className="tabs-container">
                  {files.map((file, idx) => (
                    <button 
                      key={idx} 
                      className={`tab-btn ${activeFileIndex === idx ? 'active' : ''}`}
                      onClick={() => setActiveFileIndex(idx)}
                      title={file.fileName}
                    >
                      <i className="fa-regular fa-file-code"></i> {file.fileName}
                    </button>
                  ))}
                </div>

                <div className="highlighter-wrapper">
                  <SyntaxHighlighter 
                    language={getLanguage(activeFile?.fileName)} 
                    style={vscDarkPlus} 
                    customStyle={{ 
                      margin: 0, 
                      height: '100%', 
                      background: 'transparent',
                      fontSize: '0.9rem',
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word'   
                    }}
                    showLineNumbers={true}
                    wrapLines={true}
                    wrapLongLines={true}  
                  >
                    {activeFile ? formatContent(activeFile.content) : ''}
                  </SyntaxHighlighter>
                </div>
                
                <div className="action-row">
                   <button 
                    className="secondary-button" 
                    onClick={() => navigator.clipboard.writeText(activeFile?.content || '')}
                    title="Copy to clipboard"
                  >
                    <i className="fa-regular fa-copy"></i> Copy
                  </button> 
                  
                <div style={{ flex: 1 }}></div>

                  <button className="secondary-button" onClick={() => downloadSingleFile(activeFile)}>
                    <i className="fa-solid fa-download"></i> File
                  </button>
                  
                  {files.length > 1 && (
                    <button className="primary-button" onClick={downloadZip}>
                      <i className="fa-solid fa-file-zipper"></i> Download ZIP
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                {loading ? (
                  <div className="analyzing-state">
                    <div className="spinner"></div>
                    <p>AI is building your solution...</p>
                  </div>
                ) : (
                  <div className="analyzing-state">
                    <i className="fa-solid fa-laptop-code" style={{ fontSize: '2.5rem', marginBottom: '0.3rem', opacity: 0.7 }}></i>
                    <p>Enter your requirements to generate project files.</p>
                  </div>
                )}
              </div> 
            )}
          </div>
        </div>
      </div>
    </div>
 );
}
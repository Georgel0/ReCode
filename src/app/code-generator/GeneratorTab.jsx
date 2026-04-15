'use client';

import { CopyButton, CodeOutput } from '@/components/ui';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getLanguage } from './utils';

export default function GeneratorTab({ 
  input, 
  setInput, 
  files, 
  activeFileIndex, 
  setActiveFileIndex, 
  loading, 
  error,
  handleGenerate, 
  handleClearAll 
}) {

  const activeFile = files[activeFileIndex] || null;

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

  return (
    <div className="converter-grid">
      <div className="panel">
        <h3>
          <i className="fa-solid fa-layer-group"></i>
          Requirements
        </h3>
        <textarea 
          className="flex-grow main-input"
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="E.g., Create a React button component and a CSS file for styling..." 
          spellCheck="true"
        />
        
        {error && <div className="error-message generator-error">{error}</div>}
        
        <div className="action-row">
          <button className="secondary-button" onClick={handleClearAll}>
            Clear
          </button>
          <button 
            className="primary-button" 
            onClick={handleGenerate} 
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <><span className="spinner button-spinner"></span> Building...</>
            ) : (
              <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate Code</>
            )}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="output-header-row">
          <div className="tabs-container file-tabs">
            {files.map((file, idx) => (
              <button
                key={idx}
                className={`tab-btn ${activeFileIndex === idx ? 'active' : ''}`}
                onClick={() => setActiveFileIndex(idx)}
              >
                {file.fileName}
              </button>
            ))}
          </div>
        </div>

        <div className="output-content-area">
          {files.length > 0 ? (
            <div className="editor-wrapper">
              <div className="editor-toolbar">
                <CodeOutput 
                  code={activeFile?.content || ''} 
                  language={activeFile ? getLanguage(activeFile.fileName) : ''} 
                />
                <CopyButton codeToCopy={activeFile?.content || ''} />
              </div>
                      
              <div className="action-row">
                <div className="spacer"></div>
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
            <div className="placeholder-container">
              {loading ? (
                <div className="status-message">
                  <div className="spinner status-spinner"></div>
                  <p>AI is building your solution based on your config...</p>
                </div>
              ) : (
                <div className="status-message">
                  <i className="fa-solid fa-laptop-code status-icon"></i>
                  <p>Enter your requirements and configure your stack to generate files.</p>
                </div>
              )}
            </div> 
          )}
        </div>
      </div>
    </div>
  );
}
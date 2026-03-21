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
      {/* Input Panel */}
      <div className="panel">
        <h3>
          <i className="fa-solid fa-layer-group" style={{ marginRight: '8px' }}></i>
          Requirements
        </h3>
        <textarea 
          className="flex-grow main-input"
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="E.g., Create a React button component and a CSS file for styling..." 
          spellCheck="true" // UX Enhancement
        /> 
        
        {error && (
          <div className="error-message has-error" style={{ padding: '10px', borderRadius: '6px', border: '1px solid', marginTop: '10px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i> {error}
          </div>
        )}

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

      {/* Output Panel */}
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
                <CodeOutput 
                  language={getLanguage(activeFile?.fileName)}
                  content={activeFile?.content || ''} 
                />
                <CopyButton codeToCopy={activeFile?.content || ''} />
              </div>
                      
              <div className="action-row">
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
                <div className="analyzing-state" style={{ textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 15px' }}></div>
                  <p>AI is building your solution based on your config...</p>
                </div>
              ) : (
                <div className="analyzing-state" style={{ textAlign: 'center' }}>
                  <i className="fa-solid fa-laptop-code" style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.7 }}></i>
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

import { useState, useEffect } from 'react';
import { convertCode } from '../services/api'; 
import ModuleHeader from '../components/ModuleHeader';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function CodeGenerator({ onLoadData, onSwitchModule }) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]); 
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(false);

  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      const savedFiles = onLoadData.fullOutput?.files || [];
      setFiles(savedFiles);
      setActiveFileIndex(0);
    }
  }, [onLoadData]);

  const getLanguage = (fileName) => {
    if (!fileName) return 'javascript';
    const ext = fileName.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript',
      jsx: 'javascript',
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
      php: 'php'
    };
    return map[ext] || 'javascript';
  };

  const handleGenerate = async () => {
    if (!input.trim()) return; 
    setLoading(true);
    setFiles([]);

    try {
      let result = await convertCode('generator', input);
      
      // If backend returns a single 'index.txt' containing JSON, try to parse it here.
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
        await saveHistory('generator', input, result);
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

  return (
    <div className="module-container">
      <header className="module-header">
        <h1>Code Generator</h1>
        <p>Describe your project and the AI will generate multiple files with syntax highlighting.</p>
      </header>

      <div className="converter-grid">
        <div className="panel input-panel">
          <h3>Requirements</h3>
          <textarea 
            className="flex-grow"
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="E.g., Create a React button component with a separate CSS file..." 
          /> 
          <div className="action-row">
            <button 
              className="primary-button" 
              onClick={handleGenerate} 
              disabled={loading}
            >{loading ? 'Generating...' : 'Generate Code'}
            </button> 
            <button className="primary-button clear-btn" onClick={handleClearAll}>Clear All
            </button>
          </div>
        </div>

        <div className="panel output-panel">
          <h3>Generated Output</h3>
          <div className="results-container">
            {files.length > 0 ? (
              <div className="code-output-container">
                <div className="tabs-container">
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

                <div className="highlighter-wrapper">
                  <SyntaxHighlighter 
                    language={getLanguage(activeFile?.fileName)} 
                    style={vscDarkPlus} 
                    customStyle={{ margin: 0, height: '100%', borderRadius: '8px' }}
                  >
                    {activeFile ? activeFile.content : ''}
                  </SyntaxHighlighter>
                </div>
                
                <div className="action-row">
                  <button className="primary-button" onClick={() => downloadSingleFile(activeFile)}>
                    Download File
                  </button>
                  {files.length > 1 && (
                    <button className="primary-button" onClick={downloadZip}>Download ZIP</button>
                  )}
                  <button 
                    className="primary-button" 
                    onClick={() => navigator.clipboard.writeText(activeFile.content)}
                  >
                    Copy
                  </button> 
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                {loading ? 'AI is building your project...' : 'Result will appear here...'}
              </div> 
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
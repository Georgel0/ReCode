import { useState, useEffect, useRef } from 'react';
import { convertCode } from '../services/api';
import { saveHistory } from '../services/firebase';
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
  { value: 'swift', label: 'Swift', ext: '.swift' },
];

export default function CodeConverter({ onLoadData, onSwitchModule }) {
  const [sourceLang, setSourceLang] = useState('javascript');
  const [targetLang, setTargetLang] = useState('python');
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy');
  const [fileName, setFileName] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      setOutputCode(onLoadData.fullOutput?.convertedCode || '');
      if (onLoadData.sourceLang) setSourceLang(onLoadData.sourceLang);
      if (onLoadData.targetLang) setTargetLang(onLoadData.targetLang);
    }
  }, [onLoadData]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    const matchedLang = LANGUAGES.find(l => l.ext === extension);

    if (matchedLang) {
      setSourceLang(matchedLang.value);
    }

    setFileName(file.name.split('.').slice(0, -1).join('.'));

    const reader = new FileReader();
    reader.onload = (event) => {
      setInput(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!outputCode) return;
    const targetExt = LANGUAGES.find(l => l.value === targetLang)?.ext || '.txt';
    const blob = new Blob([outputCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName || 'converted_code'}${targetExt}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInput(outputCode);
    setOutputCode('');
  };

  const handleClear = () => {
    setInput('');
    setOutputCode('');
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConvert = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    try {
      const result = await convertCode('converter', input, sourceLang, targetLang);
      if (result && result.convertedCode) {
        setOutputCode(result.convertedCode);
        await saveHistory('converter', input, result, sourceLang, targetLang);
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (error) {
      alert(`Conversion failed: ${error.message}`);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (outputCode) {
      navigator.clipboard.writeText(outputCode);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback('Copy'), 2000);
    }
  };

  return (
    <div className="module-container">
      <header className="module-header">
        <h1>Universal Code Converter</h1>
        <p>Translate code between {LANGUAGES.length} programming languages.</p>
      </header>

      <div className="converter-grid">
        <div className="panel input-panel">
          <div className="panel-header-row">
            <h3>Source: {LANGUAGES.find(l => l.value === sourceLang)?.label}</h3>
            <button className="file-upload-btn" onClick={() => fileInputRef.current.click()}>
              Upload File
            </button>
            <button className="info-icon" onClick={() => setShowInfoModal(true)}>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
              accept=".js,.ts,.py,.java,.c,.cs,.cpp,.go,.rs,.php,.swift"
            />
          </div>
       
          <div className="action-row start" style={{ marginBottom: '1rem' }}>
            <select 
              value={sourceLang} 
              onChange={(e) => setSourceLang(e.target.value)}
              className="lang-select"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={`Paste your code or upload a file...`} 
            spellCheck="false"
            className="flex-grow"
          />

          <div className="action-row">
            <button className="primary-button clear-btn" onClick={handleClear}>
              Clear
            </button>
            <button className="primary-button secondary-action-btn" onClick={handleSwap}>
              ⇄ Swap
            </button>
            <button className="primary-button action-btn" onClick={handleConvert} disabled={loading || !input.trim()}>
              {loading ? 'Converting...' : 'Convert Code'}
            </button>
          </div>
        </div>

        <div className="panel output-panel">
          <div className="panel-header-row">
            <h3>Target: {LANGUAGES.find(l => l.value === targetLang)?.label}</h3>
            {outputCode && (
              <button className="file-upload-btn download-btn" onClick={handleDownload}>
                Download Result
              </button>
            )}
          </div>
          
          <div className="action-row start" style={{ marginBottom: '1rem' }}>
            <select 
              value={targetLang} 
              onChange={(e) => setTargetLang(e.target.value)}
              className="lang-select"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="results-container">
            {outputCode ? (
              <div className="code-output-container"> 
                <div className="output-wrapper">
                  <textarea 
                    className="output-textarea"
                    value={outputCode} 
                    readOnly 
                    spellCheck="false"
                  />
                  <button className="primary-button copy-btn copy-btn-absolute" onClick={handleCopy}>
                    {copyFeedback}
                  </button>
                </div>
                
                <div className="action-row">
                  <button 
                    className="primary-button secondary-action-btn" 
                    onClick={() => onSwitchModule('analysis', { input: outputCode, sourceModule: 'converter' })}
                  >
                    Analyze Result
                  </button>
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                {loading ? 'AI is processing...' : 'Result will appear here...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Supported Files</h2>
            <p>You can upload files with the following extensions:</p>
            <div className="ext-grid">
              {LANGUAGES.map(l => (
                <span key={l.value} className="ext-tag"><strong>{l.ext}</strong> ({l.label})</span>
              ))}
            </div>
            <button className="primary-button action-btn" onClick={() => setShowInfoModal(false)} style={{marginTop: '1.5rem', width: '100%'}}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect, useRef } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/ModuleHeader';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';

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
  { value: 'kotlin', label: 'Kotlin', ext: '.kt' },
  { value: 'ruby', label: 'Ruby', ext: '.rb' },
  { value: 'dart', label: 'Dart', ext: '.dart' },
  { value: 'zig', label: 'Zig', ext: '.zig' },
  { value: 'mojo', label: 'Mojo', ext: '.mojo' },
  { value: 'r', label: 'R', ext: '.r' },
  { value: 'scala', label: 'Scala', ext: '.scala' },
  { value: 'elixir', label: 'Elixir', ext: '.ex' },
  { value: 'haskell', label: 'Haskell', ext: '.hs' },
  { value: 'lua', label: 'Lua', ext: '.lua' },
];

export default function CodeConverter() {
  const { moduleData, qualityMode, setModuleData } = useApp();
  
  const [sourceLang, setSourceLang] = useState('javascript');
  const [targetLang, setTargetLang] = useState('python');
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy');
  const [fileName, setFileName] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef(null);
  const [lastResult, setLastResult] = useState(false);
  const initialSyncRef = useRef(false);
  const router = useRouter();
  
  useEffect(() => {
    if (moduleData?.type === 'converter' && !initialSyncRef.current) {
      if (moduleData.input) setInput(moduleData.input);
      if (moduleData.fullOutput?.convertedCode) setOutputCode(moduleData.fullOutput.convertedCode);
      if (moduleData.sourceLang) setSourceLang(moduleData.sourceLang);
      if (moduleData.targetLang) setTargetLang(moduleData.targetLang);
      
      initialSyncRef.current = true;
    }
  }, [moduleData]);
  
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
    setLastResult(false);
    try {
      const result = await convertCode('converter', input, { sourceLang, targetLang, qualityMode });
      if (result && result.convertedCode) {
        setOutputCode(result.convertedCode);
        setLastResult({
          type: "converter",
          input: input,
          output: result,
          targetLang: targetLang,
          sourceLang: sourceLang
        });
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
      <ModuleHeader 
        title="Universal Code Converter"
        description={`Translate code between ${LANGUAGES.length} programming languages.`}
        resultData={lastResult}
      />

      <div className="converter-grid">
        <div className="panel">
          <div className="panel-header-row">
            <h3>Source: {LANGUAGES.find(l => l.value === sourceLang)?.label}</h3>
            <div className="header-actions">
              <button className="file-upload-btn" onClick={() => fileInputRef.current.click()}>
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
                accept=".js,.ts,.py,.java,.c,.cs,.cpp,.go,.rs,.php,.swift,.kt,.rb,.dart,.zig,.mojo,.r,.scala,.ex,.hs,.lua" 
              />
              <button className="info-icon" aria-label="Supported formats" onClick={() => setShowInfoModal(true)}>
                i
              </button>
            </div>
          </div>
       
          <div className="selector-bar">
            <select 
              value={sourceLang} 
              onChange={(e) => setSourceLang(e.target.value)}
              className="lang-select full-width"
            >
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Paste your code or upload a file..." 
            spellCheck="false"
            className="flex-grow"
          />

          <div className="action-row">
            <button className="primary-button action-btn" onClick={handleConvert} disabled={loading || !input.trim()}>
              {loading ? (
                 <><i className="fa-solid fa-spinner fa-spin"></i> Converting...</>
              ) : (
                 <><i className="fa-solid fa-wand-magic-sparkles"></i> Convert Code</>
              )}
            </button>
            <button className="secondary-button" onClick={handleSwap} title="Swap Languages">
              <i className="fa-solid fa-right-left"></i> Swap
            </button>
            <button className="secondary-button clear-btn" onClick={handleClear} title="Clear Input">
              <i className="fa-solid fa-trash"></i> Clear
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header-row">
            <h3>Target: {LANGUAGES.find(l => l.value === targetLang)?.label}</h3>
            {outputCode && (
              <button className="file-upload-btn download-btn" onClick={handleDownload}>
                <i className="fa-solid fa-download"></i> Download
              </button>
            )}
          </div>
          
          <div className="selector-bar">
            <select 
              value={targetLang} 
              onChange={(e) => setTargetLang(e.target.value)}
              className="lang-select full-width"
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
                     <i className={copyFeedback === 'Copied!' ? "fa-solid fa-check" : "fa-regular fa-copy"}></i> {copyFeedback}
                  </button>
                </div>
                
                <div className="action-row">
                  <button 
                    className="primary-button secondary-action-btn" 
                    onClick={() => {
                      setModuleData({ type: 'analysis', input: outputCode, sourceModule: 'converter' });
                      router.push('/code-analysis');
                    }}>
                    <i className="fa-solid fa-magnifying-glass-chart"></i> Analyze Result
                  </button>
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                {loading ? (
                    <span><i className="fa-solid fa-circle-notch fa-spin"></i> AI is processing...</span>
                ) : 'Result will appear here...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2><i className="fa-solid fa-file-code"></i> Supported Files</h2>
            <p>You can upload files with the following extensions:</p>
            <div className="ext-grid">
              {LANGUAGES.map(l => (
                <span key={l.value} className="ext-tag">
                    <strong>{l.ext}</strong> <span className="text-secondary">({l.label})</span>
                </span>
              ))}
            </div>
            <button className="primary-button modal-close-btn" onClick={() => setShowInfoModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { convertCode } from '../services/api';
import ModuleHeader from '../components/ModuleHeader';

export default function RegexGenerator({ onLoadData }) {
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy');
  const [lastResult, setLastResult] = useState(false);
  
  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      setOutputCode(onLoadData.fullOutput?.convertedCode || '');
    }
  }, [onLoadData]);
  
  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    setLastResult('');
    try {
      const result = await convertCode('regex', input);
      if (result && result.convertedCode) {
        setOutputCode(result.convertedCode);
        setLastResult({
          type: "regex",
          input: input,
          output: result
        });
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (error) {
      alert(`Generation failed: ${error.message}`);
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
        title="Regex Generator"
        description="Describe your pattern in plain English, and AI will generate the Regular Expression."
        resultData={lastResult}
      />

      <div className="converter-grid">
        <div className="panel">
          <h3>Pattern Description</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="e.g., Match a valid email address ending in .com or .net..." 
            spellCheck="false"
          />
          <div className="action-row">
             <button className="primary-button" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Regex'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Resulting Regex</h3>
          <div className="results-container">
            {outputCode ? (
                <div className="output-wrapper"> 
                    <textarea 
                        value={outputCode} 
                        readOnly 
                        className="output-textarea code-accent"
                        spellCheck="false"
                    />
                    <button className="copy-btn copy-btn-absolute" onClick={handleCopy}>
                       {copyFeedback}
                    </button>
                </div>
            ) : (
                <div className="placeholder-text">
                   {loading ? 'AI is processing...' : 'Your Regex pattern will appear here.'}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
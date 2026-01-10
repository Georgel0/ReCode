import { useState, useEffect } from 'react';
import { convertCode } from '../services/api';

export default function JsonFormatter({ onLoadData }) {
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      setOutputCode(onLoadData.fullOutput?.convertedCode || '');
    }
  }, [onLoadData]);

  // Client-side instant format
  const handlePrettify = () => {
    if (!input.trim()) return;
    setErrorMsg(null);
    try {
        const parsed = JSON.parse(input);
        setOutputCode(JSON.stringify(parsed, null, 2));
    } catch (e) {
        setErrorMsg("Invalid JSON. Use 'AI Fix & Format' to repair it.");
    }
  };

  // Server-side AI fix
  const handleAiFix = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    setErrorMsg(null);
    try {
      const result = await convertCode('json', input);
      if (result && result.convertedCode) {
        setOutputCode(result.convertedCode);
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (error) {
      alert(`Fix failed: ${error.message}`);
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
        <h1>JSON Formatter & Validator</h1>
        <p>Refine valid JSON instantly, or use AI to automatically repair and format broken JSON strings.</p>
      </header>

      <div className="converter-grid">
        <div className="panel">
          <h3>Input JSON</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder='Paste your JSON here (even if it is messy or broken)...' 
            spellCheck="false"
            className={errorMsg ? 'has-error' : ''}
          />
          {errorMsg && <div className="error-message">{errorMsg}</div>}
          
          <div className="action-row">
             <button className="primary-button secondary-action-btn" onClick={handlePrettify} disabled={loading} title="Fast client-side formatting">
                Refine
             </button>
             <button className="primary-button" onClick={handleAiFix} disabled={loading} title="Send to AI to fix errors">
              {loading ? 'Fixing...' : 'AI Fix & Format'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Formatted JSON</h3>
          <div className="results-container">
            {outputCode ? (
                <div className="output-wrapper"> 
                    <textarea 
                        value={outputCode} 
                        readOnly 
                        className="output-textarea"
                        spellCheck="false"
                    />
                    <button className="copy-btn copy-btn-absolute" onClick={handleCopy}>
                       {copyFeedback}
                    </button>
                </div>
            ) : (
                <div className="placeholder-text">
                   {loading ? 'AI is repairing your JSON...' : 'Clean JSON will appear here.'}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { convertCode } from '../services/api';
import ModuleHeader from '../components/ModuleHeader';

const DIALECTS = [
  { value: 'Standard SQL', label: 'Standard SQL' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'SQL Server', label: 'SQL Server (T-SQL)' },
  { value: 'Oracle', label: 'Oracle PL/SQL' },
];

export default function SqlBuilder({ onLoadData }) {
  const [input, setInput] = useState('');
  const [dialect, setDialect] = useState('Standard SQL');
  const [outputCode, setOutputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('Copy');
  const [lastResult, setLastResult] = useState(false);
  
  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      setOutputCode(onLoadData.fullOutput?.convertedCode || '');
      if (onLoadData.targetLang) setDialect(onLoadData.targetLang);
    }
  }, [onLoadData]);
  
  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    setLastResult('');
    try {
      // Passing dialect as targetLang to the API
      const result = await convertCode('sql', input, '', dialect);
      if (result && result.convertedCode) {
        setOutputCode(result.convertedCode);
        setLastResult({
          type: "sql",
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
        title="SQL Builder"
        description="Turn natural language requirements into complex SQL queries for any database."
        resultData={lastResult}
      />


      <div className="converter-grid">
        <div className="panel">
          <h3>Requirement</h3>
          
          <div className="action-row start center-y" style={{ marginBottom: '1.5rem' }}>
            <span className="label-text">Dialect:</span>
            <select 
                value={dialect} 
                onChange={(e) => setDialect(e.target.value)}
                className="lang-select"
            >
                {DIALECTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="e.g., Get top 5 users who spent more than $100 last month, grouped by country..." 
            spellCheck="false"
          />
          <div className="action-row">
             <button className="primary-button" onClick={handleGenerate} disabled={loading}>
              {loading ? 'Building...' : 'Build Query'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Generated Query ({dialect})</h3>
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
                   {loading ? 'AI is processing...' : 'Your SQL query will appear here.'}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
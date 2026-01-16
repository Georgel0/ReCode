import { useState, useEffect } from 'react';
import { convertCode } from '../services/api';
import ModuleHeader from '../components/ModuleHeader';

export default function CodeAnalysis({ onLoadData }) {
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(false);

  useEffect(() => {
    if (onLoadData) {
      const codeToAnalyze = onLoadData.input || '';
      setInput(codeToAnalyze);
      if (onLoadData.fullOutput?.analysis) {
        parseAndSetAnalysis(onLoadData.fullOutput.analysis);
      }
    }
  }, [onLoadData]);

  const parseAndSetAnalysis = (rawText) => {
    try {
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      setAnalysis(JSON.parse(cleanJson));
    } catch (e) {
      setAnalysis({ summary: rawText, fallback: true });
    }
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setAnalysis(null);

    try {
      const result = await convertCode('analysis', input);
      if (result?.analysis) {
        parseAndSetAnalysis(result.analysis);
        setLastResult({ type: "analysis", input, output: result });
      }
    } catch (error) {
      console.error("Audit failed.", error);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    const text = analysis?.fallback ? analysis.summary : JSON.stringify(analysis, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="module-container">
      <ModuleHeader 
        title="JS Code Auditor" 
        description="Senior-level analysis of security, complexity, and performance."
        resultData={lastResult}
      />

      <div className="converter-grid">
        <div className="panel">
          <h3><i className="fa-solid fa-code"></i> JavaScript Source</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste JavaScript here..." 
            spellCheck="false"
          />
          <div className="action-row">
            <button className="primary-button" onClick={handleAnalyze} disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-shield"></i>}
              {loading ? ' Auditing...' : ' Run Security Audit'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3><i className="fa-solid fa-chart-line"></i> Audit Results</h3>
          <div className="results-container">
            {loading ? (
              <div className="loading-container">
                <i className="fa-solid fa-shield-virus fa-beat-fade spin-icon"></i>
                <p>Scanning for vulnerabilities & Big O complexity...</p>
              </div>
            ) : analysis ? (
              <div className="analysis-report-wrapper">
                {analysis.fallback ? (
                  <div className="audit-section-content">{analysis.summary}</div>
                ) : (
                  <>
                    <div className="audit-header">
                      <div className="audit-score-box">
                        <div className="score-circle" style={{borderColor: analysis.score > 70 ? 'var(--accent)' : '#ff4d4d'}}>
                          {analysis.score}
                        </div>
                        <div>
                          <div style={{fontSize: '0.8rem', opacity: 0.7}}>QUALITY SCORE</div>
                          <div style={{fontWeight: 'bold'}}>{analysis.score > 70 ? 'Healthy' : 'Needs Review'}</div>
                        </div>
                      </div>
                      <div className="complexity-tag">
                        <i className="fa-solid fa-gauge-high"></i> {analysis.complexity}
                      </div>
                    </div>

                    <div className="audit-section">
                      <div className="audit-section-title"><i className="fa-solid fa-file-lines"></i> Summary</div>
                      <div className="audit-section-content">{analysis.summary}</div>
                    </div>

                    {analysis.security?.length > 0 && (
                      <div className="audit-section" style={{border: '1px solid #ff4d4d'}}>
                        <div className="audit-section-title" style={{color: '#ff4d4d'}}><i className="fa-solid fa-shield-halved"></i> Security Risks</div>
                        <div className="audit-section-content">
                          <ul className="audit-list">
                            {analysis.security.map((s, i) => <li key={i}><i className="fa-solid fa-circle-exclamation icon-sec"></i> {s}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="audit-section">
                      <div className="audit-section-title"><i className="fa-solid fa-bolt"></i> Optimization & Bugs</div>
                      <div className="audit-section-content">
                        <ul className="audit-list">
                          {analysis.bugs?.map((b, i) => <li key={i}><i className="fa-solid fa-bug icon-bug"></i> {b}</li>)}
                          {analysis.improvements?.map((imp, i) => <li key={i}><i className="fa-solid fa-wand-magic-sparkles icon-imp"></i> {imp}</li>)}
                        </ul>
                      </div>
                    </div>
                  </>
                )}
                <div className="action-row">
                  <button className="primary-button" onClick={handleCopy}><i className="fa-solid fa-copy"></i> Copy Report</button>
                </div>
              </div>
            ) : (
              <div className="placeholder-text">Enter code and run audit to see insights.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
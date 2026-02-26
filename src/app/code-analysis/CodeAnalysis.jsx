'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib/api';
import ModuleHeader from '@/components/UIComponents/ModuleHeader';
import { useApp } from '@/context/AppContext';

export default function CodeAnalysis() {
 const [input, setInput] = useState('');
 const [analysisData, setAnalysisData] = useState(null);
 const [rawAnalysis, setRawAnalysis] = useState('');
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const { moduleData, qualityMode } = useApp();
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'analysis') {
   const codeToAnalyze = moduleData.input || '';
   setInput(codeToAnalyze);
   
   if (moduleData.fullOutput?.analysis) {
    processAnalysisResult(moduleData.fullOutput.analysis);
   } else if (moduleData.sourceModule === 'converter' && codeToAnalyze) {
    handleAnalyze(codeToAnalyze);
   } else {
    setAnalysisData(null);
    setRawAnalysis('');
   }
  }
 }, [moduleData]);
 
 const processAnalysisResult = (result) => {
  if (typeof result === 'object' && result !== null) {
   setAnalysisData(result);
   setRawAnalysis(JSON.stringify(result, null, 2));
   return;
  }
  setRawAnalysis(result);
  try {
   const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
   setAnalysisData(JSON.parse(cleanJson));
  } catch (e) {
   setAnalysisData(null);
  }
 };
 
 const handleAnalyze = async (codeOverride) => {
  const codeToProcess = codeOverride || input;
  if (!codeToProcess.trim()) return;
  
  setLoading(true);
  try {
   const result = await convertCode('analysis', codeToProcess, { qualityMode });
   
   if (result && (result.summary || result.analysis)) {
    processAnalysisResult(result);
    setLastResult({ type: "analysis", input: codeToProcess, output: result });
   } else {
    throw new Error("API returned no data (check server logs for 500/429 errors)");
   }
  } catch (error) {
   alert(`Analysis failed: ${error.message}`);
  }
  
  setLoading(false);
 };
 
 const handleCopy = () => {
  let textToCopy = rawAnalysis;
  if (analysisData) {
   textToCopy = `CODE ANALYSIS REPORT\n\nSCORE: ${analysisData.score}/100\n\nSUMMARY:\n${analysisData.summary}\n\nCOMPLEXITY:\n${analysisData.complexity}\n\nSECURITY:\n${analysisData.security?.join('\n- ')}\n\nIMPROVEMENTS:\n${analysisData.improvements?.join('\n- ')}`;
  }
  
  if (textToCopy) {
   navigator.clipboard.writeText(textToCopy);
  }
 };
 
 const getScoreColor = (score) => {
  if (score >= 80) return 'var(--accent)';
  if (score >= 50) return '#ffa500';
  return '#ff4d4d';
 };
 
 return (
  <div className="module-container">
      <ModuleHeader 
        title="Code Auditor"
        description="Deep scan for vulnerabilities, complexity (Big O), and code quality."
        resultData={lastResult}
      />

      <div className="converter-grid"> 
        <div className="panel">
          <h3><i className="fa-solid fa-code"></i> Source Code</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your code here for a comprehensive audit..." 
            spellCheck="false"
          />
          <div className="action-row">
            <button 
              className="primary-button" 
              onClick={() => handleAnalyze()} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <br/>
                  <i className="fa-solid fa-circle-notch fa-spin"></i> Analyzing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-magnifying-glass-chart"></i> Run Audit
                </>
              )}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3><i className="fa-solid fa-chart-pie"></i> Audit Report</h3>
          <div className="results-container">
            {loading ? (
              <div className="analyzing-state">
                <div className="spinner"></div>
                <p>Analyzing logic structure, complexity, and security vectors...</p>
              </div>
            ) : analysisData ? (
              <div className="analysis-dashboard">
                
                <div className="analysis-header-card">
                  <div className="score-container">
                    <div 
                      className="score-ring" 
                      style={{ 
                        '--score-percent': `${analysisData.score}%`,
                        background: `conic-gradient(${getScoreColor(analysisData.score)} ${analysisData.score}%, var(--bg-tertiary) 0)` 
                      }}
                    >
                      <div className="score-value">{analysisData.score}</div>
                    </div>
                    <div className="score-label">
                      <span>Quality Score</span>
                      <strong>{analysisData.score >= 80 ? 'Excellent' : analysisData.score >= 50 ? 'Average' : 'Needs Work'}</strong>
                    </div>
                  </div>

                  <div className="complexity-grid">
                    <div className="complexity-card">
                      <div className="complexity-icon"><i className="fa-solid fa-clock"></i></div>
                      <div className="complexity-info">
                        <h4>Analysis</h4>
                        <p>{analysisData.complexity || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="analysis-section">
                  <div className="section-header">
                    <i className="fa-solid fa-align-left"></i> Executive Summary
                  </div>
                  <div className="section-content summary-text">
                    {analysisData.summary}
                  </div>
                </div>

                {analysisData.security && analysisData.security.length > 0 && (
                  <div className="analysis-section" style={{ borderColor: '#ff4d4d' }}>
                    <div className="section-header danger">
                      <i className="fa-solid fa-shield-halved"></i> Security Vulnerabilities
                    </div>
                    <div className="section-content">
                      <ul className="analysis-list">
                        {analysisData.security.map((item, i) => (
                          <li key={i} className="issue-high">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {analysisData.bugs && analysisData.bugs.length > 0 && (
                  <div className="analysis-section" style={{ borderColor: '#ffa500' }}>
                    <div className="section-header warning">
                      <i className="fa-solid fa-bug"></i> Potential Bugs
                    </div>
                    <div className="section-content">
                      <ul className="analysis-list">
                        {analysisData.bugs.map((item, i) => (
                          <li key={i} className="issue-medium">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="analysis-section">
                  <div className="section-header success">
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Recommended Improvements
                  </div>
                  <div className="section-content">
                    <ul className="analysis-list">
                      {analysisData.improvements?.map((item, i) => (
                        <li key={i} className="suggestion">
                          <i className="fa-solid fa-check"></i>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="action-row">
                  <button className="primary-button" onClick={handleCopy}>
                    <i className="fa-solid fa-copy"></i> Copy Report
                  </button>
                </div>

              </div>
            ) : rawAnalysis ? (
              <div className="output-wrapper">
                <div className="ai-summary">
                  <div className="legacy-output">
                    {rawAnalysis}
                  </div>
                </div>
                <div className="action-row">
                  <button className="primary-button" onClick={handleCopy}>
                    Copy Analysis
                  </button>
                </div>
              </div>
            ) : (
              <div className="placeholder-text">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <i className="fa-solid fa-microchip" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                  <span>Analysis results will appear here.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div> 
  </div>
 );
}
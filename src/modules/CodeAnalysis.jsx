import { useState, useEffect } from 'react';
import { convertCode } from '../services/api';
import ModuleHeader from '../components/ModuleHeader';

export default function CodeAnalysis({ onLoadData }) {
 const [input, setInput] = useState('');
 const [analysis, setAnalysis] = useState('');
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 
 useEffect(() => {
  if (onLoadData) {
   const codeToAnalyze = onLoadData.input || '';
   setInput(codeToAnalyze);
   
   if (onLoadData.fullOutput?.analysis) {
    setAnalysis(onLoadData.fullOutput.analysis);
   } else if (onLoadData.sourceModule === 'converter' && codeToAnalyze) {
    // Auto-trigger analysis if code is passed from the converter module
    handleAnalyze(codeToAnalyze);
   } else {
    setAnalysis('');
   }
  }
 }, [onLoadData]);

 const handleAnalyze = async (codeOverride) => {
  const codeToProcess = codeOverride || input;
  if (!codeToProcess.trim()) return;
  
  setLoading(true);
  setAnalysis('');
  setLastResult(false);

  try {
   const result = await convertCode('analysis', codeToProcess);

   if (result && result.analysis) {
    setAnalysis(result.analysis);
    setLastResult({ 
      type: "analysis",
      input: codeToProcess,
      output: result
    });
   } else {
    throw new Error("Analysis failed: AI returned an empty response.");
   }
  } catch (error) {
   alert(`Analysis failed: ${error.message}`);
  }
  setLoading(false);
 };

 const handleCopy = () => {
  if (analysis) {
   navigator.clipboard.writeText(analysis);
  }
 };

 return (
  <div className="module-container">
      <ModuleHeader 
        title="Code Analysis"
        description="Get a detailed, expert explanation of any code snippet."
        resultData={lastResult}
      />

      <div className="converter-grid"> 
        <div className="panel">
          <h3>Code Snippet</h3>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste code here to analyze (e.g., the output from the converter)..." 
            spellCheck="false"
          />
          <div className="action-row">
            <button 
              className="primary-button" 
              onClick={() => handleAnalyze()} 
              disabled={loading}
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Analysis Results</h3>
          <div className="results-container">
            {analysis ? (
              <>
                <div className="ai-summary" style={{ overflowY: 'auto' }}>
                  <strong>AI Analysis Summary</strong>
                  {analysis.split('\n').map((line, i) => (
                    <p 
                      key={i} 
                      dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }} 
                      style={{ margin: 0, padding: 0 }} 
                    />
                  ))}
                </div>
                <div className="action-row">
                  <button 
                    className="primary-button"
                    onClick={handleCopy}
                  >
                    Copy Analysis
                  </button>
                </div>
              </>
            ) : (
              <div className="placeholder-text">
                {loading ? 'AI is thinking...' : 'Analysis results will appear here.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
 );
}
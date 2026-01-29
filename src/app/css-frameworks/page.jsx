'use client'; 

import { useState, useEffect } from 'react';
import { convertCode } from '@/services/api';
import ModuleHeader from '@/components/ModuleHeader';

export const metadata = {
  title: 'CSS Framework Converter',
  description: 'Automatically convert raw CSS into utility classes for modern frameworks.',
};

const TARGET_FRAMEWORKS = [
  { value: 'tailwind', label: 'Tailwind CSS' },
  { value: 'bootstrap', label: 'Bootstrap' },
  { value: 'sass', label: 'SASS/SCSS' },
  { value: 'less', label: 'LESS' },
];
export default function CssFrameworkConverter({ onLoadData, preSetTarget = 'tailwind', onSwitchModule, qualityMode }) {
  const [input, setInput] = useState('');
  const [targetLang, setTargetLang] = useState(preSetTarget);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(false);
  
  useEffect(() => {
    if (onLoadData) {
      setInput(onLoadData.input || '');
      setData(onLoadData.fullOutput || null);
      if (onLoadData.targetLang) setTargetLang(onLoadData.targetLang);
    } else {
      setTargetLang(preSetTarget);
      setInput('');
      setData(null);
    }
  }, [onLoadData, preSetTarget]);
  const handleConvert = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setData(null);
    setLastResult(false);
    try {
      const result = await convertCode('css-framework', input, { sourceLang: 'css', targetLang, qualityMode });
      
      // Validation: Check if we got the expected format based on target
      const isValidTailwind = targetLang === 'tailwind' && result && result.conversions;
      const isValidStandard = targetLang !== 'tailwind' && result && result.convertedCode;
      
      if (isValidTailwind || isValidStandard) {
        setData(result);
        setLastResult({
          type: 'css-framework',
          input: input,
          output: result,
          sourceLang: 'css',
          targetLang: targetLang
        });
      } else {
        console.error("Unexpected structure:", result);
        throw new Error("AI returned an unexpected structure.");
      }
      
    } catch (error) {
      alert(`Conversion failed. Error: ${error.message}`);
      console.error(error);
    }
    setLoading(false);
  };
  
  const handleAnalyze = (snippet) => {
    if (onSwitchModule) {
      onSwitchModule('analysis', { input: snippet, sourceModule: 'css-framework' });
    }
  };
  
  const targetLabel = TARGET_FRAMEWORKS.find(f => f.value === targetLang)?.label || 'Classes';
  return (
    <div className="module-container">
      <ModuleHeader 
        title="CSS Framework Converter"
        description="Convert standard CSS into a utility framework or preprocessor format."
        resultData={lastResult}
      />
      <div className="converter-grid">
        <div className="panel">
          <h3>Input: Standard CSS</h3>
          <textarea 
  
           value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder=".btn { padding: 10px 20px; border-radius: 4px; color: white; }" 
            spellCheck="false"
            className="flex-grow"
          />
          <div className="action-row">
       
             <button 
                className="primary-button action-btn" 
                onClick={handleConvert} 
                disabled={loading || !input.trim()}
            >
                {loading ? 'Converting...' : `Convert to ${targetLabel}`}
       
             </button>
          </div>
        </div>

        <div className="panel">
          <div className="selector-bar">
            <h3>Output:</h3>
            <select
              value={targetLang}
       
              onChange={(e) => setTargetLang(e.target.value)}
              className="lang-select"
            >
              {TARGET_FRAMEWORKS.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
             
                </option>
              ))}
            </select>
          </div>
          
          {data ?
             (
            <div className="results-container">
              {/* Conditional Rendering: List for Tailwind, Block for others */}
              {targetLang === 'tailwind' && data.conversions ? (
                  <div className="selectors-list">
                    {data.conversions.map((item, idx) => (
                      <div key={idx} className="selector-card">
                        <div className="selector-name">{item.selector}</div>
                
                        <div className="tailwind-code">
                          <pre className="code-pre">{item.tailwindClasses}</pre>
                        </div>
       
                        <div className="card-actions">
                        <button 
                            className="primary-button copy-btn"
                            onClick={() => navigator.clipboard.writeText(item.tailwindClasses)}
              
                          >
                            Copy
                        </button>
                        <button 
                            className="secondary-button secondary-action-btn"
                            onClick={() => handleAnalyze(item.tailwindClasses)}
                        >
                            Analyze
                        </button>
              
                        </div>
                      </div>
                    ))}
                  </div>
              ) : (
                  // Single code block for Bootstrap, SASS, LESS
                  <div className="code-output-container">
                      <textarea 
                        className="output-textarea"
                        value={data.convertedCode || ''}
                        readOnly
                      />
                      <div className="card-actions mt-3">
                        <button 
                            className="primary-button copy-btn"
                            onClick={() => navigator.clipboard.writeText(data.convertedCode)}
                        >
                            Copy Code
                        </button>
                        <button 
                            className="primary-button secondary-action-btn"
                            onClick={() => handleAnalyze(data.convertedCode)}
                        >
                            Analyze
                        </button>
                      </div>
                  </div>
              )}
            </div>
          ) : (
            <div className="placeholder-text">
     
              {loading ? (
                 <div className="processing-state">
                   <div className="pulse-ring"></div>
                   <p>Converting...</p>
                  </div>
              ) : 'Output will appear here...'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
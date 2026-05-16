'use client';

import React, { useRef } from 'react';
import { ModuleHeader } from '@/components/layout';
import { CopyButton } from '@/components/ui';
import { useRegexGenerator, CHEATSHEET } from './useRegexGenerator';
import './regexGenerator.css';

// Extracted Component to handle individual scroll syncing perfectly
const TestCaseItem = ({ test, result, outputCode, flags, updateTestCase, removeTestCase }) => {
  const highlightLayerRef = useRef(null);

  const handleScroll = (e) => {
    if (highlightLayerRef.current) {
      highlightLayerRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const renderHighlightedText = (text) => {
    if (!outputCode || !text) return text;
    try {
      const highlightFlags = `g${flags.i ? 'i' : ''}`;
      const regex = new RegExp(outputCode, highlightFlags);
      let lastIndex = 0;
      const elements = [];
      let match;
      regex.lastIndex = 0;
      
      // Safety break to prevent infinite loops on zero-width matches
      let safeGuard = 0; 
      
      while ((match = regex.exec(text)) !== null && safeGuard < 1000) {
        if (match[0].length === 0) regex.lastIndex++; // Handle zero-width matches
        
        if (match.index > lastIndex) {
          elements.push(text.substring(lastIndex, match.index));
        }
        elements.push(
          <span key={`${match.index}-match`} className="regex-match-highlight">
            {match[0]}
          </span>
        );
        lastIndex = regex.lastIndex;
        safeGuard++;
      }
      if (lastIndex < text.length) elements.push(text.substring(lastIndex));
      return elements.length > 0 ? elements : text;
    } catch (e) {
      return text;
    }
  };

  const isSuccess = result?.isMatch === test.shouldMatch;

  return (
    <div className="test-case-row">
      <button 
        className={`expectation-toggle ${test.shouldMatch ? 'expect-match' : 'expect-fail'}`} 
        onClick={() => updateTestCase(test.id, 'shouldMatch', !test.shouldMatch)}
        aria-label={`Toggle expectation. Currently ${test.shouldMatch ? 'expecting match' : 'expecting fail'}`}
      >
        <i className={`fa-solid ${test.shouldMatch ? 'fa-check' : 'fa-ban'}`}></i>
      </button>
      
      <div className="test-input-wrapper">
        <input 
          type="text" 
          value={test.text} 
          onChange={(e) => updateTestCase(test.id, 'text', e.target.value)} 
          onScroll={handleScroll}
          placeholder="Test string..." 
          className="test-input-field" 
          aria-label="Test case input"
        />
        <div className="test-input-highlight-layer" ref={highlightLayerRef} aria-hidden="true">
          {renderHighlightedText(test.text)}
        </div>
      </div>

      <div className={`result-indicator ${isSuccess ? 'success' : 'fail'}`} title={isSuccess ? "Passed" : "Failed"}>
        {result?.error ? <i className="fa-solid fa-triangle-exclamation" title="Invalid Regex"></i> : <i className={`fa-solid ${isSuccess ? 'fa-check' : 'fa-xmark'}`}></i>}
      </div>

      <button className="remove-btn" onClick={() => removeTestCase(test.id)} aria-label="Remove test case">
        <i className="fa-solid fa-trash"></i>
      </button>
    </div>
  );
};


export default function RegexGenerator() {
  const {
    input, setInput, refineMode, setRefineMode, flavor, setFlavor, flags, setFlags,
    outputCode, setOutputCode, summary, breakdown, testCases, loading, matchResults,
    showCheatsheet, setShowCheatsheet, showTestInfo, setShowTestInfo, lastResult,
    handleGenerate, addTestCase, removeTestCase, updateTestCase, fullString
  } = useRegexGenerator();

  return (
    <div className="module-container">
      <ModuleHeader 
        title="Regex Generator" 
        description="Describe, Refine, and Battle-Test your Regular Expressions."
        resultData={lastResult}
      />

      {showCheatsheet && (
        <div className="modal-overlay" onClick={() => setShowCheatsheet(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="cheatsheet-title" onClick={e => e.stopPropagation()}>
            <h2 id="cheatsheet-title">Regex Cheatsheet</h2>
            <div className="ext-grid">
              {Object.entries(CHEATSHEET).map(([category, items]) => (
                <div key={category} className="cheatsheet-category">
                  <h4 style={{color: 'var(--accent)', margin: '0 0 10px 0'}}>{category}</h4>
                  {items.map(item => (
                    <div key={item.token} className="tailwind-code" style={{marginBottom:'5px'}}>
                      <code>{item.token} </code>
                      <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{item.desc}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <button className="secondary-button modal-close-btn" onClick={() => setShowCheatsheet(false)}>Close</button>
          </div>
        </div>
      )}
      
      {showTestInfo && (
        <div className="modal-overlay" onClick={() => setShowTestInfo(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="test-info-title" onClick={e => e.stopPropagation()}>
            <h3 id="test-info-title">Test Cases Info</h3>
            <div className="ext-grid">
              <strong><i className="fa-solid fa-toggle-on"></i> Set Your Goal</strong>
              <p>Toggle to define expectations: Match (<i className="fa-solid fa-check"></i>) or Ban (<i className="fa-solid fa-ban"></i>).</p>
              <strong><i className="fa-solid fa-keyboard"></i> Input Test Strings</strong>
              <p>Type example text in the center. Matches are highlighted in real-time.</p>
              <strong><i className="fa-solid fa-square-poll-vertical"></i> Verdict</strong>
              <p>Success (<i className="fa-solid fa-check"></i>) or Fail (<i className="fa-solid fa-xmark"></i>).</p>
            </div>
            <button className="secondary-button modal-close-btn" onClick={() => setShowTestInfo(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="converter-grid">
        <div className="panel">
          <div className="panel-header-row">
            <h3>{refineMode ? 'Refine Pattern' : 'Pattern Description'}</h3>
            <button className="mode-btn" onClick={() => setShowCheatsheet(true)}>
              <i className="fa-solid fa-book"></i> Cheatsheet
            </button>
          </div>

          <div className="controls-group">
            <div className="control-field">
              <label className="label-text">Target Flavor</label>
              <select value={flavor} onChange={(e) => setFlavor(e.target.value)}>
                <option value="JavaScript">JavaScript (Standard)</option>
                <option value="Python">Python</option>
                <option value="PCRE">PCRE (PHP/Go)</option>
              </select>
              {flavor !== 'JavaScript' && (
                <span className="flavor-warning">
                  <i className="fa-solid fa-circle-exclamation"></i> Live tests use JS engine
                </span>
              )}
            </div>
                  
            <div className="control-field">
              <label className="label-text">Flags</label>
              <div className="flag-group">
                {['g', 'i', 'm', 's'].map(flag => (
                  <label key={flag} className="custom-check">
                    <input 
                      type="checkbox" 
                      checked={flags[flag]} 
                      onChange={() => setFlags({...flags, [flag]: !flags[flag]})}
                    />
                    <span className="box"><i className="fas fa-check"></i></span>
                    <span className="label-text">{flag}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder={refineMode ? "Refine the current regex..." : "Describe what you want to match..."}
            spellCheck="false"
            style={{minHeight: '120px'}}
          />
                
          <div className="action-row between center-y">
            {refineMode && (
              <button className="secondary-button" onClick={() => { setRefineMode(false); setInput(''); setOutputCode(''); }}>
                <i className="fa-solid fa-rotate-left"></i> Start Over
              </button>
            )}
            <button className="primary-button" onClick={handleGenerate} disabled={loading || !input.trim()}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : refineMode ? 'fa-sliders' : 'fa-wand-magic-sparkles'}`}></i>
              {loading ? 'Processing...' : refineMode ? 'Refine Regex' : 'Generate Regex'}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>Result</h3>
          <div className="results-container">
            {outputCode ? (
              <>
                <div className="output-wrapper regex-output-box"> 
                  <div className="tailwind-code">
                    <span style={{color: 'var(--text-secondary)', userSelect:'none'}}>/</span>
                    <input type="text" value={outputCode} readOnly className="code-editor" style={{padding: '0 4px', height: 'auto'}} />
                    <span style={{color: 'var(--text-secondary)', userSelect:'none'}}>
                      / {Object.keys(flags).filter(k => flags[k]).join('')}
                    </span>
                    <CopyButton className="copy-btn" iconOnly={true} codeToCopy={fullString} />
                  </div>
                </div>

                <div className="ai-summary">
                  <strong><i className="fa-solid fa-circle-info"></i> {summary}</strong>
                  {breakdown.length > 0 && (
                    <div className="regex-token-grid">
                      {breakdown.map((item, idx) => (
                        <div key={idx} className="token-row">
                          <span className="token-badge">{item.token}</span>
                          <span className="token-desc">{item.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="selector-card regex-test-bench">
                  <div className="panel-header-row" style={{marginBottom: '10px'}}>
                    <div className="selector-name"><i className="fa-solid fa-vial"> </i> 
                      <h4 style={{ margin: '5px' }}>Test Cases</h4>
                      <button className="info-trigger" onClick={() => setShowTestInfo(true)} aria-label="More information about test cases"><i className="fas fa-circle-info"></i></button>
                    </div>
                    <button className="icon-btn" onClick={addTestCase} aria-label="Add Test Case" title="Add Test Case"><i className="fa-solid fa-plus"></i></button>
                  </div>

                  <div className="test-cases-list">
                    {testCases.map((test) => (
                      <TestCaseItem 
                        key={test.id}
                        test={test}
                        result={matchResults[test.id]}
                        outputCode={outputCode}
                        flags={flags}
                        updateTestCase={updateTestCase}
                        removeTestCase={removeTestCase}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="placeholder-text">
                {loading ?
                  <div className="processing-state"><div className="pulse-ring"></div><p>Crafting your expression...</p></div> 
                    : 'Describe your pattern to generate a regex.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
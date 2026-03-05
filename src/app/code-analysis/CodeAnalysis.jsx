"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib';
import { CopyButton, CodeEditor } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import './CodeAnalysis.css';

export default function CodeAnalysis() {
 const [input, setInput] = useState('');
 const [analysisData, setAnalysisData] = useState(null);
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 const [activeTab, setActiveTab] = useState('complexity');
 
 const { moduleData, setModuleData, qualityMode } = useApp();
 const router = useRouter();
 
 const [selectedLang, setSelectedLang] = useState('javascript');
 const [isAutoDetected, setIsAutoDetected] = useState(true);
 
  useEffect(() => {
  if (moduleData?.type === 'analysis') {
   const codeToAnalyze = moduleData.input || '';
   setInput(codeToAnalyze);
   
   if (moduleData.summary && moduleData.complexity) {
    setAnalysisData(moduleData);
    setLastResult({ type: "analysis", input: codeToAnalyze, output: moduleData });
   } 
   else if (moduleData.fullOutput?.analysis) {
    setAnalysisData(moduleData.fullOutput.analysis);
   } 
   else if (moduleData.fullOutput?.summary && moduleData.fullOutput?.complexity) {
    setAnalysisData(moduleData.fullOutput);
    setLastResult({ type: "analysis", input: codeToAnalyze, output: moduleData.fullOutput });
   } 
   else if (moduleData.sourceModule === 'converter' && codeToAnalyze) {
    handleAnalyze(codeToAnalyze);
   }
  }
 }, [moduleData]);
 
 useEffect(() => {
  if (!isAutoDetected) return;
  const timer = setTimeout(() => {
   const detected = detectLanguage(input);
   if (detected !== 'unknown') setSelectedLang(detected);
  }, 600);
  return () => clearTimeout(timer);
 }, [input, isAutoDetected]);
 
 const handleAnalyze = async (codeOverride) => {
  const codeToProcess = codeOverride || input;
  if (!codeToProcess.trim()) return;
  
  setLoading(true);
  try {
   const result = await convertCode('analysis', codeToProcess, { qualityMode, language: selectedLang });
   if (result) {
    setAnalysisData(result);
    setLastResult({ type: "analysis", input: codeToProcess, output: result });
   }
  } catch (error) {
   console.error("Analysis Error:", error);
  } finally {
   setLoading(false);
  }
 };
 
 const getTabContentToCopy = useMemo(() => {
  if (!analysisData) return '';
  
  switch (activeTab) {
   case 'complexity':
    return `Complexity Analysis:\n- Time: ${analysisData.complexity.time}\n- Space: ${analysisData.complexity.space}\n\nBreakdown:\n${analysisData.complexity.explanation.join('\n')}`;
   case 'security':
    return `Security Audit:\n${analysisData.security.join('\n')}`;
   case 'bestPractices':
    return `Best Practices:\n${analysisData.bestPractices.join('\n')}`;
   default:
    return JSON.stringify(analysisData[activeTab], null, 2);
  }
 }, [activeTab, analysisData]);
 
// Chart Data Preparation
const chartData = useMemo(() => {
  if (!analysisData?.complexity?.time) return [];

  // Normalize the AI's string output (e.g., "O(n^2)", "O(N log N)")
  const timeStr = analysisData.complexity.time.toLowerCase().replace(/[\s\(\)o]/g, '');
  
  const data = [];
  // Generate curve data points for n = 1 to 10
  for (let n = 1; n <= 10; n++) {
    let operations = n; // Default to O(n) if parsing fails
    
    if (timeStr === '1') { operations = 1; }
    else if (timeStr === 'logn') { operations = Math.log2(n + 1); }
    else if (timeStr === 'n') { operations = n; }
    else if (timeStr === 'nlogn') { operations = n * Math.log2(n + 1); }
    else if (timeStr.includes('n^2') || timeStr.includes('n²')) { operations = n * n; }
    else if (timeStr.includes('n^3') || timeStr.includes('n³')) { operations = n * n * n; }
    else if (timeStr.includes('2^n')) { operations = Math.pow(2, n); }

    data.push({
      inputElements: `n=${n}`,     // X-Axis label
      operations: Number(operations.toFixed(2)), // Y-Axis value
    });
  }
  
  return data;
}, [analysisData]);

  // Helper to color-code the metrics
  const getMetricClass = (value, type) => {
    if (value === undefined || value === null) return 'score-neutral';
    if (type === 'low-is-better') {
      if (value <= 10) return 'score-good';
      if (value <= 20) return 'score-warn';
      return 'score-bad';
    } else {
      if (value >= 80) return 'score-good';
      if (value >= 60) return 'score-warn';
      return 'score-bad';
    }
  };

 const handleRefactorRouting = () => {
  const ext = LANGUAGES.find(l => l.value === selectedLang)?.ext || '.js';
  setModuleData({
   type: 'refactor',
   input: [{ id: crypto.randomUUID(), name: `audit_fix${ext}`, language: selectedLang, content: input }],
   sourceModule: 'analysis'
  });
  router.push('/code-refactor');
 };
 
 const handleClear = () => {
  setLoading(false);
  setInput('');
  setAnalysisData(null);
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
     <div className="header-actions">
      <select 
       value={selectedLang} 
       onChange={(e) => { setSelectedLang(e.target.value); setIsAutoDetected(false); }}
       className="lang-selector"
      >
      {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
      </select>
      <button className="secondary-button clear-btn"  onClick={handleClear} title="Clear Input">
       <i className="fa-solid fa-trash"></i> Clear
      </button>
     </div>
          
     <CodeEditor value={input} onValueChange={setInput} language={selectedLang} />
          
     <div className="action-row">
      <button className="primary-button" onClick={() => handleAnalyze()} disabled={loading}>
       {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-chart"></i>}
       {loading ? " Analyzing..." : " Run Audit"}
      </button>
     </div>
    </div>

    <div className="panel">
     <h3><i className="fa-solid fa-chart-pie"></i> Audit Report</h3>
          
     {analysisData ? (
      <div className="analysis-dashboard">
       <div className="analysis-header-card">
        <div style={{ flex: 1 }}>
         <p className="summary-text">{analysisData.summary}</p>
        </div>
        <div className="score-container">
         <div className="score-label">
          <span>Quality Score</span>
          <strong>{analysisData.score}/100</strong>
         </div>
         <div className="score-ring" style={{ '--score-percent': `${analysisData.score}%` }}>
          <span className="score-value">{analysisData.score}</span>
         </div>
        </div>
       </div>
       
       <div className="tabs-container refactor" >
        <div style={{ display: 'flex', gap: '5px' }}>
         {['complexity', 'security', 'bugs', 'improvements', 'bestPractices'].map((tab) => (
           <button 
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
           >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([A-Z])/g, ' $1')}
           </button>
         ))}
        </div>
       </div>
       
       <div className="analysis-tab-content-wrapper">
         <div className="hover-copy-container">
           <CopyButton 
            codeToCopy={getTabContentToCopy} 
            className="primary-button copy-btn" 
            iconOnly={true} 
            label="" 
           />
         </div>
         
       <div className="analysis-tab-content">
        {activeTab === 'complexity' && (
         <div className="complexity-breakdown">
          <div>
           <div className="complexity-grid">
            <div className="complexity-card">
             <div className="complexity-icon"><i className="fa-solid fa-clock"></i></div>
             <div className="complexity-info"><h4>Time</h4><p>{analysisData.complexity.time}</p></div>
            </div>
            <div className="complexity-card">
             <div className="complexity-icon"><i className="fa-solid fa-memory"></i></div>
             <div className="complexity-info"><h4>Space</h4><p>{analysisData.complexity.space}</p></div>
            </div>
           </div>
           <ul className="complexity-explanation-list">
            {analysisData.complexity.explanation.map((item, i) => <li key={i}>{item}</li>)}
           </ul>
          </div>
          
          <div className="complexity-chart-container">
           <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                  
             {/* X-Axis: Input Size (n) */}
              <XAxis 
               dataKey="inputElements" 
               axisLine={true} 
               tickLine={false} 
               tick={{fill: 'var(--text-secondary)', fontSize: 12}} 
               dy={15}
               label={{ value: 'Input Size (Elements)', position: 'insideBottom', offset: -15, fill: 'var(--text-secondary)', fontSize: 13 }}
              />
              {/* Y-Axis: Operations (Time) */}
              <YAxis 
               axisLine={true} 
               tickLine={false}
               tick={{fill: 'var(--text-secondary)', fontSize: 12}}
               dx={-10}
               label={{ value: 'Operations (Time)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 13 }}
             />
                  
             <Tooltip 
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} 
              contentStyle={{
               background: 'var(--bg-secondary)', 
               border: '1px solid var(--border)', 
               borderRadius: 'var(--radius)', 
               color: 'var(--text-primary)',
               boxShadow: 'var(--shadow-subtle)'
              }}
              formatter={(value) => [`${value} Ops`, 'Complexity']}
              labelStyle={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '5px' }}
             />
                  
             <Line 
              type="monotone" 
              dataKey="operations" 
              name="Growth Rate"
              stroke="var(--accent)" 
              strokeWidth={4}
              dot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent)', strokeWidth: 2 }}
              activeDot={{ r: 8, fill: 'var(--accent)', stroke: 'var(--bg-primary)', strokeWidth: 3 }}
              animationDuration={1500}
              animationEasing="ease-out"
             />
            </LineChart>
           </ResponsiveContainer>
          </div>
          
          {analysisData.complexity.metrics && (
           <div className="metrics-container">
            <div className="metric-card">
             <div className="metric-header">
              <span className="metric-title">Cyclomatic</span>
              <span className={`metric-score ${getMetricClass(analysisData.complexity.metrics.cyclomatic, 'low-is-better')}`}>
               {analysisData.complexity.metrics.cyclomatic}
              </span>
             </div>
             <p className="metric-desc">Counts the number of linearly independent paths. Lower means the code is easier to test and follow.</p>
            </div>

            <div className="metric-card">
             <div className="metric-header">
              <span className="metric-title">Cognitive</span>
              <span className={`metric-score ${getMetricClass(analysisData.complexity.metrics.cognitive, 'low-is-better')}`}>
               {analysisData.complexity.metrics.cognitive}
              </span>
             </div>
             <p className="metric-desc">Measures how difficult the control flow is for a human to understand. Lower is better.</p>
            </div>

            <div className="metric-card">
             <div className="metric-header">
              <span className="metric-title">Maintainability</span>
              <span className={`metric-score ${getMetricClass(analysisData.complexity.metrics.maintainability, 'high-is-better')}`}>
               {analysisData.complexity.metrics.maintainability}
              </span>
             </div>
             <p className="metric-desc">Overall index (0-100) evaluating code health. Higher means it's easier to modify without breaking.</p>
            </div>
           </div>
          )}
          
         </div>
        )}
        
        {(activeTab === 'security' || activeTab === 'bugs' || activeTab === 'improvements' || activeTab === 'bestPractices') && (
         <ul className="analysis-list">
          {(analysisData[activeTab] || []).map((item, i) => (
           <li key={i} className={activeTab === 'security' ? 'issue-high' : activeTab === 'bugs' ? 'issue-medium' : 'suggestion'}>
            <i className={`fa-solid ${activeTab === 'security' ? 'fa-shield-halved' : activeTab === 'bugs' ? 'fa-bug' : 'fa-lightbulb'}`}></i>
            <span>{item}</span>
           </li>
          ))}
         </ul>
        )}
       </div>
      </div>

       <div className="action-row">
        <button className="primary-button secondary-action-btn" onClick={handleRefactorRouting}>
         <i className="fas fa-wand-magic-sparkles"></i> Optimize Code
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
 );
}
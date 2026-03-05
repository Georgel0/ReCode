"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib';
import { CopyButton, CodeEditor } from '@/components/ui';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context';
import {
 BarChart,
 Bar,
 XAxis,
 YAxis,
 Tooltip,
 ResponsiveContainer,
 CartesianGrid,
 Cell
} from 'recharts';

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
   
   if (moduleData.fullOutput?.analysis) {
    setAnalysisData(moduleData.fullOutput.analysis);
   } else if (moduleData.sourceModule === 'converter' && codeToAnalyze) {
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
  if (!analysisData?.complexity?.metrics) return [];
  const m = analysisData.complexity.metrics;
  return [
   { name: 'Cyclomatic', val: m.cyclomatic, color: '#ffa500' },
   { name: 'Cognitive', val: m.cognitive, color: '#ff4d4d' },
   { name: 'Maintainability', val: m.maintainability, color: '#10b981' }
  ];
 }, [analysisData]);
 
 const handleRefactorRouting = () => {
  const ext = LANGUAGES.find(l => l.value === selectedLang)?.ext || '.js';
  setModuleData({
   type: 'refactor',
   input: [{ id: crypto.randomUUID(), name: `audit_fix${ext}`, language: selectedLang, content: input }],
   sourceModule: 'analysis'
  });
  router.push('/code-refactor');
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
     <select 
      value={selectedLang} 
      onChange={(e) => { setSelectedLang(e.target.value); setIsAutoDetected(false); }}
      className="lang-selector"
     >
      {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
     </select>
          
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

       <div className="tabs-container" style={{ display: 'flex', alignItems: 'center', gap: '5px', borderBottom: '1px solid var(--border)' }}>
        {['complexity', 'security', 'bugs', 'improvements', 'bestPractices'].map((tab) => (
          <button 
           key={tab}
           className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
           onClick={() => setActiveTab(tab)}
          >
           {tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([A-Z])/g, ' $1')}
          </button>
         ))}
          <div style={{ marginLeft: 'auto', paddingBottom: '5px' }}>
           <CopyButton codeToCopy={getTabContentToCopy} iconOnly={true} label="" />
          </div>
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
              <BarChart data={chartData}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-primary)', fontSize: 12}} />
               <YAxis hide domain={[0, 100]} />
               <Tooltip cursor={{fill: 'transparent'}} contentStyle={{background: 'var(--bg-secondary)', border: '1px solid var(--border)'}} />
               <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
               </Bar>
              </BarChart>
             </ResponsiveContainer>
            </div>
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
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib'; 
import { CopyButton, CodeEditor } from '@/components/ui'; 
import { ModuleHeader } from '@/components/layout'; 
import { useApp } from '@/context'; 

import { ComplexityTab, IssuesTab, TestingTab, ArchitectureTab } from './tabs';
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
  
  // Formatters for the new object arrays
  const formatIssues = (arr) => arr?.map(i => `[${i.severity || 'Tip'}] ${i.location ? `(${i.location}) ` : ''}${i.issue}\nFix: ${i.resolution}`).join('\n\n') || 'None found.';

  switch (activeTab) {
   case 'complexity':
    return `Complexity Analysis:\n- Time: ${analysisData.complexity.time}\n- Space: ${analysisData.complexity.space}\n\nBreakdown:\n${analysisData.complexity.explanation.join('\n')}`; 
   case 'security': return `Security Audit:\n${formatIssues(analysisData.security)}`;
   
   case 'bugs': return `Bug Report:\n${formatIssues(analysisData.bugs)}`;
   
   case 'improvements': return `Suggested Improvements:\n${formatIssues(analysisData.improvements)}`;
   
   case 'bestPractices': return `Best Practices:\n${formatIssues(analysisData.bestPractices)}`;
   
   case 'testing': return `Testing:\nEdge Cases:\n${(analysisData.testing?.edgeCases || []).join('\n')}\n\nUnit Tests:\n${(analysisData.testing?.unitTests || []).join('\n')}`;
   
   case 'architecture': return `Architecture:\nSmells:\n${(analysisData.architecture?.smells || []).join('\n')}\n\nDependencies:\n${(analysisData.architecture?.dependencies || []).join('\n')}`;
   
   default:
    return JSON.stringify(analysisData[activeTab], null, 2); 
  }
 }, [activeTab, analysisData]);

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

 const TABS = ['complexity', 'security', 'bugs', 'improvements', 'bestPractices', 'testing', 'architecture'];

 return (
  <div className="module-container">
   <ModuleHeader 
    title="Code Auditor" 
    description="Deep scan for vulnerabilities, complexity (Big O), architecture smells, and code quality."
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
      <button className="secondary-button clear-btn" onClick={handleClear} title="Clear Input">
       <i className="fa-solid fa-trash"></i> Clear
      </button>
     </div>
          
     <CodeEditor value={input} onValueChange={setInput} language={selectedLang} /> 
          
     <div className="action-row">
      <button className="primary-button" onClick={() => handleAnalyze()} disabled={loading || !input.trim()}>
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
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
         {TABS.map((tab) => (
           <button 
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`} 
            onClick={() => setActiveTab(tab)} 
            style={{ whiteSpace: 'nowrap' }}
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
          {activeTab === 'complexity' && <ComplexityTab complexity={analysisData.complexity} />}
          
          {activeTab === 'security' && <IssuesTab type="security" items={analysisData.security} />}
          
          {activeTab === 'bugs' && <IssuesTab type="bugs" items={analysisData.bugs} />}
          
          {activeTab === 'improvements' && <IssuesTab type="improvements" items={analysisData.improvements} />}
          
          {activeTab === 'bestPractices' && <IssuesTab type="bestPractices" items={analysisData.bestPractices} />}
          
          {activeTab === 'testing' && <TestingTab testing={analysisData.testing} />}
          
          {activeTab === 'architecture' && <ArchitectureTab architecture={analysisData.architecture} />}
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
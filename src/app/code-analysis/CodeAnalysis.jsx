"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { convertCode, LANGUAGES, detectLanguage } from '@/lib';
import { CopyButton, CodeEditor } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { useApp } from '@/context';
import { ComplexityTab, IssuesTab, TestingTab, ArchitectureTab } from './tabs';

import './styles/CodeAnalysis.css';
import './styles/Codeanalysis-components.css'

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

  // Derived stats for the Editor
  const lineCount = input ? input.split('\n').length : 0;
  const charCount = input.length;

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

    const formatIssues = (arr) => (arr || []).map(i => `[${i.severity || 'Tip'}] ${i.location ? `(${i.location}) ` : ''}${i.issue}\nFix: ${i.resolution}`).join('\n\n') || 'None found.';

    switch (activeTab) {
      case 'complexity':
        return `Complexity Analysis:\n- Time: ${analysisData.complexity?.time || 'N/A'}\n- Space: ${analysisData.complexity?.space || 'N/A'}\n\nBreakdown:\n${(analysisData.complexity?.explanation || []).join('\n')}`;
      case 'security':
        return `Security Audit:\n${formatIssues(analysisData.security)}`;
      case 'bugs':
        return `Bug Report:\n${formatIssues(analysisData.bugs)}`;
      case 'improvements':
        return `Suggested Improvements:\n${formatIssues(analysisData.improvements)}`;
      case 'bestPractices':
        return `Best Practices:\n${formatIssues(analysisData.bestPractices)}`;
      case 'testing':
        return `Testing:\nEdge Cases:\n${(analysisData.testing?.edgeCases || []).join('\n')}\n\nUnit Tests:\n${(analysisData.testing?.unitTests || []).join('\n')}`;
      case 'architecture':
        return `Architecture:\nSmells:\n${(analysisData.architecture?.smells || []).join('\n')}\n\nDependencies:\n${(analysisData.architecture?.dependencies || []).join('\n')}`;
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
    setIsAutoDetected(true);
  };

  const TABS = [
    { id: 'complexity', icon: 'fa-chart-line', label: 'Complexity' },
    { id: 'security', icon: 'fa-shield-halved', label: 'Security' },
    { id: 'bugs', icon: 'fa-bug', label: 'Bugs' },
    { id: 'improvements', icon: 'fa-wand-magic-sparkles', label: 'Improvements' },
    { id: 'bestPractices', icon: 'fa-award', label: 'Practices' },
    { id: 'testing', icon: 'fa-vial', label: 'Testing' },
    { id: 'architecture', icon: 'fa-sitemap', label: 'Architecture' }
  ];

  return (
    <div className="a-module-container">
      <ModuleHeader
        title="Code Auditor"
        description="Deep scan for vulnerabilities, complexity (Big O), architecture smells, and code quality."
        resultData={lastResult}
      />

      <div className="a-analysis-layout">
        
        <div className="a-code-panel">
          <div className="a-panel-header">
            <div className="a-header-title">
              <i className="fa-solid fa-code"></i> Source Code
            </div>
            <div className="a-header-actions">
              <select
                value={selectedLang}
                onChange={(e) => { setSelectedLang(e.target.value); setIsAutoDetected(false); }}
                className="a-lang-selector"
              >
                {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
              </select>
              <button className="secondary-button clear-btn a-btn-sm" onClick={handleClear} title="Clear Input">
                <i className="fa-solid fa-trash"></i>
              </button>
              <button className="primary-button a-btn-sm" onClick={() => handleAnalyze()} disabled={loading || !input.trim()}>
                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-play"></i>}
                {loading ? "Analyzing" : "Audit"}
              </button>
            </div>
          </div>

          <div className="a-editor-wrapper">
            <div className="a-editor-scroll-area">
              <CodeEditor value={input} onValueChange={setInput} language={selectedLang} />
            </div>
            <div className="a-editor-footer">
              <span className="a-stat-item">
                <i className={`fa-solid ${isAutoDetected ? 'fa-wand-magic-sparkles a-text-accent' : 'fa-code'}`}></i>
                {isAutoDetected ? 'Auto-detected' : 'Manual Selection'}
              </span>
              <span className="a-stat-item">
                Ln {lineCount} <span className="a-stat-divider">|</span> Ch {charCount}
              </span>
            </div>
          </div>
        </div>

        <div className="a-report-panel">
          <div className="a-panel-header">
            <div className="a-header-title">
              <i className="fa-solid fa-chart-pie"></i> Audit Report
            </div>
            {analysisData && (
              <div className="a-header-actions">
                <button className="primary-button a-btn-sm a-action-btn" onClick={handleRefactorRouting}>
                  <i className="fas fa-wand-magic-sparkles"></i> Optimize Code
                </button>
              </div>
            )}
          </div>

          <div className="a-report-scroll-area">
            {analysisData ? (
              <div className="a-analysis-dashboard">
                
                <div className="a-analysis-header-card">
                  <div className="a-summary-section">
                    <h3 className="a-summary-title">Executive Summary</h3>
                    <p className="a-summary-text">{analysisData.summary}</p>
                  </div>
                  <div className="a-score-section">
                    <div className="a-score-ring" style={{ '--score-percent': `${analysisData.score}%` }}>
                      <svg className="a-score-svg" viewBox="0 0 36 36">
                        <path className="a-score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="a-score-fill" strokeDasharray={`${analysisData.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <div className="a-score-value">
                        <span className="a-score-number">{analysisData.score}</span>
                        <span className="a-score-label">/100</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="a-tabs-container">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      className={`a-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                      title={tab.label}
                    >
                      <i className={`fa-solid ${tab.icon}`}></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="a-analysis-tab-content-wrapper">
                  <div className="a-hover-copy-container">
                    <CopyButton
                      codeToCopy={getTabContentToCopy}
                      className="primary-button a-btn-icon-only copy-btn"
                      iconOnly={true}
                      label=""
                    />
                  </div>

                  <div className="a-analysis-tab-content">
                    {activeTab === 'complexity' && <ComplexityTab complexity={analysisData.complexity} />}
                    {activeTab === 'security' && <IssuesTab type="security" items={analysisData.security} />}
                    {activeTab === 'bugs' && <IssuesTab type="bugs" items={analysisData.bugs} />}
                    {activeTab === 'improvements' && <IssuesTab type="improvements" items={analysisData.improvements} />}
                    {activeTab === 'bestPractices' && <IssuesTab type="bestPractices" items={analysisData.bestPractices} />}
                    {activeTab === 'testing' && <TestingTab testing={analysisData.testing} />}
                    {activeTab === 'architecture' && <ArchitectureTab architecture={analysisData.architecture} />}
                  </div>
                </div>
              </div>
            ) : (
              <div className="a-empty-wrapper">
                <EmptyState
                  isLoading={loading}
                  condition={!analysisData}
                  icon="fas fa-search"
                  title="Awaiting Code Structure"
                  description="Paste your source code and click 'Audit' to reveal deep architectural, complexity, and security insights."
                  hint={<>Use <code>Optimize Code</code> after your audit finishes to automatically refactor structural warnings.</>}
                  loadingTitle="Auditing Codebase"
                  loadingDescription="Checking cognitive complexity metrics, security vulnerabilities, and design patterns..."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
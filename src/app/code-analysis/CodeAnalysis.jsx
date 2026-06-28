"use client";

import { LANGUAGES } from '@/lib';
import { CopyButton, CodeEditor } from '@/components/ui';
import { ModuleHeader, EmptyState } from '@/components/layout';
import { TestingTab } from './tabs/TestingTab';
import { ArchitectureTab } from './tabs/ArchitectureTab';
import { IssuesTab } from './tabs/IssuesTab';
import { AuditHistoryTab } from './tabs/AuditHistoryTab';
import { ShareButton } from './components/ShareButton';
import { useCodeAnalysis } from './useCodeAnalysis';

import dynamic from 'next/dynamic';
const ComplexityTab = dynamic(
  () => import('./tabs/ComplexityTab').then(m => ({ default: m.ComplexityTab })),
  { ssr: false }
);

import './styles/analysis-layout.css';
import './styles/analysis-components.css';
import './styles/analysis-widgets.css';

const AUDIT_TABS = [
  { id: 'security', icon: 'fa-shield-halved', label: 'Security' },
  { id: 'bugs', icon: 'fa-bug', label: 'Bugs' },
  { id: 'improvements', icon: 'fa-wand-magic-sparkles', label: 'Improvements' },
  { id: 'bestPractices', icon: 'fa-award', label: 'Practices' },
  { id: 'testing', icon: 'fa-vial', label: 'Testing' },
  { id: 'architecture', icon: 'fa-sitemap', label: 'Architecture' },
];

export default function CodeAnalysis() {
  const {
    input, setInput, analysisData, loading, lastResult,
    activeTab, setActiveTab, selectedLang, setSelectedLang,
    isAutoDetected, setIsAutoDetected, auditHistory, lineCount, charCount,
    getComplexityContentToCopy, getTabContentToCopy,
    handleAnalyze, handleRefactorRouting,
    handleClear, handleHistoryLoad,
    handleClearHistory, showCopyBtn
  } = useCodeAnalysis();

  return (
    <div className="a-module-container">
      <ModuleHeader
        title="Code Auditor"
        description="Deep scan for vulnerabilities, complexity (Big O), architecture smells, and code quality."
        resultData={lastResult}
      />

      <div className="a-global-actions-bar top-actions-bar">
        <div className="a-action-group">
          <button
            className="primary-button"
            onClick={() => handleAnalyze()}
            disabled={loading || !input.trim()}
          >
            {loading
              ? <><i className="fa-solid fa-circle-notch fa-spin" /> Analyzing</>
              : <><i className="fa-solid fa-play" /> Audit Code</>
            }
          </button>
          <select
            value={selectedLang}
            onChange={(e) => { setSelectedLang(e.target.value); setIsAutoDetected(false); }}
          >
            {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </div>

        <div className="a-action-group">
          <button className="secondary-button btn-danger" onClick={handleClear} title="Clear Input">
            <i className="fa-solid fa-trash" /> Clear
          </button>

          {analysisData && (
            <>
              <div className="a-action-divider"></div>
              <ShareButton
                analysisData={analysisData}
                code={input}
                language={selectedLang}
              />
              <button className="primary-button a-btn-sm a-action-btn" onClick={handleRefactorRouting}>
                <i className="fas fa-wand-magic-sparkles" /> Optimize Code
              </button>
            </>
          )}
        </div>
      </div>

      <div className="a-analysis-layout">
        <div className="a-code-panel">
          <div className="a-panel-header">
            <div className="a-header-title">
              <i className="fa-solid fa-code" /> Source Code
            </div>
          </div>

          <div className="a-editor-wrapper">
            <div className="a-editor-scroll-area">
              <CodeEditor 
                value={input} 
                onValueChange={setInput} 
                language={selectedLang} 
                onSubmit={handleAnalyze} 
              />
            </div>
            <div className="a-editor-footer">
              <span className="a-stat-item">
                <i className={`fa-solid ${isAutoDetected ? 'fa-wand-magic-sparkles a-text-accent' : 'fa-code'}`} />
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
              <i className="fa-solid fa-chart-line" /> Complexity & Summary
            </div>
            <CopyButton
              codeToCopy={getComplexityContentToCopy}
              className="primary-button copy-btn"
              iconOnly={false}
            />
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
                        <path className="a-score-bg" d="M18 2.1 a 15.9 15.9 0 0 1 0 31.8 a 15.9 15.9 0 0 1 0 -31.8" />
                        <path className="a-score-fill" strokeDasharray={`${analysisData.score}, 100`} d="M18 2.1 a 15.9 15.9 0 0 1 0 31.8 a 15.9 15.9 0 0 1 0 -31.8" />
                      </svg>
                      <div className="a-score-value">
                        <span className="a-score-number">{analysisData.score}</span>
                        <span className="a-score-label">/100</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="a-complexity-content-wrapper">
                  <ComplexityTab copyContent={getComplexityContentToCopy} complexity={analysisData.complexity} />
                </div>
              </div>
            ) : (
              <div className="a-empty-wrapper">
                <EmptyState
                  isLoading={loading}
                  condition={!analysisData}
                  icon="fas fa-search"
                  title="Awaiting Code Structure"
                  description="Paste your source code and click 'Audit Code' to reveal deep architectural, complexity, and security insights."
                  hint={<>Use <code>Optimize Code</code> after your audit finishes to automatically refactor structural warnings.</>}
                  loadingTitle="Auditing Codebase"
                  loadingDescription="Checking cognitive complexity metrics, security vulnerabilities, and design patterns..."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="a-detailed-reports-section">
        <div className="a-detailed-tabs-header">
          <div className="a-tabs-container">
            {analysisData && AUDIT_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`a-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <i className={`fa-solid ${tab.icon}`} />
                <span>{tab.label}</span>
              </button>
            ))}

            {analysisData && <div className="a-tabs-spacer" />}

            <button
              className={`a-tab-btn a-tab-btn--history ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
              title="Audit History"
            >
              <i className="fa-solid fa-clock-rotate-left" />
              <span>History</span>
              {auditHistory.length > 0 && (
                <span className="a-tab-count">{auditHistory.length}</span>
              )}
            </button>
            {showCopyBtn && (
              <CopyButton
                codeToCopy={getTabContentToCopy}
                className="primary-button copy-btn"
                iconOnly={false}
              />
            )}
          </div>
        </div>

        <div className="a-detailed-tab-content-wrapper">
          <div className="a-analysis-tab-content">
            {activeTab === 'history' && (
              <AuditHistoryTab
                history={auditHistory}
                onClear={handleClearHistory}
                onLoad={handleHistoryLoad}
              />
            )}

            {analysisData && activeTab === 'security' && (
              <IssuesTab type="security" items={analysisData.security} sourceCode={input} language={selectedLang} />
            )}
            {analysisData && activeTab === 'bugs' && (
              <IssuesTab type="bugs" items={analysisData.bugs} sourceCode={input} language={selectedLang} />
            )}
            {analysisData && activeTab === 'improvements' && (
              <IssuesTab type="improvements" items={analysisData.improvements} sourceCode={input} language={selectedLang} />
            )}
            {analysisData && activeTab === 'bestPractices' && (
              <IssuesTab type="bestPractices" items={analysisData.bestPractices} sourceCode={input} language={selectedLang} />
            )}
            {analysisData && activeTab === 'testing' && (
              <TestingTab testing={analysisData.testing} />
            )}
            {analysisData && activeTab === 'architecture' && (
              <ArchitectureTab architecture={analysisData.architecture} />
            )}

            {!analysisData && activeTab !== 'history' && (
              <div className="a-tab-no-data">
                <i className="fa-solid fa-magnifying-glass" />
                <p>Run an audit to see results here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { convertCode, LANGUAGES, detectLanguage, useDraft } from '@/lib';
import { useApp } from '@/context';
import { loadHistory, saveAuditToHistory, clearHistory } from './tabs/AuditHistoryTab';

export function useCodeAnalysis() {
  const { moduleData, setModuleData, qualityMode } = useApp();
  const router = useRouter();

  const [input, setInput] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(false);
  const [activeTab, setActiveTab] = useState('security');

  const [selectedLang, setSelectedLang] = useState('javascript');
  const [isAutoDetected, setIsAutoDetected] = useState(true);

  const [auditHistory, setAuditHistory] = useState([]);

  const lineCount = input ? input.split('\n').length : 0;
  const charCount = input.length;

  useEffect(() => {
    setAuditHistory(loadHistory());
  }, []);

  // Save audit to history whenever analysis completes
  const persistAudit = useCallback((data, code, lang) => {
    if (!data || !code) return;
    const totalIssues = [
      ...(data.security || []),
      ...(data.bugs || []),
      ...(data.improvements || []),
      ...(data.bestPractices || []),
    ].length;

    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      fileName: `audit_${new Date().toISOString().slice(0, 10)}`,
      language: lang,
      score: data.score,
      summary: data.summary,
      issueCount: totalIssues,
      code: code.slice(0, 3000), // keep snapshot capped at 3 KB
    };
    const updated = saveAuditToHistory(entry);
    setAuditHistory(updated);
  }, []);

  useEffect(() => {
    if (moduleData?.type === 'analysis') {
      const codeToAnalyze = moduleData.input || '';
      setInput(codeToAnalyze);

      if (moduleData.summary && moduleData.complexity) {
        setAnalysisData(moduleData);
        setLastResult({ type: 'analysis', input: codeToAnalyze, output: moduleData });
      } else if (moduleData.fullOutput?.analysis) {
        setAnalysisData(moduleData.fullOutput.analysis);
      } else if (moduleData.fullOutput?.summary && moduleData.fullOutput?.complexity) {
        setAnalysisData(moduleData.fullOutput);
        setLastResult({ type: 'analysis', input: codeToAnalyze, output: moduleData.fullOutput });
      } else if (moduleData.sourceModule === 'converter' && codeToAnalyze) {
        handleAnalyze(codeToAnalyze);
      }
    }
  }, [moduleData]);

  useDraft(
    'analysis-draft-data',
    { input, selectedLang, isAutoDetected, analysisData, activeTab },
    (saved) => {
      if (saved.input?.trim()) {
        setInput(saved.input);
        if (saved.selectedLang) setSelectedLang(saved.selectedLang);
        if (typeof saved.isAutoDetected === 'boolean') setIsAutoDetected(saved.isAutoDetected);
        if (saved.analysisData) {
          setAnalysisData(saved.analysisData);
          setLastResult({ type: 'analysis', input: saved.input, output: saved.analysisData });
        }
        if (saved.activeTab) setActiveTab(saved.activeTab);
      }
    },
    {
      isEmpty: (d) => !d.input.trim(),
      skip: moduleData?.type === 'analysis' || moduleData?.sourceModule === 'converter',
    }
  );

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
        setLastResult({ type: 'analysis', input: codeToProcess, output: result });
        persistAudit(result, codeToProcess, selectedLang);
      }
    } catch (error) {
      console.error('Analysis Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplexityContentToCopy = useMemo(() => {
    if (!analysisData?.complexity) return '';
    return `Complexity Analysis:\n- Time: ${analysisData.complexity.time || 'N/A'}\n- Space: ${analysisData.complexity.space || 'N/A'}\n\nBreakdown:\n${(analysisData.complexity.explanation || []).join('\n')}`;
  }, [analysisData]);

  const getTabContentToCopy = useMemo(() => {
    if (!analysisData) return '';
    const formatIssues = (arr) =>
      (arr || []).map(i => `[${i.severity || 'Tip'}] ${i.location ? `(${i.location}) ` : ''}${i.issue}\nFix: ${i.resolution}`).join('\n\n') || 'None found.';

    switch (activeTab) {
      case 'security': return `Security Audit:\n${formatIssues(analysisData.security)}`;
      case 'bugs': return `Bug Report:\n${formatIssues(analysisData.bugs)}`;
      case 'improvements': return `Suggested Improvements:\n${formatIssues(analysisData.improvements)}`;
      case 'bestPractices': return `Best Practices:\n${formatIssues(analysisData.bestPractices)}`;
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
      sourceModule: 'analysis',
    });
    router.push('/code-refactor');
  };

  const handleClear = () => {
    setLoading(false);
    setInput('');
    setAnalysisData(null);
    setIsAutoDetected(true);
  };

  const handleHistoryLoad = (entry) => {
    if (entry.code) setInput(entry.code);
    if (entry.language) { setSelectedLang(entry.language); setIsAutoDetected(false); }
    setActiveTab('security');
  };

  const handleClearHistory = () => {
    clearHistory();
    setAuditHistory([]);
  };

  const isHistoryTab = activeTab === 'history';
  const showCopyBtn = !isHistoryTab && analysisData;

  return {
    input,
    setInput,
    analysisData,
    loading,
    lastResult,
    activeTab,
    setActiveTab,
    selectedLang,
    setSelectedLang,
    isAutoDetected,
    setIsAutoDetected,
    auditHistory,
    lineCount,
    charCount,
    getComplexityContentToCopy,
    getTabContentToCopy,
    handleAnalyze,
    handleRefactorRouting,
    handleClear,
    handleHistoryLoad,
    handleClearHistory,
    isHistoryTab,
    showCopyBtn
  };
}
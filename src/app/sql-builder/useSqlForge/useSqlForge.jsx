'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { format } from 'sql-formatter';
import { toast } from 'sonner';
import { useWorkspace } from './useWorkspace';
import { useSandbox } from './useSandbox';
import { getFormatterDialect } from '../components/sqlForgeConstants';

export function useSqlForge() {
  const { moduleData, qualityMode } = useApp();

  const [activeMode, setActiveMode] = useState('builder');
  const [input, setInput] = useState('');
  const [targetDialect, setTargetDialect] = useState('Standard SQL');
  const [sourceDialect, setSourceDialect] = useState('MySQL');
  const [explainChanges, setExplainChanges] = useState(true);

  const [outputCode, setOutputCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [recommendedIndexes, setRecommendedIndexes] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const workspace = useWorkspace();
  const sandbox = useSandbox({
    outputCode,
    schema: workspace.schema,
    targetDialect,
  });

  // Sync module data when opened from elsewhere in the app
  useEffect(() => {
    if (moduleData?.type === 'sql') {
      setInput(moduleData.input || '');
      setOutputCode(moduleData.fullOutput?.query || moduleData.fullOutput?.convertedCode || '');
      if (moduleData.targetLang) setTargetDialect(moduleData.targetLang);
      if (moduleData.mode) setActiveMode(moduleData.mode);
    }
  }, [moduleData]);

  const handleGenerate = async () => {
    if (!input.trim()) { toast.error('Please enter a requirement or query.'); return; }

    setLoading(true);
    setOutputCode('');
    setExplanation('');
    setWarnings([]);
    setRecommendedIndexes([]);
    setLastResult(null);
    sandbox.resetSandboxState();

    try {
      const result = await convertCode('sql', input, {
        targetLang: targetDialect,
        sourceLang: sourceDialect,
        mode: activeMode,
        schema: workspace.schema,
        explainChanges,
        qualityMode,
      });

      const query = result?.query || result?.convertedCode;
      if (!query) throw new Error('Unexpected response structure from AI.');

      setOutputCode(query);
      setExplanation(result.explanation || '');
      setWarnings(result.warnings || []);
      setRecommendedIndexes(result.recommendedIndexes || []);
      setLastResult({ type: 'sql', mode: activeMode, input, output: result });
      toast.success('Query generated!');
    } catch (err) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormatCode = () => {
    if (!outputCode) return;
    try {
      const formatted = format(outputCode, { language: getFormatterDialect(targetDialect) });
      setOutputCode(formatted);
      toast.success('SQL formatted!');
    } catch {
      toast.error('Could not format this SQL dialect.');
    }
  };

  const clearInputs = () => {
    setInput('');
    setOutputCode('');
    setExplanation('');
    setWarnings([]);
    setRecommendedIndexes([]);
    setLastResult(null);
    sandbox.resetSandbox();
  };

  return {
    // Mode & input
    activeMode, setActiveMode,
    input, setInput,
    targetDialect, setTargetDialect,
    sourceDialect, setSourceDialect,
    explainChanges, setExplainChanges,

    // Output
    outputCode, setOutputCode,
    explanation, warnings, recommendedIndexes,
    lastResult,

    // Loading
    loading,

    // Actions
    handleGenerate,
    handleFormatCode,
    clearInputs,

    ...workspace,
    ...sandbox,
  };
}
import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context';
import { useDraft } from '@/lib';
import { generateProjectFiles } from './utils';

const DEFAULT_CONFIG = {
  language: 'Auto-Detect / Any',
  framework: 'None (Vanilla)',
  architecture: 'Standard / Minimal',
  verbosity: 'production',
  includeReadme: true,
  includeDocs: false,
  includeTests: false,
  customStack: '',
};

export function useCodeGenerator() {
  const { moduleData, qualityMode } = useApp();

  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [lastResult, setLastResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRestoring = useRef(false);
  const historyLoaded = useRef(false);

  useDraft(
    'generator-draft-data',
    { input, files, config },
    (saved) => {
      if (historyLoaded.current) return;
      if (saved?.input?.trim() || saved?.files?.length > 0) {
        isRestoring.current = true;

        if (saved.input) setInput(saved.input);
        if (saved.files?.length > 0) setFiles(saved.files);
        if (saved.config) setConfig(saved.config);

        setTimeout(() => { isRestoring.current = false; }, 100);
      }
    },
    {
      isEmpty: (d) => !d.input?.trim() && (!d.files || d.files.length === 0),
      skip: moduleData?.type === 'generator' || isRestoring.current,
    }
  );

  useEffect(() => {
    if (!moduleData || moduleData.type !== 'generator') return;

    isRestoring.current = true;
    historyLoaded.current = true;

    try {
      const savedInput = typeof moduleData.input === 'string' ? moduleData.input : moduleData.input?.text || '';
      const savedOutput = typeof moduleData.fullOutput === 'string' ? JSON.parse(moduleData.fullOutput) : moduleData.fullOutput;

      setInput(savedInput || '');

      if (savedOutput) {
        setFiles(Array.isArray(savedOutput) ? savedOutput : (savedOutput.files || []));
      }
      if (moduleData.config) {
        setConfig(moduleData.config);
      }
    } catch (e) {
      console.error('Failed to restore history', e);
    }

    setTimeout(() => { isRestoring.current = false; }, 100);
  }, [moduleData]);

  useEffect(() => {
    if (files.length > 0 && !isRestoring.current) {
      setLastResult({
        type: 'generator',
        input,
        output: { files },
        config,
        qualityMode,
      });
    }
  }, [files, input, config, qualityMode]);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setFiles([]);
    setLastResult(null);

    try {
      const result = await generateProjectFiles(input, config, { qualityMode });

      if (result && result.files) {
        setFiles(result.files);
        setActiveFileIndex(0);

        setLastResult({
          type: 'generator',
          input,
          output: result,
          config,
          qualityMode
        });
      } else {
        throw new Error('Invalid response format from AI.');
      }
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = useCallback(() => {
    setInput('');
    setFiles([]);
    setActiveFileIndex(0);
    setError('');
    setLastResult(null);
    setConfig(DEFAULT_CONFIG);
  }, []);

  return {
    // State
    input, setInput,
    files, setFiles,
    activeFileIndex, setActiveFileIndex,
    config, setConfig,
    lastResult,
    loading,
    error,

    // Actions
    handleGenerate,
    handleClearAll,
  };
}
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context';
import { get, set } from 'idb-keyval';
import debounce from 'lodash/debounce';
import { generateProjectFiles } from './utils';

const DRAFT_KEY = 'generator-draft-data';

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
  const { qualityMode } = useApp();

  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [lastResult, setLastResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pendingDraft, setPendingDraft] = useState(null);

  const saveDraft = useCallback(
    debounce(async (draftData) => {
      // Only persist when there's meaningful content
      if (draftData.input?.trim() || draftData.files?.length > 0) {
        try {
          await set(DRAFT_KEY, draftData);
        } catch (e) {
          console.error('IndexedDB draft save error:', e);
        }
      }
    }, 1500),
    []
  );

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const saved = await get(DRAFT_KEY);
        if (saved && (saved.input?.trim() || saved.files?.length > 0)) {
          setPendingDraft(saved);
        }
      } catch (err) {
        console.error('Draft load failed:', err);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    saveDraft({ input, files, config });
    return () => saveDraft.cancel();
  }, [input, files, config, saveDraft]);

  const handleConfirmDraft = () => {
    if (!pendingDraft) return;
    setInput(pendingDraft.input || '');
    setFiles(pendingDraft.files || []);
    setActiveFileIndex(0);
    if (pendingDraft.config) setConfig(pendingDraft.config);
    setPendingDraft(null);
  };

  const handleCancelDraft = async () => {
    try {
      await set(DRAFT_KEY, null);
    } catch (e) {
      console.error('Draft clear error:', e);
    }
    setPendingDraft(null);
  };

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
        setLastResult({ type: 'generator', input, output: result });
      } else {
        throw new Error('Invalid response format from AI.');
      }
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setInput('');
    setFiles([]);
    setActiveFileIndex(0);
    setError('');
    setLastResult(null);
    // Also wipe the persisted draft so it doesn't resurface
    try {
      await set(DRAFT_KEY, null);
    } catch (e) {
      console.error('Draft clear error:', e);
    }
  };

  return {
    // State
    input, setInput,
    files, setFiles,
    activeFileIndex, setActiveFileIndex,
    config, setConfig,
    lastResult,
    loading,
    error,
    pendingDraft,

    // Actions
    handleGenerate,
    handleClearAll,
    handleConfirmDraft,
    handleCancelDraft,
  };
}
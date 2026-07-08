'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '@/context';
import { convertCode, useDraft, useShareState } from '@/lib';
import { DEFAULT_OUTPUT_CONFIG, detectSpecFormat } from './constants';
import { toast } from 'sonner';

const MAX_HISTORY = 5;

export function useApiMocks({ onDataUpdate } = {}) {
  const { moduleData, qualityMode } = useApp();

  const [specInput, setSpecInput] = useState('');
  const [outputConfig, setOutputConfig] = useState(DEFAULT_OUTPUT_CONFIG);
  const updateOutputConfig = useCallback((key, value) => {
    setOutputConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const hasShareParam = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('share');

  const { share, readSharedState, shareCopied } = useShareState({
    toolId: 'api-mocks',
    input: specInput,
    config: outputConfig,
  });

  useEffect(() => {
    const shared = readSharedState();
    if (!shared) return;
    if (shared.input) setSpecInput(shared.input);
    if (shared.config) setOutputConfig(prev => ({ ...prev, ...shared.config }));
  }, []); 

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [linksDropdownOpen, setLinksDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeHandlerIdx, setActiveHandlerIdx] = useState(0);
  const [viewMode, setViewMode] = useState('code');
  const [filterQuery, setFilterQuery] = useState('');
  const [parsedSpecFeedback, setParsedSpecFeedback] = useState([]);
  const [copyFlash, setCopyFlash] = useState(null);

  const [savedSpecs, setSavedSpecs] = useState([]);
  const [specsVisible, setSpecsVisible] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [saveSpecError, setSaveSpecError] = useState('');

  const [editingHandlerIdx, setEditingHandlerIdx] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [handlerDirty, setHandlerDirty] = useState({});

  const [regeneratingIdx, setRegeneratingIdx] = useState(null);
  const [isAddEndpointOpen, setIsAddEndpointOpen] = useState(false);
  const [addEndpointInput, setAddEndpointInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const [generationHistory, setGenerationHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeErrorVariant, setActiveErrorVariant] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [timeRemaining, setTimeRemaining] = useState(null);
  
  useEffect(() => {
    if (!generatedData?.expiresAt) {
      setTimeRemaining(null);
      return;
    }
    const tick = () => {
      const diff = generatedData.expiresAt - Date.now();
      if (diff <= 0) {
        setTimeRemaining(0);
      } else {
        setTimeRemaining(diff);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [generatedData?.expiresAt]);

  const isHibernating = timeRemaining === 0;
  
  const formattedTimeRemaining = useMemo(() => {
    if (timeRemaining == null || timeRemaining <= 0) return '0m';
    const totalSeconds = Math.floor(timeRemaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, [timeRemaining]);


  useEffect(() => {
    try {
      const saved = localStorage.getItem('mockApiSpecs');
      if (saved) setSavedSpecs(JSON.parse(saved));
      const hist = localStorage.getItem('mockApiHistory');
      if (hist) setGenerationHistory(JSON.parse(hist));
    } catch (e) {
      console.warn('Failed to load saved data:', e);
    }
  }, []);

  useEffect(() => {
    if (hasShareParam) return;
    if (moduleData && moduleData.type === 'api-mocks') {
      setSpecInput(moduleData.input || '');
      setOutputConfig(prev => ({
        ...prev,
        ...(moduleData.framework && { framework: moduleData.framework }),
        ...(moduleData.endpointCount && { endpointCount: moduleData.endpointCount }),
        ...(moduleData.delayMs != null && { delayMs: moduleData.delayMs }),
        ...(moduleData.errorRate != null && { errorRate: moduleData.errorRate }),
        ...(moduleData.paginationStyle && { paginationStyle: moduleData.paginationStyle }),
        ...(moduleData.authStyle && { authStyle: moduleData.authStyle }),
        ...(moduleData.includeTypes != null && { includeTypes: moduleData.includeTypes }),
        ...(moduleData.includeAnalysis != null && { includeAnalysis: moduleData.includeAnalysis }),
        ...(moduleData.envPrefix && { envPrefix: moduleData.envPrefix }),
        ...(moduleData.mockDuration && { mockDuration: moduleData.mockDuration }),
      }));

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedSpecFeedback(parsed.parsedSpec || []);
          setActiveHandlerIdx(0);
          setFilterQuery('');
        } catch (e) {
          console.warn('Failed to parse stored output:', e);
        }
      }
    }
  }, [moduleData]);

  useDraft(
    'api-mocks-draft',
    { specInput, outputConfig, generatedData },
    (saved) => {
      if (saved.specInput !== undefined) setSpecInput(saved.specInput);
      if (saved.outputConfig) setOutputConfig(prev => ({ ...prev, ...saved.outputConfig }));
      if (saved.generatedData !== undefined) setGeneratedData(saved.generatedData);
    },
    {
      isEmpty: (d) => !d.specInput?.trim(),
      skip: hasShareParam || !!(moduleData && moduleData.type === 'api-mocks'),
    }
  );

  const detectedFormat = useMemo(() => detectSpecFormat(specInput), [specInput]);

  const filteredHandlers = useMemo(() => {
    if (!generatedData?.handlers) return [];
    const q = filterQuery.toLowerCase().trim();
    if (!q) return generatedData.handlers;
    return generatedData.handlers.filter(h =>
      h.name?.toLowerCase().includes(q) ||
      h.path?.toLowerCase().includes(q) ||
      h.method?.toLowerCase().includes(q) ||
      h.description?.toLowerCase().includes(q)
    );
  }, [generatedData, filterQuery]);

  const activeHandler = filteredHandlers[activeHandlerIdx] ?? null;

  const methodCounts = useMemo(() => {
    if (!generatedData?.handlers) return {};
    return generatedData.handlers.reduce((acc, h) => {
      const m = h.method?.toUpperCase() ?? 'GET';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
  }, [generatedData]);

  const pushHistory = useCallback((data) => {
    const entry = {
      timestamp: new Date().toISOString(),
      label: `${data.handlers?.length ?? 0} handlers – ${new Date().toLocaleTimeString()}`,
      data,
    };
    setGenerationHistory(prev => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      try { localStorage.setItem('mockApiHistory', JSON.stringify(next)); } catch (_) { }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!specInput.trim()) return;

    setIsLoading(true);
    setParsedSpecFeedback([]);
    setHandlerDirty({});
    setActiveErrorVariant({});

    const oldMockId = generatedData?.mockId;

    try {
      const data = await convertCode('api-mocks', specInput, {
        ...outputConfig,
        existingMockId: oldMockId,
        expiresIn: outputConfig.mockDuration,
        qualityMode,
        detectedFormat,
      });

      // Verify if ID was maintained
      if (oldMockId && data.mockId && (data.idChanged || oldMockId !== data.mockId)) {
        toast.info("Note: Your Mock Server ID changed because it was picked up by another session. Update your base URLs.");
      }

      setGeneratedData(data);
      setParsedSpecFeedback(data.parsedSpec || []);
      setActiveHandlerIdx(0);
      setFilterQuery('');
      setViewMode('code');
      pushHistory(data);

      if (onDataUpdate) {
        onDataUpdate({
          type: 'api-mocks',
          input: specInput,
          output: JSON.stringify(data),
          ...outputConfig,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating API mock handlers.');
    } finally {
      setIsLoading(false);
    }
  }, [specInput, outputConfig, qualityMode, detectedFormat, onDataUpdate, pushHistory, generatedData?.mockId]);

  const handleWakeUp = useCallback(async () => {
    if (!generatedData?.mockId) return;

    setIsLoading(true);
    const oldMockId = generatedData.mockId;

    try {
      const data = await convertCode('api-mocks', '', {
        action: 'wake',
        existingMockId: oldMockId,
        wakeData: generatedData,
        expiresIn: outputConfig.mockDuration,
      });

      if (data.idChanged || (data.mockId && data.mockId !== oldMockId)) {
        toast.info("Your original link was taken over in the meantime, so we issued a new one. Update your base URLs.");
      }

      setGeneratedData(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to wake up server. You may need to regenerate the mock entirely.');
    } finally {
      setIsLoading(false);
    }
  }, [generatedData, outputConfig.mockDuration]);

  const handleRegenerateHandler = useCallback(async (idx) => {
    if (!generatedData?.handlers?.[idx]) return;
    const handler = generatedData.handlers[idx];
    setRegeneratingIdx(idx);

    try {
      const singleSpec = `${handler.method} ${handler.path}\n${handler.description || ''}`;
      const data = await convertCode('api-mocks', singleSpec, {
        ...outputConfig,
        endpointCount: 1,
        includeAnalysis: false,
        qualityMode,
        detectedFormat: 'rest',
      });

      const newHandler = data.handlers?.[0];
      if (!newHandler) throw new Error('No handler returned');

      setGeneratedData(prev => {
        const handlers = [...prev.handlers];
        handlers[idx] = newHandler;
        const next = { ...prev, handlers };
        pushHistory(next);
        return next;
      });
      setHandlerDirty(prev => { const n = { ...prev }; delete n[idx]; return n; });
      setActiveErrorVariant(prev => { const n = { ...prev }; delete n[idx]; return n; });
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error regenerating handler.');
    } finally {
      setRegeneratingIdx(null);
    }
  }, [generatedData, outputConfig, qualityMode, pushHistory]);

  const handleAddEndpoint = useCallback(async () => {
    if (!addEndpointInput.trim() || !generatedData) return;
    setIsLoading(true);
    try {
      const data = await convertCode('api-mocks', addEndpointInput.trim(), {
        ...outputConfig,
        endpointCount: 1,
        errorRate: 0,
        includeAnalysis: false,
        qualityMode,
        detectedFormat: 'rest',
      });

      const newHandler = data.handlers?.[0];
      if (!newHandler) throw new Error('No handler returned');

      const newIndex = generatedData.handlers.length;
      setGeneratedData(prev => {
        const handlers = [...prev.handlers, newHandler];
        const next = { ...prev, handlers };
        pushHistory(next);
        return next;
      });
      setFilterQuery('');
      setActiveHandlerIdx(newIndex);
      setAddEndpointInput('');
      setIsAddEndpointOpen(false);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error adding endpoint.');
    } finally {
      setIsLoading(false);
    }
  }, [addEndpointInput, generatedData, outputConfig, qualityMode, pushHistory]);

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') setSpecInput(text);
    };
    reader.readAsText(file);
  }, []);

  const dragCounterRef = useRef(0);
  const handleDragEnter = useCallback((e) => { e.preventDefault(); dragCounterRef.current += 1; setIsDragOver(true); }, []);
  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); dragCounterRef.current = 0; setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const flashCopy = useCallback((key) => {
    setCopyFlash(key);
    setTimeout(() => setCopyFlash(null), 2000);
  }, []);

  const mockLinks = useMemo(() => {
    if (!generatedData?.mockId || typeof window === 'undefined') return [];
    const base = `${window.location.origin}/m/${generatedData.mockId}`;
    const links = [{ key: 'link-root', url: base, method: null }];
    (generatedData.handlers || []).forEach((h, i) => {
      links.push({ key: `link-${i}`, url: `${base}${h.path}`, method: h.method });
    });
    return links;
  }, [generatedData?.mockId, generatedData?.handlers]);

  const handleCopyLink = useCallback((key, url) => {
    navigator.clipboard.writeText(url).then(() => flashCopy(key)).catch(() => { });
  }, [flashCopy]);

  const handleCopyActiveHandler = useCallback(() => {
    if (!activeHandler) return;
    const text = viewMode === 'fixture' ? JSON.stringify(activeHandler.fixtureData, null, 2) : activeHandler.code;
    navigator.clipboard.writeText(text).then(() => flashCopy('handler')).catch(() => { });
  }, [activeHandler, viewMode, flashCopy]);

  const handleCopyAll = useCallback(() => {
    if (!generatedData?.handlers) return;
    const allCode = viewMode === 'fixture'
      ? generatedData.handlers.map(h => JSON.stringify(h.fixtureData, null, 2)).join('\n\n// ────────────────────────────\n\n')
      : generatedData.handlers.map(h => h.code).join('\n\n// ────────────────────────────\n\n');
    navigator.clipboard.writeText(allCode).then(() => flashCopy('all')).catch(() => { });
  }, [generatedData, viewMode, flashCopy]);

  const startEdit = useCallback((idx, field) => {
    if (!generatedData?.handlers?.[idx]) return;
    const handler = generatedData.handlers[idx];
    const value = field === 'fixtureData' ? JSON.stringify(handler.fixtureData, null, 2) : handler.code;
    setEditingHandlerIdx(idx);
    setEditingField(field);
    setEditDraft(value);
  }, [generatedData]);

  const cancelEdit = useCallback(() => {
    setEditingHandlerIdx(null);
    setEditingField(null);
    setEditDraft('');
  }, []);

  const handleRestoreHistory = useCallback((entry) => {
    setGeneratedData(entry.data);
    setParsedSpecFeedback(entry.data.parsedSpec || []);
    setActiveHandlerIdx(0);
    setFilterQuery('');
    setHandlerDirty({});
    setActiveErrorVariant({});
    cancelEdit();
    setHistoryOpen(false);
  }, [cancelEdit]);

  const commitEdit = useCallback(() => {
    if (editingHandlerIdx == null || !editingField) return;
    let parsedFixture;
    if (editingField === 'fixtureData') {
      try { parsedFixture = JSON.parse(editDraft); } 
      catch (_) { toast.error('Invalid JSON in fixture data. Please fix before saving.'); return; }
    }

    setGeneratedData(prev => {
      const handlers = [...prev.handlers];
      const handler = { ...handlers[editingHandlerIdx] };
      if (editingField === 'fixtureData') handler.fixtureData = parsedFixture;
      else handler.code = editDraft;
      handlers[editingHandlerIdx] = handler;
      return { ...prev, handlers };
    });
    setHandlerDirty(prev => ({ ...prev, [editingHandlerIdx]: true }));
    setEditingHandlerIdx(null);
    setEditingField(null);
    setEditDraft('');
  }, [editingHandlerIdx, editingField, editDraft]);

  const setErrorVariantForHandler = useCallback((handlerIdx, variantIdx) => {
    setActiveErrorVariant(prev => ({ ...prev, [handlerIdx]: variantIdx }));
  }, []);

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const exportAsZip = useCallback(async () => {
    if (!generatedData?.handlers) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const srcMocks = zip.folder('src/mocks/handlers');

      const groups = {};
      generatedData.handlers.forEach(h => {
        const segments = h.path.replace(/^\//, '').split('/').filter(Boolean);
        const group = segments[0] || 'root';
        if (!groups[group]) groups[group] = [];
        groups[group].push(h);
      });

      const barrelImports = [];

      Object.entries(groups).forEach(([group, handlers]) => {
        const filename = `${group}.ts`;
        const content = [
          `// ${group} handlers – generated by Mock Data Factory`,
          outputConfig.framework === 'msw' ? `import { http, HttpResponse } from 'msw';` : '',
          '',
          ...handlers.map(h => h.code),
          '',
          `export const ${group}Handlers = [`,
          ...handlers.map(h => `  ${h.name},`),
          `];`,
        ].filter(l => l !== undefined).join('\n');
        srcMocks.file(filename, content);
        barrelImports.push({ group, filename });
      });

      const barrel = [
        `// Auto-generated barrel – re-exports all handler arrays`,
        ...barrelImports.map(({ group, filename }) => `export { ${group}Handlers } from './${filename.replace('.ts', '')}';`),
        '',
        `// Combined handlers array for setupWorker / setupServer`,
        ...barrelImports.map(({ group, filename }) => `import { ${group}Handlers } from './${filename.replace('.ts', '')}';`),
        `export const handlers = [${barrelImports.map(b => `...${b.group}Handlers`).join(', ')}];`,
      ].join('\n');
      srcMocks.file('index.ts', barrel);

      if (outputConfig.framework === 'msw') {
        zip.folder('src/mocks').file('browser.ts', `import { setupWorker } from 'msw/browser';\nimport { handlers } from './handlers';\nexport const worker = setupWorker(...handlers);\n`);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mock-handlers.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error('Zip export failed:', e);
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, outputConfig]);

  const exportAsVSCodeSnippets = useCallback(() => {
    if (!generatedData?.handlers) return;
    const snippets = {};
    generatedData.handlers.forEach(h => {
      const key = h.name;
      const prefix = h.name;
      snippets[key] = { scope: 'typescript,javascript', prefix, body: h.code.split('\n'), description: h.description };
    });
    downloadFile(JSON.stringify(snippets, null, 2), 'api-mocks.code-snippets', 'application/json');
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData]);

  const executeExport = useCallback((exportType) => {
    if (!generatedData?.handlers) return;
    if (exportType === 'all-ts') {
      const isJson = outputConfig.framework === 'json';
      const ext = isJson ? 'json' : 'ts';
      const fileHeader = isJson ? '' : outputConfig.framework === 'msw'
        ? `// MSW v2 Handlers – generated by Mock Data Factory\nimport { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n`
        : outputConfig.framework === 'nextjs'
        ? `// Next.js App Router API Routes – generated by Mock Data Factory\n`
        : `// Axios Mock Adapter handlers – generated by Mock Data Factory\nimport MockAdapter from 'axios-mock-adapter';\n\n`;

      const allCode = viewMode === 'fixture'
        ? generatedData.handlers.map(h => JSON.stringify(h.fixtureData, null, 2)).join('\n\n')
        : generatedData.handlers.map(h => h.code).join('\n\n// ─────\n\n');
      const fileFooter = outputConfig.framework === 'msw' ? '\n];\n' : '';

      downloadFile(fileHeader + allCode + fileFooter, `mock-handlers.${ext}`, isJson ? 'application/json' : 'text/typescript');
    }
    else if (exportType === 'fixtures-json') {
      const fixtures = {};
      generatedData.handlers.forEach(h => {
        fixtures[`${h.method} ${h.path}`] = { status: h.statusCode ?? 200, data: h.fixtureData };
      });
      downloadFile(JSON.stringify(fixtures, null, 2), 'fixtures.json', 'application/json');
    }
    else if (exportType === 'active-ts') {
      if (!activeHandler) return;
      downloadFile(activeHandler.code, `${activeHandler.name}.ts`, 'text/typescript');
    }
    else if (exportType === 'postman') {
      const collection = {
        info: { name: 'Mock API Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: generatedData.handlers.map(h => ({
          name: h.name,
          request: { method: h.method, url: { raw: `{{baseUrl}}${h.path}`, host: ['{{baseUrl}}'], path: h.path.split('/').filter(Boolean) }, description: h.description },
          response: [{ name: `${h.statusCode ?? 200} OK`, status: 'OK', code: h.statusCode ?? 200, body: JSON.stringify(h.fixtureData, null, 2) }],
        })),
      };
      downloadFile(JSON.stringify(collection, null, 2), 'mock-collection.postman_collection.json', 'application/json');
    }
    else if (exportType === 'zip') { exportAsZip(); return; }
    else if (exportType === 'vscode-snippets') { exportAsVSCodeSnippets(); return; }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeHandler, outputConfig, viewMode, exportAsZip, exportAsVSCodeSnippets]);

  const triggerExportModal = useCallback((type) => {
    const labels = {
      'all-ts': `All Handlers (.ts)`, 'fixtures-json': 'JSON Fixtures', 'active-ts': `Active Handler (.ts)`,
      'postman': 'Postman Collection (.json)', 'zip': 'Project Structure (.zip)', 'vscode-snippets': 'VS Code Snippets (.code-snippets)',
    };
    setModalConfig({
      isOpen: true, title: `Export ${labels[type] || type}`,
      message: 'Download the generated mock code as a production-ready file.',
      confirmText: 'Export', cancelText: 'Cancel', icon: 'fa-file-export',
      onConfirm: () => executeExport(type),
    });
  }, [executeExport]);

  const handleSaveSpec = useCallback(() => {
    setNewSpecName(''); setSaveSpecError(''); setIsSaveModalOpen(true);
  }, []);

  const executeSaveSpec = useCallback(() => {
    if (!newSpecName?.trim()) { setSaveSpecError('Name cannot be empty.'); return; }
    const trimmed = newSpecName.trim();
    if (savedSpecs.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setSaveSpecError('A spec with this name already exists.'); return;
    }
    const newSaved = [...savedSpecs, { name: trimmed, spec: specInput, framework: outputConfig.framework }];
    try {
      localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved));
      setSavedSpecs(newSaved); setIsSaveModalOpen(false);
    } catch (e) {
      setSaveSpecError('Storage quota exceeded. Delete some saved specs first.');
    }
  }, [newSpecName, savedSpecs, specInput, outputConfig]);

  const handleDeleteSpec = useCallback((idx) => {
    const newSaved = savedSpecs.filter((_, i) => i !== idx);
    setSavedSpecs(newSaved);
    try { localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved)); } catch (e) {}
    if (newSaved.length === 0) setSpecsVisible(false);
  }, [savedSpecs]);

  const clearWorkspace = useCallback(() => {
    setSpecInput(''); setGeneratedData(null); setParsedSpecFeedback([]);
    setActiveHandlerIdx(0); setFilterQuery(''); setViewMode('code');
    setEditingHandlerIdx(null); setEditingField(null); setEditDraft('');
    setHandlerDirty({}); setRegeneratingIdx(null); setActiveErrorVariant({});
    setCopyFlash(null); setIsAddEndpointOpen(false); setAddEndpointInput('');
  }, []);

  const resetConfig = useCallback(() => { setOutputConfig(DEFAULT_OUTPUT_CONFIG); }, []);

  const resultData = useMemo(() => {
    if (!generatedData) return null;
    return { type: 'api-mocks', input: specInput, output: JSON.stringify(generatedData), ...outputConfig };
  }, [generatedData, specInput, outputConfig]);

  return {
    share, shareCopied, resultData, shareDisabled: !specInput.trim(),
    specInput, setSpecInput, outputConfig, updateOutputConfig,
    isDropdownOpen, setIsDropdownOpen, detectedFormat,
    isLoading, generatedData, setGeneratedData,
    activeHandlerIdx, setActiveHandlerIdx,
    viewMode, setViewMode, filterQuery, setFilterQuery, filteredHandlers,
    activeHandler, parsedSpecFeedback, methodCounts, copyFlash,
    editingHandlerIdx, editingField, editDraft, setEditDraft, handlerDirty,
    startEdit, cancelEdit, commitEdit, regeneratingIdx,
    isAddEndpointOpen, setIsAddEndpointOpen, addEndpointInput, setAddEndpointInput,
    handleRegenerateHandler, handleAddEndpoint,
    isDragOver, handleDrop, handleDragEnter, handleDragOver, handleDragLeave, handleFileUpload,
    generationHistory, historyOpen, setHistoryOpen, handleRestoreHistory,
    activeErrorVariant, setErrorVariantForHandler,
    savedSpecs, specsVisible, setSpecsVisible, isSaveModalOpen, setIsSaveModalOpen,
    newSpecName, setNewSpecName, saveSpecError, setSaveSpecError, modalConfig, setModalConfig,
    isHibernating, formattedTimeRemaining, handleWakeUp,
    mockLinks, handleCopyLink, linksDropdownOpen, setLinksDropdownOpen,
    handleGenerate, handleCopyActiveHandler, handleCopyAll, triggerExportModal,
    handleSaveSpec, executeSaveSpec, handleDeleteSpec, clearWorkspace, resetConfig
  };
}
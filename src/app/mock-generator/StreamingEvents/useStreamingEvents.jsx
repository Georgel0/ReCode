'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '@/context';
import { convertCode, useDraft } from '@/lib';
import { DEFAULT_CONFIG, ITEMS_PER_PAGE } from './constants';
import { runRuleValidation, computeColumnDistribution, generateCodeSnippet, buildCorrelatedView } from './utils';

export function useStreamingEvents({ onDataUpdate }) {
  const { moduleData, qualityMode } = useApp();

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const updateConfig = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeStream, setActiveStreamRaw] = useState(0);
  const [parsedRulesFeedback, setParsedRulesFeedback] = useState([]);

  const [viewMode, setViewMode] = useState('events'); 
  const [filterQuery, setFilterQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [fieldFilters, setFieldFilters] = useState({});

  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(500); 
  const replayTimerRef = useRef(null);

  const [distColumn, setDistColumn] = useState(null);
  const [ruleValidation, setRuleValidation] = useState([]);

  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saveTemplateError, setSaveTemplateError] = useState('');

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { },
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('streamTemplates');
      if (saved) setSavedTemplates(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load stream templates:', e);
      localStorage.removeItem('streamTemplates');
    }
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'stream') {
      setConfig(prev => ({
        ...prev,
        schemaInput: moduleData.input || prev.schemaInput,
        rules: moduleData.rules !== undefined ? moduleData.rules : prev.rules,
        eventFormat: moduleData.eventFormat || prev.eventFormat,
        streamParadigm: moduleData.streamParadigm || prev.streamParadigm,
        eventCount: moduleData.eventCount ? String(moduleData.eventCount) : prev.eventCount,
        seed: moduleData.seed !== undefined ? moduleData.seed : prev.seed,
        dataQuality: moduleData.dataQuality != null ? moduleData.dataQuality : prev.dataQuality,
        includeAnalysis: moduleData.includeAnalysis !== undefined ? moduleData.includeAnalysis : prev.includeAnalysis,
        includeStateMachine: moduleData.includeStateMachine !== undefined ? moduleData.includeStateMachine : prev.includeStateMachine,
      }));

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedRulesFeedback(parsed.parsedRules || []);
          setActiveStreamRaw(0);
          setCurrentPage(1);
          setFilterQuery('');
          setFieldFilters({});
        } catch (e) {
          console.error('Failed to rehydrate stream data:', e);
        }
      }
    }
  }, [moduleData]);

  useEffect(() => {
    setCurrentPage(1);
    setFilterQuery('');
    setFieldFilters({});
    setEditingCell(null);
    setDistColumn(null);
    setReplayIndex(0);
    setReplayPlaying(false);
  }, [activeStream]);

  useDraft(
    'streaming-events-draft',
    { config, generatedData },
    (saved) => {
      if (saved.config) {
        setConfig(prev => ({ ...prev, ...saved.config }));
      }
      if (saved.generatedData !== undefined) setGeneratedData(saved.generatedData);
    },
    {
      isEmpty: (d) => !d.config?.schemaInput?.trim(),
      skip: !!(moduleData && moduleData.type === 'stream'),
    }
  );

  useEffect(() => {
    setCurrentPage(1);
    setEditingCell(null);
  }, [filterQuery, fieldFilters]);

  useEffect(() => { setEditingCell(null); }, [currentPage]);

  const activeStreamData = generatedData?.streams?.[activeStream] ?? null;

  useEffect(() => {
    if (!replayPlaying) {
      clearInterval(replayTimerRef.current);
      return;
    }
    const events = activeStreamData?.events ?? [];
    if (replayIndex >= events.length - 1) {
      setReplayPlaying(false);
      return;
    }
    clearInterval(replayTimerRef.current);

    replayTimerRef.current = setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= events.length - 1) {
          setReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, replaySpeed);
    return () => clearInterval(replayTimerRef.current);
  }, [replayPlaying, replaySpeed, activeStream, activeStreamData]);

  const allStreamNames = useMemo(
    () => generatedData?.streams?.map(s => s.streamName) ?? [],
    [generatedData]
  );

  const correlatedView = useMemo(() => {
    if (!generatedData?.streams || generatedData.streams.length < 2) return null;
    return buildCorrelatedView(generatedData.streams);
  }, [generatedData]);

  useEffect(() => {
    if (!generatedData?.streams || !config.rules?.trim()) {
      setRuleValidation([]);
      return;
    }
    const results = runRuleValidation(generatedData.streams, config.rules);
    setRuleValidation(results);
  }, [generatedData, config.rules]);

  const distData = useMemo(() => {
    if (!distColumn || !activeStreamData?.events) return null;
    return computeColumnDistribution(activeStreamData.events, distColumn);
  }, [distColumn, activeStreamData]);

  const handleLoadSample = useCallback((sample) => {
    if (!sample) return;
    setConfig(prev => ({
      ...prev,
      schemaInput: sample.schema,
      rules: sample.rules || '',
      streamParadigm: sample.streamParadigm || prev.streamParadigm,
      eventFormat: sample.eventFormat || prev.eventFormat
    }));
  }, []);

  const filteredEvents = useMemo(() => {
    if (!activeStreamData?.events) return [];
    let evts = activeStreamData.events;

    const activeFieldFilters = Object.entries(fieldFilters).filter(([, v]) => v !== '' && v !== null && v !== undefined);

    if (activeFieldFilters.length > 0) {
      evts = evts.filter(evt =>
        activeFieldFilters.every(([k, v]) => {
          const val = evt[k];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(String(v).toLowerCase());
        })
      );
    }

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      evts = evts.filter(evt => {
        const str = typeof evt === 'object' ? JSON.stringify(evt) : String(evt);
        return str.toLowerCase().includes(q);
      });
    }

    return evts;
  }, [activeStreamData, filterQuery, fieldFilters]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, currentPage]);

  const colKeys = useMemo(() => {
    if (!activeStreamData?.events?.length) return [];
    const allKeys = new Set();

    activeStreamData.events.forEach(evt => {
      if (typeof evt === 'object' && evt !== null)
        Object.keys(evt).forEach(k => allKeys.add(k));
    });
    return Array.from(allKeys);
  }, [activeStreamData]);

  const colUniqueValues = useMemo(() => {
    if (!activeStreamData?.events?.length) return {};
    const result = {};

    colKeys.forEach(k => {
      const vals = new Set(activeStreamData.events.map(e => {
        const v = e[k];
        return (v === null || v === undefined) ? '' : String(v);
      }));
      if (vals.size <= 20 && vals.size > 1) {
        result[k] = Array.from(vals).filter(v => v !== '').sort();
      }
    });
    return result;
  }, [activeStreamData, colKeys]);

  const rawJsonContent = useMemo(() => {
    if (!activeStreamData?.events) return '';
    return activeStreamData.events.map(e => JSON.stringify(e)).join('\n');
  }, [activeStreamData]);

  const rawFullContent = useMemo(() => {
    if (!generatedData) return '';
    return JSON.stringify(generatedData, null, 2);
  }, [generatedData]);

  const handleGenerate = useCallback(async () => {
    if (!config.schemaInput.trim()) return;
    setIsLoading(true);
    setParsedRulesFeedback([]);
    setGeneratedData(null);
    setViewMode('events');
    setFieldFilters({});
    setDistColumn(null);
    setReplayIndex(0);
    setReplayPlaying(false);

    try {
      const count = parseInt(config.eventCount, 10) || 25;
      const data = await convertCode('stream', config.schemaInput, {
        mode: 'builder',
        qualityMode,
        rules: config.rules,
        eventFormat: config.eventFormat,
        streamParadigm: config.streamParadigm,
        eventCount: count,
        seed: config.seed || undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: config.includeAnalysis,
        includeStateMachine: config.includeStateMachine,
      });

      if (config.includeStateMachine && !data.stateMachine) {
        console.warn('[StreamingEventsTab] includeStateMachine was true but AI response omitted stateMachine field.');
      }
      if (config.includeAnalysis && !data.explanation) {
        console.warn('[StreamingEventsTab] includeAnalysis was true but AI response omitted explanation field.');
      }

      setGeneratedData(data);
      setParsedRulesFeedback(data.parsedRules || []);
      setActiveStreamRaw(0);
      setCurrentPage(1);
      setFilterQuery('');
      setEditingCell(null);

      if (onDataUpdate) {
        onDataUpdate({
          type: 'stream',
          input: config.schemaInput,
          output: JSON.stringify(data),
          rules: config.rules,
          eventFormat: config.eventFormat,
          streamParadigm: config.streamParadigm,
          eventCount: config.eventCount,
          seed: config.seed,
          dataQuality: config.dataQuality,
          includeAnalysis: config.includeAnalysis,
          includeStateMachine: config.includeStateMachine,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating event stream.');
    } finally {
      setIsLoading(false);
    }
  }, [config, qualityMode, onDataUpdate]);

  const handleStartEdit = useCallback((rowIdx, colKey, currentVal) => {
    const rawVal = typeof currentVal === 'object' && currentVal !== null
      ? JSON.stringify(currentVal)
      : String(currentVal ?? '');
    setEditingCell({ rowIdx, colKey });
    setEditingValue(rawVal);
  }, []);

  const handleCommitEdit = useCallback(() => {
    if (!editingCell || !generatedData) return;

    const { rowIdx, colKey } = editingCell;
    const targetEvent = paginatedEvents[rowIdx];
    if (!targetEvent) return;

    setGeneratedData(prev => {
      const updatedStreams = prev.streams.map((stream, idx) => {
        if (idx !== activeStream) return stream;
        const updatedEvents = stream.events.map((evt) => {
          if (evt !== targetEvent) return evt;
          let newVal = editingValue;
          if (newVal.startsWith('{') || newVal.startsWith('[')) {
            try { newVal = JSON.parse(newVal); } catch (_) { }
          } else if (!isNaN(newVal) && newVal.trim() !== '') {
            newVal = Number(newVal);
          } else if (newVal === 'true') {
            newVal = true;
          } else if (newVal === 'false') {
            newVal = false;
          }
          return { ...evt, [colKey]: newVal };
        });
        return { ...stream, events: updatedEvents };
      });
      return { ...prev, streams: updatedStreams };
    });

    setEditingCell(null);
    setEditingValue('');
  }, [editingCell, editingValue, activeStream, generatedData, paginatedEvents]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  const handleCopyCell = useCallback((val) => {
    const text = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
    navigator.clipboard.writeText(text).catch(() => console.warn('Clipboard write failed'));
  }, []);

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const executeExport = useCallback((type) => {
    if (!generatedData) return;

    if (type === 'ndjson') {
      const allEvents = generatedData.streams.flatMap(s => s.events);
      downloadFile(allEvents.map(e => JSON.stringify(e)).join('\n'), 'events.ndjson', 'application/x-ndjson');
    } else if (type === 'json') {
      downloadFile(JSON.stringify(generatedData.streams, null, 2), 'streams.json', 'application/json');
    } else if (type === 'csv') {
      const stream = generatedData.streams[activeStream];
      if (!stream?.events?.length) return;

      const keys = [...new Set(stream.events.flatMap(e => Object.keys(e)))];
      const rows = [keys.join(',')];

      stream.events.forEach(evt => {
        rows.push(keys.map(k => {
          let v = (evt[k] == null) ? '' : (typeof evt[k] === 'object' ? JSON.stringify(evt[k]) : String(evt[k]));
          return (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(','));
      });

      downloadFile(rows.join('\n'), `${stream.streamName}.csv`, 'text/csv');
    } else if (type === 'kafka') {
      const messages = generatedData.streams.flatMap(s =>
        s.events.map(e => JSON.stringify({ topic: s.streamName, key: e.session_id || e.user_id || e.id || null, value: e }))
      );
      downloadFile(messages.join('\n'), 'kafka-messages.ndjson', 'application/x-ndjson');
    } else if (type === 'python_kafka' || type === 'js_fetch' || type === 'python_requests' || type === 'curl') {
      const stream = generatedData.streams[activeStream];
      const snippet = generateCodeSnippet(stream.events, stream.streamName, type);
      const ext = type.startsWith('python') ? 'py' : type === 'js_fetch' ? 'js' : 'sh';

      downloadFile(snippet, `${stream.streamName}_publisher.${ext}`, 'text/plain');
    }

    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeStream]);

  const triggerExportModal = useCallback((type) => {
    const labels = {
      ndjson: 'NDJSON', json: 'JSON', csv: 'CSV', kafka: 'Kafka NDJSON',
      python_kafka: 'Python (Kafka)', js_fetch: 'JavaScript (fetch)', python_requests: 'Python (requests)', curl: 'cURL',
    };
    setModalConfig({
      isOpen: true,
      title: `Export as ${labels[type] || type.toUpperCase()}`,
      message: `Export your generated event stream as a production-ready file.`,
      confirmText: 'Export',
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: () => executeExport(type),
    });
  }, [executeExport]);

  const handleSaveTemplate = useCallback(() => {
    setNewTemplateName('');
    setSaveTemplateError('');
    setIsSaveModalOpen(true);
  }, []);

  const executeSaveTemplate = useCallback(() => {
    if (!newTemplateName?.trim()) {
      setSaveTemplateError('Name cannot be empty.');
      return;
    }
    const trimmed = newTemplateName.trim();
    if (savedTemplates.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setSaveTemplateError('A template with this name already exists.');
      return;
    }
    const updated = [
      ...savedTemplates, 
      { 
        name: trimmed, 
        schema: config.schemaInput, 
        rules: config.rules, 
        eventFormat: config.eventFormat, 
        streamParadigm: config.streamParadigm 
      }
    ];
    setSavedTemplates(updated);

    localStorage.setItem('streamTemplates', JSON.stringify(updated));
    setIsSaveModalOpen(false);
  }, [newTemplateName, savedTemplates, config]);

  const handleDeleteTemplate = useCallback((idx) => {
    const updated = savedTemplates.filter((_, i) => i !== idx);
    setSavedTemplates(updated);

    localStorage.setItem('streamTemplates', JSON.stringify(updated));
    if (updated.length === 0) setTemplatesVisible(false);
  }, [savedTemplates]);

  const setActiveStream = useCallback((idx) => {
    setActiveStreamRaw(idx);
  }, []);

  const handleReplayPlay = useCallback(() => {
    if (replayIndex >= (activeStreamData?.events?.length ?? 0) - 1) {
      setReplayIndex(0);
    }
    setReplayPlaying(true);
  }, [replayIndex, activeStreamData]);

  const handleReplayPause = useCallback(() => setReplayPlaying(false), []);
  const handleReplayReset = useCallback(() => { setReplayPlaying(false); setReplayIndex(0); }, []);
  const handleReplayStep = useCallback(() => {
    const max = (activeStreamData?.events?.length ?? 1) - 1;
    setReplayIndex(prev => Math.min(prev + 1, max));
  }, [activeStreamData]);

  const clearWorkspace = useCallback(() => {
    setConfig(prev => ({ ...prev, schemaInput: '', rules: '' }));
    setGeneratedData(null);
    setParsedRulesFeedback([]);
    setActiveStreamRaw(0);
    setViewMode('events');
    setFilterQuery('');
    setFieldFilters({});
    setCurrentPage(1);
    setEditingCell(null);
    setEditingValue('');
    setDistColumn(null);
    setRuleValidation([]);
    setReplayIndex(0);
    setReplayPlaying(false);
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      eventFormat: DEFAULT_CONFIG.eventFormat,
      streamParadigm: DEFAULT_CONFIG.streamParadigm,
      eventCount: DEFAULT_CONFIG.eventCount,
      seed: DEFAULT_CONFIG.seed,
      dataQuality: DEFAULT_CONFIG.dataQuality,
      includeAnalysis: DEFAULT_CONFIG.includeAnalysis,
      includeStateMachine: DEFAULT_CONFIG.includeStateMachine,
    }));
  }, []);

  return {
    config, setConfig, updateConfig,
    clearWorkspace, resetConfig,

    isLoading,
    generatedData,
    activeStream, setActiveStream,
    parsedRulesFeedback,
    allStreamNames,
    activeStreamData,

    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    fieldFilters, setFieldFilters,
    currentPage, setCurrentPage,
    totalPages,
    paginatedEvents,
    filteredEvents,
    colKeys,
    colUniqueValues,
    rawJsonContent,
    rawFullContent,

    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit, handleCopyCell,

    handleGenerate,
    triggerExportModal,

    savedTemplates,
    templatesVisible, setTemplatesVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newTemplateName, setNewTemplateName,
    saveTemplateError, setSaveTemplateError,
    handleSaveTemplate, executeSaveTemplate, handleDeleteTemplate,

    modalConfig, setModalConfig,

    handleLoadSample,

    replayIndex, setReplayIndex,
    replayPlaying,
    replaySpeed, setReplaySpeed,
    handleReplayPlay, handleReplayPause, handleReplayReset, handleReplayStep,

    distColumn, setDistColumn,
    distData,

    ruleValidation,
    correlatedView,
    generateCodeSnippet
  };
}
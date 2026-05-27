'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { convertCode } from '@/lib/api';

export const STREAM_RULE_TEMPLATES = [
  { label: "Burst Pattern", value: "Events should arrive in bursts: 10–20 events within 5 seconds, followed by a 30–60s quiet period." },
  { label: "Business Hours", value: "Timestamps must cluster between 09:00–18:00 local time on weekdays only." },
  { label: "Error Rate 5%", value: "Approximately 5% of events should be error or failure events." },
  { label: "Sequential Correlation", value: "Each event's session_id must be shared across a contiguous run of 3–8 events." },
  { label: "Monotonic Timestamps", value: "All event timestamps must be strictly monotonically increasing." },
  { label: "Partition Key Spread", value: "Distribute events evenly across 4 partition keys (e.g. region: us-east, us-west, eu-west, ap-south)." },
];

export const EVENT_FORMATS = [
  { value: 'json', label: 'JSON (newline-delimited)' },
  { value: 'kafka', label: 'Kafka Message (JSON)' },
  { value: 'eventbridge', label: 'AWS EventBridge' },
  { value: 'cloudevents', label: 'CloudEvents v1.0' },
  { value: 'pubsub', label: 'Google Pub/Sub' },
  { value: 'kinesis', label: 'AWS Kinesis' },
];

export const STREAM_PARADIGMS = [
  { value: 'telemetry', label: 'Telemetry / Metrics', icon: 'fa-chart-line' },
  { value: 'access_log', label: 'Access Logs', icon: 'fa-list-alt' },
  { value: 'journey', label: 'Customer Journey', icon: 'fa-route' },
  { value: 'iot', label: 'IoT / Sensor', icon: 'fa-microchip' },
  { value: 'audit', label: 'Audit Trail', icon: 'fa-shield-alt' },
  { value: 'custom', label: 'Custom Schema', icon: 'fa-code' },
];

export const SAMPLE_TEMPLATES = [
  {
    label: "E-Commerce Checkout Journey (Funnel)",
    schema: `{
  "event_type": "page_view | add_to_cart | begin_checkout | purchase",
  "user_id": "UUID",
  "session_id": "string",
  "product_id": "string?",
  "cart_value": "float?",
  "timestamp": "ISO8601"
}`,
    rules: "Events within a session must strictly follow the funnel: page_view -> add_to_cart -> begin_checkout -> purchase.\nNot all sessions reach purchase (simulate realistic drop-offs).\nTimestamps within a session must be monotonic, separated by 5-60 seconds.",
    streamParadigm: "journey",
    eventFormat: "json"
  },
  {
    label: "IoT Thermostat Telemetry",
    schema: `{
  "device_id": "UUID",
  "event_type": "telemetry",
  "temperature": "float",
  "humidity": "float",
  "hvac_status": "cooling | heating | idle",
  "timestamp": "ISO8601"
}`,
    rules: "Temperature should fluctuate realistically between 68.0 and 74.0.\nHVAC status triggers 'cooling' when temp > 73.0, and goes 'idle' when temp drops below 69.0.\nEvents arrive in exact 1-minute increments.",
    streamParadigm: "iot",
    eventFormat: "kafka"
  },
  {
    label: "Server Access Logs (Audit)",
    schema: `{
  "request_id": "UUID",
  "ip_address": "string",
  "method": "GET | POST | PUT | DELETE",
  "path": "string",
  "status_code": "integer",
  "latency_ms": "integer",
  "timestamp": "ISO8601"
}`,
    rules: "90% of requests should be GET requests with status 200.\n5% should be POST requests.\n5% should simulate errors (status 400, 401, 404, or 500).\nLatency for errors should be significantly higher.",
    streamParadigm: "access_log",
    eventFormat: "json"
  }
];

export const ITEMS_PER_PAGE = 15;

export function useStreamingEventsTab({ onDataUpdate }) {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  const [eventFormat, setEventFormat] = useState('json');
  const [streamParadigm, setStreamParadigm] = useState('telemetry');
  const [eventCount, setEventCount] = useState('25');
  const [seed, setSeed] = useState('');
  const [dataQuality, setDataQuality] = useState(100);
  const [includeAnalysis, setIncludeAnalysis] = useState(false);
  const [includeStateMachine, setIncludeStateMachine] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeStream, setActiveStreamRaw] = useState(0);
  const [parsedRulesFeedback, setParsedRulesFeedback] = useState([]);

  const [viewMode, setViewMode] = useState('events'); // 'events' | 'raw' | 'timeline'
  const [filterQuery, setFilterQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
      setSchemaInput(moduleData.input || '');
      if (moduleData.rules) setRules(moduleData.rules);
      if (moduleData.eventFormat) setEventFormat(moduleData.eventFormat);
      if (moduleData.streamParadigm) setStreamParadigm(moduleData.streamParadigm);
      if (moduleData.eventCount) setEventCount(String(moduleData.eventCount));
      if (moduleData.seed) setSeed(moduleData.seed);
      if (moduleData.dataQuality) setDataQuality(moduleData.dataQuality);
      if (moduleData.includeAnalysis !== undefined) setIncludeAnalysis(moduleData.includeAnalysis);
      if (moduleData.includeStateMachine !== undefined) setIncludeStateMachine(moduleData.includeStateMachine);

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedRulesFeedback(parsed.parsedRules || []);
          setActiveStreamRaw(0);
          setCurrentPage(1);
          setFilterQuery('');
        } catch (e) {
          console.error('Failed to rehydrate stream data:', e);
        }
      }
    }
  }, [moduleData]);

  useEffect(() => {
    setCurrentPage(1);
    setFilterQuery('');
    setEditingCell(null);
  }, [activeStream]);

  useEffect(() => { setCurrentPage(1); }, [filterQuery]);

  const activeStreamData = generatedData?.streams?.[activeStream] ?? null;

  const allStreamNames = useMemo(
    () => generatedData?.streams?.map(s => s.streamName) ?? [],
    [generatedData]
  );

  const handleLoadSample = useCallback((sample) => {
    if (!sample) return;
    setSchemaInput(sample.schema);
    if (sample.rules) {
      setRules(sample.rules);
    } else {
      setRules('');
    }
    if (sample.streamParadigm) setStreamParadigm(sample.streamParadigm);
    if (sample.eventFormat) setEventFormat(sample.eventFormat);
  }, []);

  const filteredEvents = useMemo(() => {
    if (!activeStreamData?.events) return [];
    if (!filterQuery.trim()) return activeStreamData.events;

    const q = filterQuery.toLowerCase();

    return activeStreamData.events.filter(evt => {
      const str = typeof evt === 'object' ? JSON.stringify(evt) : String(evt);
      return str.toLowerCase().includes(q);
    });
  }, [activeStreamData, filterQuery]);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, currentPage]);

  const colKeys = useMemo(() => {
    if (!activeStreamData?.events?.length) return [];
    const allKeys = new Set();
    activeStreamData.events.slice(0, 5).forEach(evt => {
      if (typeof evt === 'object' && evt !== null) Object.keys(evt).forEach(k => allKeys.add(k));
    });
    return Array.from(allKeys);
  }, [activeStreamData]);

  const rawJsonContent = useMemo(() => {
    if (!activeStreamData?.events) return '';
    return activeStreamData.events.map(e => JSON.stringify(e)).join('\n');
  }, [activeStreamData]);

  const handleGenerate = useCallback(async () => {
    if (!schemaInput.trim()) return;
    setIsLoading(true);
    setParsedRulesFeedback([]);
    setViewMode('events');

    try {
      const count = parseInt(eventCount, 10) || 25;
      const data = await convertCode('stream', schemaInput, {
        mode: 'builder',
        qualityMode,
        rules,
        eventFormat,
        streamParadigm,
        eventCount: count,
        seed: seed || undefined,
        dataQuality,
        includeAnalysis,
        includeStateMachine,
      });

      setGeneratedData(data);
      setParsedRulesFeedback(data.parsedRules || []);
      setActiveStreamRaw(0);
      setCurrentPage(1);
      setFilterQuery('');

      if (onDataUpdate) {
        onDataUpdate({
          type: 'stream',
          input: schemaInput,
          output: JSON.stringify(data),
          rules, eventFormat, streamParadigm, eventCount, seed, dataQuality,
          includeAnalysis, includeStateMachine,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating event stream.');
    } finally {
      setIsLoading(false);
    }
  }, [schemaInput, qualityMode, rules, eventFormat, streamParadigm, eventCount, seed, dataQuality, includeAnalysis, includeStateMachine, onDataUpdate]);

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
    const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + rowIdx;
    const targetEvent = filteredEvents[absoluteIdx];
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
  }, [editingCell, editingValue, currentPage, activeStream, generatedData, filteredEvents]);

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
    URL.revokeObjectURL(url);
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

      const keys = Object.keys(stream.events[0]);
      const rows = [keys.join(',')];

      stream.events.forEach(evt => {
        rows.push(keys.map(k => {
          let v = evt[k] === null ? '' : (typeof evt[k] === 'object' ? JSON.stringify(evt[k]) : String(evt[k]));
          return (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(','));
      });
      downloadFile(rows.join('\n'), `${stream.streamName}.csv`, 'text/csv');
    } else if (type === 'kafka') {
      const messages = generatedData.streams.flatMap(s =>
        s.events.map(e => JSON.stringify({ topic: s.streamName, key: e.session_id || e.user_id || e.id || null, value: e }))
      );
      downloadFile(messages.join('\n'), 'kafka-messages.ndjson', 'application/x-ndjson');
    }

    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeStream]);

  const triggerExportModal = useCallback((type) => {
    const labels = { ndjson: 'NDJSON', json: 'JSON', csv: 'CSV', kafka: 'Kafka NDJSON' };
    setModalConfig({
      isOpen: true,
      title: `Export as ${labels[type] || type.toUpperCase()}`,
      message: `Export your generated event stream as a production-ready .${type === 'kafka' ? 'ndjson' : type} file.`,
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
    const updated = [...savedTemplates, { name: trimmed, schema: schemaInput, rules, eventFormat, streamParadigm }];

    setSavedTemplates(updated);
    localStorage.setItem('streamTemplates', JSON.stringify(updated));
    setIsSaveModalOpen(false);
  }, [newTemplateName, savedTemplates, schemaInput, rules, eventFormat, streamParadigm]);

  const handleDeleteTemplate = useCallback((idx) => {
    const updated = savedTemplates.filter((_, i) => i !== idx);
    setSavedTemplates(updated);

    localStorage.setItem('streamTemplates', JSON.stringify(updated));
    if (updated.length === 0) setTemplatesVisible(false);
  }, [savedTemplates]);

  const setActiveStream = useCallback((idx) => {
    setActiveStreamRaw(idx);
    setCurrentPage(1);
    setFilterQuery('');
  }, []);

  return {
    // Inputs
    schemaInput, setSchemaInput,
    rules, setRules,
    eventFormat, setEventFormat,
    streamParadigm, setStreamParadigm,
    eventCount, setEventCount,
    seed, setSeed,
    dataQuality, setDataQuality,
    includeAnalysis, setIncludeAnalysis,
    includeStateMachine, setIncludeStateMachine,

    // Output
    isLoading,
    generatedData,
    activeStream,
    setActiveStream,
    parsedRulesFeedback,
    allStreamNames,
    activeStreamData,

    // View
    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    currentPage, setCurrentPage,
    totalPages,
    paginatedEvents,
    filteredEvents,
    colKeys,
    rawJsonContent,

    // Cell editing
    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit, handleCopyCell,

    // Actions
    handleGenerate,
    triggerExportModal,

    // Template library
    savedTemplates,
    templatesVisible, setTemplatesVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newTemplateName, setNewTemplateName,
    saveTemplateError, setSaveTemplateError,
    handleSaveTemplate, executeSaveTemplate, handleDeleteTemplate,

    // Modal
    modalConfig, setModalConfig,

    // Sample
    SAMPLE_TEMPLATES, handleLoadSample,
  };
}
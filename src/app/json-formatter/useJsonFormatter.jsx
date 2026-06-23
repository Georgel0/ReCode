'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import JSON5 from 'json5';
import {
  resolveIndent,
  parseJsonResponse,
  sortKeysDeep,
  getCounts,
  buildZodModule,
  zodToExample,
  evaluateJsonPath,
  validateAgainstJsonSchema,
  diffJson,
  yamlToJson,
  tomlToJson,
  jsonToYaml,
  jsonToToml,
  jsonToCsv,
  fetchJsonFromUrl,
  downloadFile,
  loadHistory,
  saveToHistory,
  deleteHistoryEntry,
  loadIndentSetting,
  saveIndentSetting,
  loadAutoFormatSetting,
  saveAutoFormatSetting,
} from './jsonFormatter.utils';

export { MAX_FILE_SIZE_BYTES } from './jsonFormatter.utils';

const TREE_DEBOUNCE_MS = 150;

export const useJsonFormatter = ({ convertCode, qualityMode, moduleData }) => {
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [viewMode, setViewMode] = useState('code'); // 'code' | 'tree' | 'zod' | 'diff'
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);

  const [indentSize, setIndentSizeState] = useState(() => loadIndentSetting());
  const [autoFormat, setAutoFormatState] = useState(() => loadAutoFormatSetting());
  const [jsonSchemaText, setJsonSchemaText] = useState('');
  const [schemaErrors, setSchemaErrors] = useState([]);
  const [jsonPathQuery, setJsonPathQuery] = useState('');
  const [jsonPathResult, setJsonPathResult] = useState(null);
  const [diffInput, setDiffInput] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [zodOutput, setZodOutput] = useState('');
  const [zodLoading, setZodLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [convertLoading, setConvertLoading] = useState(false);

  const treeDebounceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkTheme(mq.matches);
    const handler = (e) => setIsDarkTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'json') {
      setInput(moduleData.input || '');
      const { code, info } = parseJsonResponse(moduleData.fullOutput);
      setOutputCode(code);
      setExplanation(info);
    }
  }, [moduleData]);

  useEffect(() => {
    setErrorMsg(null);
    setLastResult(null);
  }, [input]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setErrorMsg(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    return () => { if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current); };
  }, []);

  const setIndentSize = useCallback((v) => {
    setIndentSizeState(v);
    saveIndentSetting(v);
    setOutputCode((prev) => {
      if (!prev.trim()) return prev;
      try { return JSON.stringify(JSON.parse(prev), null, resolveIndent(v)); }
      catch { return prev; }
    });
  }, []);

  const setAutoFormat = useCallback((v) => {
    setAutoFormatState(v);
    saveAutoFormatSetting(v);
  }, []);

  const runSchemaValidation = useCallback((jsonStr, schemaStr) => {
    if (!schemaStr.trim() || !jsonStr.trim()) { setSchemaErrors([]); return; }
    try {
      const data = JSON.parse(jsonStr);
      const schema = JSON.parse(schemaStr);
      setSchemaErrors(validateAgainstJsonSchema(data, schema));
    } catch (e) {
      setSchemaErrors([{ path: '$', message: `Schema parse error: ${e.message}` }]);
    }
  }, []);

  useEffect(() => {
    runSchemaValidation(outputCode, jsonSchemaText);
  }, [outputCode, jsonSchemaText, runSchemaValidation]);

  const runJsonPath = useCallback((query, jsonStr) => {
    if (!query || !jsonStr.trim()) { setJsonPathResult(null); return; }
    try {
      setJsonPathResult(evaluateJsonPath(JSON.parse(jsonStr), query));
    } catch {
      setJsonPathResult({ values: [], paths: [], error: 'Invalid JSON' });
    }
  }, []);

  useEffect(() => {
    runJsonPath(jsonPathQuery, outputCode);
  }, [jsonPathQuery, outputCode, runJsonPath]);

  const runDiff = useCallback((aStr, bStr) => {
    if (!aStr.trim() || !bStr.trim()) { setDiffResult(null); return; }
    try {
      setDiffResult(diffJson(JSON.parse(aStr), JSON.parse(bStr)));
    } catch (e) {
      setDiffResult([{ type: 'error', path: '$', message: e.message }]);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'diff') runDiff(outputCode, diffInput);
  }, [viewMode, outputCode, diffInput, runDiff]);

  const handleLocalFormat = useCallback((src) => {
    const sourceCode = (src ?? input).trim();
    if (!sourceCode) return;
    setErrorMsg(null);
    const indent = resolveIndent(indentSize);

    try {
      let parsed = JSON.parse(sourceCode);
      if (sortKeys) parsed = sortKeysDeep(parsed);
      const formatted = JSON.stringify(parsed, null, indent);
      setOutputCode(formatted);
      setExplanation('Valid JSON – formatted locally.');
      saveToHistory(sourceCode, formatted);
      setHistory(loadHistory());
    } catch {
      try {
        let looseParsed = JSON5.parse(sourceCode);
        if (sortKeys) looseParsed = sortKeysDeep(looseParsed);
        const formatted = JSON.stringify(looseParsed, null, indent);
        setOutputCode(formatted);
        setExplanation('Loose JSON fixed locally via JSON5.');
        saveToHistory(sourceCode, formatted);
        setHistory(loadHistory());
      } catch (looseError) {
        const msg = looseError.message || '';
        const match = msg.match(/line \d+ column \d+/) || msg.match(/position \d+/);
        const loc = match ? ` at ${match[0]}` : '';
        setErrorMsg(`Syntax Error${loc}: Click 'AI Fix & Format' to auto-repair.`);
      }
    }
  }, [input, sortKeys, indentSize]);

  const handleMinify = useCallback(() => {
    const sourceCode = outputCode.trim() || input.trim();
    if (!sourceCode) return;
    setErrorMsg(null);
    try {
      setOutputCode(JSON.stringify(JSON.parse(sourceCode)));
      setExplanation('JSON minified to a single line.');
      return;
    } catch { /* fall through */ }
    try {
      setOutputCode(JSON.stringify(JSON5.parse(sourceCode)));
      setExplanation('JSON5 parsed and minified.');
    } catch {
      setErrorMsg('Invalid JSON: Minification requires valid syntax.');
    }
  }, [outputCode, input]);

  const handleAiFix = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    setExplanation('');
    setErrorMsg(null);
    try {
      const result = await convertCode('json', input, { qualityMode });
      const { code, info } = parseJsonResponse(result);
      if (code) {
        setOutputCode(code);
        setExplanation(info);
        setLastResult({ type: 'json', input, output: result });
        saveToHistory(input, code);
        setHistory(loadHistory());
      }
    } catch (error) {
      alert(`Fix failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [input, qualityMode, convertCode]);

  const handlePaste = useCallback((e) => {
    if (!autoFormat) return;
    const pasted = e.clipboardData?.getData('text') ?? '';
    if (!pasted.trim()) return;
    setTimeout(() => handleLocalFormat(pasted), 0);
  }, [autoFormat, handleLocalFormat]);

  const readFile = useCallback((file) => {
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 3 MB.`);
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target.result;
      try {
        if (ext === 'yaml' || ext === 'yml') {
          const json = JSON.stringify(yamlToJson(raw), null, resolveIndent(indentSize));
          setInput(json); setOutputCode(json); setExplanation('YAML converted to JSON.');
        } else if (ext === 'toml') {
          const json = JSON.stringify(tomlToJson(raw), null, resolveIndent(indentSize));
          setInput(json); setOutputCode(json); setExplanation('TOML converted to JSON.');
        } else {
          setInput(raw); setOutputCode(''); setErrorMsg(null);
        }
      } catch (e) {
        setErrorMsg(`Failed to parse ${ext.toUpperCase()}: ${e.message}`);
      }
    };
    reader.readAsText(file);
  }, [indentSize]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      const text = await fetchJsonFromUrl(urlInput);
      setInput(text);
      handleLocalFormat(text);
      setUrlInput('');
    } catch (e) {
      setErrorMsg(`URL import failed: ${e.message}`);
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, handleLocalFormat]);

  const handleConvert = useCallback(async (format) => {
    if (!outputCode.trim()) return;
    setConvertLoading(true);
    try {
      const parsed = JSON.parse(outputCode);
      let content = '';
      if (format === 'yaml') content = jsonToYaml(parsed);
      else if (format === 'toml') content = jsonToToml(parsed);
      else if (format === 'csv') content = jsonToCsv(parsed);
      setConversionResult({ format, content });
      setViewMode('code');
    } catch (e) {
      setErrorMsg(`Conversion to ${format.toUpperCase()} failed: ${e.message}`);
    } finally {
      setConvertLoading(false);
    }
  }, [outputCode]);

  const handleGenerateZod = useCallback(async () => {
    if (!outputCode.trim()) return;
    setZodLoading(true);
    setViewMode('zod');
    try {
      let parsed;
      try { parsed = JSON.parse(outputCode); } catch { throw new Error('Format JSON first.'); }
      setZodOutput(buildZodModule(parsed));
      setExplanation('Zod schema inferred from JSON structure.');
    } catch (e) {
      setErrorMsg(`Zod inference failed: ${e.message}`);
    } finally {
      setZodLoading(false);
    }
  }, [outputCode]);

  const handleZodToExample = useCallback(() => {
    if (!zodOutput.trim()) return;
    try {
      const json = JSON.stringify(zodToExample(zodOutput), null, resolveIndent(indentSize));
      setOutputCode(json);
      setViewMode('code');
      setExplanation('Example JSON generated from Zod schema.');
    } catch (e) {
      setErrorMsg(`Zod→JSON failed: ${e.message}`);
    }
  }, [zodOutput, indentSize]);

  const handleDownload = useCallback(() => {
    if (!outputCode.trim()) return;
    downloadFile(outputCode, 'output.json');
  }, [outputCode]);

  const getJsonForTree = useCallback(() => {
    try { return outputCode ? JSON.parse(outputCode) : {}; }
    catch { return { error: 'Parse error. Switch to Code view to fix.' }; }
  }, [outputCode]);

  const handleTreeEdit = useCallback((params) => {
    if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current);
    treeDebounceRef.current = setTimeout(() => {
      try { setOutputCode(JSON.stringify(params.src, null, resolveIndent(indentSize))); }
      catch { console.error('Failed to sync tree edit.'); }
    }, TREE_DEBOUNCE_MS);
  }, [indentSize]);

  const onDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }, [readFile]);

  const loadSample = useCallback(() => {
    setInput('{\n  "status": "broken",\n  "error": "missing quotes and commas"\n  unquoted_key: 123\n  "list": [1, 2, 3,]\n}');
    setOutputCode('');
    setErrorMsg(null);
  }, []);

  const handleRestoreHistory = useCallback((entry) => {
    setInput(entry.input);
    setOutputCode(entry.output);
    setShowHistory(false);
    setExplanation('Restored from history.');
  }, []);

  const handleDeleteHistory = useCallback((id) => {
    deleteHistoryEntry(id);
    setHistory(loadHistory());
  }, []);

  return {
    // State
    input, setInput,
    outputCode, setOutputCode,
    explanation,
    loading,
    errorMsg, setErrorMsg,
    lastResult,
    viewMode, setViewMode,
    isDragging,
    isDarkTheme,
    sortKeys, setSortKeys,
    indentSize, setIndentSize,
    autoFormat, setAutoFormat,
    jsonSchemaText, setJsonSchemaText,
    schemaErrors,
    jsonPathQuery, setJsonPathQuery,
    jsonPathResult,
    diffInput, setDiffInput,
    diffResult,
    zodOutput, setZodOutput,
    zodLoading,
    urlInput, setUrlInput,
    urlLoading,
    history,
    showHistory, setShowHistory,
    conversionResult, setConversionResult,
    convertLoading,
    outputCounts: getCounts(outputCode),

    // Handlers
    handleLocalFormat,
    handleMinify,
    handleAiFix,
    handlePaste,
    handleDownload,
    handleFileUpload: (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      readFile(file);
      e.target.value = '';
    },
    onDragOver,
    onDragLeave,
    onDrop,
    loadSample,
    handleUrlImport,
    handleConvert,
    handleGenerateZod,
    handleZodToExample,
    getJsonForTree,
    handleTreeEdit,
    handleRestoreHistory,
    handleDeleteHistory,
  };
};
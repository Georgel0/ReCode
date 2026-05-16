'use client';

import { useState, useCallback } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { toast } from 'sonner';

export function useSandbox({ outputCode, schema, targetDialect }) {
  const { qualityMode } = useApp();

  const [showTestRunner,       setShowTestRunner]       = useState(false);
  const [autoTestData,         setAutoTestData]         = useState(true);
  const [testDataSQL,          setTestDataSQL]          = useState('');
  const [showTestDataPreview,  setShowTestDataPreview]  = useState(false);
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);

  const [sandboxResults,   setSandboxResults]   = useState(null);
  const [sandboxError,     setSandboxError]     = useState(null);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [simulationNote,   setSimulationNote]   = useState('');
  const [executionTime,    setExecutionTime]    = useState(null);
  const [isSimulated,      setIsSimulated]      = useState(false);

  const isNativeSqlite = targetDialect === 'SQLite';

  const resetSandbox = () => {
    setSandboxResults(null);
    setSandboxError(null);
    setSimulationNote('');
    setExecutionTime(null);
    setIsSimulated(false);
    setShowTestRunner(false);
    setTestDataSQL('');
  };

  const generateTestData = useCallback(async () => {
    const context = schema.trim() || outputCode.trim();
    if (!context) return null;

    setIsGeneratingTestData(true);
    try {
      const result = await convertCode('sql', 'Generate realistic INSERT statements for testing', {
        targetLang:  'SQLite',
        mode:        'mock',
        schema:      context,
        qualityMode,
      });
      if (result?.query) {
        setTestDataSQL(result.query);
        return result.query;
      }
    } catch {
      toast.error('Failed to generate test data.');
    } finally {
      setIsGeneratingTestData(false);
    }
    return null;
  }, [schema, outputCode, qualityMode]);

  const clearTestData = () => {
    setTestDataSQL('');
    setShowTestDataPreview(false);
  };

  const runNativeSqlite = async (resolvedTestData) => {
    let db = null;
    const t0 = Date.now();
    try {
      const initSqlJs = window.initSqlJs;
      if (!initSqlJs) throw new Error('sql.js not loaded. Ensure the WASM binary is served correctly.');

      const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
      db = new SQL.Database();

      if (schema?.trim()) {
        try   { db.exec(schema); }
        catch (err) { throw new Error(`Schema error: ${err.message}`); }
      }

      if (resolvedTestData?.trim()) {
        try { db.exec(resolvedTestData); }
        catch (err) {
          toast.warning(`Test data partially applied: ${err.message.substring(0, 100)}`);
        }
      }

      const res = db.exec(outputCode);
      const formattedResults = [];

      res?.forEach((rs) => {
        formattedResults.push({ columns: rs.columns, values: rs.values });
      });

      const modified = db.getRowsModified();
      if (modified > 0) {
        formattedResults.push({ message: `Rows affected: ${modified}` });
      } else if (formattedResults.length === 0) {
        formattedResults.push({ message: 'Query executed (0 rows returned).' });
      }

      setExecutionTime(Date.now() - t0);
      setSandboxResults(formattedResults);
      setIsSimulated(false);
      toast.success('Executed successfully!');
    } catch (err) {
      setSandboxError(err.message || 'Unknown execution error.');
    } finally {
      if (db) try { db.close(); } catch { /* noop */ }
    }
  };

  const runAiSimulation = async (resolvedTestData) => {
    const t0 = Date.now();
    try {
      const combinedSchema = [schema?.trim(), resolvedTestData?.trim()]
        .filter(Boolean)
        .join('\n\n-- Test Data Seed:\n');

      const result = await convertCode('sql', outputCode, {
        targetLang:  targetDialect,
        mode:        'simulate',
        schema:      combinedSchema,
        qualityMode,
      });

      if (!result?.query) throw new Error('Unexpected response from AI simulator.');

      let parsed;
      try {
        const cleaned = result.query
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        setSandboxResults([{ message: result.query }]);
        setSimulationNote(result.explanation || '');
        setIsSimulated(true);
        setExecutionTime(Date.now() - t0);
        return;
      }

      const formattedResults = [];
      if (parsed.columns?.length > 0) {
        formattedResults.push({ columns: parsed.columns, values: parsed.rows || [] });
      }

      const parts = [
        parsed.rowsAffected > 0 ? `Rows affected: ${parsed.rowsAffected}` : null,
        parsed.executionNote   || null,
      ].filter(Boolean);

      if (parts.length || formattedResults.length === 0) {
        formattedResults.push({ message: parts.join('. ') || 'Query simulated (0 rows returned).' });
      }

      setSandboxResults(formattedResults);
      setSimulationNote(result.explanation || '');
      setIsSimulated(true);
      setExecutionTime(Date.now() - t0);
      toast.success('AI simulation complete!');
    } catch (err) {
      setSandboxError(err.message || 'AI simulation failed.');
    }
  };

  const runSandbox = async () => {
    if (!outputCode.trim()) { toast.error('Generate a query first.'); return; }

    setShowTestRunner(true);
    setIsSandboxRunning(true);
    setSandboxError(null);
    setSandboxResults(null);
    setSimulationNote('');
    setExecutionTime(null);
    setIsSimulated(false);

    let resolvedTestData = testDataSQL;
    if (autoTestData && !resolvedTestData && (schema.trim() || outputCode.trim())) {
      resolvedTestData = (await generateTestData()) || '';
    }

    if (isNativeSqlite) {
      await runNativeSqlite(resolvedTestData);
    } else {
      await runAiSimulation(resolvedTestData);
    }

    setIsSandboxRunning(false);
  };

  const exportResultsAsCSV = () => {
    const firstTable = sandboxResults?.find((r) => r.columns?.length > 0);
    if (!firstTable) { toast.error('No tabular results to export.'); return; }

    const { columns, values } = firstTable;
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      columns.map(escape).join(','),
      ...values.map((row) => row.map(escape).join(',')),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'query-results.csv' });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as CSV!');
  };

  return {
    showTestRunner, setShowTestRunner,
    autoTestData, setAutoTestData,
    testDataSQL, setTestDataSQL,
    showTestDataPreview, setShowTestDataPreview,
    isGeneratingTestData,
    isNativeSqlite,
    sandboxResults, setSandboxResults,
    sandboxError,
    isSandboxRunning,
    simulationNote,
    executionTime,
    isSimulated,
    runSandbox,
    generateTestData,
    clearTestData,
    exportResultsAsCSV,
    resetSandbox,
  };
}
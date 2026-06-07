'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { toast } from 'sonner';
import { getNativeEngine } from '../components/sqlForgeConstants';

export function useSandbox({ outputCode, schema, targetDialect }) {
  const { qualityMode } = useApp();

  const [showTestRunner, setShowTestRunner] = useState(false);
  const [autoTestData, setAutoTestData] = useState(true);
  const [testDataSQL, setTestDataSQL] = useState('');
  const [showTestDataPreview, setShowTestDataPreview] = useState(false);
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);

  const [sandboxResults, setSandboxResults] = useState(null);
  const [sandboxError, setSandboxError] = useState(null);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);
  const [simulationNote, setSimulationNote] = useState('');
  const [executionTime, setExecutionTime] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);

  const nativeEngine = getNativeEngine(targetDialect);
  const isNativeSqlite = nativeEngine === 'sqlite';

  const schemaRef = useRef(schema);
  const outputCodeRef = useRef(outputCode);

  useEffect(() => { schemaRef.current = schema; }, [schema]);
  useEffect(() => { outputCodeRef.current = outputCode; }, [outputCode]);

  const generateTestData = useCallback(async () => {
    const context = schemaRef.current.trim() || outputCodeRef.current.trim();
    if (!context) return null;
    setIsGeneratingTestData(true);

    try {
      const result = await convertCode('sql', 'Generate realistic INSERT statements for testing', {
        targetLang: 'SQLite',
        mode: 'mock',
        schema: context,
        qualityMode,
      });
      if (result?.query) { setTestDataSQL(result.query); return result.query; }
    } catch {
      toast.error('Failed to generate test data.');
    } finally {
      setIsGeneratingTestData(false);
    }
    return null;
  }, [qualityMode]);

  const clearTestData = () => { setTestDataSQL(''); setShowTestDataPreview(false); };

  const runNativeSqlite = async (resolvedTestData) => {
    let db = null;
    const t0 = Date.now();

    try {
      const initSqlJs = window.initSqlJs;
      if (!initSqlJs) throw new Error('sql.js not loaded.');
      const SQL = await initSqlJs({ locateFile: (f) => `/${f}` });
      db = new SQL.Database();

      if (schema?.trim()) db.exec(schema);
      if (resolvedTestData?.trim()) {
        try { db.exec(resolvedTestData); }
        catch (err) { toast.warning(`Test data partial: ${err.message.substring(0, 80)}`); }
      }

      const res = db.exec(outputCode);
      const formattedResults = res?.map((rs) => ({ columns: rs.columns, values: rs.values })) ?? [];
      const modified = db.getRowsModified();

      if (modified > 0) formattedResults.push({ message: `Rows affected: ${modified}` });
      else if (formattedResults.length === 0) formattedResults.push({ message: 'Query executed (0 rows returned).' });

      setExecutionTime(Date.now() - t0);
      setSandboxResults(formattedResults);
      setIsSimulated(false);
      toast.success('Executed successfully!');
    } catch (err) {
      setSandboxError(err.message || 'Unknown error.');
    } finally {
      if (db) try { db.close(); } catch { }
    }
  };

  const runNativePglite = async (resolvedTestData) => {
    const t0 = Date.now();
    let db = null;

    try {
      const { PGlite } = await import('@electric-sql/pglite');
      db = new PGlite();

      if (schema?.trim()) {
        try { await db.exec(schema); }
        catch (err) { throw new Error(`Schema error: ${err.message}`); }
      }
      if (resolvedTestData?.trim()) {
        try { await db.exec(resolvedTestData); }
        catch (err) { toast.warning(`Test data partial: ${err.message.substring(0, 80)}`); }
      }

      const splitSqlStatements = (sql) => {
        const stmts = [];
        let current = '';
        let inSingle = false, inDouble = false;

        for (let i = 0; i < sql.length; i++) {
          const ch = sql[i];

          if (ch === "'" && !inDouble) inSingle = !inSingle;
          else if (ch === '"' && !inSingle) inDouble = !inDouble;
          if (ch === ';' && !inSingle && !inDouble) {
            const trimmed = current.trim();
            if (trimmed) stmts.push(trimmed);
            current = '';
          } else {
            current += ch;
          }
        }

        const trimmed = current.trim();
        if (trimmed) stmts.push(trimmed);
        return stmts;
      };

      const statements = splitSqlStatements(outputCode); const formattedResults = [];

      for (const stmt of statements) {
        const res = await db.query(stmt);
        if (res.rows?.length > 0) {
          formattedResults.push({
            columns: Object.keys(res.rows[0]),
            values: res.rows.map((r) => Object.values(r)),
          });
        } else if (res.affectedRows > 0) {
          formattedResults.push({ message: `Rows affected: ${res.affectedRows}` });
        }
      }

      if (formattedResults.length === 0) {
        formattedResults.push({ message: 'Query executed (0 rows returned).' });
      }

      setExecutionTime(Date.now() - t0);
      setSandboxResults(formattedResults);
      setIsSimulated(false);
      toast.success('Executed on PostgreSQL!');
    } catch (err) {
      setSandboxError(err.message || 'PostgreSQL execution failed.');
    } finally {
      if (db) {
        try { await db.close(); } catch { }
      }
    }
  };

  const runNativeDuckdb = async (resolvedTestData) => {
    const t0 = Date.now();
    let worker = null, db = null, conn = null;

    try {
      const duckdb = await import('@duckdb/duckdb-wasm');
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
      );

      worker = new Worker(worker_url);
      const logger = new duckdb.ConsoleLogger();
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(worker_url);

      conn = await db.connect();

      if (schema?.trim()) {
        try { await conn.query(schema); }
        catch (err) { throw new Error(`Schema error: ${err.message}`); }
      }
      if (resolvedTestData?.trim()) {
        try { await conn.query(resolvedTestData); }
        catch (err) { toast.warning(`Test data partial: ${err.message.substring(0, 80)}`); }
      }

      const result = await conn.query(outputCode);
      const schema_ = result.schema.fields.map((f) => f.name);
      const rows = result.toArray().map((r) => {
        const obj = r.toJSON();
        return schema_.map((col) => obj[col] ?? null);
      });

      setSandboxResults(
        rows.length > 0
          ? [{ columns: schema_, values: rows }]
          : [{ message: 'Query executed (0 rows returned).' }]
      );
      setExecutionTime(Date.now() - t0);
      setIsSimulated(false);
      toast.success('Executed on DuckDB!');
    } catch (err) {
      setSandboxError(err.message || 'DuckDB execution failed.');
    } finally {                         // ADD entire finally block
      if (conn) try { await conn.close(); } catch { }
      if (db) try { await db.terminate(); } catch { }
      if (worker) try { worker.terminate(); } catch { }
    }
  };

  const runAiSimulation = async (resolvedTestData) => {
    const t0 = Date.now();

    try {
      const combinedSchema = [schema?.trim(), resolvedTestData?.trim()]
        .filter(Boolean).join('\n\n-- Test Data Seed:\n');

      const result = await convertCode('sql', outputCode, {
        targetLang: targetDialect,
        mode: 'simulate',
        schema: combinedSchema,
        qualityMode,
      });
      if (!result?.query) throw new Error('Unexpected response from AI simulator.');

      let parsed;
      try {
        const cleaned = result.query
          .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        setSandboxResults([{ message: result.query }]);
        setSimulationNote(result.explanation || '');
        setIsSimulated(true);
        setExecutionTime(Date.now() - t0);
        return;
      }

      const formattedResults = [];
      if (parsed.columns?.length > 0)
        formattedResults.push({ columns: parsed.columns, values: parsed.rows || [] });

      const parts = [
        parsed.rowsAffected > 0 ? `Rows affected: ${parsed.rowsAffected}` : null,
        parsed.executionNote || null,
      ].filter(Boolean);
      if (parts.length || formattedResults.length === 0)
        formattedResults.push({ message: parts.join('. ') || 'Query simulated (0 rows returned).' });

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

    const engine = getNativeEngine(targetDialect);
    if (engine === 'sqlite') await runNativeSqlite(resolvedTestData);
    else if (engine === 'pglite') await runNativePglite(resolvedTestData);
    else if (engine === 'duckdb') await runNativeDuckdb(resolvedTestData);
    else await runAiSimulation(resolvedTestData);

    setIsSandboxRunning(false);
  };

  const exportResultsAsCSV = () => {
    const firstTable = sandboxResults?.find((r) => r.columns?.length > 0);
    if (!firstTable) { toast.error('No tabular results to export.'); return; }

    const { columns, values } = firstTable;
    const coerce = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'bigint') return v.toString();
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    };
    
    const escape = (v) => `"${coerce(v).replace(/"/g, '""')}"`;
    const csv = [columns.map(escape).join(','), ...values.map((r) => r.map(escape).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'query-results.csv' });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as CSV!');
  };

  const resetSandboxState = () => {
    setSandboxResults(null);
    setSandboxError(null);
    setSimulationNote('');
    setExecutionTime(null);
    setIsSimulated(false);
    setTestDataSQL('');
  };

  const resetSandbox = () => {
    resetSandboxState();
    setShowTestRunner(false);
  };

  return {
    showTestRunner, setShowTestRunner,
    autoTestData, setAutoTestData,
    testDataSQL, setTestDataSQL,
    showTestDataPreview, setShowTestDataPreview,
    isGeneratingTestData,
    isNativeSqlite,
    nativeEngine,
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
    resetSandboxState
  };
}
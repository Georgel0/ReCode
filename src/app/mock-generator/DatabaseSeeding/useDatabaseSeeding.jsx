'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { auth, initializeAuth } from '@/lib/firebase';
import { useApp } from '@/context';
import { convertCode, useDraft, useShareState } from '@/lib';
import {
  DEFAULT_CONFIG,
  ITEMS_PER_PAGE,
  extractFkRelationships,
  hasNoInboundFKs,
  isSafeToRegenerate,
  topologicalSort,
  deriveTypeScriptTypes
} from './utils';
import { amplifyDataset, SAMPLE_FLOOR } from './amplifyDataset';

import { logGenerationEvent } from '@/lib/firebase/retention';

// Significantly raised ceiling on rows per chunk to cut down HTTP round-trips.
const MAX_ROWS_PER_BATCH = 2000;
// Stay well under Postgres's 65535 bound-parameter limit. 
const MAX_PARAMS_PER_BATCH = 50000;
// Raised cap on the JSON payload size per request to 4MB.
const MAX_BATCH_BYTES = 4 * 1024 * 1024;

// Splits one table's rows into request-sized chunks, sized dynamically:
// small/narrow rows pack up to MAX_ROWS_PER_BATCH per chunk, while
// wide/heavy rows get split earlier to respect MAX_BATCH_BYTES.
function chunkTableRows(rows, columns) {
  const batches = [];
  if (!rows?.length) return batches;

  const maxRowsByParams = Math.max(1, Math.floor(MAX_PARAMS_PER_BATCH / Math.max(1, columns.length)));
  const rowsPerBatchCap = Math.min(MAX_ROWS_PER_BATCH, maxRowsByParams);

  let i = 0;
  while (i < rows.length) {
    const batch = [];
    let bytes = 0;
    while (batch.length < rowsPerBatchCap && i < rows.length) {
      const row = rows[i];
      const rowBytes = JSON.stringify(row)?.length ?? 0;
      if (batch.length > 0 && bytes + rowBytes > MAX_BATCH_BYTES) break;
      batch.push(row);
      bytes += rowBytes;
      i += 1;
    }
    // Guarantee forward progress even if a single row alone exceeds the byte cap.
    if (batch.length === 0) {
      batch.push(rows[i]);
      i += 1;
    }
    batches.push(batch);
  }
  return batches;
}

// Flattens FK-sorted tables into an ordered list of
// { tableName, columns, rows, isFinalChunk } batches. isFinalChunk marks the
// last chunk sent for a given table — the seed API uses it as the signal to
// run that table's SERIAL/IDENTITY sequence resync exactly once, after all
// of that table's rows are in, instead of after every chunk.
function buildSeedPlan(sortedTables) {
  const plan = [];
  sortedTables.forEach(table => {
    if (!table.rows?.length) return;
    const columns = Object.keys(table.rows[0]);
    const chunks = chunkTableRows(table.rows, columns);
    chunks.forEach((rows, idx) => {
      plan.push({ tableName: table.tableName, columns, rows, isFinalChunk: idx === chunks.length - 1 });
    });
  });
  return plan;
}

async function postBatchWithRetry(url, body, signal, maxRetries = 2) {
  let attempt = 0;
  while (true) {
    try {
      let token = '';
      try {
        const user = auth.currentUser || await initializeAuth();
        token = await user.getIdToken();
      } catch (e) {
        console.warn('Auth token refresh failed');
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(body),
        signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const isNetworkError = err instanceof TypeError;
      if (!isNetworkError || attempt >= maxRetries) throw err;
      attempt += 1;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

const IDLE_SEED_PROGRESS = {
  status: 'idle', // idle | running | clearing | done | error | cancelled | rolled_back
  tables: [],
  currentTableName: null,
  totalRows: 0,
  rowsDone: 0,
  totalBatches: 0,
  batchesDone: 0,
  error: null,
  startedAt: null,
  finishedAt: null,
  // Tables that received at least one successful insert this run — the
  // basis for the "rollback seeded tables" action after a mid-run failure.
  seededTables: [],
};

// 'insert': plain INSERT, fails on any duplicate key (original behavior).
// 'skipDuplicates': INSERT ... ON CONFLICT DO NOTHING, so re-running a seed
//   against a partially-populated database doesn't crash.
// 'clearFirst': TRUNCATE every table about to be seeded before inserting,
//   for a guaranteed-clean slate.
const SEED_MODES = ['insert', 'skipDuplicates', 'clearFirst'];

export function useDatabaseSeeding() {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [parsedRulesFeedback, setParsedRulesFeedback] = useState([]);
  const [regenLoadingIdx, setRegenLoadingIdx] = useState(null);
  const [regenCellTarget, setRegenCellTarget] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [filterQuery, setFilterQuery] = useState('');
  const [colFilter, setColFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [savedSchemas, setSavedSchemas] = useState([]);
  const [schemaOptionsVisible, setSchemaOptionsVisible] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [saveSchemaError, setSaveSchemaError] = useState('');
  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { }
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const [dbUri, setDbUri] = useState('');
  const [isDbConnecting, setIsDbConnecting] = useState(false);
  const [isSeedingDb, setIsSeedingDb] = useState(false);
  const [seedProgress, setSeedProgress] = useState(IDLE_SEED_PROGRESS);
  const [seedMode, setSeedMode] = useState('insert');
  const seedAbortRef = useRef(null);

  const updateConfig = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mockSchemas');
      if (saved) setSavedSchemas(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load saved schemas:', e);
      localStorage.removeItem('mockSchemas');
    }
  }, []);

  const hasShareParam = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('share');

  const { share, readSharedState, shareCopied } = useShareState({
    toolId: 'db-seeding',
    input: schemaInput,
    config: { ...config, rules },
  });

  useEffect(() => {
    const shared = readSharedState();
    if (!shared) return;
    if (shared.input) setSchemaInput(shared.input);
    if (shared.config) {
      const { rules: sharedRules, ...restConfig } = shared.config;
      setConfig(prev => ({ ...prev, ...restConfig }));
      if (sharedRules) setRules(sharedRules);
    }
  }, []);

  useEffect(() => {
    if (hasShareParam) return;
    if (moduleData && moduleData.type === 'mock') {
      setSchemaInput(moduleData.input || '');
      if (moduleData.rules) setRules(moduleData.rules);

      setConfig(prev => ({
        ...prev,
        locale: moduleData.locale ?? prev.locale,
        rowCount: moduleData.rowCount !== undefined ? String(moduleData.rowCount) : prev.rowCount,
        seed: moduleData.seed ?? prev.seed,
        dataQuality: moduleData.dataQuality ?? prev.dataQuality,
        includeAnalysis: moduleData.includeAnalysis ?? prev.includeAnalysis,
      }));

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedRulesFeedback(parsed.parsedRules || []);
          setActiveTab(0);
          setCurrentPage(1);
          setFilterQuery('');
          setColFilter(null);
          setSortConfig(null);
        } catch (e) {
          console.error('Failed to rehydrate data map:', e);
        }
      }
    }
  }, [moduleData]);

  useEffect(() => {
    setCurrentPage(1);
    setFilterQuery('');
    setColFilter(null);
    setSortConfig(null);
    setEditingCell(null);
  }, [activeTab]);

  useDraft(
    'db-seeding-draft',
    { schemaInput, rules, config, savedSchemas, generatedData },
    (saved) => {
      if (saved.schemaInput !== undefined) setSchemaInput(saved.schemaInput);
      if (saved.rules !== undefined) setRules(saved.rules);
      if (saved.config !== undefined) setConfig(saved.config);
      if (saved.savedSchemas !== undefined) setSavedSchemas(saved.savedSchemas);
      if (saved.generatedData !== undefined) setGeneratedData(saved.generatedData);
    },
    {
      isEmpty: (d) => !d.schemaInput?.trim(),
      skip: hasShareParam || !!(moduleData && moduleData.type === 'mock'),
    }
  );

  useEffect(() => { setCurrentPage(1); }, [filterQuery, colFilter, sortConfig]);
  useEffect(() => { setEditingCell(null); setEditingValue(''); }, [currentPage]);

  const detectedLanguage = useMemo(() => {
    if (!schemaInput) return 'sql';
    if (schemaInput.includes(': string') || schemaInput.includes(': number') || /^(type|interface)\s+\w/m.test(schemaInput)) return 'typescript';
    if (schemaInput.includes('model ') && schemaInput.includes('@id')) return 'prisma';
    if (schemaInput.trim().startsWith('{')) return 'json';
    return 'sql';
  }, [schemaInput]);

  const activeTableData = generatedData?.tables[activeTab];

  const allTableNames = useMemo(
    () => generatedData?.tables.map(t => t.tableName) ?? [],
    [generatedData]
  );

  const fkRelationships = useMemo(
    () => extractFkRelationships(generatedData?.tables),
    [generatedData]
  );

  const activeColKeys = useMemo(
    () => activeTableData?.rows?.[0] ? Object.keys(activeTableData.rows[0]) : [],
    [activeTableData]
  );

  const filteredRows = useMemo(() => {
    if (!activeTableData?.rows) return [];

    let rows = activeTableData.rows;

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      rows = rows.filter(row =>
        Object.values(row).some(val => {
          const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
          return str.toLowerCase().includes(q);
        })
      );
    }

    if (colFilter?.col && colFilter.value.trim()) {
      const q = colFilter.value.toLowerCase();
      rows = rows.filter(row => {
        const val = row[colFilter.col];
        const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
        return str.toLowerCase().includes(q);
      });
    }

    if (sortConfig?.col) {
      const { col, dir } = sortConfig;
      rows = [...rows].sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        const an = Number(av), bn = Number(bv);
        let cmp = (!isNaN(an) && !isNaN(bn))
          ? an - bn
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
        return dir === 'desc' ? -cmp : cmp;
      });
    }

    return rows;
  }, [activeTableData, filterQuery, colFilter, sortConfig]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE)),
    [filteredRows]
  );

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleSort = useCallback((col) => {
    setSortConfig(prev => {
      if (prev?.col === col) {
        if (prev.dir === 'asc') return { col, dir: 'desc' };
        return null;
      }
      return { col, dir: 'asc' };
    });
  }, []);

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') setSchemaInput(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleLoadSample = useCallback((sample) => {
    if (!sample) return;
    setSchemaInput(sample.schema);
    setRules(sample.rules || '');
  }, []);

  const handleGenerate = useCallback(async (overrideRows = null) => {
    if (!schemaInput.trim()) return;
    setIsLoading(true);
    setParsedRulesFeedback([]);
    setViewMode('table');

    try {
      const targetRows = overrideRows ?? (parseInt(config.rowCount, 10) || 15);
      // Above the floor, only ask the AI for a representative sample — large
      // counts are slow, expensive, and risk truncation. The sample still
      // has to be big enough that any percentage/distribution rule in the
      // user's rules text is actually expressible, hence the floor rather
      // than a proportionally tiny ask.
      const sampleRows = targetRows > SAMPLE_FLOOR ? SAMPLE_FLOOR : targetRows;

      const data = await convertCode('mock', schemaInput, {
        mode: 'builder',
        qualityMode,
        rules,
        locale: config.locale,
        rowCount: sampleRows,
        isSample: targetRows > SAMPLE_FLOOR,
        seed: config.seed || undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: config.includeAnalysis,
      });

      const finalData = targetRows > SAMPLE_FLOOR
        ? {
            ...data,
            ...amplifyDataset({
              tables: data.tables,
              requestedRows: targetRows,
              rules,
              schemaInput,
              locale: config.locale,
              seed: config.seed || undefined,
            }),
          }
        : data;

      const tableCount = finalData.tables?.length || 0;
      const totalRows = finalData.tables?.reduce((sum, t) => sum + (t.rows?.length || 0), 0) || 0;
      logGenerationEvent('database-seeding', { tableCount, totalRows });

      setGeneratedData(finalData);
      setParsedRulesFeedback(finalData.parsedRules || []);
      setActiveTab(0);
      setCurrentPage(1);
      setFilterQuery('');
      setColFilter(null);
      setSortConfig(null);

    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating relational architecture maps.');
    } finally {
      setIsLoading(false);
    }
  }, [schemaInput, qualityMode, rules, config]);

  const handleRegenerateTable = useCallback(async (tableIdx) => {
    if (!generatedData) return;
    const table = generatedData.tables[tableIdx];
    if (!table) return;

    const singleTableSchema = `-- Regenerate only: ${table.tableName}\n${schemaInput}`;
    const targetRows = parseInt(config.rowCount, 10) || 15;
    const sampleRows = targetRows > SAMPLE_FLOOR ? SAMPLE_FLOOR : targetRows;

    setRegenLoadingIdx(tableIdx);
    try {
      const data = await convertCode('mock', singleTableSchema, {
        mode: 'builder',
        qualityMode,
        rules,
        locale: config.locale,
        rowCount: sampleRows,
        isSample: targetRows > SAMPLE_FLOOR,
        seed: config.seed || undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: config.includeAnalysis,
      });

      const sampleTable = data.tables.find(
        t => t.tableName.toLowerCase() === table.tableName.toLowerCase()
      );

      if (sampleTable) {
        // Amplify against the full current table set so FK columns can pull
        // from siblings' already-final PK pools, but only this table's rows
        // actually get expanded.
        const mergedTables = generatedData.tables.map((t, idx) =>
          idx === tableIdx ? sampleTable : t
        );
        const newTable = targetRows > SAMPLE_FLOOR
          ? amplifyDataset({
              tables: mergedTables,
              requestedRows: targetRows,
              rules,
              schemaInput,
              locale: config.locale,
              seed: config.seed || undefined,
              onlyTables: [table.tableName],
            }).tables.find(t => t.tableName === sampleTable.tableName)
          : sampleTable;

        setGeneratedData(prev => ({
          ...prev,
          tables: prev.tables.map((t, idx) => idx === tableIdx ? newTable : t),
        }));
        setCurrentPage(1);
        setFilterQuery('');
        setColFilter(null);
        setSortConfig(null);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || `Error regenerating table ${table.tableName}.`);
    } finally {
      setRegenLoadingIdx(null);
    }
  }, [generatedData, schemaInput, qualityMode, rules, config]);

  const handleRegenerateCell = useCallback(async (rowIdx, colKey) => {
    if (!generatedData || !activeTableData) return;

    const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + rowIdx;
    const targetRow = filteredRows[absoluteIdx];
    if (!targetRow) return;

    setRegenCellTarget({ rowIdx, colKey });
    try {
      const hint = `-- Regenerate only the "${colKey}" column for one row in table "${activeTableData.tableName}"\n${schemaInput}`;
      const data = await convertCode('mock', hint, {
        mode: 'builder',
        qualityMode,
        rules,
        locale: config.locale,
        rowCount: 1,
        seed: undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: false,
      });

      const freshRow = data?.tables?.find(
        t => t.tableName.toLowerCase() === activeTableData.tableName.toLowerCase()
      )?.rows?.[0];

      if (freshRow && colKey in freshRow) {
        const freshVal = freshRow[colKey];
        setGeneratedData(prev => ({
          ...prev,
          tables: prev.tables.map((table, idx) => {
            if (idx !== activeTab) return table;
            return {
              ...table,
              rows: table.rows.map(row => row === targetRow ? { ...row, [colKey]: freshVal } : row),
            };
          }),
        }));
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error regenerating cell.');
    } finally {
      setRegenCellTarget(null);
    }
  }, [generatedData, activeTableData, activeTab, currentPage, filteredRows, schemaInput, qualityMode, rules, config]);

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

    const absoluteFilteredIdx = (currentPage - 1) * ITEMS_PER_PAGE + rowIdx;
    const targetRow = filteredRows[absoluteFilteredIdx];
    if (!targetRow) return;

    setGeneratedData(prev => ({
      ...prev,
      tables: prev.tables.map((table, idx) => {
        if (idx !== activeTab) return table;
        return {
          ...table,
          rows: table.rows.map(row => {
            if (row !== targetRow) return row;
            let newVal = editingValue;
            if (newVal.startsWith('{') || newVal.startsWith('[')) {
              try { newVal = JSON.parse(newVal); } catch (_) { }
            }
            return { ...row, [colKey]: newVal };
          }),
        };
      }),
    }));

    setEditingCell(null);
    setEditingValue('');
  }, [editingCell, editingValue, currentPage, activeTab, generatedData, filteredRows]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  const handleCopyCell = useCallback((val) => {
    const text = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
    navigator.clipboard.writeText(text).catch(() => console.warn('Clipboard write failed'));
  }, []);

  const handleAddRow = useCallback(() => {
    if (!activeTableData?.rows?.length) return;
    const blankRow = Object.fromEntries(
      Object.keys(activeTableData.rows[0]).map(k => [k, ''])
    );
    setGeneratedData(prev => ({
      ...prev,
      tables: prev.tables.map((table, idx) =>
        idx === activeTab
          ? { ...table, rows: [...table.rows, blankRow] }
          : table
      ),
    }));
    setCurrentPage(prev => Math.ceil((activeTableData.rows.length + 1) / ITEMS_PER_PAGE));
  }, [activeTableData, activeTab]);

  const handleDeleteRow = useCallback((rowIdx) => {
    if (!generatedData) return;
    const absoluteIdx = (currentPage - 1) * ITEMS_PER_PAGE + rowIdx;
    const targetRow = filteredRows[absoluteIdx];
    if (!targetRow) return;

    setGeneratedData(prev => ({
      ...prev,
      tables: prev.tables.map((table, idx) => {
        if (idx !== activeTab) return table;
        return { ...table, rows: table.rows.filter(row => row !== targetRow) };
      }),
    }));

    if (paginatedRows.length === 1 && currentPage > 1) {
      setCurrentPage(p => p - 1);
    }
  }, [generatedData, activeTab, currentPage, filteredRows, paginatedRows]);

  const toCamel = s => s.charAt(0).toLowerCase() + s.slice(1);

  const downloadFile = useCallback((content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, []);

  const executeExport = useCallback((type) => {
    if (!generatedData) return;

    if (type === 'json') {
      downloadFile(JSON.stringify(generatedData.tables, null, 2), 'mock-data.json', 'application/json');

    } else if (type === 'sql') {
      const sorted = topologicalSort(generatedData.tables, fkRelationships);
      let sqlString = '';

      sorted.forEach(table => {
        if (!table.rows?.length) return;
        const columns = Object.keys(table.rows[0]);

        table.rows.forEach(row => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'boolean') return val ? 1 : 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlString += `INSERT INTO ${table.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        sqlString += '\n';
      });
      downloadFile(sqlString, 'mock-data.sql', 'application/sql');

    } else if (type === 'csv') {
      const table = generatedData.tables[activeTab];
      if (!table?.rows?.length) return;

      const columns = Object.keys(table.rows[0]);
      const csvRows = [columns.join(',')];

      table.rows.forEach(row => {
        csvRows.push(columns.map(col => {
          let val = row[col] === null ? '' : (typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col]));
          return (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r'))
            ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(','));
      });
      downloadFile(csvRows.join('\n'), `${table.tableName}.csv`, 'text/csv');

    } else if (type === 'prisma') {
      let tsString = `import { PrismaClient } from '@prisma/client'\nconst prisma = new PrismaClient()\n\nasync function main() {\n`;
      const sorted = topologicalSort(generatedData.tables, fkRelationships);

      sorted.forEach(table => {
        if (!table.rows?.length) return;
        tsString += `  console.log('Seeding ${table.tableName}...')\n`;
        tsString += `  await prisma.${toCamel(table.tableName)}.createMany({\n    data: ${JSON.stringify(table.rows, null, 4).replace(/\n/g, '\n    ')}\n  })\n\n`;
      });
      tsString += `}\nmain().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })`;
      downloadFile(tsString, 'seed.ts', 'text/typescript');

    } else if (type === 'types') {
      const tsTypes = deriveTypeScriptTypes(generatedData.tables);
      downloadFile(tsTypes, 'mock-types.ts', 'text/typescript');
    }

    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeTab, fkRelationships, downloadFile]);

  const triggerExportModal = useCallback((type) => {
    const labels = {
      csv: `CSV — active table (${activeTableData?.tableName ?? ''})`,
      json: 'JSON — all tables',
      sql: 'SQL Seeds — all tables, FK-safe order',
      prisma: 'Prisma Seed (.ts) — all tables',
      types: 'TypeScript Types (.ts) — all tables',
    };
    setModalConfig({
      isOpen: true,
      title: `Export as ${type.toUpperCase()}`,
      message: `${labels[type] ?? type}. Download a production-ready file.`,
      confirmText: 'Export',
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: () => executeExport(type),
    });
  }, [executeExport, activeTableData]);

  const handleSaveSchema = useCallback(() => {
    setNewSchemaName('');
    setSaveSchemaError('');
    setIsSaveModalOpen(true);
  }, []);

  const executeSaveSchema = useCallback(() => {
    if (!newSchemaName?.trim()) {
      setSaveSchemaError('Name cannot be empty.');
      return;
    }
    const trimmedName = newSchemaName.trim();
    if (savedSchemas.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      setSaveSchemaError('A schema with this name already exists.');
      return;
    }
    const newSaved = [...savedSchemas, { name: trimmedName, schema: schemaInput, rules }];
    setSavedSchemas(newSaved);
    localStorage.setItem('mockSchemas', JSON.stringify(newSaved));
    setIsSaveModalOpen(false);
  }, [newSchemaName, savedSchemas, schemaInput, rules]);

  const handleDeleteSchema = useCallback((indexToDelete) => {
    const target = savedSchemas[indexToDelete];
    if (!target) return;
    setModalConfig({
      isOpen: true,
      title: 'Delete Schema',
      message: `Delete "${target.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'fa-trash-alt',
      onConfirm: () => {
        const newSaved = savedSchemas.filter((_, i) => i !== indexToDelete);
        setSavedSchemas(newSaved);
        localStorage.setItem('mockSchemas', JSON.stringify(newSaved));
        if (newSaved.length === 0) setSchemaOptionsVisible(false);
        setModalConfig(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [savedSchemas]);

  const clearWorkspace = useCallback(() => {
    setSchemaInput('');
    setRules('');
    setGeneratedData(null);
    setParsedRulesFeedback([]);
    setActiveTab(0);
    setViewMode('table');
    setFilterQuery('');
    setColFilter(null);
    setSortConfig(null);
    setEditingCell(null);
    setEditingValue('');
    setCurrentPage(1);
    setRegenLoadingIdx(null);
    setRegenCellTarget(null);
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  const resultData = useMemo(() => {
    if (!generatedData) return null;
    return {
      type: 'mock',
      input: schemaInput,
      output: JSON.stringify(generatedData),
      rules,
      locale: config.locale,
      rowCount: config.rowCount,
      seed: config.seed,
      dataQuality: config.dataQuality,
      includeAnalysis: config.includeAnalysis,
    };
  }, [generatedData, schemaInput, rules, config]);

  const handleIntrospect = useCallback(async () => {
    if (!dbUri.trim()) return alert('Please enter a connection string.');
    setIsDbConnecting(true);
    try {
      // Grab runtime auth token context
      let token = '';
      try {
        const user = auth.currentUser || await initializeAuth();
        token = await user.getIdToken();
      } catch (authErr) {
        console.warn('Could not retrieve Firebase token for introspection:', authErr);
      }

      const res = await fetch('/api/db/introspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }) 
        },
        body: JSON.stringify({ connectionString: dbUri })
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSchemaInput(data.schema);
      toast.message('Schema successfully extracted from live database');
    } catch (err) {
      alert(err.message || 'Failed to connect to database.');
    } finally {
      setIsDbConnecting(false);
    }
  }, [dbUri]);

  const handleSeedDirectly = useCallback(async () => {
    if (!dbUri.trim() || !generatedData) return alert('Need connection string and generated data.');

    const sortedTables = topologicalSort(generatedData.tables, fkRelationships);
    const plan = buildSeedPlan(sortedTables);

    if (plan.length === 0) {
      alert('No rows to seed.');
      return;
    }

    const totalRows = plan.reduce((sum, b) => sum + b.rows.length, 0);
    const tableOrder = [...new Set(plan.map(b => b.tableName))];

    const controller = new AbortController();
    seedAbortRef.current = controller;

    setIsSeedingDb(true);
    setSeedProgress({
      ...IDLE_SEED_PROGRESS,
      status: seedMode === 'clearFirst' ? 'clearing' : 'running',
      tables: tableOrder.map(name => ({
        tableName: name,
        totalRows: plan.filter(b => b.tableName === name).reduce((s, b) => s + b.rows.length, 0),
        rowsDone: 0,
        status: 'pending',
      })),
      totalRows,
      totalBatches: plan.length,
      startedAt: Date.now(),
    });

    let rowsDone = 0;
    let batchesDone = 0;
    const seededTables = new Set();

    try {
      if (seedMode === 'clearFirst') {
        // Single upfront TRUNCATE for every table about to be seeded, before
        // any inserts start. Doing this as one dedicated call (rather than
        // threading a "truncate first" flag through the first chunk of each
        // table's insert) keeps the seed route simple and means the clear
        // either fully succeeds or fully fails before any row is written.
        await postBatchWithRetry('/api/db/truncate', {
          connectionString: dbUri,
          tableNames: tableOrder,
        }, controller.signal);
        setSeedProgress(prev => ({ ...prev, status: 'running' }));
      }

      for (const batch of plan) {
        setSeedProgress(prev => ({
          ...prev,
          currentTableName: batch.tableName,
          tables: prev.tables.map(t =>
            t.tableName === batch.tableName && t.status === 'pending' ? { ...t, status: 'seeding' } : t
          ),
        }));

        // Injected the acquired token payload right into your bulk writer execution steps
        await postBatchWithRetry('/api/db/seed', {
          connectionString: dbUri,
          tableName: batch.tableName,
          columns: batch.columns,
          rows: batch.rows,
          isFinalChunk: batch.isFinalChunk,
          onConflict: seedMode === 'skipDuplicates' ? 'skip' : 'error',
        }, controller.signal);

        seededTables.add(batch.tableName);
        rowsDone += batch.rows.length;
        batchesDone += 1;

        setSeedProgress(prev => ({
          ...prev,
          rowsDone,
          batchesDone,
          seededTables: Array.from(seededTables),
          tables: prev.tables.map(t => {
            if (t.tableName !== batch.tableName) return t;
            const newRowsDone = t.rowsDone + batch.rows.length;
            return { ...t, rowsDone: newRowsDone, status: newRowsDone >= t.totalRows ? 'done' : 'seeding' };
          }),
        }));
      }

      setSeedProgress(prev => ({ ...prev, status: 'done', currentTableName: null, finishedAt: Date.now() }));
    } catch (err) {
      if (err.name === 'AbortError') {
        setSeedProgress(prev => ({ ...prev, status: 'cancelled', seededTables: Array.from(seededTables), finishedAt: Date.now() }));
      } else {
        setSeedProgress(prev => ({
          ...prev,
          status: 'error',
          error: { message: err.message, tableName: prev.currentTableName },
          seededTables: Array.from(seededTables),
          tables: prev.tables.map(t => (t.tableName === prev.currentTableName ? { ...t, status: 'error' } : t)),
          finishedAt: Date.now(),
        }));
      }
    } finally {
      setIsSeedingDb(false);
      seedAbortRef.current = null;
    }
  }, [dbUri, generatedData, fkRelationships, seedMode]);

  const handleCancelSeed = useCallback(() => {
    seedAbortRef.current?.abort();
  }, []);

  // Best-effort recovery from a mid-run failure or cancellation: TRUNCATEs
  // only the tables that actually received rows this run, so a retry starts
  // from a clean slate instead of double-inserting into whatever partially
  // landed. There's no true cross-request transaction here (see the note in
  // the seed route about the HTTP-chunking tradeoff) — this is the
  // "undo button" workaround for that gap.
  const handleRollbackSeededTables = useCallback(async () => {
    const tableNames = seedProgress.seededTables;
    if (!tableNames?.length || !dbUri.trim()) return;
    const confirmed = window.confirm(
      `This will TRUNCATE ${tableNames.length} table(s) touched by this run: ${tableNames.join(', ')}. This cannot be undone. Continue?`
    );
    if (!confirmed) return;

    try {
      await postBatchWithRetry('/api/db/truncate', {
        connectionString: dbUri,
        tableNames,
      });
      setSeedProgress(prev => ({ ...prev, status: 'rolled_back', seededTables: [] }));
    } catch (err) {
      alert(err.message || 'Rollback failed — you may need to clear these tables manually.');
    }
  }, [dbUri, seedProgress.seededTables]);

  const dismissSeedProgress = useCallback(() => {
    setSeedProgress(IDLE_SEED_PROGRESS);
  }, []);

  return {
    share, shareCopied, resultData,
    shareDisabled: !schemaInput.trim(),
    schemaInput, setSchemaInput,
    rules, setRules,
    config, setConfig, updateConfig,
    clearWorkspace, resetConfig,
    detectedLanguage,

    isDragOver,
    handleDrop, handleDragEnter, handleDragOver, handleDragLeave,
    handleFileUpload,
    isLoading,
    generatedData,
    activeTab,
    setActiveTab: (idx) => { setActiveTab(idx); setCurrentPage(1); setFilterQuery(''); setColFilter(null); setSortConfig(null); },
    parsedRulesFeedback,
    regenLoadingIdx,
    regenCellTarget,
    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    colFilter, setColFilter,
    sortConfig, handleSort,
    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit,
    handleCopyCell,
    handleAddRow,
    handleDeleteRow,
    handleRegenerateCell,
    handleLoadSample,
    currentPage, setCurrentPage,
    totalPages,
    paginatedRows,
    filteredRows,
    allTableNames,
    activeColKeys,
    fkRelationships,
    handleGenerate,
    handleRegenerateTable,
    triggerExportModal,
    savedSchemas,
    schemaOptionsVisible, setSchemaOptionsVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newSchemaName, setNewSchemaName,
    saveSchemaError, setSaveSchemaError,
    handleSaveSchema, executeSaveSchema, handleDeleteSchema,
    modalConfig, setModalConfig,
    activeTableData,
    hasNoInboundFKs: (tableName) => hasNoInboundFKs(tableName, fkRelationships),
    isSafeToRegenerate: (tableName) => isSafeToRegenerate(tableName, fkRelationships),
    dbUri, setDbUri, isDbConnecting, isSeedingDb, handleIntrospect, handleSeedDirectly,
    seedProgress, handleCancelSeed, dismissSeedProgress,
    seedMode, setSeedMode, seedModes: SEED_MODES, handleRollbackSeededTables,
  };
}
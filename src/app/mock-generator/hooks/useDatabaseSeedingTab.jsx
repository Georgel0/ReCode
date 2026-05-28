'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { convertCode } from '@/lib/api';

export const RULE_TEMPLATES = [
  { label: "Date Range (Last 30 Days)", value: "All created_at dates must be within the last 30 days." },
  { label: "Percentage Split", value: "70% of users should have status 'active', 30% 'inactive'." },
  { label: "Sequential IDs", value: "Primary keys should be sequential integers starting at 1000." },
  { label: "FK Pool Mapping", value: "orders.user_id must perfectly map to generated users.id values." }
];

export const SAMPLE_SCHEMAS = [
  {
    label: "E-Commerce Core (SQL)",
    schema: `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(100),
  created_at TIMESTAMP
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total_amount FLOAT,
  status VARCHAR(50),
  created_at TIMESTAMP
);`,
    rules: "All orders.user_id must perfectly map to generated users.id values.\n70% of orders should have status 'completed', 20% 'pending', 10% 'cancelled'."
  },
  {
    label: "SaaS Workspace (Prisma)",
    schema: `model Workspace {
  id        String   @id @default(uuid())
  name      String
  plan      String
  createdAt DateTime @default(now())
}

model Member {
  id          String   @id @default(uuid())
  workspaceId String
  email       String
  role        String
}`,
    rules: "75% of members must have role 'Member', 25% 'Admin'.\nAll Member.workspaceId values must reference valid Workspace records."
  }
];

export const ITEMS_PER_PAGE = 15;

/**
 * Infers column type badges from a column name + sample value.
 * Returns an array of badge labels, e.g. ['UUID', 'PK'] or ['FK →'].
 */
export function inferColumnBadges(colName, sampleValue, allTableNames = []) {
  const badges = [];
  const lower = colName.toLowerCase();
  const strVal = sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : '';

  // UUID detection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strVal)) badges.push('UUID');

  // Primary key
  if (lower === 'id' || lower.endsWith('_id') === false && lower.endsWith('id')) {
    if (!lower.includes('_')) badges.push('PK');
  }

  // Foreign key — column ends with _id and references a known table
  if (lower.endsWith('_id') && lower !== 'id') {
    const ref = lower.replace(/_id$/, '');
    const matchedTable = allTableNames.find(
      t => t.toLowerCase() === ref || t.toLowerCase() === ref + 's' || t.toLowerCase() === ref + 'es'
    );
    if (matchedTable) {
      badges.push(`FK → ${matchedTable}`);
    } else {
      badges.push('FK');
    }
  }

  // Timestamp / date detection
  const dateColNames = ['created_at', 'updated_at', 'deleted_at', 'timestamp', 'date', 'time', 'datetime'];
  if (dateColNames.some(d => lower.includes(d))) badges.push('TIMESTAMP');
  else if (!badges.includes('UUID') && strVal && /^\d{4}-\d{2}-\d{2}/.test(strVal)) badges.push('DATE');

  // Boolean
  if (strVal === 'true' || strVal === 'false') badges.push('BOOL');

  // Integer
  if (!badges.length && /^-?\d+$/.test(strVal) && strVal.length < 12) badges.push('INT');

  // Float
  if (!badges.length && /^-?\d+\.\d+$/.test(strVal)) badges.push('FLOAT');

  return badges;
}

/**
 * Parses generatedData.tables to build a list of FK relationships for the ERD.
 * Returns: [{ fromTable, fromCol, toTable, toCol }]
 */
export function extractFkRelationships(tables) {
  if (!tables || tables.length === 0) return [];

  const tableNames = tables.map(t => t.tableName);
  const relationships = [];

  tables.forEach(table => {
    if (!table.rows || table.rows.length === 0) return;
    const columns = Object.keys(table.rows[0]);

    columns.forEach(col => {
      const lower = col.toLowerCase();
      if (!lower.endsWith('_id') || lower === 'id') return;

      const ref = lower.replace(/_id$/, '');
      const matched = tableNames.find(
        t => t.toLowerCase() === ref ||
          t.toLowerCase() === ref + 's' ||
          t.toLowerCase() === ref + 'es'
      );

      if (matched && matched !== table.tableName) {
        relationships.push({
          fromTable: table.tableName,
          fromCol: col,
          toTable: matched,
          toCol: 'id',
        });
      }
    });
  });

  return relationships;
}

// Returns true if a table has no inbound FK references from other tables.
export function hasNoInboundFKs(tableName, allRelationships) {
  return !allRelationships.some(r => r.toTable === tableName);
}

export function useDatabaseSeedingTab({ onDataUpdate }) {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [rowCount, setRowCount] = useState('15');
  const [seed, setSeed] = useState('');
  const [dataQuality, setDataQuality] = useState(100);
  const [includeAnalysis, setIncludeAnalysis] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [parsedRulesFeedback, setParsedRulesFeedback] = useState([]);
  const [regenLoadingIdx, setRegenLoadingIdx] = useState(null);

  const [viewMode, setViewMode] = useState('table');

  const [filterQuery, setFilterQuery] = useState('');

  const [editingCell, setEditingCell] = useState(null); // { rowIdx, colKey }
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mockSchemas');
      if (saved) setSavedSchemas(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load saved schemas:', e);
      localStorage.removeItem('mockSchemas');
    }
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'mock') {
      setSchemaInput(moduleData.input || '');
      if (moduleData.rules) setRules(moduleData.rules);
      if (moduleData.locale) setLocale(moduleData.locale);
      if (moduleData.rowCount) setRowCount(String(moduleData.rowCount));
      if (moduleData.seed) setSeed(moduleData.seed);
      if (moduleData.dataQuality) setDataQuality(moduleData.dataQuality);
      if (moduleData.includeAnalysis !== undefined) setIncludeAnalysis(moduleData.includeAnalysis);

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedRulesFeedback(parsed.parsedRules || []);
          setActiveTab(0);
          setCurrentPage(1);
          setFilterQuery('');
        } catch (e) {
          console.error('Failed to rehydrate data map:', e);
        }
      }
    }
  }, [moduleData]);

  useEffect(() => {
    setCurrentPage(1);
    setFilterQuery('');
    setEditingCell(null);
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery]);

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

  const handleLoadSample = useCallback((sample) => {
    if (!sample) return;
    setSchemaInput(sample.schema);
    if (sample.rules) {
      setRules(sample.rules);
    } else {
      setRules('');
    }
  }, []);

  const fkRelationships = useMemo(
    () => extractFkRelationships(generatedData?.tables),
    [generatedData]
  );

  const filteredRows = useMemo(() => {
    if (!activeTableData?.rows) return [];
    if (!filterQuery.trim()) return activeTableData.rows;
    const q = filterQuery.toLowerCase();

    return activeTableData.rows.filter(row =>
      Object.values(row).some(val => {
        const str = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
        return str.toLowerCase().includes(q);
      })
    );
  }, [activeTableData, filterQuery]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleGenerate = useCallback(async (overrideRows = null) => {
    if (!schemaInput.trim()) return;
    setIsLoading(true);
    setParsedRulesFeedback([]);
    setViewMode('table');

    try {
      const targetRows = overrideRows ?? parseInt(rowCount, 10);
      const data = await convertCode('mock', schemaInput, {
        mode: 'builder',
        qualityMode,
        rules,
        locale,
        rowCount: targetRows,
        seed: seed || undefined,
        dataQuality,
        includeAnalysis,
      });

      setGeneratedData(data);
      setParsedRulesFeedback(data.parsedRules || []);
      setActiveTab(0);
      setCurrentPage(1);
      setFilterQuery('');

      if (onDataUpdate) {
        onDataUpdate({
          type: 'mock',
          input: schemaInput,
          output: JSON.stringify(data),
          rules, locale, rowCount, seed, dataQuality,
          includeAnalysis,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating relational architecture maps.');
    } finally {
      setIsLoading(false);
    }
  }, [schemaInput, qualityMode, rules, locale, rowCount, seed, dataQuality, includeAnalysis, onDataUpdate]);

  const handleRegenerateTable = useCallback(async (tableIdx) => {
    if (!generatedData) return;
    const table = generatedData.tables[tableIdx];
    if (!table) return;

    // Build a minimal schema for just this table
    const singleTableSchema = `-- Regenerate only: ${table.tableName}\n${schemaInput}`;

    setRegenLoadingIdx(tableIdx);
    try {
      const data = await convertCode('mock', singleTableSchema, {
        mode: 'builder',
        qualityMode,
        rules,
        locale,
        rowCount: parseInt(rowCount, 10),
        seed: seed || undefined,
        dataQuality,
        includeAnalysis,
      });

      const newTable = data.tables.find(
        t => t.tableName.toLowerCase() === table.tableName.toLowerCase()
      );

      if (newTable) {
        setGeneratedData(prev => {
          const updatedTables = prev.tables.map((t, idx) =>
            idx === tableIdx ? newTable : t
          );
          return { ...prev, tables: updatedTables };
        });
        setCurrentPage(1);
        setFilterQuery('');
      }
    } catch (error) {
      console.error(error);
      alert(error.message || `Error regenerating table ${table.tableName}.`);
    } finally {
      setRegenLoadingIdx(null);
    }
  }, [generatedData, schemaInput, qualityMode, rules, locale, rowCount, seed, dataQuality, includeAnalysis]);

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

    // Resolve the target row by reference so edits are correct even when a
    // filter is active (filteredRows is a subset of table.rows with different
    // indices, so using an integer index directly into table.rows is wrong).
    const absoluteFilteredIdx = (currentPage - 1) * ITEMS_PER_PAGE + rowIdx;
    const targetRow = filteredRows[absoluteFilteredIdx];
    if (!targetRow) return;

    setGeneratedData(prev => {
      const updatedTables = prev.tables.map((table, idx) => {
        if (idx !== activeTab) return table;

        const updatedRows = table.rows.map((row) => {
          if (row !== targetRow) return row;

          let newVal = editingValue;
          if ((newVal.startsWith('{') || newVal.startsWith('['))) {
            try { newVal = JSON.parse(newVal); } catch (_) { }
          }
          return { ...row, [colKey]: newVal };
        });
        return { ...table, rows: updatedRows };
      });
      return { ...prev, tables: updatedTables };
    });

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

  const executeExport = useCallback((type) => {
    if (!generatedData) return;

    if (type === 'json') {
      downloadFile(JSON.stringify(generatedData.tables, null, 2), 'mock-data.json', 'application/json');
    } else if (type === 'sql') {
      let sqlString = '';

      generatedData.tables.forEach(table => {
        if (!table.rows?.length) return;

        const columns = Object.keys(table.rows[0]);
        table.rows.forEach(row => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
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

      generatedData.tables.forEach(table => {
        if (!table.rows?.length) return;
        tsString += `  console.log('Seeding ${table.tableName}...')\n`;
        tsString += `  await prisma.${table.tableName.toLowerCase()}.createMany({\n    data: ${JSON.stringify(table.rows, null, 4).replace(/\n/g, '\n    ')}\n  })\n\n`;
      });

      tsString += `}\nmain().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })`;
      downloadFile(tsString, 'seed.ts', 'text/typescript');
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeTab]);

  const triggerExportModal = useCallback((type) => {
    setModalConfig({
      isOpen: true,
      title: `Export as ${type.toUpperCase()}`,
      message: `Export your generated dataset into a production-ready .${type} file.`,
      confirmText: 'Export',
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: () => executeExport(type),
    });
  }, [executeExport]);

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
    const newSaved = [...savedSchemas, { name: trimmedName, schema: schemaInput }];

    setSavedSchemas(newSaved);
    localStorage.setItem('mockSchemas', JSON.stringify(newSaved));
    setIsSaveModalOpen(false);
  }, [newSchemaName, savedSchemas, schemaInput]);

  const handleDeleteSchema = useCallback((indexToDelete) => {
    const newSaved = savedSchemas.filter((_, i) => i !== indexToDelete);
    setSavedSchemas(newSaved);

    localStorage.setItem('mockSchemas', JSON.stringify(newSaved));
    if (newSaved.length === 0) setSchemaOptionsVisible(false);
  }, [savedSchemas]);

  return {
    // Form
    schemaInput, setSchemaInput,
    rules, setRules,
    locale, setLocale,
    rowCount, setRowCount,
    seed, setSeed,
    dataQuality, setDataQuality,
    includeAnalysis, setIncludeAnalysis,
    detectedLanguage,

    // Output
    isLoading,
    generatedData,
    activeTab,
    setActiveTab: (idx) => { setActiveTab(idx); setCurrentPage(1); setFilterQuery(''); },
    parsedRulesFeedback,
    regenLoadingIdx,

    // View mode
    viewMode, setViewMode,

    // Filter
    filterQuery, setFilterQuery,

    // Cell editing
    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit,
    handleCopyCell,

    // Pagination
    currentPage, setCurrentPage,
    totalPages,
    paginatedRows,
    filteredRows,

    // Schema helpers
    allTableNames,
    fkRelationships,

    // Actions
    handleGenerate,
    handleRegenerateTable,
    triggerExportModal,

    // Schema library
    savedSchemas,
    schemaOptionsVisible, setSchemaOptionsVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newSchemaName, setNewSchemaName,
    saveSchemaError, setSaveSchemaError,
    handleSaveSchema, executeSaveSchema, handleDeleteSchema,

    // Modals
    modalConfig, setModalConfig,

    // Sample
    SAMPLE_SCHEMAS,
    handleLoadSample,

    // Helpers
    activeTableData,
    hasNoInboundFKs: (tableName) => hasNoInboundFKs(tableName, fkRelationships),
    inferColumnBadges,
  };
}
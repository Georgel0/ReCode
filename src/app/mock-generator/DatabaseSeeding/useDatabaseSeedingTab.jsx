'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { convertCode, useDraft } from '@/lib';

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

export const FAKER_ANNOTATIONS = [
  { annotation: '@faker:uuid', description: 'UUID v4' },
  { annotation: '@faker:email', description: 'Realistic email address' },
  { annotation: '@faker:firstName', description: 'First name' },
  { annotation: '@faker:lastName', description: 'Last name' },
  { annotation: '@faker:fullName', description: 'Full name' },
  { annotation: '@faker:phone', description: 'Phone number' },
  { annotation: '@faker:zipCode', description: 'Postal / ZIP code' },
  { annotation: '@faker:city', description: 'City name' },
  { annotation: '@faker:country', description: 'Country name' },
  { annotation: '@faker:streetAddress', description: 'Street address' },
  { annotation: '@faker:creditCard', description: 'Credit card number' },
  { annotation: '@faker:iban', description: 'IBAN bank account number' },
  { annotation: '@faker:url', description: 'Full URL' },
  { annotation: '@faker:ipv4', description: 'IPv4 address' },
  { annotation: '@faker:hexColor', description: 'Hex colour code' },
  { annotation: '@faker:companyName', description: 'Company name' },
  { annotation: '@faker:jobTitle', description: 'Job title' },
  { annotation: '@faker:paragraph', description: 'Lorem paragraph' },
  { annotation: '@faker:sentence', description: 'Lorem sentence' },
  { annotation: '@faker:word', description: 'Single word' },
  { annotation: '@regex:[A-Z]{3}-\\d{4}', description: 'Custom regex pattern' },
];

export function inferColumnBadges(colName, sampleValue, allTableNames = []) {
  const badges = [];
  const lower = colName.toLowerCase();
  const strVal = sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : '';

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strVal)) badges.push('UUID');

  if (lower === 'id') badges.push('PK');

  if (lower.endsWith('_id') && lower !== 'id') {
    const ref = lower.replace(/_id$/, '');
    const matchedTable = allTableNames.find(
      t => t.toLowerCase() === ref || t.toLowerCase() === ref + 's' || t.toLowerCase() === ref + 'es'
    );
    badges.push(matchedTable ? `FK → ${matchedTable}` : 'FK');
  }

  const dateColNames = ['created_at', 'updated_at', 'deleted_at', 'timestamp', 'date', 'time', 'datetime'];
  if (dateColNames.some(d => lower.includes(d))) badges.push('TIMESTAMP');
  else if (!badges.includes('UUID') && strVal && /^\d{4}-\d{2}-\d{2}/.test(strVal)) badges.push('DATE');

  if (strVal === 'true' || strVal === 'false') badges.push('BOOL');
  if (!badges.length && /^-?\d+$/.test(strVal) && strVal.length < 12) badges.push('INT');
  if (!badges.length && /^-?\d+\.\d+$/.test(strVal)) badges.push('FLOAT');

  return badges;
}

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

export function hasNoInboundFKs(tableName, allRelationships) {
  return !allRelationships.some(r => r.toTable === tableName);
}

function topologicalSort(tables, relationships) {
  const order = [];
  const visited = new Set();
  const deps = Object.fromEntries(tables.map(t => [t.tableName, []]));
  relationships.forEach(r => {
    if (deps[r.fromTable]) deps[r.fromTable].push(r.toTable);
  });

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    (deps[name] || []).forEach(visit);
    order.push(name);
  }
  tables.forEach(t => visit(t.tableName));
  return order.map(name => tables.find(t => t.tableName === name)).filter(Boolean);
}

function deriveTypeScriptTypes(tables) {
  const jsTypeOf = (val) => {
    if (val === null || val === undefined) return 'string | null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return Number.isInteger(val) ? 'number' : 'number';
    if (typeof val === 'object') return 'Record<string, unknown>';

    const s = String(val);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(s)) return 'string'; 
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'string'; 

    return 'string';
  };

  return tables
    .filter(t => t.rows?.length)
    .map(table => {
      const sample = table.rows[0];
      const fields = Object.entries(sample)
        .map(([k, v]) => `  ${k}: ${jsTypeOf(v)};`)
        .join('\n');
      return `export interface ${table.tableName} {\n${fields}\n}`;
    })
    .join('\n\n');
}

function encodeShareState(schema, rules, seed) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify({ schema, rules, seed }))));
  } catch {
    return null;
  }
}

function decodeShareState(encoded) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

export function useDatabaseSeedingTab({ onDataUpdate }) {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  
  // Grouped configuration state for the sidebar
  const [config, setConfig] = useState({
    locale: 'en-US',
    rowCount: '15',
    seed: '',
    dataQuality: 100,
    includeAnalysis: false
  });

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
    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.get('mock');
      if (shared) {
        const decoded = decodeShareState(shared);
        if (decoded) {
          if (decoded.schema) setSchemaInput(decoded.schema);
          if (decoded.rules) setRules(decoded.rules);
          if (decoded.seed) setConfig(prev => ({ ...prev, seed: decoded.seed }));
          
          params.delete('mock');
          const newUrl = [window.location.pathname, params.toString()].filter(Boolean).join('?');
          window.history.replaceState({}, '', newUrl);
        }
      }
    } catch { /* non-browser or SSR — ignore */ }
  }, []);

  useEffect(() => {
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
      skip: !!(moduleData && moduleData.type === 'mock'),
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

      const data = await convertCode('mock', schemaInput, {
        mode: 'builder',
        qualityMode,
        rules,
        locale: config.locale,
        rowCount: targetRows,
        seed: config.seed || undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: config.includeAnalysis,
      });

      setGeneratedData(data);
      setParsedRulesFeedback(data.parsedRules || []);
      setActiveTab(0);
      setCurrentPage(1);
      setFilterQuery('');
      setColFilter(null);
      setSortConfig(null);

      if (onDataUpdate) {
        onDataUpdate({
          type: 'mock',
          input: schemaInput,
          output: JSON.stringify(data),
          rules, 
          locale: config.locale, 
          rowCount: targetRows, 
          seed: config.seed, 
          dataQuality: config.dataQuality,
          includeAnalysis: config.includeAnalysis,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating relational architecture maps.');
    } finally {
      setIsLoading(false);
    }
  }, [schemaInput, qualityMode, rules, config, onDataUpdate]);

  const handleRegenerateTable = useCallback(async (tableIdx) => {
    if (!generatedData) return;
    const table = generatedData.tables[tableIdx];
    if (!table) return;

    const singleTableSchema = `-- Regenerate only: ${table.tableName}\n${schemaInput}`;

    setRegenLoadingIdx(tableIdx);
    try {
      const data = await convertCode('mock', singleTableSchema, {
        mode: 'builder',
        qualityMode,
        rules,
        locale: config.locale,
        rowCount: parseInt(config.rowCount, 10) || 15,
        seed: config.seed || undefined,
        dataQuality: config.dataQuality,
        includeAnalysis: config.includeAnalysis,
      });

      const newTable = data.tables.find(
        t => t.tableName.toLowerCase() === table.tableName.toLowerCase()
      );

      if (newTable) {
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
    setCurrentPage(prev => {
      const newTotal = Math.ceil((activeTableData.rows.length + 1) / ITEMS_PER_PAGE);
      return newTotal;
    });
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

  const handleCopyShareLink = useCallback(() => {
    const encoded = encodeShareState(schemaInput, rules, config.seed);
    if (!encoded) { alert('Could not encode schema for sharing.'); return; }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mock', encoded);
      navigator.clipboard.writeText(url.toString())
        .then(() => alert('Share link copied to clipboard!'))
        .catch(() => alert(`Copy this URL:\n${url.toString()}`));
    } catch {
      alert('Share link could not be generated in this environment.');
    }
  }, [schemaInput, rules, config.seed]);

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

  return {
    schemaInput, setSchemaInput,
    rules, setRules,
    config, setConfig,
    detectedLanguage,
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
    handleCopyShareLink,
    savedSchemas,
    schemaOptionsVisible, setSchemaOptionsVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newSchemaName, setNewSchemaName,
    saveSchemaError, setSaveSchemaError,
    handleSaveSchema, executeSaveSchema, handleDeleteSchema,
    modalConfig, setModalConfig,
    SAMPLE_SCHEMAS,
    handleLoadSample,
    activeTableData,
    hasNoInboundFKs: (tableName) => hasNoInboundFKs(tableName, fkRelationships),
    inferColumnBadges,
  };
}
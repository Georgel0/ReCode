'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context';
import { convertCode } from '@/lib/api';
import { CodeEditor, ConfirmModal } from '@/components/ui';

const RULE_TEMPLATES = [
  { label: "Select a rule template...", value: "" },
  { label: "Date Range (Last 30 Days)", value: "All created_at dates must be within the last 30 days." },
  { label: "Percentage Split", value: "70% of users should have status 'active', 30% 'inactive'." },
  { label: "Sequential IDs", value: "Primary keys should be sequential integers starting at 1000." },
  { label: "FK Pool Mapping", value: "orders.user_id must perfectly map to generated users.id values." }
];

export default function DatabaseSeedingTab({ onDataUpdate }) {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [rowCount, setRowCount] = useState('15');
  const [seed, setSeed] = useState('');
  const [dataQuality, setDataQuality] = useState(100);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [parsedRulesFeedback, setParsedRulesFeedback] = useState([]);

  const [savedSchemas, setSavedSchemas] = useState([]);
  const [schemaOptionsVisible, setSchemaOptionsVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { }
  });

  useEffect(() => {
    const saved = localStorage.getItem('mockSchemas');
    if (saved) setSavedSchemas(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'mock') {
      setSchemaInput(moduleData.input || '');

      if (moduleData.rules) setRules(moduleData.rules);
      if (moduleData.locale) setLocale(moduleData.locale);
      if (moduleData.rowCount) setRowCount(String(moduleData.rowCount));
      if (moduleData.seed) setSeed(moduleData.seed);
      if (moduleData.dataQuality) setDataQuality(moduleData.dataQuality);

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedRulesFeedback(parsed.parsedRules || []);
          setActiveTab(0);

          if (onDataUpdate) {
            onDataUpdate({ type: 'mock', input: moduleData.input, output: JSON.stringify(parsed), rules: moduleData.rules, locale: moduleData.locale, rowCount: moduleData.rowCount, seed: moduleData.seed, dataQuality: moduleData.dataQuality });
          }
        } catch (e) {
          console.error("Failed to rehydrate data map:", e);
        }
      }
    }
  }, [moduleData, onDataUpdate]);

  const detectedLanguage = useMemo(() => {
    if (!schemaInput) return 'sql';
    if (schemaInput.includes('type ') || schemaInput.includes('interface ')) return 'typescript';
    if (schemaInput.includes('model ') && schemaInput.includes('@id')) return 'graphql';
    if (schemaInput.trim().startsWith('{')) return 'json';
    return 'sql';
  }, [schemaInput]);

  const handleGenerate = async (overrideRows = null) => {
    if (!schemaInput.trim()) return;

    setIsLoading(true);
    setParsedRulesFeedback([]);

    try {
      const targetRows = overrideRows || parseInt(rowCount, 10);
      const data = await convertCode('mock', schemaInput, {
        mode: 'builder',
        qualityMode: qualityMode,
        rules: rules,
        locale: locale,
        rowCount: targetRows,
        seed: seed || undefined,
        dataQuality: dataQuality
      });

      setGeneratedData(data);
      setParsedRulesFeedback(data.parsedRules || []);
      setActiveTab(0);
      setCurrentPage(1);

      if (onDataUpdate) {
        onDataUpdate({ type: 'mock', input: schemaInput, output: JSON.stringify(data), rules, locale, rowCount, seed, dataQuality });
      }

    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating relational architecture maps.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSchema = () => {
    const name = prompt("Name this schema template:");
    if (!name) return;

    const newSaved = [...savedSchemas, { name, schema: schemaInput }];
    setSavedSchemas(newSaved);
    localStorage.setItem('mockSchemas', JSON.stringify(newSaved));
  };

  const handleCopyCell = (val) => {
    navigator.clipboard.writeText(String(val));
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeExport = (type) => {
    if (!generatedData) return;

    if (type === 'json') {
      downloadFile(JSON.stringify(generatedData.tables, null, 2), 'mock-data.json', 'application/json');
    } else if (type === 'sql') {
      let sqlString = '';
      generatedData.tables.forEach(table => {
        if (!table.rows || table.rows.length === 0) return;

        const columns = Object.keys(table.rows[0]);

        table.rows.forEach(row => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          sqlString += `INSERT INTO ${table.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        });
        sqlString += '\n';
      });
      downloadFile(sqlString, 'mock-data.sql', 'application/sql');
    } else if (type === 'csv') {
      const table = generatedData.tables[activeTab];
      if (!table || !table.rows.length) return;

      const columns = Object.keys(table.rows[0]);
      const csvRows = [columns.join(',')];

      table.rows.forEach(row => {
        csvRows.push(columns.map(col => {
          let val = row[col] === null ? '' : String(row[col]);
          return (val.includes(',') || val.includes('"')) ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(','));
      });
      downloadFile(csvRows.join('\n'), `${table.tableName}.csv`, 'text/csv');
    } else if (type === 'prisma') {
      let tsString = `import { PrismaClient } from '@prisma/client'\nconst prisma = new PrismaClient()\n\nasync function main() {\n`;

      generatedData.tables.forEach(table => {
        if (!table.rows || table.rows.length === 0) return;
        tsString += `  console.log('Seeding ${table.tableName}...')\n`;
        tsString += `  await prisma.${table.tableName.toLowerCase()}.createMany({\n    data: ${JSON.stringify(table.rows, null, 4).replace(/\n/g, '\n    ')}\n  })\n\n`;
      });

      tsString += `}\nmain().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })`;
      downloadFile(tsString, 'seed.ts', 'text/typescript');
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const triggerExportModal = (type) => {
    setModalConfig({
      isOpen: true,
      title: `Export as ${type.toUpperCase()}`,
      message: `Export your generated dataset into a production-ready .${type} file.`,
      confirmText: `Export`,
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: () => executeExport(type)
    });
  };

  const activeTableData = generatedData?.tables[activeTab];

  const paginatedRows = useMemo(() => {
    if (!activeTableData?.rows) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return activeTableData.rows.slice(startIndex, startIndex + itemsPerPage);
  }, [activeTableData, currentPage]);

  const totalPages = activeTableData ? Math.ceil(activeTableData.rows.length / itemsPerPage) : 0;

  return (
    <>
      <div className="mock-factory-container">
        <div className="mock-sidebar">
          <div className="mock-sidebar-content">

            <div className="mock-form-group">
              <div className="flex-between">
                <label>1. Architecture ({detectedLanguage})</label>
                <button className="text-btn text-xs" onClick={() => setSchemaOptionsVisible(!schemaOptionsVisible)}>
                  <i className="fas fa-bookmark"></i> Saved Schemas
                </button>
              </div>

              {schemaOptionsVisible && savedSchemas.length > 0 && (
                <div className="schema-library">
                  {savedSchemas.map((s, i) => (
                    <button key={i} className="schema-badge" onClick={() => { setSchemaInput(s.schema); setSchemaOptionsVisible(false); }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="editor-wrapper-box">
                <CodeEditor
                  value={schemaInput}
                  onValueChange={setSchemaInput}
                  language={detectedLanguage}
                  placeholder="CREATE TABLE users (&#10;  id UUID PRIMARY KEY,&#10;  created_at TIMESTAMP&#10;);"
                />
              </div>
              <button className="secondary-button btn-small mt-1" onClick={handleSaveSchema}>Save to Library</button>
            </div>

            <div className="mock-form-group">
              <label>2. Rule & Distribution Assertions</label>
              <select className="theme-select-dropdown mb-1 text-sm" onChange={(e) => {
                if (e.target.value) setRules(prev => prev ? prev + '\n' + e.target.value : e.target.value);
                e.target.value = "";
              }}>
                {RULE_TEMPLATES.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
              </select>
              <textarea
                className="mock-rule-input text-area"
                placeholder="e.g., 75% of users must have role 'Developer'."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
              {parsedRulesFeedback.length > 0 && (
                <div className="rules-feedback">
                  <strong>Rules Applied:</strong>
                  <ul>{parsedRulesFeedback.map((r, i) => <li key={i}><i className="fas fa-check text-green"></i> {r}</li>)}</ul>
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <div className="mock-form-group">
                <label>Locale</label>
                <select value={locale} onChange={(e) => setLocale(e.target.value)} className="theme-select-dropdown">
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="de-DE">German</option>
                  <option value="fr-FR">French</option>
                  <option value="ja-JP">Japanese</option>
                </select>
              </div>
              <div className="mock-form-group">
                <label>Volume (Rows)</label>
                <select value={rowCount} onChange={(e) => setRowCount(e.target.value)} className="theme-select-dropdown">
                  <option value="5">5 (Fast)</option>
                  <option value="15">15 (Standard)</option>
                  <option value="50">50 (Batch)</option>
                  <option value="100">100 (Deep)</option>
                </select>
              </div>
            </div>

            <div className="mock-form-group">
              <div className="flex-between">
                <label>Data Quality: {dataQuality}%</label>
                <span className="sub-label">{dataQuality < 100 ? 'Injecting Edge Cases' : 'Perfect'}</span>
              </div>
              <input
                type="range" min="50" max="100"
                value={dataQuality}
                onChange={(e) => setDataQuality(parseInt(e.target.value))}
                className="slider"
              />
            </div>

            <div className="mock-form-group">
              <label>Seed Lock (Optional)</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. 42 (For reproducible data)"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </div>

            <div className="action-row column">
              <button className="primary-button full-width" onClick={() => handleGenerate()} disabled={isLoading || !schemaInput.trim()}>
                {isLoading ? <div className="spinner" /> : <><i className="fas fa-bolt"></i> Fabricate Data</>}
              </button>
            </div>
          </div>
        </div>

        <div className="mock-main">
          <div className="mock-toolbar">
            <div className="tabs-container">
              {generatedData && generatedData.tables.map((table, idx) => (
                <button
                  key={idx}
                  className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
                  onClick={() => { setActiveTab(idx); setCurrentPage(1); }}
                >
                  <i className="fas fa-table"></i> {table.tableName}
                  <span className="close-tab">({table.rows.length})</span>
                </button>
              ))}
            </div>

            <div className="mock-export-group">
              <button className="secondary-button icon-only" title="Copy as JSON" onClick={() => navigator.clipboard.writeText(JSON.stringify(activeTableData, null, 2))} disabled={!generatedData}>
                <i className="fas fa-clipboard"></i>
              </button>
              <select className="theme-select-dropdown small-select" onChange={(e) => { if (e.target.value) triggerExportModal(e.target.value); e.target.value = ""; }} disabled={!generatedData}>
                <option value="">Export As...</option>
                <option value="csv">CSV (Active Table)</option>
                <option value="json">JSON (All Tables)</option>
                <option value="sql">SQL Seeds</option>
                <option value="prisma">Prisma Seed (.ts)</option>
              </select>
            </div>
          </div>

          <div className="mock-preview-area">
            {!generatedData && !isLoading && (
              <div className="mock-empty-state">
                <i className="fas fa-project-diagram"></i>
                <h3>Workspace Target Empty</h3>
                <p>Compile structures using the architecture interface. Add comments like <code>@faker:creditCard</code> to hint specific formats.</p>
              </div>
            )}

            {isLoading && (
              <div className="mock-empty-state">
                <div className="spinner" />
                <p>Synthesizing interconnected architecture via {qualityMode} engine...</p>
              </div>
            )}

            {activeTableData && !isLoading && (
              <div className="mock-table-wrapper">
                <table className="mock-data-table">
                  <thead>
                    <tr>
                      {Object.keys(activeTableData.rows[0] || {}).map(key => <th key={key}>{key}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            title={String(val)}
                            onDoubleClick={() => handleCopyCell(val)}
                            className="editable-cell"
                          >
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination-controls">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                  </div>
                )}
              </div>
            )}

            {generatedData?.explanation && (
              <div className="panel" style={{ marginTop: '1rem', flexShrink: 0 }}>
                <h3>Generation Explanations</h3>
                <div dangerouslySetInnerHTML={{ __html: generatedData.explanation }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal {...modalConfig} onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} />
    </>
  );
}
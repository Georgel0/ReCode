'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context';
import { convertCode } from '@/lib/api'; 
import { ModuleHeader } from '@/components/layout';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import './MockDataGenerator.css';

export default function MockDataGenerator() {
  const { moduleData, qualityMode } = useApp();

  const [schemaInput, setSchemaInput] = useState('');
  const [rules, setRules] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [rowCount, setRowCount] = useState('15');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (moduleData && moduleData.type === 'mock') {
      setSchemaInput(moduleData.input || '');
      
      if (moduleData.rules) setRules(moduleData.rules);
      if (moduleData.locale) setLocale(moduleData.locale);
      if (moduleData.rowCount) setRowCount(String(moduleData.rowCount));

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setActiveTab(0);
        } catch (e) {
          console.error("Failed to rehydrate data map from history payload:", e);
        }
      }
    }
  }, [moduleData]);

  const handleGenerate = async () => {
    if (!schemaInput.trim()) return;
    
    setIsLoading(true);
    try {
      const data = await convertCode('mock', schemaInput, {
        mode: 'builder',
        qualityMode: qualityMode,
        rules: rules,
        locale: locale,
        rowCount: parseInt(rowCount, 10)
      });

      setGeneratedData(data);
      setActiveTab(0);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating relational architecture maps.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const executeExportJSON = () => {
    downloadFile(JSON.stringify(generatedData.tables, null, 2), 'mock-data.json', 'application/json');
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const executeExportSQL = () => {
    let sqlString = '';
    generatedData.tables.forEach(table => {
      if (!table.rows || table.rows.length === 0) return;
      const columns = Object.keys(table.rows[0]);
      
      table.rows.forEach(row => {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sqlString += `INSERT INTO ${table.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      });
      sqlString += '\n';
    });
    downloadFile(sqlString, 'mock-data.sql', 'application/sql');
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const executeExportCSV = () => {
    const table = generatedData.tables[activeTab];
    if (!table || !table.rows || table.rows.length === 0) return;

    const columns = Object.keys(table.rows[0]);
    const csvRows = [columns.join(',')];

    table.rows.forEach(row => {
      const values = columns.map(col => {
        let val = row[col] === null ? '' : String(row[col]);
        if (val.includes(',') || val.includes('"')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(','));
    });

    downloadFile(csvRows.join('\n'), `${table.tableName}.csv`, 'text/csv');
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const triggerExportModal = (type, confirmAction) => {
    setModalConfig({
      isOpen: true,
      title: `Confirm Data Export`,
      message: `You are about to export your generated dataset into a production-ready .${type} file layout. Do you wish to proceed?`,
      confirmText: `Export ${type.toUpperCase()}`,
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: confirmAction
    });
  };

  const resultDataPayload = generatedData ? {
    type: 'mock',
    input: schemaInput,
    output: JSON.stringify(generatedData),
    rules,
    locale,
    rowCount
  } : null;

  return (
    <div className="module-container">
      <ModuleHeader 
        title="Enterprise Mock Data Factory" 
        description="Transform DDL definitions, TypeScript types, or JSON schemas into highly interconnected relational target seeds." 
        resultData={resultDataPayload}
      />

      <div className="mock-factory-container">
        <div className="mock-sidebar">
          <div className="mock-sidebar-content">
            <div className="mock-form-group">
              <label>1. Input Source Architecture</label>
              <span className="sub-label">SQL DDL, TypeScript definitions, or raw API outputs</span>
              <div className="editor-wrapper-box">
                <CodeEditor 
                  value={schemaInput}
                  onValueChange={setSchemaInput}
                  language="sql"
                  placeholder="CREATE TABLE users (&#10;  id UUID PRIMARY KEY,&#10;  created_at TIMESTAMP&#10;);"
                />
              </div>
            </div>

            <div className="mock-form-group">
              <label>2. Rule & Distribution Assertions</label>
              <span className="sub-label">Define statistical conditions or chronological criteria</span>
              <textarea 
                className="mock-rule-input text-area" 
                placeholder="e.g., 75% of users must have role 'Developer'."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </div>

            <div className="mock-form-group">
              <label>3. Localization Settings</label>
              <select value={locale} onChange={(e) => setLocale(e.target.value)} className="theme-select-dropdown">
                <option value="en-US">English (US Locale)</option>
                <option value="en-GB">English (UK Locale)</option>
                <option value="de-DE">German (Germany Locale)</option>
                <option value="fr-FR">French (France Locale)</option>
                <option value="ja-JP">Japanese (Japan Locale)</option>
              </select>
            </div>

            <div className="mock-form-group">
              <label>4. Document Rows Content Count</label>
              <select value={rowCount} onChange={(e) => setRowCount(e.target.value)} className="theme-select-dropdown">
                <option value="5">5 Rows (Fast Preview Layout)</option>
                <option value="15">15 Rows (Standard Testing Batch)</option>
                <option value="50">50 Rows (Deep Volumetric Batch)</option>
              </select>
            </div>

            <button 
              className="primary-button" 
              onClick={handleGenerate}
              disabled={isLoading || !schemaInput.trim()}
            >
              {isLoading ? (
                <div className="spinner" />
              ) : (
                <><i className="fas fa-bolt"></i> Fabricate Interconnected Entities</>
              )}
            </button>
          </div>
        </div>

        <div className="mock-main">
          <div className="mock-toolbar">
            <div className="tabs-container">
              {generatedData && generatedData.tables.map((table, idx) => (
                <button 
                  key={idx} 
                  className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <i className="fas fa-table"></i> {table.tableName}
                  <span className="close-tab">({table.rows.length})</span>
                </button>
              ))}
            </div>
            
            <div className="mock-export-group">
              <button className="secondary-button" onClick={() => triggerExportModal('csv', executeExportCSV)} disabled={!generatedData}>
                <i className="fas fa-file-csv"></i> Save CSV
              </button>
              <button className="secondary-button" onClick={() => triggerExportModal('json', executeExportJSON)} disabled={!generatedData}>
                <i className="fas fa-file-code"></i> Save JSON
              </button>
              <button className="primary-button" onClick={() => triggerExportModal('sql', executeExportSQL)} disabled={!generatedData}>
                <i className="fas fa-database"></i> Append SQL Seeds
              </button>
            </div>
          </div>

          <div className="mock-preview-area">
            {!generatedData && !isLoading && (
              <div className="mock-empty-state">
                <i className="fas fa-project-diagram"></i>
                <h3>Workspace Target Empty</h3>
                <p>Compile structures using the architecture interface or select an item from your context history.</p>
              </div>
            )}

            {isLoading && (
              <div className="mock-empty-state">
                <div className="spinner" />
                <p>Parsing structures & blinding reference architectures via {qualityMode} engine...</p>
              </div>
            )}

            {generatedData && generatedData.tables[activeTab] && !isLoading && (
              <div className="mock-table-wrapper">
                <table className="mock-data-table">
                  <thead>
                    <tr>
                      {Object.keys(generatedData.tables[activeTab].rows[0] || {}).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {generatedData.tables[activeTab].rows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} title={String(val)}>{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        icon={modalConfig.icon}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
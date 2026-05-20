'use client';

import React, { useRef, useEffect } from 'react';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { useDatabaseSeedingTab, inferColumnBadges, RULE_TEMPLATES } from '../hooks/useDatabaseSeedingTab';

function ColTypeBadge({ label }) {
  let cls = 'col-type-badge';
  if (label.startsWith('FK'))            cls += ' col-type-badge--fk';
  else if (label === 'UUID')             cls += ' col-type-badge--uuid';
  else if (label === 'TIMESTAMP' || label === 'DATE') cls += ' col-type-badge--ts';
  else if (label === 'PK')              cls += ' col-type-badge--pk';
  else if (label === 'BOOL')            cls += ' col-type-badge--bool';
  else if (label === 'INT' || label === 'FLOAT')      cls += ' col-type-badge--num';

  return <span className={cls}>{label}</span>;
}

function EditableCell({ value, isEditing, editingValue, onStartEdit, onChange, onCommit, onCancel, onCopy }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayVal = typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value ?? '');

  if (isEditing) {
    return (
      <td className="editable-cell editing-cell">
        <input
          ref={inputRef}
          className="cell-edit-input"
          value={editingValue}
          onChange={e => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => {
            if (e.key === 'Enter')  onCommit();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </td>
    );
  }

  return (
    <td
      className="editable-cell"
      title={`Double-click to edit · ${displayVal}`}
      onDoubleClick={() => onStartEdit(displayVal)}
      onClick={e => { if (e.detail === 3) onCopy(value); }}
    >
      <span className="cell-value">{displayVal}</span>
    </td>
  );
}

export default function DatabaseSeedingTab({ onDataUpdate }) {
  const db = useDatabaseSeedingTab({ onDataUpdate });

  const {
    schemaInput, setSchemaInput, rules, setRules, locale, setLocale, rowCount, setRowCount,
    seed, setSeed, dataQuality, setDataQuality, detectedLanguage,

    isLoading, generatedData, activeTab,
    setActiveTab, parsedRulesFeedback, regenLoadingIdx,

    viewMode, setViewMode, filterQuery, setFilterQuery,

    editingCell, editingValue, setEditingValue, handleStartEdit, handleCommitEdit,
    handleCancelEdit, handleCopyCell,

    currentPage, setCurrentPage, totalPages, paginatedRows, filteredRows,

    allTableNames, fkRelationships,

    handleGenerate, handleRegenerateTable, triggerExportModal,

    savedSchemas, schemaOptionsVisible, setSchemaOptionsVisible,
    isSaveModalOpen, setIsSaveModalOpen, newSchemaName, setNewSchemaName,
    saveSchemaError, setSaveSchemaError, handleSaveSchema, executeSaveSchema, handleDeleteSchema,

    modalConfig, setModalConfig,

    activeTableData, hasNoInboundFKs,
  } = db;

  const colKeys   = activeTableData?.rows?.[0] ? Object.keys(activeTableData.rows[0]) : [];
  const sampleRow = activeTableData?.rows?.[0] ?? {};

  return (
    <>
      <div className="mock-factory-container">

        <div className="mock-sidebar">
          <div className="mock-sidebar-content">

            <div className="mock-form-group">
              <div className="flex-between sidebar-label-row">
                <label>1. Architecture ({detectedLanguage})</label>
                <button
                  className="text-btn text-xs"
                  onClick={() => setSchemaOptionsVisible(!schemaOptionsVisible)}
                  disabled={savedSchemas.length === 0}
                  title={savedSchemas.length === 0 ? 'Save a schema first' : 'Toggle Saved Schemas'}
                >
                  <i className={`fas ${schemaOptionsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                  {schemaOptionsVisible ? ' Close Library' : ' Saved Schemas'}
                  {savedSchemas.length > 0 && ` (${savedSchemas.length})`}
                </button>
              </div>

              {schemaOptionsVisible && savedSchemas.length > 0 && (
                <div className="schema-library-panel">
                  {savedSchemas.map((s, i) => (
                    <div key={i} className="schema-library-item">
                      <div
                        className="schema-library-item-name"
                        onClick={() => { setSchemaInput(s.schema); setSchemaOptionsVisible(false); }}
                        title="Load this schema"
                      >
                        <i className="fas fa-file-code schema-library-item-icon" />
                        {s.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteSchema(i); }}
                        className="library-item-delete-btn"
                        title="Delete saved schema"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
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

              <button
                className="secondary-button btn-small"
                onClick={handleSaveSchema}
                disabled={!schemaInput.trim()}
              >
                <i className="fas fa-save" /> Save to Library
              </button>
            </div>

            <div className="mock-form-group">
              <label>2. Rule &amp; Distribution Assertions</label>
              <select
                className="theme-select-dropdown mb-1 text-sm"
                value=""
                onChange={e => {
                  if (e.target.value) setRules(prev => prev ? `${prev}\n${e.target.value}` : e.target.value);
                }}
              >
                {RULE_TEMPLATES.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
              </select>
              <textarea
                className="mock-rule-input"
                placeholder="e.g., 75% of users must have role 'Developer'."
                value={rules}
                onChange={e => setRules(e.target.value)}
              />
              {parsedRulesFeedback.length > 0 && (
                <div className="rules-feedback">
                  <strong>Rules Applied:</strong>
                  <ul>
                    {parsedRulesFeedback.map((r, i) => (
                      <li key={i}><i className="fas fa-check text-green" /> {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <div className="mock-form-group">
                <label>Locale</label>
                <select value={locale} onChange={e => setLocale(e.target.value)} className="theme-select-dropdown">
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="de-DE">German</option>
                  <option value="fr-FR">French</option>
                  <option value="ja-JP">Japanese</option>
                </select>
              </div>
              <div className="mock-form-group">
                <label>Volume (Rows)</label>
                <select value={rowCount} onChange={e => setRowCount(e.target.value)} className="theme-select-dropdown">
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
                onChange={e => setDataQuality(parseInt(e.target.value, 10))}
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
                onChange={e => setSeed(e.target.value)}
              />
            </div>

            <div className="action-row column">
              <button
                className="primary-button full-width"
                onClick={() => handleGenerate()}
                disabled={isLoading || !schemaInput.trim()}
              >
                {isLoading
                  ? <div className="spinner" />
                  : <><i className="fas fa-bolt" /> Fabricate Data</>}
              </button>
            </div>

          </div>
        </div>

        <div className="mock-main">

          <div className="mock-toolbar">
            <div className="tabs-container">
              {generatedData?.tables.map((table, idx) => {
                const canRegen = hasNoInboundFKs(table.tableName);
                return (
                  <div key={idx} className="tab-btn-wrapper">
                    <button
                      className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
                      onClick={() => setActiveTab(idx)}
                    >
                      <i className="fas fa-table" /> {table.tableName}
                      <span className="close-tab">({table.rows?.length ?? 0})</span>
                    </button>
                    {canRegen && (
                      <button
                        className="regen-table-btn"
                        title={`Re-roll ${table.tableName} (no inbound FKs)`}
                        disabled={regenLoadingIdx !== null || isLoading}
                        onClick={e => { e.stopPropagation(); handleRegenerateTable(idx); }}
                      >
                        {regenLoadingIdx === idx
                          ? <i className="fas fa-circle-notch fa-spin" />
                          : <i className="fas fa-redo-alt" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="toolbar-right">
              {generatedData && (
                <div className="view-mode-toggles">
                  <button
                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table view"
                  >
                    <i className="fas fa-table" /> Table
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'erd' ? 'active' : ''}`}
                    onClick={() => setViewMode('erd')}
                    title="Entity Relationship Diagram"
                  >
                    <i className="fas fa-project-diagram" /> ERD
                  </button>
                </div>
              )}

              <div className="mock-export-group">
                <button
                  className="secondary-button icon-only"
                  title="Copy as JSON"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      JSON.stringify(activeTableData, null, 2)
                    ).catch(() => console.warn('Clipboard write failed'))
                  }
                  disabled={!generatedData}
                >
                  <i className="fas fa-clipboard" />
                </button>
                <select
                  className="theme-select-dropdown small-select"
                  value=""
                  onChange={e => { if (e.target.value) triggerExportModal(e.target.value); }}
                  disabled={!generatedData}
                >
                  <option value="">Export As…</option>
                  <option value="csv">CSV (Active Table)</option>
                  <option value="json">JSON (All Tables)</option>
                  <option value="sql">SQL Seeds</option>
                  <option value="prisma">Prisma Seed (.ts)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mock-preview-area">

            {!generatedData && !isLoading && (
              <div className="mock-empty-state">
                <i className="fas fa-project-diagram" />
                <h3>Workspace Target Empty</h3>
                <p>
                  Compile structures using the architecture interface.
                  Add comments like <code>@faker:creditCard</code> to hint specific formats.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="mock-empty-state">
                <div className="spinner" />
                <p>Synthesizing interconnected architecture…</p>
              </div>
            )}

            {generatedData && !isLoading && viewMode === 'erd' && (
              <ErdDiagram
                tables={generatedData.tables}
                relationships={fkRelationships}
              />
            )}

            {activeTableData && !isLoading && viewMode === 'table' && (
              <div className="mock-table-wrapper">

                <div className="table-filter-bar">
                  <div className="table-filter-input-wrap">
                    <i className="fas fa-search table-filter-icon" />
                    <input
                      type="text"
                      className="table-filter-input"
                      placeholder={`Search ${activeTableData.tableName}…`}
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                    />
                    {filterQuery && (
                      <button
                        className="table-filter-clear"
                        onClick={() => setFilterQuery('')}
                        title="Clear filter"
                      >
                        <i className="fas fa-times" />
                      </button>
                    )}
                  </div>
                  {filterQuery && (
                    <span className="table-filter-count">
                      {filteredRows.length} match{filteredRows.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <span className="table-edit-hint">
                    <i className="fas fa-pencil-alt" /> Double-click any cell to edit
                  </span>
                </div>

                <table className="mock-data-table">
                  <thead>
                    <tr>
                      {colKeys.map(key => {
                        const badges = inferColumnBadges(key, sampleRow[key], allTableNames);
                        return (
                          <th key={key}>
                            <span className="th-col-name">{key}</span>
                            {badges.map(b => <ColTypeBadge key={b} label={b} />)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={colKeys.length} className="table-no-results">
                          No rows match &ldquo;{filterQuery}&rdquo;
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {colKeys.map((colKey, colIdx) => {
                            const isEditing =
                              editingCell?.rowIdx === rowIdx &&
                              editingCell?.colKey === colKey;
                            return (
                              <EditableCell
                                key={colIdx}
                                value={row[colKey]}
                                isEditing={isEditing}
                                editingValue={editingValue}
                                onStartEdit={val => handleStartEdit(rowIdx, colKey, val)}
                                onChange={setEditingValue}
                                onCommit={handleCommitEdit}
                                onCancel={handleCancelEdit}
                                onCopy={handleCopyCell}
                              />
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination-controls">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {generatedData?.explanation && (
              <div className="panel explanation-panel">
                <h3>Generation Explanations</h3>
                <div dangerouslySetInnerHTML={{ __html: generatedData.explanation }} />
              </div>
            )}

          </div>
        </div>
      </div>

      <ConfirmModal
        {...modalConfig}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-save" /> Save Schema</h2>
            </div>
            <p className="modal-desc">
              Name this schema template to save it to your library for quick access later.
            </p>
            <div className="mock-form-group">
              <input
                type="text"
                className="text-input full-width"
                placeholder="e.g., E-commerce Users &amp; Orders"
                value={newSchemaName}
                onChange={e => { setNewSchemaName(e.target.value); setSaveSchemaError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && executeSaveSchema()}
              />
              {saveSchemaError && (
                <div className="error-message">
                  <i className="fas fa-exclamation-circle" /> {saveSchemaError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setIsSaveModalOpen(false)}>Cancel</button>
              <button className="primary-button"   onClick={executeSaveSchema}>Save Template</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
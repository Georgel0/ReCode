'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { ErdDiagram } from '@/components/widgets';
import {
  useDatabaseSeedingTab,
  inferColumnBadges,
  RULE_TEMPLATES,
  SAMPLE_SCHEMAS,
  FAKER_ANNOTATIONS,
} from './useDatabaseSeedingTab';

function ColTypeBadge({ label }) {
  let cls = 'm-col-type-badge';
  if (label.startsWith('FK')) cls += ' m-col-type-badge--fk';
  else if (label === 'UUID') cls += ' m-col-type-badge--uuid';
  else if (label === 'TIMESTAMP' || label === 'DATE') cls += ' m-col-type-badge--ts';
  else if (label === 'PK') cls += ' m-col-type-badge--pk';
  else if (label === 'BOOL') cls += ' m-col-type-badge--bool';
  else if (label === 'INT' || label === 'FLOAT') cls += ' m-col-type-badge--num';
  return <span className={cls}>{label}</span>;
}

function SortIndicator({ col, sortConfig }) {
  if (sortConfig?.col !== col) return <i className="fas fa-sort m-sort-icon m-sort-icon--idle" />;
  return sortConfig.dir === 'asc'
    ? <i className="fas fa-sort-up   m-sort-icon m-sort-icon--active" />
    : <i className="fas fa-sort-down m-sort-icon m-sort-icon--active" />;
}

function EditableCell({
  value, rowIdx, colKey,
  isEditing, editingValue,
  isRegenerating,
  onStartEdit, onChange, onCommit, onCancel, onCopy, onRegen,
}) {
  const inputRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    window.addEventListener('click', close, { once: true });
    return () => window.removeEventListener('click', close);
  }, [menuPos]);

  const displayVal = typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value ?? '');

  if (isEditing) {
    return (
      <td className="m-editable-cell m-editing-cell">
        <input
          ref={inputRef}
          className="m-cell-edit-input"
          value={editingValue}
          onChange={e => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </td>
    );
  }

  if (isRegenerating) {
    return (
      <td className="m-editable-cell m-regen-cell">
        <i className="fas fa-circle-notch fa-spin m-regen-cell-spinner" />
      </td>
    );
  }

  return (
    <td
      className="m-editable-cell"
      title="Double-click to edit · Right-click for options"
      onDoubleClick={() => onStartEdit(displayVal)}
      onClick={e => { if (e.detail === 3) onCopy(value); }}
      onContextMenu={e => {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="m-cell-content-wrapper">
        <span className="m-cell-value">{displayVal}</span>
        <i className="fas fa-pencil-alt m-cell-edit-icon" />
      </div>

      {menuPos && (
        <ul
          className="m-cell-context-menu"
          style={{ top: menuPos.y, left: menuPos.x }}
          onClick={e => e.stopPropagation()}
        >
          <li onClick={() => { onStartEdit(displayVal); setMenuPos(null); }}>
            <i className="fas fa-pencil-alt" /> Edit value
          </li>
          <li onClick={() => { onCopy(value); setMenuPos(null); }}>
            <i className="fas fa-copy" /> Copy value
          </li>
          <li className="m-context-menu-divider" />
          <li onClick={() => { onRegen(rowIdx, colKey); setMenuPos(null); }}>
            <i className="fas fa-sync-alt" /> Regenerate value
          </li>
        </ul>
      )}
    </td>
  );
}

function ColFilterBar({ colKeys, colFilter, setColFilter, filterQuery, filteredRows }) {
  return (
    <div className="m-col-filter-bar">
      <select
        value={colFilter?.col ?? ''}
        onChange={e => setColFilter(prev =>
          e.target.value ? { col: e.target.value, value: prev?.value ?? '' } : null
        )}
      >
        <option value="">Filter column…</option>
        {colKeys.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      {colFilter?.col && (
        <>
          <input
            className="m-text-input m-col-filter-value"
            placeholder={`Value in ${colFilter.col}…`}
            value={colFilter.value ?? ''}
            onChange={e => setColFilter(prev => ({ ...prev, value: e.target.value }))}
            autoFocus
          />
          <button
            className="m-col-filter-clear"
            onClick={() => setColFilter(null)}
            title="Clear column filter"
          >
            <i className="fas fa-times" />
          </button>

          {(filterQuery || colFilter) && (
            <span className="m-table-filter-count">
              {filteredRows.length} match{filteredRows.length !== 1 ? 'es' : ''}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function DatabaseSeedingTab({ onDataUpdate, onShareStateChange, isActive }) {
  const db = useDatabaseSeedingTab({ onDataUpdate, isActive });

  const {
    share, shareCopied, resultData, shareDisabled,

    schemaInput, setSchemaInput,
    rules, setRules,
    config, setConfig,
    detectedLanguage,
    clearWorkspace, resetConfig,

    isLoading, generatedData, activeTab, setActiveTab,
    parsedRulesFeedback, regenLoadingIdx, regenCellTarget,

    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    colFilter, setColFilter,
    sortConfig, handleSort,

    editingCell, editingValue, setEditingValue,
    handleStartEdit, handleCommitEdit, handleCancelEdit, handleCopyCell,
    handleAddRow, handleDeleteRow,
    handleRegenerateCell,

    currentPage, setCurrentPage, totalPages, paginatedRows, filteredRows,

    allTableNames, activeColKeys, fkRelationships,

    handleGenerate, handleRegenerateTable, triggerExportModal,

    savedSchemas, schemaOptionsVisible, setSchemaOptionsVisible,
    isSaveModalOpen, setIsSaveModalOpen, newSchemaName, setNewSchemaName,
    saveSchemaError, setSaveSchemaError, handleSaveSchema, executeSaveSchema, handleDeleteSchema,

    modalConfig, setModalConfig,
    activeTableData, hasNoInboundFKs, handleLoadSample,
  } = db;

  // Report share state up so the parent's single ModuleHeader can reflect
  // this tool whenever it's the active paradigm.
  useEffect(() => {
    onShareStateChange?.({ share, shareCopied, resultData, shareDisabled });
  }, [share, shareCopied, resultData, shareDisabled, onShareStateChange]);

  const colKeys = activeColKeys;
  const sampleRow = activeTableData?.rows?.[0] ?? {};

  const getQualityLabel = (val) => {
    if (val === 75) return 'Perfect';
    if (val >= 60) return 'Minor Edge Cases';
    return 'Heavy Edge Cases';
  };

  const isRegenCell = (rowIdx, colKey) =>
    regenCellTarget?.rowIdx === rowIdx && regenCellTarget?.colKey === colKey;

  return (
    <>
      <div className="m-factory-container">

        <div className="m-sidebar">
          <div className="m-sidebar-content">

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-sitemap" /> Architecture ({detectedLanguage})
                </div>
                <div className="m-section-header-actions">
                  <button
                    className="m-icon-text-btn"
                    onClick={() => setSchemaOptionsVisible(!schemaOptionsVisible)}
                    disabled={savedSchemas.length === 0}
                    title={savedSchemas.length === 0 ? 'Save a schema first' : 'Toggle Saved Schemas'}
                  >
                    <i className={`fas ${schemaOptionsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                    {savedSchemas.length > 0 && <span className="m-badge-count">{savedSchemas.length}</span>}
                  </button>
                </div>
              </div>

              <div className="m-form-group reset-btn">
                <select
                  value=""
                  onChange={e => {
                    const selected = SAMPLE_SCHEMAS.find(s => s.label === e.target.value);
                    if (selected) handleLoadSample(selected);
                  }}
                >
                  <option value="" disabled>⚡ Load Starter Sample...</option>
                  {SAMPLE_SCHEMAS.map(s => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>

                <button className="secondary-button btn-danger" onClick={resetConfig} title="Reset Output Config">
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>

              <div className="m-form-group">
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) {
                      navigator.clipboard.writeText(e.target.value);
                    }
                  }}
                >
                  <option value="" disabled>📋 View &amp; Copy Annotations...</option>
                  {FAKER_ANNOTATIONS.map(a => (
                    <option key={a.annotation} value={a.annotation}>
                      {a.annotation} ({a.description})
                    </option>
                  ))}
                </select>
              </div>

              {schemaOptionsVisible && savedSchemas.length > 0 && (
                <div className="m-schema-library-panel">
                  {savedSchemas.map((s, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
                        onClick={() => {
                          setSchemaInput(s.schema);
                          if (s.rules) setRules(s.rules);
                          setSchemaOptionsVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code m-schema-library-item-icon" />
                        {s.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteSchema(i); }}
                        className="m-library-item-delete-btn"
                        title="Delete saved schema"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="m-editor-wrapper-box">
                <CodeEditor
                  value={schemaInput}
                  lineNumbers={false}
                  onValueChange={setSchemaInput}
                  language={detectedLanguage}
                  placeholder="CREATE TABLE users (id UUID PRIMARY KEY, created_at TIMESTAMP);"
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button"
                  onClick={handleSaveSchema}
                  disabled={!schemaInput.trim()}
                >
                  <i className="fas fa-save" /> Save to Library
                </button>
              </div>
            </div>

            <div className="m-section m-section-expanded">
              <div className="m-section-header">
                <div className="m-section-title">
                  <><i className="fas fa-balance-scale" /> Rules &amp; Distributions</>
                </div>
              </div>
              <div className="m-form-group m-form-group-expanded">
                <select
                  value=""
                  onChange={e => {
                    if (e.target.value) setRules(prev => prev ? `${prev}\n${e.target.value}` : e.target.value);
                  }}
                >
                  <option value="" disabled>+ Insert Template Rule...</option>
                  {RULE_TEMPLATES.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
                </select>
                <textarea
                  className="m-text-input m-rule-input"
                  placeholder="e.g., 75% of users must have role 'Developer'."
                  value={rules}
                  onChange={e => setRules(e.target.value)}
                />
                {parsedRulesFeedback.length > 0 && (
                  <div className="m-rules-feedback">
                    <strong>Applied Directives:</strong>
                    <ul>
                      {parsedRulesFeedback.map((r, i) => (
                        <li key={i}><i className="fas fa-check-circle" /> {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-sliders-h" /> Fabrication Settings
                </div>
              </div>

              <div className="m-form-grid-2">
                <div className="m-form-group">
                  <label className="m-input-label">Locale</label>
                  <select
                    value={config.locale}
                    onChange={e => setConfig(prev => ({ ...prev, locale: e.target.value }))}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="de-DE">German</option>
                    <option value="fr-FR">French</option>
                    <option value="ja-JP">Japanese</option>
                  </select>
                </div>
                <div className="m-form-group">
                  <label className="m-input-label">Volume</label>
                  <select
                    value={config.rowCount}
                    onChange={e => setConfig(prev => ({ ...prev, rowCount: e.target.value }))}
                  >
                    <option value="4">4 (Fast)</option>
                    <option value="12">12 (Standard)</option>
                    <option value="38">38 (Batch)</option>
                    <option value="75">75 (Deep)</option>
                  </select>
                </div>
              </div>

              <div className="m-form-group m-quality-group">
                <div className="action-row between center-y">
                  <label className="m-input-label">Data Quality</label>
                  <span className="m-quality-value-badge">{config.dataQuality}%</span>
                </div>
                <input
                  type="range" min="38" max="75"
                  value={config.dataQuality}
                  onChange={e => setConfig(prev => ({ ...prev, dataQuality: parseInt(e.target.value, 10) }))}
                  className="m-slider m-styled-slider"
                />
                <span className="m-slider-hint">{getQualityLabel(config.dataQuality)}</span>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">Seed Lock <span className="m-optional-tag">Optional</span></label>
                <div className="m-input-with-icon">
                  <i className="fas fa-lock m-input-icon" />
                  <input
                    type="text"
                    className="m-text-input m-with-icon"
                    placeholder="e.g. 42 (Reproducible)"
                    value={config.seed}
                    onChange={e => setConfig(prev => ({ ...prev, seed: e.target.value }))}
                  />
                </div>
              </div>

              <label className="custom-check" title="Generate Data Analysis">
                <input
                  type="checkbox"
                  checked={config.includeAnalysis}
                  onChange={e => setConfig(prev => ({ ...prev, includeAnalysis: e.target.checked }))}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Generate Data Analysis &amp; Explanations</span>
              </label>

            </div>
          </div>

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${isLoading ? 'm-loading' : ''}`}
              onClick={() => handleGenerate()}
              disabled={isLoading || !schemaInput.trim()}
            >
              {isLoading
                ? <><div className="m-spinner-small" /> Synthesizing...</>
                : <><i className="fas fa-bolt" /> Fabricate Database</>}
            </button>

            <button className="secondary-button btn-danger" onClick={clearWorkspace} title="Clear Workspace">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="m-main">

          <div className="mb-toolbar">
            {!isLoading && viewMode !== 'erd' ? (
              <div className="m-tabs-container">
                {generatedData?.tables.map((table, idx) => {
                  const canRegen = hasNoInboundFKs(table.tableName);
                  return (
                    <div key={idx} className="m-tab-btn-wrapper">
                      <button
                        className={`m-tab-btn ${activeTab === idx ? 'm-active' : ''}`}
                        onClick={() => setActiveTab(idx)}
                      >
                        <i className="fas fa-table" /> {table.tableName}
                        <span className="m-tab-count-badge">{table.rows?.length ?? 0}</span>
                      </button>
                      {canRegen && (
                        <button
                          className="m-regen-table-btn"
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
            ) : (
              <div></div>
            )}

            <div className="m-toolbar-right">
              {generatedData && (
                <>
                  <div className="m-view-mode-toggles">
                    <button
                      className={`m-view-toggle-btn ${viewMode === 'table' ? 'm-active' : ''}`}
                      onClick={() => setViewMode('table')}
                      title="Table view"
                    >
                      <i className="fas fa-th-list" /> Table
                    </button>
                    <button
                      className={`m-view-toggle-btn ${viewMode === 'erd' ? 'm-active' : ''}`}
                      onClick={() => setViewMode('erd')}
                      title="Entity Relationship Diagram"
                    >
                      <i className="fas fa-project-diagram" /> ERD
                    </button>
                  </div>

                  <div className="m-export-group">
                    <button
                      className="secondary-button m-tool-btn"
                      title="Copy active table as JSON"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(JSON.stringify(activeTableData, null, 2))
                          .catch(() => console.warn('Clipboard write failed'))
                      }
                    >
                      <i className="fas fa-clipboard" />
                    </button>
                    <select
                      value=""
                      onChange={e => { if (e.target.value) triggerExportModal(e.target.value); }}
                    >
                      <option value="">Export As…</option>
                      <option value="csv">CSV (Active Table)</option>
                      <option value="json">JSON (All Tables)</option>
                      <option value="sql">SQL Seeds</option>
                      <option value="prisma">Prisma Seed (.ts)</option>
                      <option value="types">TypeScript Types (.ts)</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="m-preview-area">

            <EmptyState
              isLoading={isLoading}
              condition={!generatedData}
              icon="fas fa-database"
              title="Awaiting Architecture"
              description="Input your schema definitions in the sidebar to generate a highly interconnected relational database."
              hint={<>Use <code>@faker:creditCard</code> for specific column formatting. Choose an option from the <strong>Annotations</strong> dropdown in the sidebar to view references.</>}
              loadingTitle="Synthesizing Reality"
              loadingDescription="Analyzing schema relationships and generating localized datasets..."
            />

            {generatedData && !isLoading && viewMode === 'erd' && (
              <ErdDiagram
                tables={generatedData.tables}
                relationships={fkRelationships}
              />
            )}

            {activeTableData && !isLoading && viewMode === 'table' && (
              <div className="m-table-wrapper">

                <div className="m-table-filter-bar">
                  <div className="m-table-filter-input-wrap">
                    <i className="fas fa-search m-table-filter-icon" />
                    <input
                      type="text"
                      className="m-table-filter-input"
                      placeholder={`Search all columns in ${activeTableData.tableName}…`}
                      value={filterQuery}
                      onChange={e => setFilterQuery(e.target.value)}
                    />
                    {filterQuery && (
                      <button
                        className="m-table-filter-clear"
                        onClick={() => setFilterQuery('')}
                        title="Clear search"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  <ColFilterBar
                    colKeys={colKeys}
                    colFilter={colFilter}
                    setColFilter={setColFilter}
                    filterQuery={filterQuery}
                    filteredRows={filteredRows}
                  />

                  <div className="m-table-controls-right">
                    <button
                      className="secondary-button"
                      onClick={handleAddRow}
                      title="Add a blank row"
                    >
                      <i className="fas fa-plus" /> Add Row
                    </button>
                  </div>
                </div>

                <div className="m-table-scroll-container">
                  <table className="m-data-table">
                    <thead>
                      <tr>
                        <th className="m-row-actions-th" />
                        {colKeys.map(key => {
                          const badges = inferColumnBadges(key, sampleRow[key], allTableNames);
                          return (
                            <th
                              key={key}
                              className="m-sortable-th"
                              onClick={() => handleSort(key)}
                              title={`Sort by ${key}`}
                            >
                              <div className="m-th-content">
                                <span className="m-th-col-name">{key}</span>
                                <div className="m-th-right">
                                  <div className="m-th-badges">
                                    {badges.map((b, i) => <ColTypeBadge key={`${b}-${i}`} label={b} />)}
                                  </div>
                                  <SortIndicator col={key} sortConfig={sortConfig} />
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={colKeys.length + 1} className="m-table-no-results">
                            <i className="fas fa-search-minus m-empty-search-icon" />
                            <p>No rows match the current filters</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="m-data-row">
                            <td className="m-row-actions-cell">
                              <button
                                className="m-row-delete-btn"
                                title="Delete this row"
                                onClick={() => handleDeleteRow(rowIdx)}
                              >
                                <i className="fas fa-times" />
                              </button>
                            </td>
                            {colKeys.map(colKey => {
                              const isEditing =
                                editingCell?.rowIdx === rowIdx &&
                                editingCell?.colKey === colKey;
                              return (
                                <EditableCell
                                  key={colKey}
                                  value={row[colKey]}
                                  rowIdx={rowIdx}
                                  colKey={colKey}
                                  isEditing={isEditing}
                                  editingValue={editingValue}
                                  isRegenerating={isRegenCell(rowIdx, colKey)}
                                  onStartEdit={val => handleStartEdit(rowIdx, colKey, val)}
                                  onChange={setEditingValue}
                                  onCommit={handleCommitEdit}
                                  onCancel={handleCancelEdit}
                                  onCopy={handleCopyCell}
                                  onRegen={handleRegenerateCell}
                                />
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="m-pagination-controls">
                    <button
                      className="m-page-btn"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <i className="fas fa-chevron-left" /> Prev
                    </button>
                    <span className="m-page-indicator">
                      Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button
                      className="m-page-btn"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {generatedData?.explanation && (
              <div className="m-panel m-explanation-panel">
                <h3 className="m-explanation-title"><i className="fas fa-robot" /> Generation Analysis</h3>
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generatedData.explanation) }} />
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
          <div className="modal-content m-save-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-cloud-upload-alt" /> Save Schema Template</h2>
            </div>
            <p className="modal-desc">
              Store this architecture in your local library for quick reuse across different mocking sessions.
            </p>
            <div className="m-form-group">
              <label className="m-input-label">Template Name</label>
              <input
                type="text"
                className="m-text-input"
                placeholder="e.g., E-commerce Core v2"
                value={newSchemaName}
                onChange={e => { setNewSchemaName(e.target.value); setSaveSchemaError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && executeSaveSchema()}
              />
              {saveSchemaError && (
                <div className="m-error-message">
                  <i className="fas fa-exclamation-triangle" /> {saveSchemaError}
                </div>
              )}
            </div>
            <div className="modal-footer m-split-footer">
              <button className="secondary-button" onClick={() => setIsSaveModalOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={executeSaveSchema}>Save Template</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
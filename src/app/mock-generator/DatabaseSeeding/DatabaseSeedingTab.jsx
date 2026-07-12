'use client';

import React, { useRef, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { CodeEditor, ConfirmModal } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { ErdDiagram } from '@/components/widgets';
import { useDatabaseSeeding } from './useDatabaseSeeding';
import {
  inferColumnBadges,
  RULE_TEMPLATES,
  SAMPLE_SCHEMAS,
  FAKER_ANNOTATIONS,
} from './utils';

const SEED_STATUS_ICON_CLASS = {
  pending: 'fas fa-circle',
  seeding: 'fas fa-circle-notch fa-spin',
  done: 'fas fa-check-circle',
  error: 'fas fa-times-circle',
};

function SeedStatusIcon({ status }) {
  const iconClass = SEED_STATUS_ICON_CLASS[status] || 'fas fa-circle';
  return <i className={`${iconClass} m-seed-status-icon m-seed-status-icon--${status}`} />;
}

function SeedProgressPanel({ progress, onCancel, onDismiss, onRollback }) {
  if (!progress || progress.status === 'idle') return null;

  const { status, tables, totalRows, rowsDone, totalBatches, batchesDone, error, currentTableName, startedAt, finishedAt, seededTables } = progress;
  const pct = totalBatches > 0 ? Math.min(100, Math.round((batchesDone / totalBatches) * 100)) : 0;
  const elapsedSec = startedAt ? Math.max(0, Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000)) : 0;

  const headline = {
    clearing: <><i className="fas fa-eraser" /> Clearing tables before seeding…</>,
    running: <><i className="fas fa-bolt" /> Seeding database in {totalBatches} batch{totalBatches === 1 ? '' : 'es'}…</>,
    done: <><i className="fas fa-check-circle" /> Seed complete</>,
    error: <><i className="fas fa-times-circle" /> Seeding failed</>,
    cancelled: <><i className="fas fa-ban" /> Seeding cancelled</>,
    rolled_back: <><i className="fas fa-rotate-left" /> Seeded tables rolled back</>,
  }[status];

  const isActive = status === 'running' || status === 'clearing';

  return (
    <div className={`m-seed-progress-panel m-seed-progress-panel--${status}`}>
      <div className="m-seed-progress-header">
        <div className={`m-seed-progress-title m-seed-progress-title--${status}`}>
          {headline}
        </div>
        <div className="m-seed-progress-actions">
          <span className="m-seed-progress-elapsed">{elapsedSec}s</span>
          {isActive ? (
            <button className="secondary-button btn-danger m-seed-progress-btn" onClick={onCancel}>
              Cancel
            </button>
          ) : (
            <>
              {(status === 'error' || status === 'cancelled') && seededTables?.length > 0 && (
                <button className="secondary-button btn-danger m-seed-progress-btn" onClick={onRollback}>
                  <i className="fas fa-rotate-left" /> Rollback seeded tables
                </button>
              )}
              <button className="secondary-button m-seed-progress-btn" onClick={onDismiss}>
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>

      <div className="m-seed-progress-track">
        {/* The completion % is per-run data, not a style choice, so it's passed through
            as a single CSS custom property — every actual style rule stays in the .css file. */}
        <div
          className={`m-seed-progress-fill m-seed-progress-fill--${status}`}
          style={{ '--m-seed-progress-pct': `${pct}%` }}
        />
      </div>

      <div className="m-seed-progress-meta">
        {rowsDone.toLocaleString()} / {totalRows.toLocaleString()} rows · batch {batchesDone}/{totalBatches}
        {status === 'running' && currentTableName && <> · inserting <strong>{currentTableName}</strong></>}
      </div>

      <div className="m-seed-table-list">
        {tables.map(t => (
          <div key={t.tableName} className="m-seed-table-row">
            <SeedStatusIcon status={t.status} />
            <span className="m-seed-table-name">{t.tableName}</span>
            <span className="m-seed-table-count">{t.rowsDone.toLocaleString()}/{t.totalRows.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {status === 'error' && error && (
        <div className="m-seed-error-box">
          <strong>{error.tableName ? `${error.tableName}: ` : ''}</strong>{error.message}
          <div className="m-seed-error-note">
            Each batch commits independently, so rows already inserted before this failure remain in the database.
            {seededTables?.length > 0
              ? ' Use "Rollback seeded tables" above to clear them before re-running, or switch to "Skip duplicates" / "Clear tables first" mode.'
              : ' Fix the issue and re-run.'}
          </div>
        </div>
      )}

      {status === 'cancelled' && (
        <div className="m-seed-cancelled-note">
          Batches already sent before cancelling remain committed. Re-running is not an automatic resume —
          {seededTables?.length > 0 ? ' use "Rollback seeded tables" above, or ' : ' '}
          already-seeded tables will insert again unless cleared first.
        </div>
      )}

      {status === 'rolled_back' && (
        <div className="m-seed-cancelled-note">
          The tables touched by this run have been truncated. You can safely re-run the seed from a clean slate.
        </div>
      )}
    </div>
  );
}

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
        </>
      )}

      {(filterQuery || colFilter) && (
        <span className="m-table-filter-count">
          {filteredRows.length} match{filteredRows.length !== 1 ? 'es' : ''}
        </span>
      )}
    </div>
  );
}

export default function DatabaseSeedingTab({ onShareStateChange }) {
  const db = useDatabaseSeeding();
  const fileInputRef = useRef(null);

  useEffect(() => {
    onShareStateChange?.({
      share: db.share,
      shareCopied: db.shareCopied,
      resultData: db.resultData,
      shareDisabled: db.shareDisabled
    });
  }, [db.share, db.shareCopied, db.resultData, db.shareDisabled, onShareStateChange]);

  const sampleRow = db.activeTableData?.rows?.[0] ?? {};

  const getQualityLabel = (val) => {
    if (val === 75) return 'Perfect';
    if (val >= 60) return 'Minor Edge Cases';
    return 'Heavy Edge Cases';
  };

  const isRegenCell = (rowIdx, colKey) =>
    db.regenCellTarget?.rowIdx === rowIdx && db.regenCellTarget?.colKey === colKey;

  return (
    <>
      <div className="m-factory-container">
        <div className="m-sidebar">
          <div className="m-sidebar-content">

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-plug" /> Live DB Connection
                </div>
              </div>
              <div className="m-form-group">
                <input
                  type="password"
                  className="m-text-input"
                  placeholder="postgresql://user:pass@localhost:5432/db"
                  value={db.dbUri}
                  onChange={e => db.setDbUri(e.target.value)}
                />
                <button
                  className="primary-button"
                  onClick={db.handleIntrospect}
                  disabled={db.isDbConnecting || !db.dbUri}
                  style={{ marginTop: '8px', width: '100%' }}
                >
                  {db.isDbConnecting ? 'Connecting...' : <><i className="fas fa-download" /> Pull Live Schema</>}
                </button>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-header">
                <div className="m-section-title">
                  <i className="fas fa-sitemap" /> Architecture ({db.detectedLanguage})
                </div>
                <div className="m-section-header-actions">
                  <button
                    className="m-icon-text-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload a schema file"
                  >
                    <i className="fas fa-file-arrow-up" />
                  </button>
                  <button
                    className="m-icon-text-btn"
                    onClick={() => db.setSchemaOptionsVisible(!db.schemaOptionsVisible)}
                    disabled={db.savedSchemas.length === 0}
                    title={db.savedSchemas.length === 0 ? 'Save a schema first' : 'Toggle Saved Schemas'}
                  >
                    <i className={`fas ${db.schemaOptionsVisible ? 'fa-folder-open' : 'fa-bookmark'}`} />
                    {db.savedSchemas.length > 0 && <span className="m-badge-count">{db.savedSchemas.length}</span>}
                  </button>
                </div>
              </div>

              <div className="m-form-group reset-btn">
                <select
                  value=""
                  onChange={e => {
                    const selected = SAMPLE_SCHEMAS.find(s => s.label === e.target.value);
                    if (selected) db.handleLoadSample(selected);
                  }}
                >
                  <option value="" disabled>Load Starter Sample...</option>
                  {SAMPLE_SCHEMAS.map(s => (
                    <option key={s.label} value={s.label}>{s.label}</option>
                  ))}
                </select>

                <button className="secondary-button btn-danger" onClick={db.resetConfig} title="Reset Output Config">
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

              {db.schemaOptionsVisible && db.savedSchemas.length > 0 && (
                <div className="m-schema-library-panel">
                  {db.savedSchemas.map((s, i) => (
                    <div key={i} className="m-schema-library-item">
                      <div
                        className="m-schema-library-item-name"
                        onClick={() => {
                          db.setSchemaInput(s.schema);
                          if (s.rules) db.setRules(s.rules);
                          db.setSchemaOptionsVisible(false);
                        }}
                      >
                        <i className="fas fa-file-code m-schema-library-item-icon" />
                        {s.name}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); db.handleDeleteSchema(i); }}
                        className="m-library-item-delete-btn"
                        title="Delete saved schema"
                      >
                        <i className="fas fa-trash-alt" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={`m-editor-wrapper-box mb-editor-dropzone ${db.isDragOver ? 'mb-dragover' : ''}`}
                onDrop={db.handleDrop}
                onDragEnter={db.handleDragEnter}
                onDragOver={db.handleDragOver}
                onDragLeave={db.handleDragLeave}
                title="Drop a schema file here"
              >
                <CodeEditor
                  value={db.schemaInput}
                  lineNumbers={false}
                  onValueChange={db.setSchemaInput}
                  language={db.detectedLanguage}
                  placeholder="CREATE TABLE users (id UUID PRIMARY KEY, created_at TIMESTAMP);"
                />

                {db.isDragOver && (
                  <div className="mb-drop-overlay">
                    <div className="mb-drop-overlay-card">
                      <i className="fas fa-file-arrow-up" />
                      <span>Drop your schema file to load it</span>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sql,.prisma,.ts,.json,.txt"
                  style={{ display: 'none' }}
                  onChange={e => db.handleFileUpload(e.target.files?.[0])}
                />
              </div>

              <div className="action-row start">
                <button
                  className="secondary-button"
                  onClick={db.handleSaveSchema}
                  disabled={!db.schemaInput.trim()}
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
                    if (e.target.value) db.setRules(prev => prev ? `${prev}\n${e.target.value}` : e.target.value);
                  }}
                >
                  <option value="" disabled>+ Insert Template Rule...</option>
                  {RULE_TEMPLATES.map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
                </select>
                <textarea
                  className="m-text-input m-rule-input"
                  placeholder="e.g., 75% of users must have role 'Developer'."
                  value={db.rules}
                  onChange={e => db.setRules(e.target.value)}
                />
                {db.parsedRulesFeedback.length > 0 && (
                  <div className="m-rules-feedback">
                    <strong>Applied Directives:</strong>
                    <ul>
                      {db.parsedRulesFeedback.map((r, i) => (
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
                    value={db.config.locale}
                    onChange={e => db.setConfig(prev => ({ ...prev, locale: e.target.value }))}
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
                    value={db.config.rowCount}
                    onChange={e => db.setConfig(prev => ({ ...prev, rowCount: e.target.value }))}
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
                  <span className="m-quality-value-badge">{db.config.dataQuality}%</span>
                </div>
                <input
                  type="range" min="38" max="75"
                  value={db.config.dataQuality}
                  onChange={e => db.setConfig(prev => ({ ...prev, dataQuality: parseInt(e.target.value, 10) }))}
                  className="m-slider m-styled-slider"
                />
                <span className="m-slider-hint">{getQualityLabel(db.config.dataQuality)}</span>
              </div>

              <div className="m-form-group">
                <label className="m-input-label">Seed Lock <span className="m-optional-tag">Optional</span></label>
                <div className="m-input-with-icon">
                  <i className="fas fa-lock m-input-icon" />
                  <input
                    type="text"
                    className="m-text-input m-with-icon"
                    placeholder="e.g. 42 (Reproducible)"
                    value={db.config.seed}
                    onChange={e => db.setConfig(prev => ({ ...prev, seed: e.target.value }))}
                  />
                </div>
              </div>

              <label className="custom-check" title="Generate Data Analysis">
                <input
                  type="checkbox"
                  checked={db.config.includeAnalysis}
                  onChange={e => db.setConfig(prev => ({ ...prev, includeAnalysis: e.target.checked }))}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Generate Data Analysis &amp; Explanations</span>
              </label>
            </div>
          </div>

          <div className="m-sidebar-footer">
            <button
              className={`primary-button m-fabricate-action-btn ${db.isLoading ? 'm-loading' : ''}`}
              onClick={() => db.handleGenerate()}
              disabled={db.isLoading || !db.schemaInput.trim()}
            >
              {db.isLoading
                ? <><div className="m-spinner-small" /> Synthesizing...</>
                : <><i className="fas fa-bolt" /> Fabricate Database</>}
            </button>

            <button className="secondary-button btn-danger" onClick={db.clearWorkspace} title="Clear Workspace">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="m-main">
          <div className="mb-toolbar">
            {!db.isLoading && db.viewMode !== 'erd' ? (
              <div className="m-tabs-container">
                {db.generatedData?.tables.map((table, idx) => {
                  const canRegen = db.isSafeToRegenerate(table.tableName);
                  return (
                    <div key={idx} className="m-tab-btn-wrapper">
                      <button
                        className={`m-tab-btn ${db.activeTab === idx ? 'm-active' : ''}`}
                        onClick={() => db.setActiveTab(idx)}
                      >
                        <i className="fas fa-table" /> {table.tableName}
                        <span className="m-tab-count-badge">{table.rows?.length ?? 0}</span>
                      </button>
                      {canRegen && (
                        <button
                          className="m-regen-table-btn"
                          title={`Re-roll ${table.tableName} (no inbound FKs)`}
                          disabled={db.regenLoadingIdx !== null || db.isLoading}
                          onClick={e => { e.stopPropagation(); db.handleRegenerateTable(idx); }}
                        >
                          {db.regenLoadingIdx === idx
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
              {db.generatedData && (
                <>
                  <div className="m-view-mode-toggles">
                    <button
                      className={`m-view-toggle-btn ${db.viewMode === 'table' ? 'm-active' : ''}`}
                      onClick={() => db.setViewMode('table')}
                      title="Table view"
                    >
                      <i className="fas fa-th-list" /> Table
                    </button>
                    <button
                      className={`m-view-toggle-btn ${db.viewMode === 'erd' ? 'm-active' : ''}`}
                      onClick={() => db.setViewMode('erd')}
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
                          .writeText(JSON.stringify(db.activeTableData, null, 2))
                          .catch(() => console.warn('Clipboard write failed'))
                      }
                    >
                      <i className="fas fa-clipboard" />
                    </button>
                    <select
                      value=""
                      onChange={e => { if (e.target.value) db.triggerExportModal(e.target.value); }}
                    >
                      <option value="">Export As…</option>
                      <option value="csv">CSV (Active Table)</option>
                      <option value="json">JSON (All Tables)</option>
                      <option value="sql">SQL Seeds</option>
                      <option value="prisma">Prisma Seed (.ts)</option>
                      <option value="types">TypeScript Types (.ts)</option>
                    </select>

                    <select
                      value={db.seedMode}
                      onChange={e => db.setSeedMode(e.target.value)}
                      disabled={db.isSeedingDb}
                      title="What to do about rows that already exist in the target tables"
                    >
                      <option value="insert">Insert (fail on duplicate)</option>
                      <option value="skipDuplicates">Skip duplicates</option>
                      <option value="clearFirst">Clear tables first</option>
                    </select>

                    <button
                      className={`primary-button m-tool-btn ${db.isSeedingDb ? 'm-loading' : ''}`}
                      title="Seed directly into the connected database (sent in small chunks per request)"
                      onClick={() => {
                        if (db.seedMode === 'clearFirst' && !window.confirm(
                          'This will TRUNCATE every table in the current schema before seeding. This cannot be undone. Continue?'
                        )) return;
                        db.handleSeedDirectly();
                      }}
                      disabled={db.isSeedingDb || !db.dbUri}
                    >
                      {db.isSeedingDb ? (
                        <>
                          <i className="fas fa-circle-notch fa-spin" />
                          {db.seedProgress.totalBatches > 0 && ` ${db.seedProgress.batchesDone}/${db.seedProgress.totalBatches}`}
                        </>
                      ) : (
                        <><i className="fas fa-bolt" /> Seed to DB</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <SeedProgressPanel
            progress={db.seedProgress}
            onCancel={db.handleCancelSeed}
            onDismiss={db.dismissSeedProgress}
            onRollback={db.handleRollbackSeededTables}
          />

          <div className="m-preview-area">
            <EmptyState
              isLoading={db.isLoading}
              condition={!db.generatedData}
              icon="fas fa-database"
              title="Awaiting Architecture"
              description="Input your schema definitions in the sidebar to generate a highly interconnected relational database."
              hint={<>Use <code>@faker:creditCard</code> for specific column formatting. Choose an option from the <strong>Annotations</strong> dropdown in the sidebar to view references.</>}
              loadingTitle="Synthesizing Reality"
              loadingDescription="Analyzing schema relationships and generating localized datasets..."
            />

            {db.generatedData && !db.isLoading && db.viewMode === 'erd' && (
              <ErdDiagram
                tables={db.generatedData.tables}
                relationships={db.fkRelationships}
              />
            )}

            {db.activeTableData && !db.isLoading && db.viewMode === 'table' && (
              <div className="m-table-wrapper">
                <div className="m-table-filter-bar">
                  <div className="m-table-filter-input-wrap">
                    <i className="fas fa-search m-table-filter-icon" />
                    <input
                      type="text"
                      className="m-table-filter-input"
                      placeholder={`Search all columns in ${db.activeTableData.tableName}…`}
                      value={db.filterQuery}
                      onChange={e => db.setFilterQuery(e.target.value)}
                    />
                    {db.filterQuery && (
                      <button
                        className="m-table-filter-clear"
                        onClick={() => db.setFilterQuery('')}
                        title="Clear search"
                      >
                        <i className="fas fa-times-circle" />
                      </button>
                    )}
                  </div>

                  <ColFilterBar
                    colKeys={db.activeColKeys}
                    colFilter={db.colFilter}
                    setColFilter={db.setColFilter}
                    filterQuery={db.filterQuery}
                    filteredRows={db.filteredRows}
                  />

                  <div className="m-table-controls-right">
                    <button
                      className="secondary-button"
                      onClick={db.handleAddRow}
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
                        {db.activeColKeys.map(key => {
                          const badges = inferColumnBadges(key, sampleRow[key], db.allTableNames);
                          return (
                            <th
                              key={key}
                              className="m-sortable-th"
                              onClick={() => db.handleSort(key)}
                              title={`Sort by ${key}`}
                            >
                              <div className="m-th-content">
                                <span className="m-th-col-name">{key}</span>
                                <div className="m-th-right">
                                  <div className="m-th-badges">
                                    {badges.map((b, i) => <ColTypeBadge key={`${b}-${i}`} label={b} />)}
                                  </div>
                                  <SortIndicator col={key} sortConfig={db.sortConfig} />
                                </div>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {db.paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={db.activeColKeys.length + 1} className="m-table-no-results">
                            <i className="fas fa-search-minus m-empty-search-icon" />
                            <p>No rows match the current filters</p>
                          </td>
                        </tr>
                      ) : (
                        db.paginatedRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="m-data-row">
                            <td className="m-row-actions-cell">
                              <button
                                className="m-row-delete-btn"
                                title="Delete this row"
                                onClick={() => db.handleDeleteRow(rowIdx)}
                              >
                                <i className="fas fa-times" />
                              </button>
                            </td>
                            {db.activeColKeys.map(colKey => {
                              const isEditing =
                                db.editingCell?.rowIdx === rowIdx &&
                                db.editingCell?.colKey === colKey;
                              return (
                                <EditableCell
                                  key={colKey}
                                  value={row[colKey]}
                                  rowIdx={rowIdx}
                                  colKey={colKey}
                                  isEditing={isEditing}
                                  editingValue={db.editingValue}
                                  isRegenerating={isRegenCell(rowIdx, colKey)}
                                  onStartEdit={val => db.handleStartEdit(rowIdx, colKey, val)}
                                  onChange={db.setEditingValue}
                                  onCommit={db.handleCommitEdit}
                                  onCancel={db.handleCancelEdit}
                                  onCopy={db.handleCopyCell}
                                  onRegen={db.handleRegenerateCell}
                                />
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {db.totalPages > 1 && (
                  <div className="m-pagination-controls">
                    <button
                      className="m-page-btn"
                      onClick={() => db.setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={db.currentPage === 1}
                    >
                      <i className="fas fa-chevron-left" /> Prev
                    </button>
                    <span className="m-page-indicator">
                      Page <strong>{db.currentPage}</strong> of <strong>{db.totalPages}</strong>
                    </span>
                    <button
                      className="m-page-btn"
                      onClick={() => db.setCurrentPage(p => Math.min(db.totalPages, p + 1))}
                      disabled={db.currentPage === db.totalPages}
                    >
                      Next <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {db.generatedData?.explanation && (
              <div className="m-panel m-explanation-panel">
                <h3 className="m-explanation-title"><i className="fas fa-robot" /> Generation Analysis</h3>
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(db.generatedData.explanation) }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        {...db.modalConfig}
        onCancel={() => db.setModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {db.isSaveModalOpen && (
        <div className="modal-overlay" onClick={() => db.setIsSaveModalOpen(false)}>
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
                value={db.newSchemaName}
                onChange={e => { db.setNewSchemaName(e.target.value); db.setSaveSchemaError(''); }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && db.executeSaveSchema()}
              />
              {db.saveSchemaError && (
                <div className="m-error-message">
                  <i className="fas fa-exclamation-triangle" /> {db.saveSchemaError}
                </div>
              )}
            </div>
            <div className="modal-footer m-split-footer">
              <button className="secondary-button" onClick={() => db.setIsSaveModalOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={db.executeSaveSchema}>Save Template</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
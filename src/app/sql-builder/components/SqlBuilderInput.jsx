'use client';

import { CodeEditor } from '@/components/ui';
import { DialectSelect } from './SqlBuilderPrimitives';

export function SqlBuilderInput({
  activeMode,
  input, setInput,
  targetDialect, setTargetDialect,
  sourceDialect, setSourceDialect,
  explainChanges, setExplainChanges,
  schema, handleSchemaChange, handleCopySchema, handleClearSchema,
  showSchema, setShowSchema,
  workspaces, activeWorkspace, switchWorkspace,
  openWorkspaceModal, deleteWorkspace,
  handleFileUpload,
  mockLoading, handleGenerateMockData,
  loading,
  handleGenerate,
  clearInputs,
}) {
  return (
    <div className="panel flex-col">
      <div className="panel-header-row">
        <h3>
          {activeMode === 'builder' && 'Requirement'}
          {activeMode === 'converter' && 'Source Query'}
          {activeMode === 'optimizer' && 'Slow Query'}
        </h3>
        <button className="mode-btn" onClick={clearInputs} title="Clear all">
          <i className="fa-solid fa-eraser"></i> Clear
        </button>
      </div>

      <div className="controls-group">
        {activeMode === 'converter' ? (
          <div className="ext-grid">
            <div className="control-field">
              <span className="label-text">From:</span>
              <DialectSelect
                value={sourceDialect}
                onChange={setSourceDialect}
                className="combobox-input full-width"
              />
            </div>
            <div className="control-field">
              <span className="label-text">To:</span>
              <DialectSelect
                value={targetDialect}
                onChange={setTargetDialect}
                className="combobox-input full-width"
              />
            </div>
          </div>
        ) : (
          <div className="dialect-selection-row">
            <span className="label-text">Dialect:</span>
            <DialectSelect value={targetDialect} onChange={setTargetDialect} />

            {activeMode === 'optimizer' && (
              <label className="custom-check explain-check">
                <input
                  type="checkbox"
                  checked={explainChanges}
                  onChange={(e) => setExplainChanges(e.target.checked)}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Explain Changes</span>
              </label>
            )}
          </div>
        )}

        {activeMode !== 'converter' && (
          <div className="schema-wrapper">
            <div className="schema-header-actions">
              <button
                className={`schema-toggle-btn ${showSchema ? 'active' : ''}`}
                onClick={() => setShowSchema((v) => !v)}
                aria-expanded={showSchema}
              >
                <i className="fa-solid fa-database"></i>
                {showSchema ? 'Hide Database Schema' : 'Add Database Schema Context'}
              </button>

              {showSchema && (
                <div className="workspace-controls">
                  <select
                    className="combobox-input select-small"
                    value={activeWorkspace}
                    onChange={(e) => switchWorkspace(e.target.value)}
                    aria-label="Active workspace"
                  >
                    {Object.keys(workspaces).map((ws) => (
                      <option key={ws} value={ws}>{ws}</option>
                    ))}
                  </select>

                  <div className="sub-workspace-controls">
                    <button
                      className="secondary-button btn-small"
                      onClick={openWorkspaceModal}
                      title="New Workspace"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>

                    {Object.keys(workspaces).length > 1 && (
                      <button
                        className="secondary-button btn-small"
                        onClick={() => deleteWorkspace(activeWorkspace)}
                        title={`Delete "${activeWorkspace}"`}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}

                    <div className="upload-btn-wrapper" title="Import Schema File">
                      <button className="secondary-button btn-small">
                        <i className="fa-solid fa-file-import"></i>
                      </button>
                      <input type="file" accept=".sql,.txt" onChange={handleFileUpload} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {showSchema && (
              <>
                <div className="schema-editor-wrapper">
                  <CodeEditor
                    key={activeWorkspace}
                    value={schema}
                    onValueChange={handleSchemaChange}
                    language="sql"
                    placeholder="CREATE TABLE users (id INT, name TEXT...);"
                  />
                </div>

                <div className="schema-footer-actions action-row">
                  <button
                    className="secondary-button btn-small full-width"
                    onClick={() => handleGenerateMockData(targetDialect)}
                    disabled={mockLoading}
                    title="Append INSERT statements to schema"
                  >
                    {mockLoading ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
                    ) : (
                      <><i className="fa-solid fa-table"></i> Generate Mock Data into Schema</>
                    )}
                  </button>

                  {schema && (
                    <>
                      <button
                        className="secondary-button btn-small"
                        onClick={handleCopySchema}
                        title="Copy schema to clipboard"
                      >
                        <i className="fa-solid fa-copy"></i>
                      </button>
                      <button
                        className="secondary-button btn-small"
                        onClick={handleClearSchema}
                        title="Clear schema"
                      >
                        <i className="fa-solid fa-eraser"></i>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="main-input-wrapper flex-grow">
        <CodeEditor
          value={input}
          onValueChange={setInput}
          language="sql"
          placeholder={
            activeMode === 'builder'
              ? 'e.g., Get all users who placed an order in the last 7 days, join with products and show total spend.'
              : activeMode === 'converter'
                ? 'Paste your source SQL query here...'
                : 'Paste the slow query to optimize...'
          }
        />
      </div>

      <div className="generate-action-row action-row">
        <button
          className="primary-button"
          onClick={handleGenerate}
          disabled={loading || mockLoading}
        >
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
          ) : (
            <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate</>
          )}
        </button>
      </div>
    </div>
  );
}
'use client';

import { CodeEditor } from '@/components/ui';
import { ResultStatsBar, ResultTable } from './SqlBuilderPrimitives';

const formatExecTime = (ms) => {
  if (ms === null || ms === undefined) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
};

export function TestRunner({
  panelRef,
  showTestRunner, setShowTestRunner,
  isNativeSqlite,
  targetDialect,
  isSandboxRunning,
  isGeneratingTestData,
  executionTime,
  autoTestData, setAutoTestData,
  testDataSQL, setTestDataSQL,
  showTestDataPreview, setShowTestDataPreview,
  sandboxResults,
  sandboxError,
  simulationNote,
  isSimulated,
  runSandbox,
  generateTestData,
  clearTestData,
  exportResultsAsCSV,
}) {
  const totalResultRows = sandboxResults
    ?.filter((r) => r.columns?.length > 0)
    .reduce((acc, r) => acc + (r.values?.length ?? 0), 0) ?? 0;

  const hasTableResults = sandboxResults?.some((r) => r.columns?.length > 0);

  return (
    <div className="test-runner-panel" ref={panelRef}>

      <div
        className="test-runner-header"
        onClick={() => setShowTestRunner((v) => !v)}
        role="button"
        aria-expanded={showTestRunner}
      >
        <div className="test-runner-title">
          <i className="fa-solid fa-flask-vial"></i>
          <span>Test Runner</span>

          {isSandboxRunning ? (
            <span className="exec-time-badge running">
              <i className="fa-solid fa-spinner fa-spin"></i>
              {isGeneratingTestData ? 'Seeding data...' : 'Running...'}
            </span>
          ) : executionTime !== null && (
            <span className="exec-time-badge">
              {formatExecTime(executionTime)}
            </span>
          )}
        </div>

        <div className="test-runner-header-right">
          {isNativeSqlite ? (
            <span className="dialect-badge native">
              <i className="fa-solid fa-bolt"></i> Native SQLite
            </span>
          ) : (
            <span className="dialect-badge simulated">
              <i className="fa-solid fa-robot"></i> AI Simulation — {targetDialect}
            </span>
          )}
          <i className={`fa-solid ${showTestRunner ? 'fa-chevron-up' : 'fa-chevron-down'} tr-chevron`}></i>
        </div>
      </div>

      {showTestRunner && (
        <div className="test-runner-body">
          <div className="test-runner-controls" onClick={(e) => e.stopPropagation()}>
            <div className="tr-controls-left">

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={autoTestData}
                  onChange={(e) => setAutoTestData(e.target.checked)}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="label-text">Auto-generate test data</span>
              </label>

              {testDataSQL ? (
                <>
                  <button
                    className="secondary-button btn-small"
                    onClick={() => setShowTestDataPreview((v) => !v)}
                    title="View / edit seed data"
                  >
                    <i className={`fa-solid ${showTestDataPreview ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    {showTestDataPreview ? 'Hide' : 'View'} Test Data
                  </button>
                  <button
                    className="secondary-button btn-small"
                    onClick={clearTestData}
                    title="Clear test data"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </>
              ) : autoTestData && (
                <button
                  className="secondary-button btn-small"
                  onClick={generateTestData}
                  disabled={isGeneratingTestData}
                  title="Pre-generate test data without running"
                >
                  {isGeneratingTestData ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Generating...</>
                  ) : (
                    <><i className="fa-solid fa-database"></i> Pre-generate Data</>
                  )}
                </button>
              )}
            </div>

            <div className="tr-controls-right">
              {hasTableResults && (
                <button
                  className="secondary-button btn-small"
                  onClick={exportResultsAsCSV}
                  title="Export results as CSV"
                >
                  <i className="fa-solid fa-file-csv"></i> Export CSV
                </button>
              )}
              <button
                className="primary-button btn-small"
                onClick={runSandbox}
                disabled={isSandboxRunning}
              >
                {isSandboxRunning ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i>
                    {isGeneratingTestData ? 'Seeding...' : 'Running...'}
                  </>
                ) : (
                  <><i className="fa-solid fa-play"></i> Run Query</>
                )}
              </button>
            </div>
          </div>

          {showTestDataPreview && testDataSQL && (
            <div className="test-data-section">
              <div className="test-data-section-header">
                <span><i className="fa-solid fa-table"></i> Test Data (editable)</span>
                <button
                  className="secondary-button btn-small"
                  onClick={generateTestData}
                  disabled={isGeneratingTestData}
                  title="Regenerate test data"
                >
                  <i className={`fa-solid ${isGeneratingTestData ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                  {' '}Regenerate
                </button>
              </div>
              <div className="test-data-editor-wrapper">
                <CodeEditor
                  value={testDataSQL}
                  onValueChange={setTestDataSQL}
                  language="sql"
                  placeholder="INSERT INTO..."
                />
              </div>
            </div>
          )}

          {sandboxError && (
            <div className="alert-box error-box tr-result-area">
              <strong>
                <i className="fa-solid fa-circle-xmark"></i> Execution Error
              </strong>
              <p className="sandbox-error-text">{sandboxError}</p>
            </div>
          )}

          {sandboxResults?.length > 0 && (
            <div className="tr-result-area">
              {isSimulated && (
                <div className="simulation-notice">
                  <i className="fa-solid fa-robot"></i>
                  These results are AI-simulated — {targetDialect} cannot run natively in the browser.
                </div>
              )}

              {hasTableResults && (
                <ResultStatsBar
                  totalRows={totalResultRows}
                  executionTime={executionTime}
                  isSimulated={isSimulated}
                  formatExecTime={formatExecTime}
                />
              )}

              <div className="sandbox-results">
                {sandboxResults.map((result, idx) => (
                  <ResultTable
                    key={idx}
                    result={result}
                    index={idx}
                    total={sandboxResults.length}
                  />
                ))}
              </div>
            </div>
          )}

          {simulationNote && (
            <div className="ai-summary simulation-note-box">
              <strong><i className="fa-solid fa-circle-info"></i> Simulation Notes</strong>
              <div dangerouslySetInnerHTML={{ __html: simulationNote.replace(/\n/g, '<br/>') }} />
            </div>
          )}

          {!isSandboxRunning && !sandboxResults && !sandboxError && (
            <div className="tr-empty-state">
              <i className="fa-solid fa-play-circle"></i>
              <p>
                Click <strong>Run Query</strong> to test your SQL.
                {!isNativeSqlite && (
                  <span className="tr-empty-note">
                    {' '}Results for <strong>{targetDialect}</strong> will be AI-simulated.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
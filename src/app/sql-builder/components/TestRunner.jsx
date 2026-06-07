'use client';

import DOMPurify from 'dompurify';
import { CodeEditor } from '@/components/ui';
import { ResultStatsBar, ResultTable } from './SqlBuilderPrimitives';
import { ENGINE_LABELS } from './sqlForgeConstants';

const formatExecTime = (ms) => {
  if (ms === null || ms === undefined) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
};

export function TestRunner({
  panelRef,
  showTestRunner, setShowTestRunner,
  nativeEngine,
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
  const engine = ENGINE_LABELS[nativeEngine] ?? ENGINE_LABELS.ai;

  return (
    <div className="s-test-runner-panel" ref={panelRef}>

      <div
        className="s-test-runner-header"
        onClick={() => setShowTestRunner((v) => !v)}
        role="button"
        aria-expanded={showTestRunner}
      >
        <div className="s-test-runner-title">
          <i className="fa-solid fa-flask-vial"></i>
          <span>Test Runner</span>

          {isSandboxRunning ? (
            <span className="s-exec-time-badge s-running">
              <i className="fa-solid fa-spinner fa-spin"></i>
              {isGeneratingTestData ? 'Seeding data...' : 'Running...'}
            </span>
          ) : executionTime !== null && (
            <span className="s-exec-time-badge">
              {formatExecTime(executionTime)}
            </span>
          )}
        </div>

        <div className="s-test-runner-header-right">
          <span className={`s-dialect-badge ${engine.cls}`}>
            <i className={`fa-solid ${engine.icon}`}></i>{' '}
            {engine.cls === 'simulated' ? `${engine.label} — ${targetDialect}` : engine.label}
          </span>
          <i className={`fa-solid ${showTestRunner ? 'fa-chevron-up' : 'fa-chevron-down'} s-tr-chevron`}></i>
        </div>
      </div>

      {showTestRunner && (
        <div className="s-test-runner-body">
          <div className="s-test-runner-controls" onClick={(e) => e.stopPropagation()}>
            <div className="s-tr-controls-left">

              <label className="custom-check">
                <input
                  type="checkbox"
                  checked={autoTestData}
                  onChange={(e) => setAutoTestData(e.target.checked)}
                />
                <div className="box"><i className="fa-solid fa-check"></i></div>
                <span className="s-label-text">Auto-generate test data</span>
              </label>

              {testDataSQL ? (
                <>
                  <button
                    className="secondary-button s-btn-small"
                    onClick={() => setShowTestDataPreview((v) => !v)}
                    title="View / edit seed data"
                  >
                    <i className={`fa-solid ${showTestDataPreview ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    {showTestDataPreview ? 'Hide' : 'View'} Test Data
                  </button>
                  <button
                    className="secondary-button s-btn-small"
                    onClick={clearTestData}
                    title="Clear test data"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </>
              ) : autoTestData && (
                <button
                  className="secondary-button s-btn-small"
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

            <div className="s-tr-controls-right">
              {hasTableResults && (
                <button
                  className="secondary-button s-btn-small"
                  onClick={exportResultsAsCSV}
                  title="Export results as CSV"
                >
                  <i className="fa-solid fa-file-csv"></i> Export CSV
                </button>
              )}
              <button
                className="primary-button s-btn-small"
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
            <div className="s-test-data-section">
              <div className="s-test-data-section-header">
                <span><i className="fa-solid fa-table"></i> Test Data (editable)</span>
                <button
                  className="secondary-button s-btn-small"
                  onClick={generateTestData}
                  disabled={isGeneratingTestData}
                  title="Regenerate test data"
                >
                  <i className={`fa-solid ${isGeneratingTestData ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                  {' '}Regenerate
                </button>
              </div>
              <div className="s-test-data-editor-wrapper">
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
            <div className="s-alert-box s-error-box s-tr-result-area">
              <strong>
                <i className="fa-solid fa-circle-xmark"></i> Execution Error
              </strong>
              <p className="s-sandbox-error-text">{sandboxError}</p>
            </div>
          )}

          {sandboxResults?.length > 0 && (
            <div className="s-tr-result-area">
              {isSimulated && (
                <div className="s-simulation-notice">
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

              <div className="s-sandbox-results">
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
            <div className="s-ai-summary s-simulation-note-box">
              <strong><i className="fa-solid fa-circle-info"></i> Simulation Notes</strong>
              <div dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(simulationNote.replace(/\n/g, '<br/>'))
              }} />           
            </div>
          )}

          {!isSandboxRunning && !sandboxResults && !sandboxError && (
            <div className="s-tr-empty-state">
              <i className="fa-solid fa-play-circle"></i>
              <p>
                Click <strong>Run Query</strong> to test your SQL.
                {nativeEngine === 'ai' && (
                  <span className="s-tr-empty-note">
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
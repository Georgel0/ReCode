'use client';

import DOMPurify from 'dompurify';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { CodeOutput, CopyButton } from '@/components/ui';
import { EmptyState } from '@/components/layout';

export function SqlBuilderOutput({
  activeMode,
  input,
  outputCode,
  targetDialect,
  explanation,
  warnings,
  recommendedIndexes,
  loading,
  mockLoading,
  isSandboxRunning,
  isDarkTheme,
  runSandbox,
  handleFormatCode,
}) {
  const isSameDiff =
    activeMode === 'optimizer' &&
    input.trim() &&
    outputCode.trim() &&
    input.trim() === outputCode.trim();

  return (
    <div className="s-panel-output">
      <div className="s-panel-header-row">
        <h3>Generated SQL {outputCode && `(${targetDialect})`}</h3>
        {outputCode && (
          <div className="s-header-actions">
            <button
              className="secondary-button s-btn-small"
              onClick={runSandbox}
              disabled={isSandboxRunning}
              title="Open Test Runner"
            >
              <i className={`fa-solid ${isSandboxRunning ? 'fa-spinner fa-spin' : 'fa-flask'}`}></i> Test
            </button>
            <button
              className="secondary-button s-btn-small"
              onClick={handleFormatCode}
              title="Format SQL"
            >
              <i className="fa-solid fa-align-left"></i> Format
            </button>
            <CopyButton codeToCopy={outputCode} className="secondary-button s-btn-small" />
          </div>
        )}
      </div>

      <div className="s-results-container s-flex-grow">
        {outputCode ? (
          <div className="s-output-scrollable">

            {warnings?.length > 0 && (
              <div className="s-alert-box s-amber">
                <strong>
                  <i className="fa-solid fa-triangle-exclamation"></i> Warnings
                </strong>
                <ul>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {isSameDiff ? (
              <div className="s-success-state placeholder-container-inner s-diff-success-state">
                <i className="fa-solid fa-circle-check"></i>
                <p><strong>Query is already optimized!</strong></p>
                <p className="s-success-desc">No structural or indexing improvements were necessary.</p>
              </div>
            ) : activeMode === 'optimizer' ? (
              <div className="s-diff-viewer-wrapper s-optimizer-diff">
                <ReactDiffViewer
                  oldValue={input}
                  newValue={outputCode}
                  splitView
                  useDarkTheme={isDarkTheme}
                  compareMethod="diffLines"
                  leftTitle="Original Query"
                  rightTitle="Optimized Query"
                  styles={!isDarkTheme ? undefined : {
                    variables: {
                      diffViewerBackground: 'var(--bg-primary)',
                      addedBackground: 'rgba(46, 160, 67, 0.15)',
                      addedGutterBackground: 'rgba(46, 160, 67, 0.25)',
                      removedBackground: 'rgba(248, 81, 73, 0.15)',
                      removedGutterBackground: 'rgba(248, 81, 73, 0.25)',
                    },
                    contentText: { fontSize: '13px', lineHeight: '20px' },
                    titleBlock: { height: 'auto', padding: '10px' },
                  }}
                />
              </div>
            ) : (
              <div className="s-code-output-wrapper">
                <CodeOutput content={outputCode} language="sql" />
              </div>
            )}

            {recommendedIndexes?.length > 0 && (
              <div className="s-ai-summary s-recommended-indexes">
                <strong>
                  <i className="fa-solid fa-bolt"></i> Recommended Indexes
                </strong>
                <p className="s-small-text">
                  These indexes may significantly improve query performance.
                </p>
                {recommendedIndexes.map((idx, i) => (
                  <CodeOutput key={i} content={idx} language="sql" />
                ))}
              </div>
            )}

            {explanation && (
              <div className="s-ai-summary s-explain-plan">
                <strong><i className="fa-solid fa-lightbulb"></i> Explain Plan</strong>
                <div dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(explanation.replace(/\n/g, '<br/>'))
                }} />
              </div>
            )}

          </div>
        ) : (
          <EmptyState
            isLoading={loading || mockLoading}
            condition={!outputCode}
            icon="fas fa-database"
            title="Awaiting Query Definition"
            description="Explain your targeted query operation objectives or design table relation models to generate pristine dialect-safe SQL code."
            hint={<>Open the integrated <code>Test Runner</code> terminal layer below to test your query's performance live against virtual sandboxes.</>}
            loadingTitle="Forging Relational Syntax"
            loadingDescription="Optimizing engine index lookup targets, sanitizing parameter fields, and checking database constraint rules..."
          />
        )}
      </div>
    </div>
  );
}
'use client';

import ReactDiffViewer from 'react-diff-viewer-continued';
import { CodeOutput, CopyButton } from '@/components/ui';

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
    <div className="panel flex-col">
      <div className="panel-header-row">
        <h3>Generated SQL {outputCode && `(${targetDialect})`}</h3>
        {outputCode && (
          <div className="header-actions">
            <button
              className="secondary-button btn-small"
              onClick={runSandbox}
              disabled={isSandboxRunning}
              title="Open Test Runner"
            >
              <i className={`fa-solid ${isSandboxRunning ? 'fa-spinner fa-spin' : 'fa-flask'}`}></i> Test
            </button>
            <button
              className="secondary-button btn-small"
              onClick={handleFormatCode}
              title="Format SQL"
            >
              <i className="fa-solid fa-align-left"></i> Format
            </button>
            <CopyButton codeToCopy={outputCode} className="secondary-button btn-small" />
          </div>
        )}
      </div>

      <div className="results-container flex-grow">
        {outputCode ? (
          <div className="output-scrollable">

            {warnings?.length > 0 && (
              <div className="alert-box amber">
                <strong>
                  <i className="fa-solid fa-triangle-exclamation"></i> Warnings
                </strong>
                <ul>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {isSameDiff ? (
              <div className="success-state placeholder-container-inner diff-success-state">
                <i className="fa-solid fa-circle-check"></i>
                <p><strong>Query is already optimized!</strong></p>
                <p className="success-desc">No structural or indexing improvements were necessary.</p>
              </div>
            ) : activeMode === 'optimizer' ? (
              <div className="diff-viewer-wrapper optimizer-diff">
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
                      diffViewerBackground:    'var(--bg-primary)',
                      addedBackground:         'rgba(46, 160, 67, 0.15)',
                      addedGutterBackground:   'rgba(46, 160, 67, 0.25)',
                      removedBackground:       'rgba(248, 81, 73, 0.15)',
                      removedGutterBackground: 'rgba(248, 81, 73, 0.25)',
                    },
                    contentText: { fontSize: '13px', lineHeight: '20px' },
                    titleBlock:  { height: 'auto', padding: '10px' },
                  }}
                />
              </div>
            ) : (
              <div className="code-output-wrapper">
                <CodeOutput content={outputCode} language="sql" />
              </div>
            )}

            {recommendedIndexes?.length > 0 && (
              <div className="ai-summary recommended-indexes">
                <strong>
                  <i className="fa-solid fa-bolt"></i> Recommended Indexes
                </strong>
                <p className="small-text">
                  These indexes may significantly improve query performance.
                </p>
                {recommendedIndexes.map((idx, i) => (
                  <CodeOutput key={i} content={idx} language="sql" />
                ))}
              </div>
            )}

            {explanation && (
              <div className="ai-summary explain-plan">
                <strong><i className="fa-solid fa-lightbulb"></i> Explain Plan</strong>
                <div dangerouslySetInnerHTML={{ __html: explanation.replace(/\n/g, '<br/>') }} />
              </div>
            )}

          </div>
        ) : (
          <div className="placeholder-text placeholder-container-inner">
            {loading || mockLoading ? (
              <div className="processing-state">
                <div className="pulse-ring"></div>
                <p>AI is {mockLoading ? 'generating mock data...' : 'building your query...'}</p>
              </div>
            ) : (
              'Generated SQL will appear here.'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
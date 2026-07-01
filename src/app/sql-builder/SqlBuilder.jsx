'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { ModuleHeader } from '@/components/layout';
import { ErdDiagram } from '@/components/widgets';
import { useTheme } from '@/context';
import { useSqlForge } from './useSqlForge/useSqlForge';
import { MODES } from './components/sqlForgeConstants';
import { SqlBuilderInput } from './components/SqlBuilderInput';
import { SqlBuilderOutput } from './components/SqlBuilderOutput';
import { TestRunner } from './components/TestRunner';
import { WorkspaceModal } from './components/WorkspaceModal';

import './styles/sqlBuilder.css';
import './styles/testRunner.css';
import './styles/schema.css';
import './styles/sandbox.css';

export default function SqlBuilder() {
  const { currentTheme } = useTheme();
  const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);
  const testRunnerRef = useRef(null);

  const forge = useSqlForge();

  const [viewMode, setViewMode] = useState('query');

  const erdData = useMemo(() => forge.parseSchemaToErd(forge.schema), [forge.schema]);
  const hasSchema = !!(forge.schema && forge.schema.trim().length > 0);

  useEffect(() => {
    if (!hasSchema && viewMode === 'erd') {
      setViewMode('query');
    }
  }, [hasSchema, viewMode]);

  useEffect(() => {
    if (forge.showTestRunner && testRunnerRef.current) {
      const id = setTimeout(
        () => testRunnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        100,
      );
      return () => clearTimeout(id);
    }
  }, [forge.showTestRunner]);

  return (
    <div className="s-module-container">
      <ModuleHeader
        title="SQL Builder"
        description="Generate, convert, execute, and optimize SQL queries for any dialect."
        resultData={forge.lastResult}
      />

      <div className="s-tabs-container">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`s-tab-btn ${viewMode === 'query' && forge.activeMode === m.id ? 's-active' : ''}`}
            onClick={() => {
              setViewMode('query');
              forge.setActiveMode(m.id);
            }}
          >
            <i className={`fa-solid ${m.icon}`}></i> {m.label}
          </button>
        ))}

        {hasSchema && (
          <button
            key="erd-tab"
            className={`s-tab-btn ${viewMode === 'erd' ? 's-active' : ''}`}
            onClick={() => setViewMode('erd')}
          >
            <i className="fa-solid fa-project-diagram"></i> ER Diagram
          </button>
        )}
      </div>

      {viewMode === 'query' ? (
        <>
          <div className="s-converter-grid">
            <SqlBuilderInput
              activeMode={forge.activeMode}
              input={forge.input} setInput={forge.setInput}
              targetDialect={forge.targetDialect} setTargetDialect={forge.setTargetDialect}
              sourceDialect={forge.sourceDialect} setSourceDialect={forge.setSourceDialect}
              explainChanges={forge.explainChanges} setExplainChanges={forge.setExplainChanges}
              schema={forge.schema}
              handleSchemaChange={forge.handleSchemaChange}
              handleCopySchema={forge.handleCopySchema}
              handleClearSchema={forge.handleClearSchema}
              showSchema={forge.showSchema} setShowSchema={forge.setShowSchema}
              workspaces={forge.workspaces}
              activeWorkspace={forge.activeWorkspace}
              switchWorkspace={forge.switchWorkspace}
              openWorkspaceModal={forge.openWorkspaceModal}
              deleteWorkspace={forge.deleteWorkspace}
              handleFileUpload={forge.handleFileUpload}
              mockLoading={forge.mockLoading}
              handleGenerateMockData={forge.handleGenerateMockData}
              loading={forge.loading}
              handleGenerate={forge.handleGenerate}
              clearInputs={forge.clearInputs}
            />

            <SqlBuilderOutput
              activeMode={forge.activeMode}
              input={forge.input}
              outputCode={forge.outputCode}
              targetDialect={forge.targetDialect}
              explanation={forge.explanation}
              warnings={forge.warnings}
              recommendedIndexes={forge.recommendedIndexes}
              loading={forge.loading}
              mockLoading={forge.mockLoading}
              isSandboxRunning={forge.isSandboxRunning}
              isDarkTheme={isDarkTheme}
              runSandbox={forge.runSandbox}
              handleFormatCode={forge.handleFormatCode}
            />
          </div>

          {forge.outputCode && (
            <TestRunner
              panelRef={testRunnerRef}
              showTestRunner={forge.showTestRunner}
              setShowTestRunner={forge.setShowTestRunner}
              nativeEngine={forge.nativeEngine}
              targetDialect={forge.targetDialect}
              isSandboxRunning={forge.isSandboxRunning}
              isGeneratingTestData={forge.isGeneratingTestData}
              executionTime={forge.executionTime}
              autoTestData={forge.autoTestData} setAutoTestData={forge.setAutoTestData}
              testDataSQL={forge.testDataSQL} setTestDataSQL={forge.setTestDataSQL}
              showTestDataPreview={forge.showTestDataPreview}
              setShowTestDataPreview={forge.setShowTestDataPreview}
              sandboxResults={forge.sandboxResults}
              sandboxError={forge.sandboxError}
              simulationNote={forge.simulationNote}
              isSimulated={forge.isSimulated}
              runSandbox={forge.runSandbox}
              generateTestData={forge.generateTestData}
              clearTestData={forge.clearTestData}
              exportResultsAsCSV={forge.exportResultsAsCSV}
            />
          )}
        </>
      ) : (
        <div className="s-panel s-erd-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <ErdDiagram tables={erdData.tables} relationships={erdData.relationships} />
        </div>
      )}

      <WorkspaceModal
        isOpen={forge.isWorkspaceModalOpen}
        newWorkspaceName={forge.newWorkspaceName}
        setNewWorkspaceName={forge.setNewWorkspaceName}
        onConfirm={forge.confirmCreateWorkspace}
        onClose={forge.closeWorkspaceModal}
      />
    </div>
  );
}
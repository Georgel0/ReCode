'use client';

import { useEffect, useRef } from 'react';
import { ModuleHeader } from '@/components/layout';
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

  // Scroll to test runner when it opens
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
    <div className="module-container">
      <ModuleHeader
        title="SQL Builder"
        description="Generate, convert, execute, and optimize SQL queries for any dialect."
        resultData={forge.lastResult}
      />

      <div className="tabs-container">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`tab-btn ${forge.activeMode === m.id ? 'active' : ''}`}
            onClick={() => forge.setActiveMode(m.id)}
          >
            <i className={`fa-solid ${m.icon}`}></i> {m.label}
          </button>
        ))}
      </div>

      <div className="converter-grid">
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
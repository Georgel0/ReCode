'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { ModuleHeader } from '@/components/layout';
import { ErdDiagram } from '@/components/ui';
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
import '@/styles/ErdDiagram.css';

function splitByTopLevelCommas(str) {
  const result = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;

    if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) result.push(current);
  return result;
}

function parseSchemaToErd(schemaSql) {
  if (!schemaSql) return { tables: [], relationships: [] };
  const tables = [];
  const relationships = [];

  try {
    // Strip out standard SQL comments
    const noComments = schemaSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Chunk statements by "CREATE TABLE"
    const tableChunks = noComments.split(/(?=CREATE\s+TABLE)/i).filter(c => /CREATE\s+TABLE/i.test(c));

    tableChunks.forEach(chunk => {
      // Extract the table name and the body inside the parentheses
      const match = chunk.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s*\(([\s\S]*)\)/i);
      if (!match) return;

      const tableName = match[1].replace(/["']/g, '').split('.').pop();
      const body = match[2];

      const lines = splitByTopLevelCommas(body);
      const rowsObj = {};

      lines.forEach(line => {
        const l = line.trim();
        if (!l) return;

        // Extract Explicit Table-Level Foreign Keys
        const fkMatch = l.match(/FOREIGN\s+KEY\s*\(([a-zA-Z0-9_"]+)\)\s*REFERENCES\s*([a-zA-Z0-9_".]+)/i);
        if (fkMatch) {
          relationships.push({
            fromTable: tableName,
            fromCol: fkMatch[1].replace(/["']/g, ''),
            toTable: fkMatch[2].replace(/["']/g, '').split('.').pop()
          });
          return;
        }

        // Ignore generic constraints/indexes logic
        if (/^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|INDEX|KEY)/i.test(l)) {
          const constraintFkMatch = l.match(/FOREIGN\s+KEY\s*\(([a-zA-Z0-9_"]+)\)\s*REFERENCES\s*([a-zA-Z0-9_".]+)/i);
          if (constraintFkMatch) {
            relationships.push({
              fromTable: tableName,
              fromCol: constraintFkMatch[1].replace(/["']/g, ''),
              toTable: constraintFkMatch[2].replace(/["']/g, '').split('.').pop()
            });
          }
          return;
        }

        // Extract Inline Column-Level Foreign Keys (Don't return, let it parse column details below!)
        const inlineFkMatch = l.match(/^([a-zA-Z0-9_"]+)\s+[\s\S]*?\s+REFERENCES\s+([a-zA-Z0-9_".]+)/i);
        if (inlineFkMatch) {
          relationships.push({
            fromTable: tableName,
            fromCol: inlineFkMatch[1].replace(/["']/g, ''),
            toTable: inlineFkMatch[2].replace(/["']/g, '').split('.').pop()
          });
        }

        // Standard column definition handling
        const parts = l.split(/\s+/);
        if (parts.length >= 2) {
          const colName = parts[0].replace(/["']/g, '');
          const colType = parts[1].toUpperCase();

          let sampleVal = 'text';
          if (colType.includes('INT') || colType.includes('SERIAL')) sampleVal = 1;
          else if (colType.includes('FLOAT') || colType.includes('DECIMAL') || colType.includes('NUMERIC')) sampleVal = 1.1;
          else if (colType.includes('BOOL')) sampleVal = 'true';
          else if (colType.includes('DATE') || colType.includes('TIME') || colType.includes('TIMESTAMP')) sampleVal = '2023-01-01';
          else if (colType.includes('UUID')) sampleVal = '123e4567-e89b-12d3-a456-426614174000';

          rowsObj[colName] = sampleVal;
        }
      });

      tables.push({ tableName, rows: [rowsObj] });
    });
  } catch (e) {
    console.error("Schema parse error:", e);
  }

  return { tables, relationships };
}

export default function SqlBuilder() {
  const { currentTheme } = useTheme();
  const isDarkTheme = ['recode-dark', 'midnight-gold', 'deep-sea'].includes(currentTheme);
  const testRunnerRef = useRef(null);

  const forge = useSqlForge();

  const [viewMode, setViewMode] = useState('query');

  const erdData = useMemo(() => parseSchemaToErd(forge.schema), [forge.schema]);
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
            className={`tab-btn ${viewMode === 'query' && forge.activeMode === m.id ? 'active' : ''}`}
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
            className={`tab-btn ${viewMode === 'erd' ? 'active' : ''}`}
            onClick={() => setViewMode('erd')}
          >
            <i className="fa-solid fa-project-diagram"></i> ER Diagram
          </button>
        )}
      </div>

      {viewMode === 'query' ? (
        <>
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
        </>
      ) : (
        <div className="panel erd-panel" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
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
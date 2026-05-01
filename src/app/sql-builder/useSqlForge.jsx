'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { format } from 'sql-formatter';
import { toast } from 'sonner';

export function useSqlForge() {
 const { moduleData, qualityMode } = useApp();
 
 const [activeMode, setActiveMode] = useState('builder');
 const [input, setInput] = useState('');
 
 const [workspaces, setWorkspaces] = useState({ 'Default Project': '' });
 const [activeWorkspace, setActiveWorkspace] = useState('Default Project');
 const [schema, setSchema] = useState('');
 const [showSchema, setShowSchema] = useState(false);
 
 const [targetDialect, setTargetDialect] = useState('Standard SQL');
 const [sourceDialect, setSourceDialect] = useState('MySQL');
 const [explainChanges, setExplainChanges] = useState(true);
 
 const [outputCode, setOutputCode] = useState('');
 const [explanation, setExplanation] = useState('');
 const [warnings, setWarnings] = useState([]);
 const [recommendedIndexes, setRecommendedIndexes] = useState([]);
 const [loading, setLoading] = useState(false);
 const [mockLoading, setMockLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);

 const [sandboxResults, setSandboxResults] = useState(null);
 const [sandboxError, setSandboxError] = useState(null);
 const [isSandboxRunning, setIsSandboxRunning] = useState(false);

 const getFormatterDialect = (dialectName) => {
  const map = {
   'MySQL': 'mysql',
   'PostgreSQL': 'postgresql',
   'SQLite': 'sqlite',
   'SQL Server': 'tsql',
   'Oracle': 'plsql',
   'Snowflake': 'snowflake',
   'BigQuery': 'bigquery',
   'Redshift': 'redshift'
  };
  return map[dialectName] || 'sql';
 };
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'sql') {
   setInput(moduleData.input || '');
   setOutputCode(moduleData.fullOutput?.query || moduleData.fullOutput?.convertedCode || '');
   if (moduleData.targetLang) setTargetDialect(moduleData.targetLang);
   if (moduleData.mode) setActiveMode(moduleData.mode);
  }
 }, [moduleData]);

 useEffect(() => {
  const savedWorkspaces = localStorage.getItem('sqlForge_workspaces');
  if (savedWorkspaces) {
   const parsed = JSON.parse(savedWorkspaces);
   setWorkspaces(parsed);
   const firstKey = Object.keys(parsed)[0];
   setActiveWorkspace(firstKey);
   setSchema(parsed[firstKey]);
  }
 }, []);

 const handleSchemaChange = (val) => {
  setSchema(val);
  const updatedWorkspaces = { ...workspaces, [activeWorkspace]: val };
  setWorkspaces(updatedWorkspaces);
  localStorage.setItem('sqlForge_workspaces', JSON.stringify(updatedWorkspaces));
 };

 const switchWorkspace = (name) => {
  setActiveWorkspace(name);
  setSchema(workspaces[name]);
 };

 const createWorkspace = () => {
  const name = prompt("Enter a name for the new workspace:");
  if (name && !workspaces[name]) {
   const updated = { ...workspaces, [name]: '' };
   setWorkspaces(updated);
   setActiveWorkspace(name);
   setSchema('');
   localStorage.setItem('sqlForge_workspaces', JSON.stringify(updated));
   toast.success(`Workspace "${name}" created.`);
  }
 };
 
 const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
   handleSchemaChange(evt.target.result);
   toast.success("Schema successfully extracted from file!");
   setShowSchema(true);
  };
  reader.onerror = () => toast.error("Failed to read the file.");
  reader.readAsText(file);
 };

 const handleFormatCode = () => {
  if (!outputCode) return;
  try {
   const formatted = format(outputCode, { language: getFormatterDialect(targetDialect) });
   setOutputCode(formatted);
   toast.success("SQL Formatted!");
  } catch (err) {
   toast.error("Could not format this SQL dialect perfectly.");
  }
 };

 const handleGenerate = async () => {
  if (!input.trim()) {
   toast.error("Please provide an input requirement or query.");
   return;
  }
  
  setLoading(true);
  setOutputCode('');
  setExplanation('');
  setWarnings([]);
  setRecommendedIndexes([]);
  setLastResult(false);
  setSandboxResults(null);
  setSandboxError(null);

  try {
   const requestBody = {
    targetLang: targetDialect,
    sourceLang: sourceDialect,
    mode: activeMode,
    schema,
    explainChanges,
    qualityMode
   };
   const result = await convertCode('sql', input, requestBody);
   
   if (result && (result.query || result.convertedCode)) {
    setOutputCode(result.query || result.convertedCode);
    setExplanation(result.explanation || '');
    setWarnings(result.warnings || []);
    setRecommendedIndexes(result.recommendedIndexes || []);
    
    setLastResult({ type: "sql", mode: activeMode, input, output: result });
    toast.success("Query generated successfully!");
   } else {
    throw new Error("Unexpected response structure from AI.");
   }
  } catch (error) {
   toast.error(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };

 const handleGenerateMockData = async () => {
  if (!schema.trim()) {
   toast.error("Please provide a schema first to generate mock data.");
   return;
  }
  setMockLoading(true);
  
  try {
   const requestBody = { targetLang: targetDialect, mode: 'mock', schema, qualityMode };
   const result = await convertCode('sql', 'Generate mock data', requestBody);
   
   if (result && result.query) {
    const updatedSchema = `${schema}\n\n-- Mock Data\n${result.query}`;
    handleSchemaChange(updatedSchema);
    toast.success("Mock data appended to schema successfully!");
   }
  } catch (error) {
   toast.error(`Mock Data generation failed: ${error.message}`);
  }
  setMockLoading(false);
 };

 const runSandbox = async () => {
    if (!outputCode.trim()) {
      toast.error("Generate a query first before running.");
      return;
    }
    
    setIsSandboxRunning(true);
    setSandboxError(null);
    setSandboxResults(null);

    try {
      // Dynamically import sql.js to prevent SSR issues in Next.js
      const initSqlJsModule = (await import('sql.js')).default;
      const SQL = await initSqlJsModule({
        // Use CDN to easily grab the wasm file without Webpack headaches
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });
      
      const db = new SQL.Database();

      if (schema.trim()) {
        try {
          db.run(schema);
        } catch (schemaErr) {
          throw new Error(`Schema/Mock Data Error: ${schemaErr.message}`);
        }
      }

      const res = db.exec(outputCode);

      if (res && res.length > 0) {
        setSandboxResults(res[0]); // Returns { columns: [...], values: [[...]] }
      } else {
        setSandboxResults({ columns: [], values: [], message: 'Query executed successfully but returned 0 rows.' });
      }
      toast.success("Query executed in sandbox!");

    } catch (err) {
      setSandboxError(err.message);
      toast.error("Execution failed.");
    } finally {
      setIsSandboxRunning(false);
    }
 };
 
 const clearInputs = () => {
  setInput('');
  setOutputCode('');
  setExplanation('');
  setWarnings([]);
  setRecommendedIndexes([]);
  setSandboxResults(null);
  setSandboxError(null);
 };

 return {
  activeMode, setActiveMode,
  input, setInput,
  schema, handleSchemaChange,
  showSchema, setShowSchema,
  workspaces, activeWorkspace, switchWorkspace, createWorkspace,
  targetDialect, setTargetDialect,
  sourceDialect, setSourceDialect,
  explainChanges, setExplainChanges,
  outputCode, setOutputCode,
  explanation, warnings, recommendedIndexes,
  loading, mockLoading, lastResult,
  sandboxResults, setSandboxResults, sandboxError, isSandboxRunning,
  handleGenerate, handleGenerateMockData, clearInputs,
  handleFileUpload, handleFormatCode, runSandbox
 };
}

export const DIALECTS = [
 { value: 'Standard SQL', label: 'Standard SQL' },
 { value: 'PostgreSQL', label: 'PostgreSQL' },
 { value: 'MySQL', label: 'MySQL' },
 { value: 'SQLite', label: 'SQLite' },
 { value: 'SQL Server', label: 'SQL Server (T-SQL)' },
 { value: 'Oracle', label: 'Oracle PL/SQL' },
 { value: 'Snowflake', label: 'Snowflake' },
 { value: 'BigQuery', label: 'Google BigQuery' },
 { value: 'Redshift', label: 'AWS Redshift' },
];

export const MODES = [
 { id: 'builder', label: 'Builder', icon: 'fa-wand-magic-sparkles' },
 { id: 'converter', label: 'Converter', icon: 'fa-right-left' },
 { id: 'optimizer', label: 'Optimizer', icon: 'fa-gauge-high' },
];
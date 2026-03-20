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
 const [schema, setSchema] = useState('');
 const [showSchema, setShowSchema] = useState(false);
 const [targetDialect, setTargetDialect] = useState('Standard SQL');
 const [sourceDialect, setSourceDialect] = useState('MySQL');
 const [explainChanges, setExplainChanges] = useState(true);
 
 const [outputCode, setOutputCode] = useState('');
 const [explanation, setExplanation] = useState('');
 const [loading, setLoading] = useState(false);
 const [lastResult, setLastResult] = useState(false);
 
 useEffect(() => {
  if (moduleData && moduleData.type === 'sql') {
   setInput(moduleData.input || '');
   setOutputCode(moduleData.fullOutput?.query || moduleData.fullOutput?.convertedCode || '');
   if (moduleData.targetLang) setTargetDialect(moduleData.targetLang);
   if (moduleData.mode) setActiveMode(moduleData.mode);
  }
 }, [moduleData]);
 
 useEffect(() => {
  const savedSchema = localStorage.getItem('sqlForge_schema');
  if (savedSchema) setSchema(savedSchema);
 }, []);
 
 const handleSchemaChange = (val) => {
  setSchema(val);
  localStorage.setItem('sqlForge_schema', val);
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
   // Map display dialects to sql-formatter dialects if needed
   const formatted = format(outputCode, { language: 'postgresql' });
   
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
  setLastResult(false);
  
  try {
   let fullPrompt = '';
   
   if (activeMode === 'builder') {
    fullPrompt = `Generate a ${targetDialect} query based on this requirement: "${input}".\n`;
    
    if (schema) fullPrompt += `Use this Database Schema strictly: ${schema}`;
    
   } else if (activeMode === 'converter') {
    fullPrompt = `Convert the following ${sourceDialect} query to ${targetDialect}.\nOriginal SQL:\n${input}`;
    
   } else if (activeMode === 'optimizer') {
    fullPrompt = `Analyze and optimize this ${targetDialect} query for performance.\nQuery:\n${input}`;
    
    if (schema) fullPrompt += `\nSchema Context: ${schema}`;
    
    if (explainChanges) fullPrompt += `\nProvide an explanation plan detailing exactly why specific indexes or joins were restructured.`;
   }
   
   const result = await convertCode('sql', fullPrompt, { targetLang: targetDialect, qualityMode });
   
   // Expected result based on updated prompts.js (JSON object)
   if (result && (result.query || result.convertedCode)) {
    const finalCode = result.query || result.convertedCode;
    setOutputCode(finalCode);
    if (result.explanation) setExplanation(result.explanation);
    
    setLastResult({
     type: "sql",
     mode: activeMode,
     input: input,
     output: result
    });
    toast.success("Query generated successfully!");
   } else {
    throw new Error("Unexpected response structure from AI.");
   }
  } catch (error) {
   toast.error(`Generation failed: ${error.message}`);
  }
  setLoading(false);
 };
 
 const clearInputs = () => {
  setInput('');
  setOutputCode('');
  setExplanation('');
 };
 
 return {
  activeMode,
  setActiveMode,
  input,
  setInput,
  schema,
  handleSchemaChange,
  showSchema,
  setShowSchema,
  targetDialect,
  setTargetDialect,
  sourceDialect,
  setSourceDialect,
  explainChanges,
  setExplainChanges,
  outputCode,
  setOutputCode,
  explanation,
  loading,
  lastResult,
  handleGenerate,
  clearInputs,
  handleFileUpload,
  handleFormatCode
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
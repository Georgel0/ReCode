'use client';

import { useState, useEffect } from 'react';
import { convertCode } from '@/lib';
import { useApp } from '@/context';
import { format } from 'sql-formatter';
import { toast } from 'sonner';
import { useWorkspace } from './useWorkspace';
import { useSandbox } from './useSandbox';
import { getFormatterDialect } from '../components/sqlForgeConstants';

export function useSqlForge() {
  const { moduleData, qualityMode } = useApp();

  const [activeMode, setActiveMode] = useState('builder');
  const [input, setInput] = useState('');
  const [targetDialect, setTargetDialect] = useState('Standard SQL');
  const [sourceDialect, setSourceDialect] = useState('MySQL');
  const [explainChanges, setExplainChanges] = useState(true);

  const [outputCode, setOutputCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [recommendedIndexes, setRecommendedIndexes] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const workspace = useWorkspace();
  const sandbox = useSandbox({
    outputCode,
    schema: workspace.schema,
    targetDialect,
  });

  // Sync module data when opened from elsewhere in the app

  useEffect(() => {
    if (moduleData?.type === 'sql') {
      setInput(moduleData.input || '');
      setOutputCode(moduleData.fullOutput?.query
        || moduleData.fullOutput?.convertedCode || '');
      if (moduleData.targetLang) setTargetDialect(moduleData.targetLang);
      if (moduleData.mode) setActiveMode(moduleData.mode);
    } else if (moduleData === null) {
      setInput('');
      setOutputCode('');
    }
  }, [moduleData]);

  const handleGenerate = async () => {
    if (!input.trim()) { toast.error('Please enter a requirement or query.'); return; }

    setLoading(true);
    setOutputCode('');
    setExplanation('');
    setWarnings([]);
    setRecommendedIndexes([]);
    setLastResult(null);
    sandbox.resetSandboxState();

    try {
      const result = await convertCode('sql', input, {
        targetLang: targetDialect,
        sourceLang: sourceDialect,
        mode: activeMode,
        schema: workspace.schema,
        explainChanges,
        qualityMode,
      });

      const query = result?.query || result?.convertedCode;
      if (!query) throw new Error('Unexpected response structure from AI.');

      setOutputCode(query);
      setExplanation(result.explanation || '');
      setWarnings(result.warnings || []);
      setRecommendedIndexes(result.recommendedIndexes || []);
      setLastResult({ type: 'sql', mode: activeMode, input, output: result });

      toast.success('Query generated!');
    } catch (err) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormatCode = () => {
    if (!outputCode) return;
    try {
      const formatted = format(outputCode, { language: getFormatterDialect(targetDialect) });
      setOutputCode(formatted);
      toast.success('SQL formatted!');
    } catch {
      toast.error('Could not format this SQL dialect.');
    }
  };

  const clearInputs = () => {
    setInput('');
    setOutputCode('');
    setExplanation('');
    setWarnings([]);
    setRecommendedIndexes([]);
    setLastResult(null);
    sandbox.resetSandbox();
  };

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
        const headerMatch = chunk.match(
          /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_".]+)\s*\(/i
        );
        if (!headerMatch) return;

        const tableName = headerMatch[1].replace(/["']/g, '').split('.').pop();
        const startIdx = headerMatch.index + headerMatch[0].length;
        let depth = 1, i = startIdx;

        while (i < chunk.length && depth > 0) {
          if (chunk[i] === '(') depth++;
          else if (chunk[i] === ')') depth--;
          i++;
        }
        const body = chunk.slice(startIdx, i - 1);

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

  return {
    // Mode & input
    activeMode, setActiveMode,
    input, setInput,
    targetDialect, setTargetDialect,
    sourceDialect, setSourceDialect,
    explainChanges, setExplainChanges,

    // Output
    outputCode, setOutputCode,
    explanation, warnings, recommendedIndexes,
    lastResult,

    // Loading
    loading,

    // Actions
    handleGenerate,
    handleFormatCode,
    clearInputs,
    parseSchemaToErd,

    ...workspace,
    ...sandbox,
  };
}
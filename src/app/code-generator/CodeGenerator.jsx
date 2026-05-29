'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context';
import { ModuleHeader } from '@/components/layout';
import ConfigTab from './ConfigTab';
import OutputPanel from './OutputPanel';
import { generateProjectFiles } from './utils';
import './CodeGenerator.css';

export default function CodeGenerator() {
  const { moduleData, qualityMode } = useApp();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [lastResult, setLastResult] = useState(null);

  const [config, setConfig] = useState({
    language: 'Auto-Detect / Any',
    framework: 'None (Vanilla)',
    architecture: 'Standard / Minimal',
    verbosity: 'production',
    includeReadme: true,
    includeDocs: false,
    includeTests: false,
    customStack: ''
  });

  useEffect(() => {
    if (moduleData && moduleData.type === 'generator') {
      setInput(moduleData.input || '');
      setFiles(moduleData.fullOutput?.files || []);
      setActiveFileIndex(0);
    }
  }, [moduleData]);

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setFiles([]);
    setLastResult(null);

    try {
      const result = await generateProjectFiles(input, config, { qualityMode });

      if (result && result.files) {
        setFiles(result.files);
        setActiveFileIndex(0);
        setLastResult({
          type: 'generator',
          input,
          output: result
        });
      } else {
        throw new Error('Invalid response format from AI.');
      }
    } catch (err) {
      setError(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setInput('');
    setFiles([]);
    setActiveFileIndex(0);
    setError('');
  };

  return (
    <div className="module-container">
      <ModuleHeader
        title="Code Generator"
        description="Scaffold multi-file solutions from a plain-English description."
        resultData={lastResult}
      />

      <div className="generator-layout">
        <aside className="generator-sidebar">
          <section className="sidebar-section">
            <h3 className="sidebar-heading">
              <i className="fa-solid fa-layer-group"></i>
              Requirements
            </h3>
            <textarea
              className="sidebar-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Create a React button component and a CSS file for styling..."
              spellCheck="true"
            />
            {error && <div className="error-message sidebar-error">{error}</div>}
            <div className="sidebar-actions">
              <button className="secondary-button" onClick={handleClearAll}>
                Clear
              </button>
              <button
                className="primary-button"
                onClick={handleGenerate}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <><span className="spinner button-spinner"></span> Building...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate</>
                )}
              </button>
            </div>
          </section>

          <div className="sidebar-divider" />

          <section className="sidebar-section sidebar-config">
            <ConfigTab config={config} setConfig={setConfig} />
          </section>
        </aside>

        <main className="generator-output">
          <OutputPanel
            files={files}
            activeFileIndex={activeFileIndex}
            setActiveFileIndex={setActiveFileIndex}
            loading={loading}
          />
        </main>
      </div>
    </div>
  );
}
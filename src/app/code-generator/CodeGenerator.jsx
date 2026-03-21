'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context';
import { ModuleHeader } from '@/components/layout';
import ConfigTab from './ConfigTab';
import GeneratorTab from './GeneratorTab';
import { generateProjectFiles } from './utils';
import './generator.css';

export default function CodeGenerator() {
 const { moduleData, qualityMode } = useApp();
 
 const [activeTab, setActiveTab] = useState('generator');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 
 const [input, setInput] = useState('');
 const [files, setFiles] = useState([]);
 const [activeFileIndex, setActiveFileIndex] = useState(0);
 const [lastResult, setLastResult] = useState(null);
 
 const [config, setConfig] = useState({
  typescript: true,
  styling: 'Tailwind CSS',
  stateManagement: 'None (Local State Only)',
  verbosity: 'production',
  includeReadme: true,
  includeJSDoc: false,
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
   // Logic abstracted to utility file
   const result = await generateProjectFiles(input, config, { qualityMode });
   
   if (result && result.files) {
    setFiles(result.files);
    setActiveFileIndex(0);
    setLastResult({
     type: 'generator',
     input: input,
     output: result
    });
    // Switch back to generator tab to see results if they were in config
    setActiveTab('generator');
   } else {
    throw new Error("Invalid response format from AI.");
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
        description="Scaffold multi-file solutions. Tweak your stack in the Config tab."
        resultData={lastResult}
      />

      <div className="tabs-container main-module-tabs">
        <button 
          className={`tab-btn ${activeTab === 'generator' ? 'active' : ''}`}
          onClick={() => setActiveTab('generator')}
        >
          <i className="fa-solid fa-pen-nib"></i> Editor & Output
        </button>
        <button 
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <i className="fa-solid fa-sliders"></i> Configuration
        </button>
      </div>

      <div className="tab-content-wrapper">
        {activeTab === 'generator' ? (
          <GeneratorTab 
            input={input}
            setInput={setInput}
            files={files}
            activeFileIndex={activeFileIndex}
            setActiveFileIndex={setActiveFileIndex}
            loading={loading}
            error={error}
            handleGenerate={handleGenerate}
            handleClearAll={handleClearAll}
          />
        ) : (
          <ConfigTab config={config} setConfig={setConfig} />
        )}
      </div>
    </div>
 );
}
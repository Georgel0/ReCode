import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTheme } from './components/ThemeContext';
import { initializeAuth, cleanupOldHistory } from './services/firebase';
import { SpeedInsights } from "@vercel/speed-insights/react";

import './styles/Components.css';
import './styles/Sidebar.css';
import './styles/Modules.css';

import Notification from './components/Notification';
import Sidebar from './components/Sidebar';
import ModelSelector from './components/ModelSelector';

import CodeConverter from './modules/CodeConverter';
import CodeAnalysis from './modules/CodeAnalysis';
import CodeGenerator from './modules/CodeGenerator';
import RegexGenerator from './modules/RegexGenerator';
import SqlBuilder from './modules/SqlBuilder';
import JsonFormatter from './modules/JsonFormatter';
import CodeRefactor from './modules/CodeRefactor';
import CssFrameworkConverter from './modules/CssFrameworkConverter';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moduleData, setModuleData] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState(null);
  const { currentTheme } = useTheme();
  const [activeModule, setActiveModule] = 
    useState(() => {
      return localStorage.getItem('recode_active_module') || 'converter';
  });
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [quailtyMode, setQualityMode] = useState(() => {
    return localStorage.getItem('recode_quality_mode') || null;
  });
  
  useEffect(() => {
    const savedMode = localStorage.getItem('recode_quality_mode');
    !savedMode ? setShowModelSelector(true) : setQualityMode(savedMode);
  }, []);
  
  useEffect(() => {
    localStorage.setItem('recode_active_module', activeModule);
  }, [activeModule]);
  
  const metaMap = {
    'converter': { title: 'Code Converter | ReCode', desc: 'Convert code between many languages with AI.' },
    'refactor': { title: 'Code Refactorer | ReCode', desc: 'Optimize and clean your code using AI.' },
    'analysis': { title: 'Code Analysis | ReCode', desc: 'Detect bugs and security issues in your code.' },
    'css-tailwind': { title: 'Tailwind/CSS Converter | ReCode', desc: 'Convert CSS frameworks to Tailwind instantly.' },
    'generator': { title: 'Code Generator | ReCode', desc: 'Generate boilerplate and logic from prompts.' },
    'regex': { title: 'Regex Generator | ReCode', desc: 'Create and test complex regular expressions with ease.' },
    'sql': { title: 'SQL Builder | ReCode', desc: 'Build and optimize SQL queries using AI.' },
    'json': { title: 'JSON Formatter | ReCode', desc: 'Prettify and validate JSON data.' }
  };
  
  const currentMeta = metaMap[activeModule] || metaMap['converter'];
  
  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(`theme-${currentTheme}`);
  }, [currentTheme]);
  
  useEffect(() => {
  const setupApp = async () => {
    try {
      const user = await initializeAuth();
      if (user) cleanupOldHistory();
    } catch (error) {
      console.error("Initialization failed", error);
    } 
  };
  setupApp();
}, []);
  
  const handleModelSelect = (mode) => {
    setQualityMode(mode);
    localStorage.setItem('recode_quality_mode', mode);
    setShowModelSelector(false);
    
    setNotificationMessage(`Switched to ${mode === 'fast' ? 'Fast Response' : 'Quality Response'} Mode`);
  };
  
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  const handleModuleSwitch = (moduleName, data = null) => {
    setActiveModule(moduleName);
    setModuleData(data);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };
  
  const loadFromHistory = (historyItem) => {
    let targetModule;
    
    switch (historyItem.type) {
      case 'css-framework':
      case 'css-tailwind':
        targetModule = 'css-tailwind';
        break;
      case 'refactor':
      case 'analysis':
      case 'generator':
      case 'regex':
      case 'sql':
      case 'json':
        targetModule = historyItem.type;
        break;
      default:
        targetModule = 'converter';
    }
    
    handleModuleSwitch(targetModule, historyItem);
    setNotificationMessage(`History loaded: ${historyItem.type} conversion.`);
  };
  
  const renderModule = () => {
    const commonProps = {
      onLoadData: moduleData,
      onSwitchModule: handleModuleSwitch,
      quailtyMode: qualityMode || 'fast'
    };
    
    switch (activeModule) {
      case 'converter':
        return <CodeConverter {...commonProps} />;
      case 'refactor':
        return <CodeRefactor {...commonProps} />;
      case 'analysis':
        return <CodeAnalysis {...commonProps} />;
      case 'css-tailwind':
        return <CssFrameworkConverter {...commonProps} preSetTarget="tailwind" />;
      case 'generator':
        return <CodeGenerator {...commonProps} />;
      case 'regex':
        return <RegexGenerator {...commonProps} />;
      case 'sql':
        return <SqlBuilder {...commonProps} />;
      case 'json':
        return <JsonFormatter {...commonProps} />;
      default:
        return <CodeConverter {...commonProps} />;
    }
  };
  
  return (
    <div className='container'>
      <Helmet>
        <title>{currentMeta.title}</title>
        <meta name="description" content={currentMeta.desc} />
        <meta property="og:title" content={currentMeta.title} />
        <meta property="og:description" content={currentMeta.desc} />
      </Helmet>
      
      <ModelSelector
        isOpen={showModelSelector}
        onSelect={handleModelSelect}
        onClose={qualityMode ? () => setShowModelSelector(false) : null}
      />

      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={(mod) => handleModuleSwitch(mod, null)} 
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        loadFromHistory={loadFromHistory}
        openModelSelector={() => setShowModelSelector}
      />
      
      <main className="main-content">
        <div className="mobile-header"> 
           <button className="sidebar-toggle" onClick={toggleSidebar}>
              ☰
           </button>
        <div className="logo-group">
          <div className="logo-image" />
          <span>ReCode</span>
        </div>
      </div>
      
      {renderModule()}
      </main>
      
      <Notification message={notificationMessage} />
      <SpeedInsights />
    </div>
  );
}

export default App;
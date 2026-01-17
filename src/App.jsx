import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTheme } from './components/ThemeContext';
import { initializeAuth } from './services/firebase';

import './styles/Components.css';
import './styles/Sidebar.css';
import './styles/Modules.css';

import Notification from './components/Notification';
import Sidebar from './components/Sidebar';

import CodeConverter from './modules/CodeConverter';
import CodeAnalysis from './modules/CodeAnalysis';
import CodeGenerator from './modules/CodeGenerator';
import RegexGenerator from './modules/RegexGenerator';
import SqlBuilder from './modules/SqlBuilder';
import JsonFormatter from './modules/JsonFormatter';
import CodeRefactor from './modules/CodeRefactor';
import CssFrameworkConverter from './modules/CssFrameworkConverter';

function App() {
  const [activeModule, setActiveModule] = useState('converter');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moduleData, setModuleData] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState(null);
  const { currentTheme } = useTheme();
  
  const metaMap = {
    'converter': { title: 'Code Converter | ReCode', desc: 'Convert code between any language with AI.' },
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
    initializeAuth();
  }, []);
  
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
    switch (activeModule) {
      case 'converter':
        return <CodeConverter onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'refactor':
        return <CodeRefactor onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'analysis':
        return <CodeAnalysis onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'css-tailwind':
        return <CssFrameworkConverter onLoadData={moduleData} preSetTarget="tailwind" onSwitchModule={handleModuleSwitch} />;
      case 'generator':
        return <CodeGenerator onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'regex':
        return <RegexGenerator onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'sql':
        return <SqlBuilder onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      case 'json':
        return <JsonFormatter onLoadData={moduleData} onSwitchModule={handleModuleSwitch} />;
      default:
        return <CodeConverter />;
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

      <Sidebar 
        activeModule={activeModule} 
        setActiveModule={(mod) => handleModuleSwitch(mod, null)} 
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        loadFromHistory={loadFromHistory}
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
    </div>
  );
}

export default App;
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(`theme-${currentTheme}`);
  }, [currentTheme]);

  useEffect(() => {
    initializeAuth();
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Unified function to switch modules and pass data
  const handleModuleSwitch = (moduleName, data = null) => {
    setActiveModule(moduleName);
    setModuleData(data);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };
  
  const loadFromHistory = (historyItem) => {
    let targetModule = 'converter';
    if (historyItem.type === 'css-framework' || historyItem.type === 'css-tailwind') {
        targetModule = 'css-tailwind';
    } else if (historyItem.type === 'refactor') {
      targetModule = 'refactor';
    } else if (historyItem.type === 'analysis') {
        targetModule = 'analysis';
    } else if (historyItem.type === 'generator') {
        targetModule = 'generator';
    } else if (historyItem.type === 'regex') {
        targetModule = 'regex';
    } else if (historyItem.type === 'sql') {
        targetModule = 'sql';
    } else if (historyItem.type === 'json') {
        targetModule = 'json';
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
        return <CssFrameworkConverter 
                  onLoadData={moduleData} 
                  preSetTarget="tailwind" 
                  onSwitchModule={handleModuleSwitch} 
               />;
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
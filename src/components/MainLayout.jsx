'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation'; 
import { useApp } from '../context/AppContext';
import { useTheme } from './ThemeContext';
import Sidebar from './Sidebar';
import Notification from './Notification';
import ModelSelector from './ModelSelector';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  const { qualityMode, toggleQualityMode, setModuleData } = useApp();
  const { currentTheme } = useTheme();
  
  const pathname = usePathname();
  const router = useRouter();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const loadFromHistory = (historyItem) => {
    let targetPath = '/code-converter'; 
    
    if (historyItem.type === 'sql') targetPath = '/sql-builder';
    if (historyItem.type === 'analysis') targetPath = '/code-analysis';
    if (historyItem.type === 'generator') targetPath = '/code-generator';
    if (historyItem.type === 'refactor') targetPath = '/code-refactor';
    if (historyItem.type === 'regex') targetPath = '/regex-generator';
    if (historyItem.type === 'json') targetPath = '/json-formatter';
    if (historyItem.type === 'css-tailwind' || historyItem.type === 'css-framework') targetPath = '/css-frameworks';
    
    setModuleData(historyItem); 
    setNotification(`Loaded ${historyItem.type} from history`);
    router.push(targetPath);
  };

  return (
    <div className={`app-wrapper theme-${currentTheme}`}>
      <Sidebar 
        activeModule={pathname}
        isOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        loadFromHistory={loadFromHistory}
        qualityMode={qualityMode}
        toggleQuality={toggleQualityMode}
        openModelSelector={() => setShowModelSelector(true)}
      />

      <main className="main-content">
        <div className="mobile-header"> 
           <button className="sidebar-toggle" onClick={toggleSidebar}>☰</button>
           <Link href="/" className="logo-link">
            <div className="logo-group">
              <div className="logo-image" />
              <span>ReCode</span>
            </div>
           </Link>
        </div>
        
        {children}
      </main>

      <Notification message={notification} />
      
      <ModelSelector
        isOpen={showModelSelector}
        onSelect={(mode) => {
            toggleQualityMode();
            setShowModelSelector(false);
        }}
        onClose={() => setShowModelSelector(false)}
      />
    </div>
  );
}

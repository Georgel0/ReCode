'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { useTheme } from '@/components/FunctionalComponents/ThemeContext';
import Sidebar from './Sidebar';
import Notification from './Notification';
import ModelSelector from './ModelSelector';

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); 
  const [notification, setNotification] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  const { qualityMode, setQualityMode, toggleQualityMode, setModuleData } = useApp();
  const { currentTheme } = useTheme();
  
  const pathname = usePathname();
  const router = useRouter();
  
  const isLandingPage = pathname === '/';
  
  useEffect(() => {
    if (isLandingPage) return;
    
    localStorage.setItem('recode_last_module', pathname);
      
    const hasQualityModeSet = localStorage.getItem('recode_quality_mode');
    if (!hasQualityModeSet) setShowModelSelector(true);
  }, [pathname, isLandingPage]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleDesktopCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

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
  
  const handleLaunchApp = (e) => {
    e.preventDefault();
    const lastModule = localStorage.getItem('recode_last_module');
    router.push(lastModule || '/code-converter');
  };

  return (
    <div className={`app-wrapper ${isLandingPage ? 'landing-mode' : `theme-${currentTheme}`}`}>
      
      {!isLandingPage && (
        <Sidebar 
          activeModule={pathname}
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed} 
          toggleCollapse={toggleDesktopCollapse} 
          toggleSidebar={toggleSidebar}
          loadFromHistory={loadFromHistory}
          qualityMode={qualityMode}
          toggleQuality={toggleQualityMode}
          openModelSelector={() => setShowModelSelector(true)}
        />
      )}

      <main className="main-content">
        <div className={`mobile-header ${isLandingPage ? 'landing-header' : ''}`}> 
           {isLandingPage ? (
             <>
                <Link href="/" className="logo-link">
                  <div className="logo-group">
                    <div className="logo-image" style={{ backgroundColor: '#38bdf8' }} />
                    <span style={{ color: '#fff' }}>ReCode</span>
                  </div>
                </Link>
                <Link 
                  href="/code-converter" 
                  onClick={handleLaunchApp} 
                  className="primary-button launch-app-btn">
                  Launch App
                </Link>
             </>
           ) : (
             <>
               <button className="sidebar-toggle" onClick={toggleSidebar}>☰</button>
               <Link href="/" className="logo-link">
                <div className="logo-group">
                  <div className="logo-image" />
                  <span>ReCode</span>
                </div>
               </Link>
               <div style={{ width: '24px' }}></div> 
             </>
           )}
        </div>
        
        {children}
      </main>

      <Notification message={notification} />
      
      {!isLandingPage && <ModelSelector
        currentMode={qualityMode}
        isOpen={showModelSelector}
        onSelect={(mode) => {
          setQualityMode(mode);
          setShowModelSelector(false);
        }}
        onClose={() => setShowModelSelector(false)}
      />}
    </div>
  );
}
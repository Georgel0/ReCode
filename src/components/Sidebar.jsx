'use client';

import { useState, useEffect, useRef } from 'react';
import { getHistory, deleteHistoryItem, clearAllHistory } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeContext';
import Link from 'next/link';
import About from "./About";

export default function Sidebar({ isOpen, toggleSidebar, isCollapsed, toggleCollapse, loadFromHistory, openModelSelector, qualityMode, toggleQuality }) {
  const pathname = usePathname();
  const [historyItems, setHistoryItems] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const { currentTheme, changeTheme, groupedThemes } = useTheme();
  const sidebarRef = useRef(null);
  const [autoSave, setAutoSave] = useState(() => {
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem('recode_autoSave') === 'true';
    }
    return false;
  });
  
  const refreshHistory = async () => {
    try {
      const data = await getHistory();
      setHistoryItems(data);
    } catch (error) {
      console.error("Failed to refresh history:", error);
    }
  };
  
  const toggleAutoSave = () => {
    const newState = !autoSave;
    setAutoSave(newState);
    localStorage.setItem("recode_autoSave", newState);
    
    window.dispatchEvent(new CustomEvent('recode_autoSave_changed', { detail: newState }));
  };
  
  useEffect(() => {
    if (isOpen) {
      refreshHistory();
    }
  }, [isOpen, pathname]);
  
  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        toggleSidebar();
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, toggleSidebar]);
  
  const handleDelete = async (e, itemId) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteHistoryItem(itemId);
      setHistoryItems(historyItems.filter(item => item.id !== itemId));
    } catch (error) {
      alert('Failed to delete history item.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleClearAll = async () => {
    if (historyItems.length === 0) return;
    if (window.confirm('Are you sure you want to delete all history items? This cannot be undone.')) {
      setIsDeleting(true);
      try {
        await clearAllHistory();
        setHistoryItems([]);
      } catch (error) {
        alert('Failed to clear history.');
      } finally {
        setIsDeleting(false);
      }
    }
  };
  
  const modules = [
    { id: 'converter', label: 'Code Converter', icon: 'fas fa-sync-alt', path: '/code-converter' },
    { id: 'refactor', label: 'Code Refactor', icon: 'fas fa-wand-magic-sparkles', path: '/code-refactor' },
    { id: 'analysis', label: 'Code Analyzer', icon: 'fas fa-brain', path: '/code-analysis' },
    { id: 'generator', label: 'Code Generator', icon: 'fas fa-magic', path: '/code-generator' },
    { id: 'css-tailwind', label: 'CSS Frameworks', icon: 'fas fa-swatchbook', path: '/css-frameworks' },
    { id: 'regex', label: 'Regex Generator', icon: 'fas fa-search', path: '/regex-generator' },
    { id: 'sql', label: 'SQL Builder', icon: 'fas fa-database', path: '/sql-builder' },
    { id: 'json', label: 'JSON Formatter', icon: 'fas fa-list-alt', path: '/json-formatter' },
  ];
  
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} ref={sidebarRef}>
      
      <div className="sidebar-header">
        {!isCollapsed && (
          <div className="logo-group">
            <div className="logo-image" />
            <h2>ReCode</h2>
          </div>
        )}
        
        {!isCollapsed && ( <button className="close-btn" onClick={toggleSidebar}>✕</button> )}
        
        <button className="collapse-toggle-btn desktop-only" onClick={toggleCollapse}>
          <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
        </button>
      </div>

      {!isCollapsed && (<div className="about-trigger-wrapper">
        <button 
          className={`about-toggle-btn ${showAbout ? 'active' : ''}`}
          onClick={() => setShowAbout(!showAbout)}
          title="About ReCode"
        >
          <i className={showAbout ? "fas fa-arrow-left" : "fas fa-info-circle"}></i>
          {!isCollapsed && (showAbout ? 'Back to Modules' : 'About ReCode')}
        </button>
      </div>
      )}

      <div className="sidebar-scroll-area">
        {showAbout ? (
          <About />
        ) : (
          <nav className="nav-menu">
            {!isCollapsed && <h3>Modules</h3>}
            {modules.map(module => (
              <Link
                key={module.id}
                href={module.path}
                className={`nav-item ${pathname === module.path ? 'active' : ''}`}
                title={isCollapsed ? module.label : ''}
                onClick={() => {
                  if (window.innerWidth < 768) toggleSidebar(); 
                }}
              >
                 <i className={module.icon}></i>
                 {!isCollapsed && module.label}
              </Link>
            ))}
          </nav>
        )}
        
        <div className="model-trigger-section">
          {!isCollapsed && (
          <button className="model-trigger-btn" onClick={openModelSelector}>
            <i className="fas fa-microchip"></i>
            <span>AI Model Mode</span>
            </button>
          )}
          <button className="second-model-trigger-btn" onClick={toggleQuality}>
            <div className="mode-icon-slide" key={qualityMode}>
              {qualityMode === 'fast' ? (
              <i className="fas fa-stopwatch" title="Fast Mode"></i>
              ) : (
              <i className="fas fa-gem" title="Quality Mode"></i>
              )}
            </div>
          </button>
        </div>

        
        {!isCollapsed && (
          <div className="theme-selector-section">
            <h3>Theme:</h3>
            <select value={currentTheme} onChange={(e) => changeTheme(e.target.value)} className="theme-select-dropdown">
              {Object.entries(groupedThemes).map(([group, themes]) => (
                <optgroup key={group} label={group}>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <div className="history-section">
          <div className="history-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
             {!isCollapsed ? (
                // Full Header (Text + Toggle + Clear)
                <>
                  <div className="history-sub-header">
                    <h3>History</h3>
                    <button onClick={toggleAutoSave} className={`autosave-btn ${autoSave ? "active" : ""}`} title={autoSave ? "Auto-Save ON" : "Auto-Save OFF"}>
                      <i className={`fas ${autoSave ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                    </button>
                  </div>
                  {historyItems.length > 0 && (
                    <button 
                      className="refresh-btn" 
                      onClick={handleClearAll}
                      disabled={isDeleting}
                      title="Clear All History"
                      style={{ color: 'var(--danger)' }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </>
             ) : (
                // Collapsed Header (Toggle Only)
                <button onClick={toggleAutoSave} className={`autosave-btn ${autoSave ? "active" : ""}`} title="Toggle Auto-Save">
                    <i className={`fas ${autoSave ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                </button>
             )}
          </div>
          
          {!isCollapsed && (
            <div className="history-list">
              {historyItems.length === 0 ? (
                <p className="empty-state">No history yet.</p>
              ) : (
                historyItems.map(item => (
                  <div key={item.id} className="history-card" onClick={() => loadFromHistory(item)}>
                    <div className="history-card-content">
                      <span className="history-type">
                        {item.type === 'converter' 
                          ? `${item.sourceLang?.toUpperCase()} to ${item.targetLang?.toUpperCase()}`
                          : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                      </span>
                      
                      {item.input && (
                        <span className="history-snippet">
                          {item.input.substring(0, 35)}{item.input.length > 35 ? '...' : ''}
                        </span>
                      )}

                      <span className="history-date">
                        {item.createdAt?.seconds 
                          ? new Date(item.createdAt.seconds * 1000).toLocaleString([], { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            }) 
                          : 'N/A'}
                      </span>
                    </div>
                    <button className="delete-item-btn" onClick={(e) => handleDelete(e, item.id)} disabled={isDeleting}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
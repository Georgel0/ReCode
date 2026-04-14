'use client';

import { useState, useEffect, useRef } from 'react';
import { getHistory, deleteHistoryItem, clearAllHistory, subscribeToHistory } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ui';

const modules = [
 { id: 'converter', label: 'Code Converter', icon: 'fas fa-sync-alt', path: '/code-converter' },
 { id: 'refactor', label: 'Code Refactor', icon: 'fas fa-wand-magic-sparkles', path: '/code-refactor' },
 { id: 'analysis', label: 'Code Analyzer', icon: 'fas fa-brain', path: '/code-analysis' },
 { id: 'generator', label: 'Code Generator', icon: 'fas fa-magic', path: '/code-generator' },
 { id: 'css-tailwind', label: 'CSS Frameworks', icon: 'fab fa-css3-alt', path: '/css-frameworks' },
 { id: 'regex', label: 'Regex Generator', icon: 'fas fa-search', path: '/regex-generator' },
 { id: 'sql', label: 'SQL Builder', icon: 'fas fa-database', path: '/sql-builder' },
 { id: 'json', label: 'JSON Formatter', icon: 'fas fa-list-alt', path: '/json-formatter' },
];

const qualityConfig = {
 fast: { icon: 'fa-stopwatch', title: 'Fast Mode' },
 quality: { icon: 'fa-gem', title: 'Quality Mode' },
 turbo: { icon: 'fa-bolt', title: 'Turbo Mode' },
};

export function Sidebar({ isOpen, toggleSidebar, isCollapsed, toggleCollapse, loadFromHistory, openModelSelector, qualityMode, toggleQuality }) {
 
 const pathname = usePathname();
 const { currentTheme, changeTheme, groupedThemes } = useTheme();
 const sidebarRef = useRef(null);
 
 const [historyItems, setHistoryItems] = useState([]);
 const [isDeleting, setIsDeleting] = useState(false);
 
 const [modalConfig, setModalConfig] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
  type: null // 'single' or 'all'
 });
 
 const [autoSave, setAutoSave] = useState(() => {
  if (typeof window !== 'undefined') {
   return localStorage.getItem('recode_autoSave') === 'true';
  }
  return false;
 });
 
 const current = qualityConfig[qualityMode] || qualityConfig.fast;
 
 const toggleAutoSave = () => {
  const newState = !autoSave;
  setAutoSave(newState);
  localStorage.setItem("recode_autoSave", newState);
  
  window.dispatchEvent(new CustomEvent('recode_autoSave_changed', { detail: newState }));
 };
 
 useEffect(() => {
  // Subscribe to real-time updates when the component mounts
  // This automatically handles updates, deletions, and new items
  const unsubscribe = subscribeToHistory((data) => {
   setHistoryItems(data);
  });
  
  return () => unsubscribe();
 }, []);
 
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
 
 const handleDeleteClick = (e, id) => {
  e.stopPropagation();
  setModalConfig({
   isOpen: true,
   title: 'Delete History Item?',
   message: 'This will permanently remove this item from your history. This action cannot be undone.',
   confirmText: 'Delete',
   cancelText: 'Keep it',
   icon: 'fa-trash-can',
   onConfirm: () => executeDelete(id)
  });
 };
 
 const handleClearAllClick = () => {
  setModalConfig({
   isOpen: true,
   title: 'Clear Entire History?',
   message: 'Are you sure you want to delete every item in your history? This is a permanent action.',
   confirmText: 'Clear All',
   cancelText: 'Cancel',
   icon: 'fa-fire-flame-curved',
   onConfirm: executeClearAll
  });
 };
 
 // Execution Logic
 const executeDelete = async (id) => {
  setIsDeleting(true);
  try {
   await deleteHistoryItem(id);
  } catch (err) {
   console.error("Delete failed", err);
  } finally {
   setIsDeleting(false);
   closeModal();
  }
 };
 
 const executeClearAll = async () => {
  setIsDeleting(true);
  try {
   await clearAllHistory();
  } catch (err) {
   console.error("Clear failed", err);
  } finally {
   setIsDeleting(false);
   closeModal();
  }
 };
 
 const closeModal = () => {
  setModalConfig(prev => ({ ...prev, isOpen: false }));
 };
 
 return (
  <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} ref={sidebarRef}>
      
   <div className="sidebar-header">
    {!isCollapsed && (
     <Link href="/" className="logo-link">
      <div className="logo-group">
       <div className="logo-image"/>
       <span>ReCode</span>
      </div>
     </Link>
    )}
        
    <div className="sidebar-actions">
     <button className="header-icon-btn mobile-only" onClick={toggleSidebar} title="Close Menu">
      <i className="fas fa-times"></i>
     </button>
        
     <button className="header-icon-btn desktop-only" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
      <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
     </button>
    </div>
   </div>

   <div className="sidebar-scroll-area">
    <nav className="nav-menu">
     {!isCollapsed && <h3>Modules</h3>}
      {modules.map(module => (
       <Link
        key={module.id}
        href={module.path}
        className={`nav-item ${pathname ===
        module.path ? 'active' : ''}`}
        title={isCollapsed ? module.label : ''}
        onClick={() => {
         if (window.innerWidth < 768) toggleSidebar(); 
        }} >
        <i className={module.icon}></i>
        {!isCollapsed && module.label}
       </Link>
      ))}
     </nav>
        
     <div className="model-trigger-section">
      {!isCollapsed && (
       <button className="model-trigger-btn" onClick={openModelSelector}>
        <i className="fas fa-microchip"></i>
        <span>AI Model Mode</span>
       </button>
      )}
      <button className="second-model-trigger-btn" onClick={toggleQuality}>
       <div className="mode-icon-slide" key={qualityMode}>
        <i className={`fas ${current.icon}`} title={current.title}></i>
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
          AutoSave
          <i className={`fas ${autoSave ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
         </button>
        </div>
        {historyItems.length > 0 && (
         <button 
          className="refresh-btn" 
          onClick={handleClearAllClick}
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
        <div className="empty-state">
         <i className="fas fa-ghost"></i>
         <p>No history yet.</p>
        </div>
       ) : (
        historyItems.map(item => (
         <div key={item.id} className="history-card" onClick={() => loadFromHistory(item)}>
          <div className="history-card-content">
           <span className="history-type">
            {item.type === 'converter' 
             ? `${item.sourceLang?.toUpperCase()} to ${item.targetLang?.toUpperCase()}`
             : item.type.charAt(0).toUpperCase() + item.type.slice(1)
            }
           </span>
                      
           {item.input && (
            <span className="history-snippet">
             {item.input.substring(0, 35)}{item.input.length > 35 ? '...' : ''}
            </span>
           )}

           <span className="history-date">
            {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString([], { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : 'N/A'}
           </span>
           </div>
           <button 
            className="delete-item-btn" 
            onClick={(e) => handleDeleteClick(e, item.id)}
            disabled={isDeleting}>
           <i className="fas fa-trash"></i>
          </button>
         </div>
        ))
       )}
      </div>
     )}
    </div>
   </div>
   
   <ConfirmModal 
    isOpen={modalConfig.isOpen}
    title={modalConfig.title}
    message={modalConfig.message}
    confirmText={modalConfig.confirmText}
    cancelText={modalConfig.cancelText}
    icon={modalConfig.icon}
    onConfirm={modalConfig.onConfirm}
    onCancel={closeModal}
   />
  </aside>
 );
}
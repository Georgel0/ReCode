'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getHistory,
  deleteHistoryItem,
  clearAllHistory,
  subscribeToHistory,
  generateSyncCode,
  consumeSyncCode
} from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ui';
import '@/styles/components/Sidebar.css';

const modules = [
  { id: 'mock', label: 'Mock Data Factory', icon: 'fas fa-flask', path: '/mock-generator' },
  { id: 'analysis', label: 'Code Analyzer', icon: 'fas fa-search', path: '/code-analysis' },
  { id: 'converter', label: 'Code Converter', icon: 'fas fa-sync-alt', path: '/code-converter' },
  { id: 'refactor', label: 'Code Refactor', icon: 'fas fa-wand-magic-sparkles', path: '/code-refactor' },
  { id: 'generator', label: 'Code Generator', icon: 'fas fa-cubes', path: '/code-generator' },
  { id: 'css-tailwind', label: 'CSS Frameworks', icon: 'fab fa-css3-alt', path: '/css-frameworks' },
  { id: 'regex', label: 'Regex Generator', icon: 'fas fa-asterisk', path: '/regex-generator' },
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
  const themeMenuRef = useRef(null);

  const [historyItems, setHistoryItems] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceCode, setDeviceCode] = useState('');
  const [insertCode, setInsertCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ type: '', message: '' });
  const [timeLeft, setTimeLeft] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: null // 'single' or 'all'
  });

  const [autoSave, setAutoSave] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAutoSave = localStorage.getItem('recode_autoSave') === 'true';
      if (savedAutoSave !== autoSave) {
        setAutoSave(savedAutoSave);
      }
    }
  }, []);

  const toggleAutoSave = () => {
    const newState = !autoSave;
    setAutoSave(newState);
    localStorage.setItem("recode_autoSave", newState);
    window.dispatchEvent(new CustomEvent('recode_autoSave_changed', { detail: newState }));
  };

  useEffect(() => {
    // Subscribe to real-time updates when the component mounts
    const unsubscribe = subscribeToHistory((data) => {
      setHistoryItems(data);
      if (data.length === 0) {
        setShowHistoryModal(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!expiresAt || !deviceCode) return;

    const interval = setInterval(() => {
      const distance = expiresAt - Date.now();

      if (distance <= 0) {
        clearInterval(interval);
        setDeviceCode('');
        setTimeLeft(null);
        setExpiresAt(null);
        setSyncStatus({ type: 'error', message: 'Code expired. Please generate a new one.' });
      } else {
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, deviceCode]);

  useEffect(() => {
    if (!showDeviceModal) {
      setInsertCode('');
      setSyncStatus({ type: '', message: '' });
    }
  }, [showDeviceModal]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (isOpen && window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        toggleSidebar();
      }

      if (isThemeMenuOpen && themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, toggleSidebar, isThemeMenuOpen]);

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

  const handleHistoryClick = () => {
    if (historyItems.length > 0) {
      setShowHistoryModal(true);
    }
  };

  const generateDeviceCode = () => {
    setDeviceCode(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  const handleGenerateCode = async () => {
    setIsSyncing(true);
    setSyncStatus({ type: '', message: '' });
    try {
      const code = await generateSyncCode();
      setDeviceCode(code);
      setExpiresAt(Date.now() + 15 * 60 * 1000); // 15 minutes
    } catch (error) {
      setSyncStatus({ type: 'error', message: 'Authentication required to generate code.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectDevice = async () => {
    if (insertCode.length !== 6) return;
    setIsSyncing(true);
    setSyncStatus({ type: '', message: '' });
    try {
      await consumeSyncCode(insertCode);
      setSyncStatus({ type: 'success', message: 'Workspace synced successfully!' });
      setTimeout(() => setShowDeviceModal(false), 2000); // Close automatically
    } catch (error) {
      setSyncStatus({ type: 'error', message: error.message || 'Invalid or expired code.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} ref={sidebarRef}>

        <header className="sidebar-header">
          {!isCollapsed && (
            <Link href="/" className="logo-link">
              <div className="logo-group">
                <div className="logo-image" />
                <span>ReCode</span>
              </div>
            </Link>
          )}

          <section className="sidebar-actions">
            <button className="header-icon-btn mobile-only" onClick={toggleSidebar} title="Close Menu">
              <i className="fas fa-times"></i>
            </button>

            <button className="header-icon-btn desktop-only" onClick={toggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
              <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
          </section>
        </header>

        <section className="sidebar-scroll-area">
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
                }} >
                <i className={module.icon}></i>
                {!isCollapsed && module.label}
              </Link>
            ))}
          </nav>

          <div className="history-section">
            <div className="history-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
              {!isCollapsed ? (
                <>
                  <div className="history-sub-header">
                    <h3
                      className={`history-title ${historyItems.length > 0 ? 'clickable' : ''}`}
                      onClick={handleHistoryClick}
                      title={historyItems.length > 0 ? "Click to view full history details" : "No history yet"}
                    >
                      History
                    </h3>
                    <button onClick={toggleAutoSave} className={`autosave-btn ${autoSave ? "active" : ""}`} title={autoSave ? "Auto-Save ON" : "Auto-Save OFF"}>
                      AutoSave
                      <i className={`fas ${autoSave ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                    </button>
                  </div>
                  {historyItems.length > 0 && (
                    <button
                      className="clear-all-btn"
                      onClick={handleClearAllClick}
                      disabled={isDeleting}
                      title="Clear All History"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </>
              ) : (
                <button onClick={toggleAutoSave} className={`autosave-btn ${autoSave ? "active" : ""}`} title="Toggle Auto-Save">
                  <i className={`fas ${autoSave ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                </button>
              )}
            </div>

            {!isCollapsed && (
              <div className="history-list">
                {historyItems.length === 0 ? (
                  <div className="empty-history">
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
                            {(() => {
                              const preview = Array.isArray(item.input)
                                ? item.input.map(f => f.name).join(', ')
                                : item.input;
                              return <>{preview.substring(0, 35)}{preview.length > 35 ? '...' : ''}</>;
                            })()}
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
        </section>

        <footer className="sidebar-footer">
          <div className="footer-action-container">
            <button className={`footer-icon-btn ${showDeviceModal ? 'active' : ''}`} onClick={() => setShowDeviceModal(true)} title="Link Devices">
              <i className="fas fa-link"></i>
            </button>
          </div>
          <div className="footer-action-container">
            <div className="ai-options-menu">
              {Object.entries(qualityConfig).map(([key, config]) => (
                <button key={key} className={`ai-option-btn ${qualityMode === key ? 'active' : ''}`} onClick={() => toggleQuality(key)} title={config.title}>
                  <i className={`fas ${config.icon}`}></i>
                </button>
              ))}
            </div>
            <button className="footer-icon-btn" onClick={openModelSelector} title="AI Model Selection">
              <i className="fas fa-microchip"></i>
            </button>
          </div>
          <div className="footer-action-container" ref={themeMenuRef}>
            <div className={`theme-dropdown-menu ${isThemeMenuOpen ? 'open' : ''}`}>
              {Object.entries(groupedThemes).map(([group, themes]) => (
                <div key={group} className="theme-group">
                  <div className="theme-group-label">{group}</div>
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      className={`theme-option-btn ${currentTheme === theme.id ? 'active' : ''}`}
                      onClick={() => { changeTheme(theme.id); setIsThemeMenuOpen(false); }}>
                      {theme.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button className={`footer-icon-btn ${isThemeMenuOpen ? 'active' : ''}`} onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} title="Change Theme">
              <i className="fas fa-palette"></i>
            </button>
          </div>
        </footer>
      </aside>

      {showDeviceModal && (
        <div className="modal-overlay" onClick={() => setShowDeviceModal(false)}>
          <div className="modal-content device-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="fas fa-satellite-dish"></i> Sync Workspace</h2>
            </div>
            <p className="modal-desc">
              Generate a secure 6-digit code to bridge your session, or enter an active code from another device.
            </p>

            {syncStatus.message && (
              <div className={`sync-status-banner ${syncStatus.type}`}>
                <i className={`fas ${syncStatus.type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'}`}></i>
                {syncStatus.message}
              </div>
            )}

            <div className="device-code-section">
              <div className="code-display">
                {deviceCode || '------'}
              </div>

              {timeLeft && (
                <div className="timer-display">
                  <i className="fas fa-stopwatch"></i> Expires in {timeLeft}
                </div>
              )}

              <button className="primary-button" onClick={handleGenerateCode} disabled={isSyncing || timeLeft}>
                {isSyncing && !insertCode ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-fingerprint"></i>}
                {timeLeft ? 'Code Active' : 'Generate Code'}
              </button>
            </div>

            <div className="device-insert-section">
              <p><i className="fas fa-keyboard"></i> Have a code from another device?</p>
              <div className="insert-code-wrapper">
                <input
                  type="text"
                  placeholder="Enter 6 digits"
                  className="device-code-input"
                  maxLength={6}
                  value={insertCode}
                  onChange={(e) => setInsertCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  disabled={isSyncing || !!timeLeft}
                />
                <button
                  className="secondary-button"
                  onClick={handleConnectDevice}
                  disabled={insertCode.length < 6 || isSyncing || !!timeLeft}
                >
                  {isSyncing && insertCode ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plug"></i>}
                  Connect
                </button>
              </div>
            </div>

            <div className="modal-footer action-row" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="secondary-button" onClick={() => setShowDeviceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="history-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="history-modal-container" onClick={e => e.stopPropagation()}>

            <div className="history-modal-header">
              <h2><i className="fas fa-history" style={{ marginRight: '10px' }}></i> Extended History</h2>
              <div className="history-modal-actions">
                <button
                  className="history-clear-all-btn"
                  onClick={() => { setShowHistoryModal(false); handleClearAllClick(); }}
                >
                  <i className="fas fa-trash-alt"></i> Clear All
                </button>
                <button className="history-close-btn" onClick={() => setShowHistoryModal(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="history-modal-body">
              <div className="history-grid">
                {historyItems.map(item => (
                  <div key={item.id} className="history-detail-card">

                    <div className="detail-card-header">
                      <div className="detail-card-title">
                        <i className={
                          item.type === 'converter' ? 'fas fa-sync-alt' :
                            item.type === 'refactor' ? 'fas fa-wand-magic-sparkles' :
                              item.type === 'analysis' ? 'fas fa-search' : 'fas fa-cube'
                        }></i>
                        <span>
                          {item.type === 'converter'
                            ? `${item.sourceLang?.toUpperCase() || 'Unknown'} to ${item.targetLang?.toUpperCase() || 'Unknown'}`
                            : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </span>
                      </div>
                      <span className="detail-card-date">
                        {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString([], {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'Just now'}
                      </span>
                    </div>

                    <div className="detail-card-content">
                      {item.input && (
                        <div className="detail-snippet">
                          <strong>Input Snippet:</strong>
                          {(() => {
                            const preview = Array.isArray(item.input)
                              ? item.input.map(f => f.name).join(', ')
                              : item.input;
                            return <pre>{preview.substring(0, 150)}{preview.length > 150 ? '...' : ''}</pre>;
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="detail-card-footer">
                      <button
                        className="detail-load-btn"
                        onClick={() => {
                          loadFromHistory(item);
                          setShowHistoryModal(false);
                        }}
                      >
                        <i className="fas fa-folder-open"></i> Load into Workspace
                      </button>
                      <button
                        className="detail-delete-btn"
                        onClick={(e) => handleDeleteClick(e, item.id)}
                        disabled={isDeleting}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

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
    </>
  );
}
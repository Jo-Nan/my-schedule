import { useEffect, useRef, useState } from 'react';

const Header = ({
  viewMode,
  setViewMode,
  theme,
  toggleTheme,
  language,
  setLanguage,
  t,
  onSync,
  onUpload,
  onImport,
  setSyncModalOpen,
  syncStatus,
  currentUser,
  activeUser,
  isViewingManagedUser,
  onExitManagedView,
  onOpenMessage,
  onOpenProfile,
  onLogout,
  onOpenAdmin,
  hasUnsavedProgress,
}) => {
  const displayName = activeUser?.username || activeUser?.email || '—';
  const isAdmin = currentUser?.role === 'admin';
  const isChinese = language === 'zh';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSettingsAction = (action) => {
    setIsSettingsOpen(false);
    action();
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportChange = async (event) => {
    const [file] = event.target.files || [];
    if (file && onImport) {
      await onImport(file);
    }
    event.target.value = '';
  };

  return (
    <header className="glass-panel" style={styles.header}>
      <div style={styles.left}>
        <img src="logo.png" alt="Logo" style={styles.logo} />
        <div>
          <h1 style={styles.title}>{t.title}</h1>
          <div style={styles.userLine}>
            <span>{displayName}</span>
            {isAdmin && <span style={styles.adminBadge}>{t.adminBadge}</span>}
            {isViewingManagedUser && <span style={styles.viewBadge}>{t.adminViewingUser}</span>}
          </div>
        </div>
      </div>

      <div className="segmented-control" style={styles.center}>
        <button className={`glass-button ${viewMode === 'daily' ? 'active-tab' : ''}`} style={isChinese ? styles.tabButtonZh : styles.tabButton} onClick={() => setViewMode('daily')}>{t.daily}</button>
        <button className={`glass-button ${viewMode === 'weekly' ? 'active-tab' : ''}`} style={isChinese ? styles.tabButtonZh : styles.tabButton} onClick={() => setViewMode('weekly')}>{t.weekly}</button>
        <button className={`glass-button ${viewMode === 'monthly' ? 'active-tab' : ''}`} style={isChinese ? styles.tabButtonZh : styles.tabButton} onClick={() => setViewMode('monthly')}>{t.monthly}</button>
        <button className={`glass-button ${viewMode === 'yearly' ? 'active-tab' : ''}`} style={isChinese ? styles.tabButtonZh : styles.tabButton} onClick={() => setViewMode('yearly')}>{t.yearly}</button>
      </div>

      <div style={styles.right}>
        <div style={styles.syncCluster}>
          <button className="glass-button" onClick={() => setSyncModalOpen(true)} style={styles.statusButton} title={t.syncSettings}>
            <span style={styles.statusDotWrap}>
              <span style={{ ...styles.statusDot, background: getStatusColor(syncStatus) }} />
            </span>
            <span style={{ ...styles.statusText, color: getStatusColor(syncStatus) }}>
              {getStatusLabel(syncStatus, t)}
            </span>
          </button>
          <button
            className="glass-button"
            onClick={onUpload}
            style={{
              ...styles.saveButton,
              ...(hasUnsavedProgress ? styles.saveButtonPending : {}),
            }}
            title={hasUnsavedProgress ? 'Save Progress Changes' : t.upload}
          >
            {hasUnsavedProgress ? 'Save' : 'Saved'}
          </button>
        </div>

        <div className="button-group">
          <button className="glass-button icon-only" onClick={onSync} title={t.sync}>🔄</button>
          <button className="glass-button icon-only" onClick={handleImportClick} title={t.importButton}>📂</button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={styles.hiddenInput}
            onChange={handleImportChange}
          />
        </div>

        {isAdmin && (
          <div className="button-group">
            <button className="glass-button" onClick={onOpenAdmin} title={t.adminPanelTitle}>{t.adminButton}</button>
            {isViewingManagedUser && (
              <button className="glass-button" onClick={onExitManagedView} title={t.adminExitView}>{t.adminExitView}</button>
            )}
          </div>
        )}

        <div className="button-group">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={styles.languageSelect}
            title="Select Language"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
          <button 
            className="glass-button" 
            style={styles.themeBtn}
            onClick={toggleTheme} 
            title="Toggle Theme (Alt+T)"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>

        <div style={styles.settingsWrap} ref={settingsRef}>
          <button
            className="glass-button"
            style={styles.settingsBtn}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            title={t.settingsMenu}
            aria-expanded={isSettingsOpen}
            aria-haspopup="menu"
            type="button"
          >
            <span style={styles.settingsIcon}>⚙</span>
            <span style={styles.settingsLabel}>{t.settingsMenu}</span>
          </button>

          {isSettingsOpen && (
            <div style={styles.settingsMenu} role="menu">
              <button
                className="glass-button"
                style={styles.menuItem}
                onClick={() => handleSettingsAction(onOpenProfile)}
                title={t.profileTitle}
                type="button"
              >
                <span style={styles.menuIcon}>👤</span>
                <span>{t.profileButton}</span>
              </button>
              <button
                className="glass-button"
                style={styles.menuItem}
                onClick={() => handleSettingsAction(onOpenMessage)}
                title={t.messageAdminTitle}
                type="button"
              >
                <span style={styles.menuIcon}>✉️</span>
                <span>{t.messageButton}</span>
              </button>
              <button
                className="glass-button"
                style={{ ...styles.menuItem, ...styles.menuItemDanger }}
                onClick={() => handleSettingsAction(onLogout)}
                title={t.logoutBtn}
                type="button"
              >
                <span style={styles.menuIcon}>⇠</span>
                <span>{t.logoutBtn}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'loading': return 'var(--accent-color)';
    case 'uploading': return '#fbbf24';
    case 'synced': return '#10b981';
    case 'error': return 'var(--danger-color)';
    default: return 'var(--text-secondary)';
  }
};

const getStatusLabel = (status, t) => {
  switch (status) {
    case 'loading': return t.syncStatusLoading;
    case 'uploading': return t.syncStatusUploading;
    case 'synced': return t.syncStatusSynced;
    case 'error': return t.syncStatusError;
    default: return t.syncStatusIdle;
  }
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    padding: '0.8rem 1.5rem',
    marginBottom: '2rem',
    borderRadius: '24px',
    flexWrap: 'wrap',
    position: 'relative',
    zIndex: 40,
    overflow: 'visible',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    flexShrink: 0,
  },
  center: {
    flexShrink: 0,
    minWidth: 0,
  },
  tabButton: {
    minWidth: '72px',
  },
  tabButtonZh: {
    minWidth: '60px',
    padding: '6px 10px',
    fontSize: '0.82rem',
    letterSpacing: '0.01em',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  settingsWrap: {
    position: 'relative',
    flexShrink: 0,
    zIndex: 60,
  },
  hiddenInput: {
    display: 'none',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    background: 'linear-gradient(90deg, var(--text-primary), var(--accent-color))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    whiteSpace: 'nowrap',
  },
  userLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
    flexWrap: 'wrap',
  },
  adminBadge: {
    padding: '0.1rem 0.45rem',
    borderRadius: '999px',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    fontWeight: 600,
  },
  viewBadge: {
    padding: '0.1rem 0.45rem',
    borderRadius: '999px',
    background: 'rgba(59, 130, 246, 0.15)',
    color: 'var(--accent-color)',
    fontWeight: 600,
  },
  syncCluster: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.3rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--glass-border)',
  },
  statusButton: {
    minWidth: '132px',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.55rem 0.8rem',
    fontSize: '0.92rem',
    boxShadow: 'none',
  },
  statusDotWrap: {
    width: '0.75rem',
    height: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusDot: {
    width: '0.5rem',
    height: '0.5rem',
    borderRadius: '999px',
    boxShadow: '0 0 0 4px rgba(255,255,255,0.08)',
  },
  statusText: {
    fontSize: '0.82rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease',
  },
  saveButton: {
    minWidth: '74px',
    padding: '0.55rem 0.85rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    boxShadow: 'none',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
  },
  saveButtonPending: {
    color: '#fff',
    background: 'linear-gradient(135deg, var(--accent-color), #60a5fa)',
    borderColor: 'transparent',
  },
  languageSelect: {
    padding: '0.55rem 0.8rem',
    borderRadius: '10px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
  },
  themeBtn: {
    padding: '0.5rem 0.65rem',
    fontSize: '1.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '40px',
    minHeight: '40px',
    background: 'rgba(150, 150, 150, 0.1)',
    border: '1px solid rgba(150, 150, 150, 0.2)',
    transition: 'all 0.2s ease',
  },
  settingsBtn: {
    padding: '0.55rem 0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  settingsIcon: {
    fontSize: '1rem',
    lineHeight: 1,
  },
  settingsLabel: {
    fontSize: '0.9rem',
  },
  settingsMenu: {
    position: 'absolute',
    top: 'calc(100% + 0.55rem)',
    right: 0,
    minWidth: '180px',
    padding: '0.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    borderRadius: '16px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(18px)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
    zIndex: 80,
  },
  menuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.6rem',
    padding: '0.7rem 0.85rem',
    borderRadius: '12px',
    boxShadow: 'none',
    border: '1px solid transparent',
    background: 'transparent',
  },
  menuItemDanger: {
    color: '#dc2626',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(248, 113, 113, 0.14))',
    borderColor: 'rgba(239, 68, 68, 0.16)',
  },
  menuIcon: {
    width: '1rem',
    textAlign: 'center',
    flexShrink: 0,
    fontSize: '0.95rem',
    lineHeight: 1,
  },
  menuItemText: {
    transition: 'all 0.2s ease',
  },
};

export default Header;

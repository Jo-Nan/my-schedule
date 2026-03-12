import React from 'react';

const Header = ({ viewMode, setViewMode, theme, toggleTheme, language, toggleLanguage, t, onSync, onUpload, setSyncModalOpen, syncStatus }) => {
  return (
    <header className="glass-panel" style={styles.header}>
      <div style={styles.brand}>
        <img src="logo.png" alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>{t.title}</h1>
      </div>
      
      <div style={styles.controls}>
        <div style={styles.statusGroup}>
          <span style={{ ...styles.statusText, color: getStatusColor(syncStatus) }}>
            {getStatusIcon(syncStatus)} {getStatusLabel(syncStatus, t)}
          </span>
        </div>
        <button 
          className="glass-button" 
          onClick={() => setSyncModalOpen(true)}
          style={styles.themeBtn}
          title={t.syncSettings}
        >
          ⚙️
        </button>
        <button 
          className="glass-button" 
          onClick={onSync}
          style={styles.themeBtn}
        >
          🔄 {t.sync}
        </button>
        <button 
          className="glass-button" 
          onClick={onUpload}
          style={styles.themeBtn}
        >
          📤 {t.upload}
        </button>
        <div style={styles.divider}></div>
        <button 
          className="glass-button" 
          onClick={toggleLanguage}
          style={styles.themeBtn}
          title="Toggle Language (Alt+L)"
        >
          {t.languageToggle}
        </button>
        <button 
          className="glass-button" 
          onClick={toggleTheme}
          style={styles.themeBtn}
          title="Toggle Theme (Alt+T)"
        >
          {theme === 'light' ? t.darkMode : t.lightMode}
        </button>
        <button 
          className={`glass-button ${viewMode === 'daily' ? 'active-tab' : ''}`}
          style={viewMode === 'daily' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('daily')}
        >
          {t.daily}
        </button>
        <button 
          className={`glass-button ${viewMode === 'weekly' ? 'active-tab' : ''}`}
          style={viewMode === 'weekly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('weekly')}
        >
          {t.weekly}
        </button>
        <button 
          className={`glass-button ${viewMode === 'monthly' ? 'active-tab' : ''}`}
          style={viewMode === 'monthly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('monthly')}
        >
          {t.monthly}
        </button>
        <button 
          className={`glass-button ${viewMode === 'yearly' ? 'active-tab' : ''}`}
          style={viewMode === 'yearly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('yearly')}
        >
          {t.yearly}
        </button>
      </div>
    </header>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'loading': return 'var(--accent-color)';
    case 'uploading': return '#fbbf24'; // Amber
    case 'synced': return '#10b981'; // Emerald
    case 'error': return 'var(--danger-color)';
    default: return 'var(--text-secondary)';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'loading': return '📡';
    case 'uploading': return '⏳';
    case 'synced': return '✅';
    case 'error': return '⚠️';
    default: return '☁️';
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
    padding: '1rem 2rem',
    marginBottom: '2rem',
    borderRadius: '24px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logo: {
    width: '45px',
    height: '45px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    background: 'linear-gradient(90deg, var(--text-primary), var(--accent-color))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  controls: {
    display: 'flex',
    gap: '0.8rem',
    alignItems: 'center',
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginRight: '1rem',
    padding: '0.4rem 0.8rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
  },
  statusText: {
    fontSize: '0.8rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease',
  },
  themeBtn: {
    padding: '0.5rem 1rem',
    marginRight: '1rem',
    background: 'var(--glass-bg)',
  },
  btn: {
    padding: '0.5rem 1.2rem',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'var(--border-color)',
    margin: '0 0.5rem',
    opacity: 0.5,
  },
  activeBtn: {
    background: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
  }
};

export default Header;

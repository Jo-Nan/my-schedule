import React from 'react';

const Header = ({ viewMode, setViewMode, theme, toggleTheme, language, toggleLanguage, t, onSync, onUpload, setSyncModalOpen, syncStatus }) => {
  return (
    <header className="glass-panel" style={styles.header}>
      <div style={styles.left}>
        <img src="logo.png" alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>{t.title}</h1>
      </div>

      <div className="segmented-control" style={styles.center}>
        <button 
          className={`glass-button ${viewMode === 'daily' ? 'active-tab' : ''}`}
          onClick={() => setViewMode('daily')}
        >
          {t.daily}
        </button>
        <button 
          className={`glass-button ${viewMode === 'weekly' ? 'active-tab' : ''}`}
          onClick={() => setViewMode('weekly')}
        >
          {t.weekly}
        </button>
        <button 
          className={`glass-button ${viewMode === 'monthly' ? 'active-tab' : ''}`}
          onClick={() => setViewMode('monthly')}
        >
          {t.monthly}
        </button>
        <button 
          className={`glass-button ${viewMode === 'yearly' ? 'active-tab' : ''}`}
          onClick={() => setViewMode('yearly')}
        >
          {t.yearly}
        </button>
      </div>
      
      <div style={styles.right}>
        <div style={styles.statusGroup}>
          <button 
            className="glass-button icon-only"
            onClick={() => setSyncModalOpen(true)}
            style={{ 
              background: 'transparent', 
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0',
              fontSize: '1rem'
            }}
            title={t.syncSettings}
          >
            <span style={{ ...styles.statusText, color: getStatusColor(syncStatus) }}>
              {getStatusIcon(syncStatus)} {getStatusLabel(syncStatus, t)}
            </span>
          </button>
        </div>

        <div className="button-group">
          <button 
            className="glass-button icon-only" 
            onClick={onSync}
            title={t.sync}
          >
            🔄
          </button>
          <button 
            className="glass-button icon-only" 
            onClick={onUpload}
            title={t.upload}
          >
            📥
          </button>
        </div>

        <div className="button-group">
          <button 
            className="glass-button icon-only" 
            onClick={toggleLanguage}
            title="Toggle Language (Alt+L)"
          >
            🌐
          </button>
          <button 
            className="glass-button" 
            style={{ padding: '0 0.8rem', fontSize: '1.2rem'}}
            onClick={toggleTheme}
            title="Toggle Theme (Alt+T)"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
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
    gap: '1.5rem',
    padding: '0.8rem 1.5rem',
    marginBottom: '2rem',
    borderRadius: '24px',
    flexWrap: 'wrap',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    flexShrink: 0,
  },
  center: {
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  logo: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    background: 'linear-gradient(90deg, var(--text-primary), var(--accent-color))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    whiteSpace: 'nowrap',
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.8rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.3s ease',
  },
};

export default Header;

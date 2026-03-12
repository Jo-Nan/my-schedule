import React, { useState } from 'react';

const SyncModal = ({ isOpen, onClose, onSave, config, t, onRestore }) => {
  const [token, setToken] = useState(config.token || '');
  const [gistId, setGistId] = useState(config.gistId || '');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ token, gistId });
  };

  const fetchHistory = async () => {
    if (!token || !gistId) return;
    setLoading(true);
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}/commits`, {
        headers: { Authorization: `token ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.slice(0, 10)); // Last 10 versions
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionHash) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}/${versionHash}`, {
        headers: { Authorization: `token ${token}` }
      });
      if (response.ok) {
        const gist = await response.json();
        const content = gist.files['plans.json'].content;
        onRestore(JSON.parse(content));
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h2>{t.syncSettings}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t.githubToken}</label>
            <input
              type="password"
              className="glass-input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.gistId}</label>
            <input
              type="text"
              className="glass-input"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
              placeholder="e.g. 5d57b3..."
              required
            />
          </div>

          <div style={styles.help}>
            <a 
              href="https://github.com/settings/tokens/new?scopes=gist&description=NanMuZ%20Schedule%20Sync" 
              target="_blank" 
              rel="noopener noreferrer"
              style={styles.link}
            >
              {t.howToGist}
            </a>
          </div>

          <div style={styles.actions}>
            <button type="submit" className="glass-button active-tab">
              {t.saveSettings}
            </button>
            <button type="button" className="glass-button" onClick={fetchHistory} disabled={loading}>
              {loading ? '...' : t.loadHistory}
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <div style={styles.historyList}>
            <h4 style={styles.historyTitle}>{t.version}</h4>
            <div style={styles.scrollArea}>
              {history.map(commit => (
                <div key={commit.version} style={styles.historyItem}>
                  <div style={styles.versionInfo}>
                    <span style={styles.date}>{new Date(commit.committed_at).toLocaleString()}</span>
                    <span style={styles.hash}>{commit.version.substring(0, 7)}</span>
                  </div>
                  <button 
                    onClick={() => handleRestore(commit.version)} 
                    style={styles.restoreBtn}
                    className="glass-button"
                  >
                    {t.restore}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: '90%',
    maxWidth: '500px',
    padding: '2rem',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
    flexShrink: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  help: {
    fontSize: '0.85rem',
  },
  link: {
    color: 'var(--accent-color)',
    textDecoration: 'none',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  historyList: {
    marginTop: '1.5rem',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  historyTitle: {
    margin: '0 0 0.8rem 0',
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  },
  scrollArea: {
    overflowY: 'auto',
    paddingRight: '5px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.8rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },
  versionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  date: {
    color: 'var(--text-primary)',
  },
  hash: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
  },
  restoreBtn: {
    padding: '0.3rem 0.8rem',
    fontSize: '0.8rem',
  }
};

export default SyncModal;

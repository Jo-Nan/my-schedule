import React, { useState } from 'react';

const SyncModal = ({ isOpen, onClose, onSave, config, t }) => {
  const [token, setToken] = useState(config.token || '');
  const [gistId, setGistId] = useState(config.gistId || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ token, gistId });
    onClose();
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
            <button type="button" className="glass-button" onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" className="glass-button active-tab">
              {t.saveSettings}
            </button>
          </div>
        </form>
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
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
    marginTop: '1rem',
  },
};

export default SyncModal;

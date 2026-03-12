import React from 'react';

const SyncModal = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h2>{t.syncSettings}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.content}>
          <p style={styles.info}>{t.fileSyncInfo}</p>
          <div style={styles.steps}>
            <ol>
              <li>点击 <b>{t.upload}</b> 将当前数据保存到您的电脑里。</li>
              <li>应用会自动尝试保存到：
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem' }}>
                  <li><b>Mac</b>: <code>/Users/muzinan/NanMuZ/Code/day/public/data/plans.json</code></li>
                  <li><b>Win</b>: <code>D:/Code/day/public/data/plans.json</code></li>
                </ul>
              </li>
              <li>点击 <b>{t.sync}</b> 即可直接从上述位置读回最新数据。</li>
            </ol>
          </div>
        </div>

        <div style={styles.actions}>
          <button className="glass-button active-tab" onClick={onClose}>
            {t.save}
          </button>
        </div>
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
    fontSize: '2rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  info: {
    lineHeight: 1.6,
    color: 'var(--text-primary)',
  },
  steps: {
    background: 'rgba(255,255,255,0.05)',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1.5rem',
  },
};

export default SyncModal;

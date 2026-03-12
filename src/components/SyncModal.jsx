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
              <li>点击 <b>{t.upload}</b> 后，应用会先判断系统和默认目录，再自动导出 <code>plans.json</code>。</li>
              <li>点击 <b>{t.sync}</b> 前，也会按同样规则自动查找导入位置。</li>
              <li>默认目录规则如下：
                <ul style={{ paddingLeft: '1.2rem', marginTop: '0.4rem' }}>
                  <li><b>macOS</b>: 若 <code>/Users/muzinan/NanMuZ/Code/day/public/data</code> 存在，则读写其中的 <code>plans.json</code></li>
                  <li><b>Windows</b>: 使用 <code>D:/Code/day/public/data/plans.json</code></li>
                  <li><b>其他情况</b>: 回退到项目内的 <code>public/data/plans.json</code></li>
                </ul>
              </li>
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

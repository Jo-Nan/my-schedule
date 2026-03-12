import React from 'react';

const SyncModal = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h2>{t.syncSettings}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.content}>
          <p style={styles.info}>{t.fileSyncInfo}</p>
          
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>📤 数据同步</h4>
            <div style={styles.steps}>
              <ol>
                <li>点击 <b>{t.upload}</b> 后，计划数据会保存到 <code>Jo-Nan/day-data</code> 仓库的 <code>data/plans.json</code>。</li>
                <li>点击 <b>{t.sync}</b> 时，会从 GitHub 同步最新的计划数据。</li>
                <li>数据变更会实时自动同步，无需手动点击按钮。</li>
                <li>同一设备或多个设备都可以通过一套 GitHub 同步机制实现数据一致。</li>
              </ol>
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>💾 自动备份</h4>
            <div style={styles.steps}>
              <ol>
                <li>每天凌晨 2:00 AM（北京时间）自动备份一次数据。</li>
                <li>备份文件保存在 <code>my-schedule</code> 仓库的 <code>backups/</code> 目录。</li>
                <li>文件名格式：<code>YYYYMMDD.json</code>（如 <code>20260313.json</code>）。</li>
                <li>如需恢复数据，可从备份目录选择对应日期的文件。详见项目文档。</li>
              </ol>
            </div>
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
    WebkitBackdropFilter: 'blur(8px)',
    animation: 'fadeIn 0.25s ease-in',
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
    gap: '1.5rem',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
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

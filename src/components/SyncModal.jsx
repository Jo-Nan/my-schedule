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
            <h4 style={styles.sectionTitle}>🔐 {t.syncAccountIsolationTitle}</h4>
            <div style={styles.steps}>
              <ol>
                <li>{t.syncAccountIsolationItem1}</li>
                <li>{t.syncAccountIsolationItem2}</li>
                <li>{t.syncAccountIsolationItem3}</li>
              </ol>
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>☁️ {t.syncGuideTitle}</h4>
            <div style={styles.steps}>
              <ol>
                <li>{t.syncGuideItem1}</li>
                <li>{t.syncGuideItem2}</li>
                <li>{t.syncGuideItem3}</li>
                <li>{t.syncGuideItem4}</li>
                <li>{t.syncGuideItem5}</li>
                <li>{t.syncGuideItem6}</li>
                <li>{t.syncGuideItem7}</li>
                <li>{t.syncGuideItem8}</li>
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

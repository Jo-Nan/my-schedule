const ImportModal = ({ isOpen, fileName, itemCount, onReplace, onMerge, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{t.importModalTitle}</h2>
            <p style={styles.subtitle}>{fileName}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn} type="button">×</button>
        </div>

        <div style={styles.content}>
          <p style={styles.info}>
            {t.importModalIntro} <b>{itemCount}</b> {t.importModalPlansUnit}
          </p>

          <div style={styles.optionCard}>
            <h3 style={styles.optionTitle}>{t.importReplaceTitle}</h3>
            <p style={styles.optionText}>{t.importReplaceDescription}</p>
            <button className="glass-button" style={styles.primaryButton} onClick={onReplace} type="button">
              {t.importReplaceAction}
            </button>
          </div>

          <div style={styles.optionCard}>
            <h3 style={styles.optionTitle}>{t.importMergeTitle}</h3>
            <p style={styles.optionText}>{t.importMergeDescription}</p>
            <button className="glass-button" style={styles.secondaryButton} onClick={onMerge} type="button">
              {t.importMergeAction}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.2rem',
    zIndex: 10000,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  modal: {
    width: '100%',
    maxWidth: '560px',
    padding: '1.4rem',
    borderRadius: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  subtitle: {
    margin: '0.3rem 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.88rem',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '2rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  content: {
    display: 'grid',
    gap: '0.9rem',
  },
  info: {
    margin: 0,
    color: 'var(--text-primary)',
    lineHeight: 1.6,
  },
  optionCard: {
    padding: '1rem',
    borderRadius: '18px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.05)',
    display: 'grid',
    gap: '0.7rem',
  },
  optionTitle: {
    margin: 0,
    fontSize: '1rem',
  },
  optionText: {
    margin: 0,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    fontSize: '0.9rem',
  },
  primaryButton: {
    justifySelf: 'flex-start',
    background: 'linear-gradient(135deg, var(--accent-color), #60a5fa)',
    borderColor: 'transparent',
    color: '#fff',
  },
  secondaryButton: {
    justifySelf: 'flex-start',
  },
};

export default ImportModal;

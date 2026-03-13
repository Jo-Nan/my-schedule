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
            <h4 style={styles.sectionTitle}>🔐 账户隔离</h4>
            <div style={styles.steps}>
              <ol>
                <li>每个邮箱账号只会读取和保存自己的计划数据。</li>
                <li>当前设备上的缓存也按用户隔离，不会和其他账号混在一起。</li>
                <li>超级管理员账号与普通用户账号共享同一登录入口，但数据彼此隔离。</li>
              </ol>
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>☁️ 同步说明</h4>
            <div style={styles.steps}>
              <ol>
                <li>右上角的状态标签会显示当前状态，比如 <b>{t.syncStatusIdle}</b>、<b>{t.syncStatusUploading}</b> 或 <b>{t.syncStatusSynced}</b>。</li>
                <li>点击 <b>{t.upload}</b> 会把当前页面里的修改保存到服务端。</li>
                <li>打开 <b>{t.dataMenu}</b> 下拉菜单，可以看到 <b>{t.sync}</b>、<b>{t.importButton}</b> 和 <b>{t.exportButton}</b>。</li>
                <li>点击 <b>{t.sync}</b> 会重新拉取当前登录用户在服务端的最新计划数据。</li>
                <li>点击 <b>{t.importButton}</b> 可以导入外部 JSON 文件，并选择“替换当前数据”或“合并当前数据”。</li>
                <li>点击 <b>{t.exportButton}</b> 会把当前工作区计划下载成 JSON 文件。</li>
                <li>在周视图或日视图里，先选中任务后可以使用 <b>Cmd/Ctrl + C</b> 复制，再用 <b>Cmd/Ctrl + V</b> 粘贴到目标日期。</li>
                <li>普通编辑和导入后的改动会自动保存，进度条改动会延迟保存，减少频繁请求。</li>
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

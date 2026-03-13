import React, { useEffect, useMemo, useState } from 'react';

const AdminPanel = ({
  isOpen,
  onClose,
  currentUser,
  t,
  onAdminDataChanged,
  onRefreshCurrentUser,
  onOpenUserSchedule,
  viewedUserId,
}) => {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserPlans, setSelectedUserPlans] = useState([]);
  const [selectedUserSnapshots, setSelectedUserSnapshots] = useState([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', username: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) || null, [users, selectedUserId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    loadUsers();
    loadMessages();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedUserId || !isOpen) {
      return;
    }
    Promise.all([loadUserPlans(selectedUserId), loadUserSnapshots(selectedUserId)]);
  }, [selectedUserId, isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin?action=users', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminLoadError);
      }
      setUsers(result.users || []);
      setSelectedUserId((prev) => prev || result.users?.[0]?.id || '');
    } catch (loadError) {
      setError(loadError.message || t.adminLoadError);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/admin?action=messages', { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminLoadError);
      }
      setMessages(result.messages || []);
    } catch (loadError) {
      setError(loadError.message || t.adminLoadError);
    }
  };

  const loadUserPlans = async (userId) => {
    try {
      const response = await fetch(`/api/admin?action=user-plans&userId=${encodeURIComponent(userId)}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminLoadError);
      }
      setSelectedUserPlans(result.plans || []);
    } catch (loadError) {
      setError(loadError.message || t.adminLoadError);
    }
  };

  const loadUserSnapshots = async (userId) => {
    try {
      const response = await fetch(`/api/admin?action=user-snapshots&id=${encodeURIComponent(userId)}`, { credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminLoadError);
      }
      setSelectedUserSnapshots(result.snapshots || []);
    } catch (loadError) {
      setError(loadError.message || t.adminLoadError);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin?action=users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(createForm),
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminCreateError);
      }
      setCreateForm({ email: '', password: '', username: '' });
      setMessage(t.adminCreateSuccess);
      await loadUsers();
      await loadMessages();
      if (result.user?.id) {
        setSelectedUserId(result.user.id);
      }
      onAdminDataChanged?.();
    } catch (createError) {
      setError(createError.message || t.adminCreateError);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`${t.adminDeleteConfirm} ${user.email}?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin?action=users&id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminDeleteError);
      }
      setMessage(t.adminDeleteSuccess);
      setSelectedUserPlans([]);
      setSelectedUserSnapshots([]);
      setSelectedUserId('');
      await loadUsers();
      onAdminDataChanged?.();
    } catch (deleteError) {
      setError(deleteError.message || t.adminDeleteError);
    }
  };

  const handleRestoreSnapshot = async (snapshot) => {
    if (!selectedUser) {
      return;
    }
    if (!window.confirm(`${t.adminRestoreConfirm} ${selectedUser.email} · ${snapshot.snapshotDate}?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin?action=restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ userId: selectedUser.id, snapshotId: snapshot.id }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.adminRestoreError);
      }
      setMessage(t.adminRestoreSuccess);
      await Promise.all([loadUserPlans(selectedUser.id), loadUserSnapshots(selectedUser.id)]);
      onAdminDataChanged?.();
      if (selectedUser.id === currentUser?.id) {
        onRefreshCurrentUser?.();
      }
    } catch (restoreError) {
      setError(restoreError.message || t.adminRestoreError);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={{ marginBottom: '0.35rem' }}>{t.adminPanelTitle}</h2>
            <p style={styles.headerNote}>{t.adminPanelSubtitle}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        {(error || message) && (
          <div style={{ ...styles.flash, color: error ? 'var(--danger-color)' : 'var(--success-color)' }}>
            {error || message}
          </div>
        )}

        <div style={styles.layout}>
          <div style={styles.sidebar}>
            <div style={styles.sectionHeader}>{t.adminUsers}</div>
            <div style={styles.userList}>
              {users.map((user) => (
                <button
                  key={user.id}
                  className="glass-button"
                  style={{
                    ...styles.userItem,
                    borderColor: selectedUserId === user.id ? 'var(--accent-color)' : 'var(--glass-border)',
                  }}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <div style={styles.userPrimary}>{user.username || user.email}</div>
                  <div style={styles.userMeta}>{user.email}</div>
                  <div style={styles.userMeta}>{t.adminPlanCount}: {user.planCount || 0}</div>
                  {viewedUserId === user.id && <div style={styles.viewingFlag}>{t.adminViewingNow}</div>}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.main}>
            <div className="glass-panel" style={styles.card}>
              <div style={styles.sectionHeader}>{t.adminCreateUser}</div>
              <form onSubmit={handleCreateUser} style={styles.createForm}>
                <input className="glass-input" placeholder={t.emailPlaceholder} value={createForm.email} onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))} required />
                <input className="glass-input" placeholder={t.usernamePlaceholder} value={createForm.username} onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))} />
                <input className="glass-input" type="password" placeholder={t.passwordPlaceholder} value={createForm.password} onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))} required />
                <button className="glass-button active-tab" type="submit">{t.adminCreateUser}</button>
              </form>
            </div>

            <div className="glass-panel" style={styles.card}>
              <div style={styles.sectionHeader}>{t.adminUserDetails}</div>
              {loading ? (
                <div style={styles.empty}>{t.adminLoading}</div>
              ) : selectedUser ? (
                <>
                  <div style={styles.userDetails}>
                    <div><b>{t.usernamePlaceholder}:</b> {selectedUser.username || '—'}</div>
                    <div><b>{t.emailPlaceholder}:</b> {selectedUser.email}</div>
                    <div><b>{t.adminRole}:</b> {selectedUser.role}</div>
                    <div><b>{t.adminPlanCount}:</b> {selectedUserPlans.length}</div>
                  </div>
                  <div style={styles.actionRow}>
                    <button className="glass-button active-tab" onClick={() => onOpenUserSchedule?.(selectedUser)}>
                      {t.adminOpenSchedule}
                    </button>
                    {selectedUser.role !== 'admin' && (
                      <button className="glass-button" style={styles.dangerBtn} onClick={() => handleDeleteUser(selectedUser)}>
                        {t.adminDeleteUser}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={styles.empty}>{t.adminNoUserSelected}</div>
              )}
            </div>

            <div style={styles.gridCols}>
              <div className="glass-panel" style={styles.card}>
                <div style={styles.sectionHeader}>{t.adminViewPlans}</div>
                <div style={styles.scrollArea}>
                  {selectedUserPlans.length > 0 ? selectedUserPlans.map((plan) => (
                    <div key={plan.id} style={styles.planItem}>
                      <div style={styles.planTitle}>{plan.event || '—'}</div>
                      <div style={styles.planMeta}>{plan.date} {plan.time || ''}</div>
                      <div style={styles.planMeta}>{t.adminStatus}: {plan.status} · {plan.progress || 0}%</div>
                    </div>
                  )) : <div style={styles.empty}>{t.adminNoPlans}</div>}
                </div>
              </div>

              <div className="glass-panel" style={styles.card}>
                <div style={styles.sectionHeader}>{t.adminSnapshots}</div>
                <div style={styles.scrollArea}>
                  {selectedUserSnapshots.length > 0 ? selectedUserSnapshots.map((snapshot) => (
                    <div key={snapshot.id} style={styles.snapshotItem}>
                      <div>
                        <div style={styles.planTitle}>{snapshot.snapshotDate}</div>
                        <div style={styles.planMeta}>{snapshot.planCount} {t.adminPlansUnit} · {snapshot.source}</div>
                      </div>
                      <button className="glass-button" onClick={() => handleRestoreSnapshot(snapshot)}>{t.adminRestore}</button>
                    </div>
                  )) : <div style={styles.empty}>{t.adminNoSnapshots}</div>}
                </div>
              </div>
            </div>

            <div className="glass-panel" style={styles.card}>
              <div style={styles.sectionHeader}>{t.adminMessages}</div>
              <div style={styles.scrollAreaLarge}>
                {messages.length > 0 ? messages.map((item) => (
                  <div key={item.id} style={styles.messageItem}>
                    <div style={styles.planTitle}>{item.username || item.userEmail}</div>
                    <div style={styles.planMeta}>{item.userEmail} · {item.createdAt}</div>
                    <div style={styles.messageContent}>{item.content}</div>
                    <div style={styles.planMeta}>{t.adminEmailStatus}: {item.emailStatus}</div>
                  </div>
                )) : <div style={styles.empty}>{t.adminNoMessages}</div>}
              </div>
            </div>
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
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11000,
    padding: '1rem',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: 'min(1240px, 96vw)',
    maxHeight: '92vh',
    overflow: 'hidden',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  headerNote: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '2rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  flash: {
    fontSize: '0.92rem',
    minHeight: '1.2rem',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: '1rem',
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebar: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    overflow: 'auto',
    paddingRight: '0.25rem',
  },
  userItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    gap: '0.25rem',
    width: '100%',
  },
  userPrimary: {
    fontWeight: 600,
  },
  userMeta: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
  },
  viewingFlag: {
    fontSize: '0.72rem',
    color: '#10b981',
    fontWeight: 600,
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minHeight: 0,
    overflow: 'auto',
    paddingRight: '0.25rem',
  },
  card: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
  },
  sectionHeader: {
    fontSize: '1rem',
    fontWeight: 600,
  },
  createForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.75rem',
  },
  userDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.5rem 1rem',
    fontSize: '0.92rem',
  },
  actionRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  dangerBtn: {
    borderColor: 'var(--danger-color)',
    color: 'var(--danger-color)',
  },
  gridCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem',
  },
  scrollArea: {
    maxHeight: '300px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  scrollAreaLarge: {
    maxHeight: '260px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  planItem: {
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.04)',
  },
  snapshotItem: {
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  messageItem: {
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  planTitle: {
    fontWeight: 600,
    marginBottom: '0.2rem',
  },
  planMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  empty: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
};

export default AdminPanel;

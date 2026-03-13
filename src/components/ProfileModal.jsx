import React, { useEffect, useState } from 'react';

const ProfileModal = ({ isOpen, onClose, currentUser, t, onProfileUpdated }) => {
  const [form, setForm] = useState({ username: '', birthday: '', currentPassword: '', newPassword: '' });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) {
      return;
    }
    setForm({
      username: currentUser.username || '',
      birthday: currentUser.birthday || '',
      currentPassword: '',
      newPassword: '',
    });
    setFeedback('');
    setError('');
  }, [isOpen, currentUser]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback('');
    setError('');

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.profileUpdateError);
      }
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      setFeedback(t.profileUpdateSuccess);
      onProfileUpdated?.(result.user);
    } catch (submitError) {
      setError(submitError.message || t.profileUpdateError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h2>{t.profileTitle}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input className="glass-input" placeholder={t.usernamePlaceholder} value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} />
          <input className="glass-input" type="date" value={form.birthday} onChange={(event) => setForm((prev) => ({ ...prev, birthday: event.target.value }))} />
          <input className="glass-input" type="password" placeholder={t.profileCurrentPassword} value={form.currentPassword} onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))} />
          <input className="glass-input" type="password" placeholder={t.profileNewPassword} value={form.newPassword} onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))} />
          {feedback && <div style={{ color: 'var(--success-color)' }}>{feedback}</div>}
          {error && <div style={{ color: 'var(--danger-color)' }}>{error}</div>}
          <div style={styles.actions}>
            <button type="button" className="glass-button" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="glass-button active-tab" disabled={saving}>{saving ? t.submitting : t.profileSaveBtn}</button>
          </div>
        </form>
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
    width: 'min(560px, 96vw)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '2rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
};

export default ProfileModal;

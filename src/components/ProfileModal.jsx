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
          <div style={styles.formSection}>
            <label style={styles.label}>{t.usernamePlaceholder}</label>
            <input 
              className="glass-input" 
              placeholder={t.usernamePlaceholder} 
              value={form.username} 
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} 
            />
            <span style={styles.helperText}>你的昵称或显示名称</span>
          </div>

          <div style={styles.formSection}>
            <label style={styles.label}>生日（可选）</label>
            <input 
              className="glass-input" 
              type="date" 
              value={form.birthday} 
              onChange={(event) => setForm((prev) => ({ ...prev, birthday: event.target.value }))} 
            />
            <span style={styles.helperText}>用于发送生日祝福邮件</span>
          </div>

          {/* 密码更新部分 */}
          <div style={styles.divider} />
          
          <div style={styles.sectionTitle}>🔐 更改密码</div>
          
          <div style={styles.formSection}>
            <label style={styles.label}>{t.profileCurrentPassword}</label>
            <input 
              className="glass-input" 
              type="password" 
              placeholder={t.profileCurrentPassword} 
              value={form.currentPassword} 
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))} 
            />
            <span style={styles.helperText}>输入当前密码以验证身份</span>
          </div>

          {form.newPassword && (
            <div style={styles.formSection}>
              <div style={styles.passwordStrength}>
                密码强度：{form.newPassword.length < 8 ? '弱' : form.newPassword.length < 12 ? '中' : '强'}
              </div>
            </div>
          )}
          
          <div style={styles.formSection}>
            <label style={styles.label}>{t.profileNewPassword}</label>
            <input 
              className="glass-input" 
              type="password" 
              placeholder={t.profileNewPassword} 
              value={form.newPassword} 
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))} 
            />
            <span style={styles.helperText}>留空表示不修改密码（至少 6 个字符）</span>
          </div>

          {(feedback || error) && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: error ? 'var(--danger-color)' : 'var(--success-color)',
              border: `1px solid ${error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
            }}>
              {error || feedback}
            </div>
          )}

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
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  helperText: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  },
  divider: {
    height: '1px',
    background: 'var(--glass-border)',
    margin: '0.5rem 0',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginTop: '0.5rem',
  },
  passwordStrength: {
    fontSize: '0.85rem',
    color: 'var(--accent-color)',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
};

export default ProfileModal;

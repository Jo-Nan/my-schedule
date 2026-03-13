import React, { useState } from 'react';

const AuthOverlay = ({ onAuthenticated, t }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', username: '', code: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (mode === 'forgot') {
        const response = await fetch('/api/auth?action=request-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email: form.email.trim() }),
        });
        const result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || t.authUnknownError);
        }
        setSuccess(t.resetCodeSent);
      } else if (mode === 'reset') {
        const response = await fetch('/api/auth?action=reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            email: form.email.trim(),
            code: form.code.trim(),
            newPassword: form.newPassword,
          }),
        });
        const result = await response.json();
        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || t.authUnknownError);
        }
        setSuccess(t.resetPasswordSuccess);
        setMode('login');
        setForm((prev) => ({ ...prev, password: '', code: '', newPassword: '' }));
      } else {
        const endpoint = mode === 'login' ? '/api/auth?action=login' : '/api/auth?action=register';
        const payload = {
          email: form.email.trim(),
          password: form.password,
        };

        if (mode === 'register') {
          payload.username = form.username.trim();
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || t.authUnknownError);
        }

        onAuthenticated(result.user);
      }
    } catch (submitError) {
      setError(submitError.message || t.authUnknownError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container" style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <img src="logo.png" alt="NanMuZ Logo" style={styles.logo} />
        <h2>{t.title}</h2>
        <p style={styles.subtitle}>
          {mode === 'login' && t.loginSubtitle}
          {mode === 'register' && t.registerSubtitle}
          {mode === 'forgot' && t.forgotSubtitle}
          {mode === 'reset' && t.resetSubtitle}
        </p>

        <div style={styles.modeSwitcher}>
          <button type="button" className={`glass-button ${mode === 'login' ? 'active-tab' : ''}`} style={styles.modeButton} onClick={() => switchMode('login')}>{t.loginBtn}</button>
          <button type="button" className={`glass-button ${mode === 'register' ? 'active-tab' : ''}`} style={styles.modeButton} onClick={() => switchMode('register')}>{t.registerBtn}</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input type="email" className="glass-input" placeholder={t.emailPlaceholder} value={form.email} onChange={(e) => updateField('email', e.target.value)} autoFocus required />

          {mode === 'register' && (
            <input type="text" className="glass-input" placeholder={t.usernamePlaceholder} value={form.username} onChange={(e) => updateField('username', e.target.value)} />
          )}

          {(mode === 'login' || mode === 'register') && (
            <input type="password" className="glass-input" placeholder={t.passwordPlaceholder} value={form.password} onChange={(e) => updateField('password', e.target.value)} required />
          )}

          {mode === 'forgot' && (
            <div style={styles.infoBanner}>
              <div style={styles.infoBannerTitle}>📧 密码重置步骤</div>
              <ol style={styles.stepsList}>
                <li>输入你的账户邮箱地址</li>
                <li>点击"发送重置码"</li>
                <li>查看邮箱中的重置码</li>
                <li>点击"我有重置码"使用重置码</li>
              </ol>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div style={styles.infoBanner}>
                <div style={styles.infoBannerTitle}>验证重置码</div>
                <p style={styles.infoText}>请输入从邮箱收到的重置码和新密码</p>
              </div>
              <input type="text" className="glass-input" placeholder={t.resetCodePlaceholder} value={form.code} onChange={(e) => updateField('code', e.target.value)} maxLength="6" required />
              <input type="password" className="glass-input" placeholder={t.resetNewPasswordPlaceholder} value={form.newPassword} onChange={(e) => updateField('newPassword', e.target.value)} required />
              {form.newPassword && (
                <div style={{...styles.infoBanner, background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.2)'}}>
                  密码强度：{form.newPassword.length < 8 ? '弱 ⚠️' : form.newPassword.length < 12 ? '中等 ✓' : '强 ✓'}（至少 6 个字符）
                </div>
              )}
            </>
          )}

          <button type="submit" className="glass-button" style={styles.button} disabled={isSubmitting}>
            {isSubmitting
              ? t.submitting
              : mode === 'login'
                ? t.loginBtn
                : mode === 'register'
                  ? t.registerBtn
                  : mode === 'forgot'
                    ? t.requestResetBtn
                    : t.resetPasswordBtn}
          </button>
        </form>

        <div style={styles.linkRow}>
          <button type="button" style={styles.linkButton} onClick={() => switchMode('forgot')}>{t.forgotPasswordBtn}</button>
          <button type="button" style={styles.linkButton} onClick={() => switchMode('reset')}>{t.haveResetCodeBtn}</button>
        </div>

        {success && <p style={styles.successText}>{success}</p>}
        {error && <p style={styles.errorText}>{error}</p>}
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  panel: {
    padding: '3rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    maxWidth: '420px',
    width: '92%',
  },
  logo: {
    width: '90px',
    height: '90px',
    borderRadius: '20px',
    marginBottom: '1.5rem',
    boxShadow: '0 0 20px rgba(0,0,0,0.5)',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
  },
  modeSwitcher: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
    marginBottom: '1rem',
  },
  modeButton: {
    flex: 1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    gap: '1rem',
  },
  button: {
    padding: '0.8em',
    marginTop: '0.5rem',
  },
  linkRow: {
    width: '100%',
    marginTop: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-color)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  successText: {
    color: 'var(--success-color)',
    marginTop: '1rem',
    fontSize: '0.9rem',
  },
  infoBanner: {
    background: 'rgba(59, 130, 246, 0.08)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'left',
  },
  infoBannerTitle: {
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: 'var(--accent-color)',
  },
  stepsList: {
    margin: 0,
    paddingLeft: '1.5rem',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  },
  infoText: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  errorText: {
    color: 'var(--danger-color)',
    marginTop: '1rem',
    fontSize: '0.9rem',
  },
};

export default AuthOverlay;

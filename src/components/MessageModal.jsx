import React, { useState } from 'react';

const MessageModal = ({ isOpen, onClose, t }) => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('idle');
  const [feedback, setFeedback] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    setFeedback('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ content }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || t.messageSendError);
      }
      setContent('');
      setStatus('success');
      setFeedback(t.messageSendSuccess);
    } catch (error) {
      setStatus('error');
      setFeedback(error.message || t.messageSendError);
    }
  };

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modal}>
        <div style={styles.header}>
          <h2>{t.messageAdminTitle}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <p style={styles.info}>{t.messageAdminSubtitle}</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            className="glass-input"
            style={styles.textarea}
            placeholder={t.messagePlaceholder}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
          {feedback && (
            <div style={{ color: status === 'error' ? 'var(--danger-color)' : 'var(--success-color)' }}>
              {feedback}
            </div>
          )}
          <div style={styles.actions}>
            <button type="button" className="glass-button" onClick={onClose}>{t.cancel}</button>
            <button type="submit" className="glass-button active-tab" disabled={status === 'submitting'}>
              {status === 'submitting' ? t.submitting : t.messageSendBtn}
            </button>
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
  info: {
    color: 'var(--text-secondary)',
    fontSize: '0.92rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  textarea: {
    minHeight: '180px',
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
  },
};

export default MessageModal;

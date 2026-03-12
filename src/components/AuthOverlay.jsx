import React, { useState, useEffect } from 'react';

const AuthOverlay = ({ onAuthenticated, t }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  
  // SHA-256 hash of '571428'
  const HASHED_PASSWORD = '99742880c98f869153cb100ca2c3666b6c086d0ba5032049e9cf245942f62b4d'; 
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 5;

  useEffect(() => {
    // Check local storage for persistent authentication
    const isAuth = localStorage.getItem('nanmuz_auth');
    if (isAuth === 'true') {
      onAuthenticated();
    }
    
    // Check for existing lockout
    const savedLockout = localStorage.getItem('nanmuz_lockout');
    if (savedLockout && new Date(savedLockout) > new Date()) {
      setLockoutUntil(new Date(savedLockout));
    }
  }, [onAuthenticated]);

  const hashPassword = async (pwd) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (lockoutUntil && new Date() < lockoutUntil) {
      return;
    }

    const hashedInput = await hashPassword(password);
    
    if (hashedInput === HASHED_PASSWORD) {
      localStorage.setItem('nanmuz_auth', 'true');
      localStorage.removeItem('nanmuz_lockout');
      setError(false);
      onAuthenticated();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(true);
      
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = new Date(new Date().getTime() + LOCKOUT_MINUTES * 60000);
        setLockoutUntil(until);
        localStorage.setItem('nanmuz_lockout', until.toISOString());
        setAttempts(0);
      }
      
      setTimeout(() => setError(false), 2000);
    }
  };

  const isLocked = lockoutUntil && new Date() < lockoutUntil;
  const minutesLeft = isLocked ? Math.ceil((lockoutUntil - new Date()) / 60000) : 0;

  return (
    <div className="auth-container" style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <img src="logo.png" alt="NanMuZ Logo" style={styles.logo} />
        <h2>{t.title}</h2>
        <p style={styles.subtitle}>{t.subtitle}</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            className="glass-input"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={error ? { ...styles.inputError } : {}}
            disabled={isLocked}
            autoFocus
          />
          <button 
            type="submit" 
            className="glass-button" 
            style={styles.button}
            disabled={isLocked}
          >
            {isLocked ? t.lockoutMessage(minutesLeft) : t.unlockBtn}
          </button>
        </form>
        {error && !isLocked && <p className="animate-fade-in" style={styles.errorText}>{t.accessDenied}</p>}
        {isLocked && <p className="animate-fade-in" style={styles.errorText}>{t.lockoutMessage(minutesLeft)}</p>}
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
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
    maxWidth: '400px',
    width: '90%',
  },
  logo: {
    width: '90px',
    height: '90px',
    borderRadius: '20px',
    marginBottom: '1.5rem',
    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    fontSize: '0.95rem'
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
  inputError: {
    borderColor: 'var(--danger-color)',
    boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
  },
  errorText: {
    color: 'var(--danger-color)',
    marginTop: '1rem',
    fontSize: '0.9rem',
  }
};

export default AuthOverlay;

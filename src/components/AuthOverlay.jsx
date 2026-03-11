import React, { useState, useEffect } from 'react';

const AuthOverlay = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  
  // A simple predefined password for device verification
  const EXPECTED_PASSWORD = '571428'; 
  
  useEffect(() => {
    // Check local storage for persistent authentication
    const isAuth = localStorage.getItem('nanmuz_auth');
    if (isAuth === 'true') {
      onAuthenticated();
    }
  }, [onAuthenticated]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === EXPECTED_PASSWORD) {
      localStorage.setItem('nanmuz_auth', 'true');
      setError(false);
      onAuthenticated();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="auth-container" style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <img src="/logo.png" alt="NanMuZ Logo" style={styles.logo} />
        <h2>Welcome to NanMuZ's Schedule</h2>
        <p style={styles.subtitle}>Enter your password to access your private plans.</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            className="glass-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={error ? { ...styles.inputError } : {}}
            autoFocus
          />
          <button type="submit" className="glass-button" style={styles.button}>
            Unlock Device
          </button>
        </form>
        {error && <p className="animate-fade-in" style={styles.errorText}>Access Denied</p>}
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

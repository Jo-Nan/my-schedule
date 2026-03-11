import React from 'react';

const Header = ({ viewMode, setViewMode, theme, toggleTheme }) => {
  return (
    <header className="glass-panel" style={styles.header}>
      <div style={styles.brand}>
        <img src="logo.png" alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>NanMuZ's Schedule</h1>
      </div>
      
      <div style={styles.controls}>
        <button 
          className="glass-button" 
          onClick={toggleTheme}
          style={styles.themeBtn}
          title="Toggle Theme"
        >
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
        <button 
          className={`glass-button ${viewMode === 'daily' ? 'active-tab' : ''}`}
          style={viewMode === 'daily' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('daily')}
        >
          Daily
        </button>
        <button 
          className={`glass-button ${viewMode === 'weekly' ? 'active-tab' : ''}`}
          style={viewMode === 'weekly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('weekly')}
        >
          Weekly
        </button>
        <button 
          className={`glass-button ${viewMode === 'monthly' ? 'active-tab' : ''}`}
          style={viewMode === 'monthly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('monthly')}
        >
          Monthly
        </button>
        <button 
          className={`glass-button ${viewMode === 'yearly' ? 'active-tab' : ''}`}
          style={viewMode === 'yearly' ? styles.activeBtn : styles.btn}
          onClick={() => setViewMode('yearly')}
        >
          Yearly
        </button>
      </div>
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    marginBottom: '2rem',
    borderRadius: '24px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logo: {
    width: '45px',
    height: '45px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    background: 'linear-gradient(90deg, var(--text-primary), var(--accent-color))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  controls: {
    display: 'flex',
    gap: '0.8rem',
    alignItems: 'center',
  },
  themeBtn: {
    padding: '0.5rem 1rem',
    marginRight: '1rem',
    background: 'var(--glass-bg)',
  },
  btn: {
    padding: '0.5rem 1.2rem',
  },
  activeBtn: {
    background: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
  }
};

export default Header;

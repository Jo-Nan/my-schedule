import React, { useEffect, useMemo, useRef, useState } from 'react';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import DailyView from './components/DailyView';
import YearlyView from './components/YearlyView';
import SyncModal from './components/SyncModal';
import AdminPanel from './components/AdminPanel';
import { fetchWeeklyWeather } from './utils/weatherApi';
import { translations } from './utils/translations';
import './index.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [viewMode, setViewMode] = useState('weekly');
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState(() => localStorage.getItem('nanmuz_lang') || 'en');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [plans, setPlans] = useState([]);
  const [weatherData, setWeatherData] = useState([]);

  const t = translations[language];
  const cacheKey = useMemo(() => (currentUser ? `nanmuz_plans_${currentUser.id}` : null), [currentUser]);
  const autoSyncTimerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastSyncedHashRef = useRef(null);

  const mergePlans = (localPlans, remotePlans) => {
    const merged = [];

    localPlans.forEach((localPlan) => {
      const remotePlan = remotePlans.find((plan) => plan.id === localPlan.id);
      if (remotePlan) {
        merged.push((remotePlan.updatedAt || 0) > (localPlan.updatedAt || 0) ? remotePlan : localPlan);
      } else {
        merged.push(localPlan);
      }
    });

    remotePlans.forEach((remotePlan) => {
      if (!localPlans.some((plan) => plan.id === remotePlan.id)) {
        merged.push(remotePlan);
      }
    });

    return merged;
  };

  const refreshCurrentUserPlans = async ({ silent = false } = {}) => {
    if (!currentUser) {
      return;
    }

    if (!silent) {
      setSyncStatus('loading');
    }

    try {
      const response = await fetch(`/api/load-plans?t=${Date.now()}`, { credentials: 'same-origin' });
      if (response.status === 401) {
        setCurrentUser(null);
        setPlans([]);
        return;
      }
      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to load plans');
      }

      setPlans((prev) => {
        const merged = mergePlans(prev, result.data || []);
        const hash = JSON.stringify(merged);
        lastSyncedHashRef.current = hash;
        isInitializedRef.current = true;
        return merged;
      });

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Load plans failed:', error);
      isInitializedRef.current = true;
      setSyncStatus('error');
      if (!silent) {
        alert(t.syncError || 'Sync failed');
      }
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('nanmuz_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const result = await response.json();
        if (result.status === 'success') {
          setCurrentUser(result.user);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (!cacheKey) {
      setPlans([]);
      return;
    }

    const savedPlans = localStorage.getItem(cacheKey);
    const parsedPlans = savedPlans ? JSON.parse(savedPlans) : [];
    setPlans(parsedPlans);
    lastSyncedHashRef.current = JSON.stringify(parsedPlans);
    isInitializedRef.current = false;
  }, [cacheKey]);

  useEffect(() => {
    if (cacheKey) {
      localStorage.setItem(cacheKey, JSON.stringify(plans));
    }

    if (isInitializedRef.current && currentUser) {
      const currentHash = JSON.stringify(plans);
      if (currentHash === lastSyncedHashRef.current) {
        return;
      }

      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }

      autoSyncTimerRef.current = setTimeout(() => {
        handleExport();
      }, 500);
    }
  }, [plans, cacheKey, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    refreshCurrentUserPlans({ silent: true });
    fetchWeeklyWeather().then((data) => setWeatherData(Array.isArray(data) ? data : []));
  }, [currentUser]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key.toLowerCase() === 't') {
        toggleTheme();
      }
      if (event.altKey && event.key.toLowerCase() === 'l') {
        toggleLanguage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, language]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('nanmuz_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    localStorage.setItem('nanmuz_lang', newLang);
  };

  const handleSync = async () => {
    await refreshCurrentUserPlans();
  };

  const handleExport = async () => {
    setSyncStatus('uploading');
    try {
      const response = await fetch('/api/save-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(plans),
      });

      if (response.status === 401) {
        setCurrentUser(null);
        setPlans([]);
        return;
      }
      if (!response.ok) {
        throw new Error('Save failed');
      }

      const result = await response.json();
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to save plans');
      }

      lastSyncedHashRef.current = JSON.stringify(plans);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setSyncStatus('error');
      alert((t.uploadError || t.syncError) || 'Save failed');
    }
  };

  const getLocalDateStr = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updatePlan = (id, updates) => {
    setPlans((prev) => prev.map((plan) => (
      plan.id === id ? { ...plan, ...updates, updatedAt: Date.now() } : plan
    )));
  };

  const addPlan = (newPlan) => {
    const completePlan = {
      id: newPlan.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      event: newPlan.event || '',
      date: newPlan.date || getLocalDateStr(),
      time: newPlan.time || '',
      person: newPlan.person || 'self',
      ddl: newPlan.ddl || '',
      progress: newPlan.progress || 0,
      status: newPlan.status || 'uncompleted',
      updatedAt: Date.now(),
    };

    setPlans((prev) => [...prev, completePlan]);
  };

  const deletePlan = (id) => {
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
  };

  const handleAuthenticated = (user) => {
    setCurrentUser(user);
    setAuthReady(true);
    setSyncStatus('idle');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      setCurrentUser(null);
      setPlans([]);
      setWeatherData([]);
      setSyncStatus('idle');
      setIsAdminPanelOpen(false);
      isInitializedRef.current = false;
      lastSyncedHashRef.current = null;
    }
  };

  if (!authReady) {
    return <div style={styles.loading}>{t.authChecking}</div>;
  }

  if (!currentUser) {
    return <AuthOverlay onAuthenticated={handleAuthenticated} t={t} />;
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        theme={theme}
        toggleTheme={toggleTheme}
        toggleLanguage={toggleLanguage}
        t={t}
        onSync={handleSync}
        onUpload={handleExport}
        setSyncModalOpen={setIsSyncModalOpen}
        syncStatus={syncStatus}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
      />

      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} t={t} />
      <AdminPanel
        isOpen={isAdminPanelOpen && currentUser.role === 'admin'}
        onClose={() => setIsAdminPanelOpen(false)}
        currentUser={currentUser}
        t={t}
        onAdminDataChanged={() => {
          if (currentUser?.role === 'admin') {
            refreshCurrentUserPlans({ silent: true });
          }
        }}
        onRefreshCurrentUser={() => refreshCurrentUserPlans({ silent: true })}
      />

      <main>
        {viewMode === 'daily' && (
          <DailyView plans={plans} updatePlan={updatePlan} addPlan={addPlan} deletePlan={deletePlan} weatherData={weatherData} t={t} />
        )}
        {viewMode === 'weekly' && (
          <WeeklyView plans={plans} updatePlan={updatePlan} addPlan={addPlan} deletePlan={deletePlan} weatherData={weatherData} t={t} />
        )}
        {viewMode === 'monthly' && <MonthlyView plans={plans} t={t} />}
        {viewMode === 'yearly' && <YearlyView plans={plans} addPlan={addPlan} t={t} />}
      </main>
    </div>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: '1rem',
  },
};

export default App;

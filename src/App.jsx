import React, { useState, useEffect, useRef } from 'react';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import DailyView from './components/DailyView';
import YearlyView from './components/YearlyView';
import SyncModal from './components/SyncModal';
import { fetchWeeklyWeather } from './utils/weatherApi';
import { translations } from './utils/translations';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [viewMode, setViewMode] = useState('weekly'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [language, setLanguage] = useState(() => localStorage.getItem('nanmuz_lang') || 'en');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'loading', 'uploading', 'synced', 'error'

  const t = translations[language];
  
  // Synchronous initialization prevents overwriting saved data on hard reloads
  const [plans, setPlans] = useState(() => {
    const savedPlans = localStorage.getItem('nanmuz_plans');
    return savedPlans ? JSON.parse(savedPlans) : [];
  });
  
  const [weatherData, setWeatherData] = useState([]);
  
  // Debounce timer for auto-sync
  const autoSyncTimerRef = useRef(null);

  // Init Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('nanmuz_theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('nanmuz_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Save plans to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('nanmuz_plans', JSON.stringify(plans));
  }, [plans]);

  // Sync Logic
  const mergePlans = (local, remote) => {
    const merged = [...local];
    remote.forEach(remotePlan => {
      const existingIdx = merged.findIndex(p => p.id === remotePlan.id);
      if (existingIdx > -1) {
        if ((remotePlan.updatedAt || 0) > (merged[existingIdx].updatedAt || 0)) {
          merged[existingIdx] = remotePlan;
        }
      } else {
        merged.push(remotePlan);
      }
    });
    return merged;
  };

  const handleSync = async () => {
    setSyncStatus('loading');
    try {
      const response = await fetch('/api/load-plans?t=' + Date.now());

      if (!response.ok) throw new Error('Sync failed');
      const result = await response.json();
      
      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to load plans from GitHub');
      }

      const remotePlans = result.data || [];
      const merged = mergePlans(plans, remotePlans);
      setPlans(merged);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error('Sync Error:', err);
      setSyncStatus('error');
      alert(t.syncError || 'Sync failed');
    }
  };

  const handleExport = async () => {
    setSyncStatus('uploading');
    try {
      const response = await fetch('/api/save-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plans)
      });

      if (!response.ok) throw new Error('Save failed');
      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.message || 'Failed to save plans to GitHub');
      }

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error('Export error:', err);
      setSyncStatus('error');
      alert((t.uploadError || t.syncError) || 'Save failed');
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+T: Toggle Theme
      if (e.altKey && e.key.toLowerCase() === 't') {
        toggleTheme();
      }
      // Alt+L: Toggle Language
      if (e.altKey && e.key.toLowerCase() === 'l') {
        toggleLanguage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, language]);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    localStorage.setItem('nanmuz_lang', newLang);
  };

  // Fetch weather data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchWeeklyWeather().then(data => {
        setWeatherData(data);
      });
    }
  }, [isAuthenticated]);

  // Trigger debounced auto-sync (合并多个快速操作为一次同步)
  const triggerAutoSync = () => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    autoSyncTimerRef.current = setTimeout(() => {
      handleExport();
    }, 500);
  };

  const updatePlan = (id, updates) => {
    setPlans(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p);
      triggerAutoSync();
      return updated;
    });
  };

  const addPlan = (newPlan) => {
    setPlans(prev => {
      const updated = [...prev, { ...newPlan, updatedAt: Date.now() }];
      triggerAutoSync();
      return updated;
    });
  };

  const deletePlan = (id) => {
    setPlans(prev => {
      const updated = prev.filter(p => p.id !== id);
      triggerAutoSync();
      return updated;
    });
  };

  if (!isAuthenticated) {
    return <AuthOverlay onAuthenticated={() => setIsAuthenticated(true)} t={t} />;
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <Header 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        language={language}
        toggleLanguage={toggleLanguage}
        t={t}
        onSync={() => handleSync()}
        onUpload={() => handleExport()}
        setSyncModalOpen={setIsSyncModalOpen}
        syncStatus={syncStatus}
      />
      
      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        t={t}
      />
      
      <main>
        {viewMode === 'daily' && (
          <DailyView 
            plans={plans} 
            updatePlan={updatePlan} 
            addPlan={addPlan} 
            deletePlan={deletePlan}
            weatherData={weatherData} 
            t={t}
          />
        )}
        {viewMode === 'weekly' && (
          <WeeklyView 
            plans={plans} 
            updatePlan={updatePlan} 
            addPlan={addPlan} 
            deletePlan={deletePlan}
            weatherData={weatherData} 
            t={t}
          />
        )}
        {viewMode === 'monthly' && (
          <MonthlyView plans={plans} t={t} />
        )}
        {viewMode === 'yearly' && (
          <YearlyView plans={plans} addPlan={addPlan} t={t} />
        )}
      </main>
    </div>
  );
}

export default App;

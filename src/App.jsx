import React, { useState, useEffect } from 'react';
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
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
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
      const response = await fetch('./data/plans.json?t=' + Date.now()); // Anti-cache
      if (!response.ok) throw new Error('Fetch failed');
      const remotePlans = await response.json();
      
      const merged = mergePlans(plans, remotePlans);
      setPlans(merged);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      alert(t.syncError);
    }
  };

  const handleExport = () => {
    setSyncStatus('uploading');
    try {
      const dataStr = JSON.stringify(plans, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'plans.json';
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
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

  const updatePlan = (id, updates) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const addPlan = (newPlan) => {
    setPlans(prev => [...prev, { ...newPlan, updatedAt: Date.now() }]);
  };

  const deletePlan = (id) => {
    setPlans(prev => prev.filter(p => p.id !== id));
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

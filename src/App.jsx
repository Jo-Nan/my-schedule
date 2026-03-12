import React, { useState, useEffect } from 'react';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import DailyView from './components/DailyView';
import YearlyView from './components/YearlyView';
import { fetchWeeklyWeather } from './utils/weatherApi';
import { translations } from './utils/translations';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'weekly', 'monthly', 'yearly'
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [language, setLanguage] = useState(() => localStorage.getItem('nanmuz_lang') || 'en');
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

  // (Removed async load effect since we now initialize synchronously in useState)

  // Save plans to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('nanmuz_plans', JSON.stringify(plans));
  }, [plans]);

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
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const addPlan = (newPlan) => {
    setPlans(prev => [...prev, newPlan]);
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
      />
      
      <main>
        {viewMode === 'daily' && (
          <DailyView 
            plans={plans} 
            updatePlan={updatePlan} 
            addPlan={addPlan} 
            deletePlan={deletePlan}
            weatherData={weatherData} 
          />
        )}
        {viewMode === 'weekly' && (
          <WeeklyView 
            plans={plans} 
            updatePlan={updatePlan} 
            addPlan={addPlan} 
            deletePlan={deletePlan}
            weatherData={weatherData} 
          />
        )}
        {viewMode === 'monthly' && (
          <MonthlyView plans={plans} />
        )}
        {viewMode === 'yearly' && (
          <YearlyView plans={plans} addPlan={addPlan} />
        )}
      </main>
    </div>
  );
}

export default App;

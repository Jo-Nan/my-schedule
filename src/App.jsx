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
  // Track if we should auto-sync (skip initial load)
  const isInitializedRef = useRef(false);

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
    
    // Auto-sync with debounce when plans change (but skip initial load)
    if (isInitializedRef.current && isAuthenticated) {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
      autoSyncTimerRef.current = setTimeout(() => {
        console.log('[AutoSync] Syncing updated plans to GitHub');
        handleExport();
      }, 500);
    }
  }, [plans, isAuthenticated]);

  // Sync Logic - 正确处理数据合并
  const mergePlans = (local, remote) => {
    // 基于远程数据构建最终结果（远程是真实来源）
    const merged = [];
    const remoteIds = new Set(remote.map(p => p.id));
    
    // 1. 遍历本地数据，如果在远程存在则比较时间戳
    local.forEach(localPlan => {
      const remoteIndex = remote.findIndex(p => p.id === localPlan.id);
      if (remoteIndex > -1) {
        // 本地和远程都有 - 保留更新的版本
        const remotePlan = remote[remoteIndex];
        if ((remotePlan.updatedAt || 0) > (localPlan.updatedAt || 0)) {
          merged.push(remotePlan);
        } else {
          merged.push(localPlan);
        }
      } else {
        // 本地有但远程没有 - 可能被其他浏览器删除，不要加回
        console.log(`[Sync] Skipping locally deleted item: ${localPlan.id}`);
      }
    });
    
    // 2. 添加远程独有的项目（其他浏览器新增的）
    remote.forEach(remotePlan => {
      if (!local.some(p => p.id === remotePlan.id)) {
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

      // 保存成功后，立即重新同步确保所有浏览器数据一致
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const syncResponse = await fetch('/api/load-plans?t=' + Date.now());
      if (!syncResponse.ok) throw new Error('Sync after save failed');
      
      const syncResult = await syncResponse.json();
      if (syncResult.status === 'success') {
        const remotePlans = syncResult.data || [];
        // 直接使用远程数据作为真实来源（避免再次合并）
        setPlans(remotePlans);
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

  // Auto-sync and fetch weather when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Mark as initialized after first load
      isInitializedRef.current = false;
      
      // Auto-load plans from GitHub on page load/refresh
      // 使用智能合并：优先保留本地较新的数据
      const loadAndMergePlans = async () => {
        try {
          const response = await fetch('/api/load-plans?t=' + Date.now());
          if (!response.ok) return;
          
          const result = await response.json();
          if (result.status === 'success') {
            const remotePlans = result.data || [];
            // 使用 mergePlans 确保本地更新的数据不会被覆盖
            setPlans(prev => {
              const merged = mergePlans(prev, remotePlans);
              // 初始化完成后，后续改动会自动 sync
              isInitializedRef.current = true;
              return merged;
            });
          }
        } catch (err) {
          console.error('Auto-sync on load failed:', err);
          isInitializedRef.current = true;
        }
      };
      
      loadAndMergePlans();
      
      // Fetch weather data
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
      return updated;
    });
    // useEffect 会自动检测 plans 变化并触发 auto-sync
  };

  const addPlan = (newPlan) => {
    // 确保新计划有所有必需的字段
    const completePlan = {
      id: newPlan.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      event: newPlan.event || '',
      date: newPlan.date || new Date().toISOString().split('T')[0],
      time: newPlan.time || '',
      person: newPlan.person || 'self',
      ddl: newPlan.ddl || '',
      progress: newPlan.progress || 0,
      status: newPlan.status || 'uncompleted',
      updatedAt: Date.now()
    };
    
    setPlans(prev => {
      const updated = [...prev, completePlan];
      return updated;
    });
    // useEffect 会自动检测 plans 变化并触发 auto-sync
  };

  const deletePlan = (id) => {
    setPlans(prev => {
      const updated = prev.filter(p => p.id !== id);
      return updated;
    });
    // useEffect 会自动检测 plans 变化并触发 auto-sync
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

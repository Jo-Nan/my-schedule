import { useEffect, useMemo, useRef, useState } from 'react';
import AuthOverlay from './components/AuthOverlay';
import Header from './components/Header';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import DailyView from './components/DailyView';
import YearlyView from './components/YearlyView';
import SyncModal from './components/SyncModal';
import AdminPanel from './components/AdminPanel';
import MessageModal from './components/MessageModal';
import ProfileModal from './components/ProfileModal';
import ImportModal from './components/ImportModal';
import MapView from './components/MapView';
import { fetchWeeklyWeather } from './utils/weatherApi';
import { translations } from './utils/translations';
import './index.css';

const APP_VERSION = __APP_VERSION__;
const APP_BUILD_TIME = __APP_BUILD_TIME__;

const normalizeAttachment = (attachment, index = 0) => ({
  id: typeof attachment?.id === 'string' && attachment.id.trim()
    ? attachment.id
    : `att_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
  name: typeof attachment?.name === 'string' ? attachment.name : '',
  url: typeof attachment?.url === 'string' ? attachment.url : '',
  pathname: typeof attachment?.pathname === 'string' ? attachment.pathname : '',
  size: Number.isFinite(attachment?.size) ? Math.max(0, Math.round(attachment.size)) : 0,
  contentType: typeof attachment?.contentType === 'string' ? attachment.contentType : '',
  uploadedAt: typeof attachment?.uploadedAt === 'string' ? attachment.uploadedAt : new Date().toISOString(),
});

const formatBuildTime = (value) => {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const normalizeImportedPlan = (plan, index, fallbackDate) => ({
  id: typeof plan?.id === 'string' && plan.id.trim() ? plan.id : `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  event: typeof plan?.event === 'string' ? plan.event : '',
  date: typeof plan?.date === 'string' && plan.date ? plan.date : fallbackDate,
  time: typeof plan?.time === 'string' ? plan.time : '',
  person: typeof plan?.person === 'string' && plan.person ? plan.person : 'self',
  ddl: typeof plan?.ddl === 'string' ? plan.ddl : '',
  details: typeof plan?.details === 'string' ? plan.details : '',
  attachments: Array.isArray(plan?.attachments)
    ? plan.attachments.map((attachment, attachmentIndex) => normalizeAttachment(attachment, attachmentIndex)).filter((attachment) => attachment.url)
    : [],
  progress: Number.isFinite(plan?.progress) ? Math.max(0, Math.min(100, Math.round(plan.progress))) : 0,
  status: typeof plan?.status === 'string' && plan.status ? plan.status : 'uncompleted',
  updatedAt: Number.isFinite(plan?.updatedAt) ? plan.updatedAt : Date.now(),
});

const extractImportedPlans = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.plans)) {
    return payload.plans;
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  return null;
};

const mergeImportedPlans = (currentPlans, importedPlans) => {
  const importedById = new Map(importedPlans.map((plan) => [plan.id, plan]));
  const merged = currentPlans.map((plan) => importedById.get(plan.id) || plan);
  const existingIds = new Set(currentPlans.map((plan) => plan.id));
  const appended = importedPlans.filter((plan) => !existingIds.has(plan.id));
  return [...merged, ...appended];
};

const getInitialViewMode = () => {
  if (typeof window === 'undefined') {
    return 'weekly';
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') === 'map' ? 'map' : 'weekly';
  } catch {
    return 'weekly';
  }
};

const getInitialShareToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('share') || '').trim();
  } catch {
    return '';
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [managedUser, setManagedUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [viewMode, setViewMode] = useState(() => getInitialViewMode());
  const [shareTokenInUrl, setShareTokenInUrl] = useState(() => getInitialShareToken());
  const [sharedMapWorkspace, setSharedMapWorkspace] = useState(null);
  const [sharedMapOwnerName, setSharedMapOwnerName] = useState('');
  const [sharedMapStatus, setSharedMapStatus] = useState('idle');
  const [sharedMapError, setSharedMapError] = useState('');
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState(() => localStorage.getItem('nanmuz_lang') || 'en');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [plans, setPlans] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false);
  const [pendingSaveType, setPendingSaveType] = useState('none');
  const [pendingImport, setPendingImport] = useState(null);
  const [copiedPlan, setCopiedPlan] = useState(null);
  const buildLabel = useMemo(() => formatBuildTime(APP_BUILD_TIME), []);

  const t = translations[language];
  const activeUser = managedUser || currentUser;
  const isViewingManagedUser = Boolean(currentUser && managedUser && currentUser.id !== managedUser.id);
  const cacheKey = useMemo(() => (activeUser ? `nanmuz_plans_${activeUser.id}` : null), [activeUser]);
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

  const fetchWorkspacePlans = async () => {
    if (!activeUser || !currentUser) {
      return [];
    }

    const endpoint = isViewingManagedUser
      ? `/api/admin?action=user-plans&userId=${encodeURIComponent(activeUser.id)}`
      : `/api/plans?t=${Date.now()}`;

    const response = await fetch(endpoint, { credentials: 'same-origin' });
    if (response.status === 401) {
      setCurrentUser(null);
      setManagedUser(null);
      setPlans([]);
      return null;
    }

    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Failed to load plans');
    }

    if (isViewingManagedUser && result.user) {
      setManagedUser(result.user);
    }

    const rawPlans = result.plans || result.data || [];
    if (!Array.isArray(rawPlans)) {
      return [];
    }

    const fallbackDate = getLocalDateStr();
    return rawPlans.map((plan, index) => normalizeImportedPlan(plan, index, fallbackDate));
  };

  const refreshWorkspacePlans = async ({ silent = false } = {}) => {
    if (!activeUser || !currentUser) {
      return;
    }

    if (!silent) {
      setSyncStatus('loading');
    }

    try {
      const remotePlans = await fetchWorkspacePlans();
      if (!remotePlans) {
        return;
      }

      setPlans((prev) => {
        const merged = mergePlans(prev, remotePlans);
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
    const syncViewModeWithUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const isMapPage = params.get('page') === 'map';
      const nextShareToken = (params.get('share') || '').trim();
      setShareTokenInUrl(nextShareToken);
      setViewMode((previous) => {
        if (isMapPage) {
          return 'map';
        }
        return previous === 'map' ? 'weekly' : previous;
      });
    };

    window.addEventListener('popstate', syncViewModeWithUrl);
    return () => window.removeEventListener('popstate', syncViewModeWithUrl);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const isMapInUrl = url.searchParams.get('page') === 'map';

    if (viewMode === 'map' && !isMapInUrl) {
      url.searchParams.set('page', 'map');
      const nextSearch = url.searchParams.toString();
      window.history.pushState(
        { page: 'map' },
        '',
        `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`,
      );
      return;
    }

    if (viewMode !== 'map' && isMapInUrl) {
      url.searchParams.delete('page');
      const nextSearch = url.searchParams.toString();
      window.history.pushState(
        { page: 'schedule' },
        '',
        `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`,
      );
    }
  }, [viewMode]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth', { credentials: 'same-origin' });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const result = await response.json();
        if (result.status === 'success') {
          setCurrentUser(result.user);
          setManagedUser(null);
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
    if (!shareTokenInUrl) {
      setSharedMapWorkspace(null);
      setSharedMapOwnerName('');
      setSharedMapStatus('idle');
      setSharedMapError('');
      return;
    }

    let cancelled = false;
    const loadSharedWorkspace = async () => {
      setSharedMapStatus('loading');
      setSharedMapError('');

      try {
        const response = await fetch(`/api/maps-share?token=${encodeURIComponent(shareTokenInUrl)}&t=${Date.now()}`, {
          credentials: 'same-origin',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.status !== 'success' || !result?.workspace) {
          throw new Error(result?.message || 'Shared map not available');
        }
        if (cancelled) {
          return;
        }
        setSharedMapWorkspace(result.workspace);
        setSharedMapOwnerName(result?.owner?.username || '');
        setSharedMapStatus('ready');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSharedMapWorkspace(null);
        setSharedMapOwnerName('');
        setSharedMapStatus('error');
        setSharedMapError(error?.message || 'Shared map not available');
      }
    };

    loadSharedWorkspace();
    return () => {
      cancelled = true;
    };
  }, [shareTokenInUrl]);

  useEffect(() => {
    if (!cacheKey) {
      setPlans([]);
      return;
    }

    const savedPlans = localStorage.getItem(cacheKey);
    const parsedPlans = savedPlans ? JSON.parse(savedPlans) : [];
    const fallbackDate = getLocalDateStr();
    const normalizedPlans = Array.isArray(parsedPlans)
      ? parsedPlans.map((plan, index) => normalizeImportedPlan(plan, index, fallbackDate))
      : [];
    setPlans(normalizedPlans);
    lastSyncedHashRef.current = JSON.stringify(normalizedPlans);
    isInitializedRef.current = false;
  }, [cacheKey]);

  useEffect(() => {
    if (cacheKey) {
      localStorage.setItem(cacheKey, JSON.stringify(plans));
    }

    if (isInitializedRef.current && activeUser && currentUser) {
      const currentHash = JSON.stringify(plans);
      if (currentHash === lastSyncedHashRef.current) {
        return;
      }

      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }

      const delay = pendingSaveType === 'progress' ? 30000 : 500;
      autoSyncTimerRef.current = setTimeout(() => {
        handleExport({ silent: true });
      }, delay);
    }
  }, [plans, cacheKey, currentUser, activeUser, pendingSaveType]);

  useEffect(() => {
    if (!activeUser || !currentUser) {
      return;
    }

    refreshWorkspacePlans({ silent: true });
    fetchWeeklyWeather().then((data) => setWeatherData(Array.isArray(data) ? data : []));
  }, [activeUser?.id, currentUser?.id]);

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
    await refreshWorkspacePlans();
  };

  const handleImport = async (file) => {
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const importedPlans = extractImportedPlans(parsed);

      if (!importedPlans) {
        throw new Error('Invalid import format');
      }

      const fallbackDate = getLocalDateStr();
      const normalizedPlans = importedPlans.map((plan, index) => normalizeImportedPlan(plan, index, fallbackDate));
      setPendingImport({
        fileName: file.name,
        plans: normalizedPlans,
      });
    } catch (error) {
      console.error('Import error:', error);
      alert(t.importError || 'Failed to import file');
    }
  };

  const finalizeImport = (mode) => {
    if (!pendingImport) {
      return;
    }

    if (mode === 'replace') {
      setPlans(pendingImport.plans);
    } else {
      setPlans((prev) => mergeImportedPlans(prev, pendingImport.plans));
    }

    setHasUnsavedProgress(false);
    setPendingSaveType('general');
    setPendingImport(null);
    alert(t.importSuccess || 'Import completed. Plans will be saved automatically.');
  };

  const handleExport = async ({ silent = false } = {}) => {
    if (!activeUser || !currentUser) {
      return;
    }

    setSyncStatus('uploading');
    try {
      const endpoint = isViewingManagedUser ? '/api/admin?action=user-plans' : '/api/plans';
      const payload = isViewingManagedUser ? { userId: activeUser.id, plans } : plans;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setCurrentUser(null);
        setManagedUser(null);
        setPlans([]);
        return;
      }
      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to save plans');
      }

      lastSyncedHashRef.current = JSON.stringify(plans);
      setHasUnsavedProgress(false);
      setPendingSaveType('none');
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setSyncStatus('error');
      if (!silent) {
        alert((t.uploadError || t.syncError) || 'Save failed');
      }
    }
  };

  const getLocalDateStr = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const updatePlan = (id, updates, options = {}) => {
    setPlans((prev) => prev.map((plan) => (
      plan.id === id ? { ...plan, ...updates, updatedAt: Date.now() } : plan
    )));
    if (options.saveStrategy === 'progress') {
      setHasUnsavedProgress(true);
      setPendingSaveType('progress');
    } else {
      setPendingSaveType('general');
    }
  };

  const addPlan = (newPlan) => {
    const completePlan = {
      id: newPlan.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      event: newPlan.event || '',
      date: newPlan.date || getLocalDateStr(),
      time: newPlan.time || '',
      person: newPlan.person || 'self',
      ddl: newPlan.ddl || '',
      details: newPlan.details || '',
      attachments: Array.isArray(newPlan.attachments)
        ? newPlan.attachments.map((attachment, index) => normalizeAttachment(attachment, index)).filter((attachment) => attachment.url)
        : [],
      progress: newPlan.progress || 0,
      status: newPlan.status || 'uncompleted',
      updatedAt: Date.now(),
    };

    setPlans((prev) => [...prev, completePlan]);
    setPendingSaveType('general');
  };

  const copyPlan = (plan) => {
    if (!plan) {
      return;
    }
    setCopiedPlan({ ...plan });
  };

  const exportPlans = () => {
    if (!activeUser) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      userId: activeUser.id,
      username: activeUser.username || '',
      plans,
    };

    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `plans-${activeUser.username || activeUser.id}-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const pastePlanToDate = (targetDate) => {
    if (!copiedPlan || !targetDate) {
      return false;
    }

    addPlan({
      ...copiedPlan,
      id: undefined,
      date: targetDate,
      updatedAt: Date.now(),
    });
    return true;
  };

  const deletePlan = (id) => {
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
    setPendingSaveType('general');
  };

  const handleAuthenticated = (user) => {
    setCurrentUser(user);
    setManagedUser(null);
    setAuthReady(true);
    setSyncStatus('idle');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth?action=logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      setCurrentUser(null);
      setManagedUser(null);
      setPlans([]);
      setWeatherData([]);
      setSyncStatus('idle');
      setIsAdminPanelOpen(false);
      setIsMessageModalOpen(false);
      setIsProfileModalOpen(false);
      setHasUnsavedProgress(false);
      setPendingSaveType('none');
      isInitializedRef.current = false;
      lastSyncedHashRef.current = null;
    }
  };

  const sharedPageText = language === 'zh'
    ? {
        loading: '正在加载分享地图...',
        invalid: '分享链接无效或已关闭。',
      }
    : {
        loading: 'Loading shared map...',
        invalid: 'Share link is invalid or disabled.',
      };

  if (shareTokenInUrl) {
    if (sharedMapStatus === 'loading' || (sharedMapStatus !== 'error' && !sharedMapWorkspace)) {
      return <div style={styles.loading}>{sharedPageText.loading}</div>;
    }

    if (sharedMapStatus === 'error' || !sharedMapWorkspace) {
      return (
        <div style={styles.shareState}>
          <p style={styles.shareStateTitle}>{sharedPageText.invalid}</p>
          {sharedMapError ? <p style={styles.shareStateMessage}>{sharedMapError}</p> : null}
        </div>
      );
    }

    return (
      <div className="animate-fade-in" style={{ width: '100%' }}>
        <main>
          <MapView
            activeUserId=""
            activeUserName={sharedMapOwnerName}
            language={language}
            onBackToSchedule={() => {}}
            readOnly
            sharedWorkspace={sharedMapWorkspace}
            sharedOwnerName={sharedMapOwnerName}
            sharedToken={shareTokenInUrl}
          />
        </main>
        <footer style={styles.footer}>
          <span style={styles.footerLabel}>Version {APP_VERSION}</span>
          <span style={styles.footerDivider}>·</span>
          <span style={styles.footerLabel}>Deploy Time {buildLabel} (Shanghai)</span>
        </footer>
      </div>
    );
  }

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
        language={language}
        setLanguage={setLanguage}
        t={t}
        onSync={handleSync}
        onUpload={handleExport}
        onImport={handleImport}
        onExport={exportPlans}
        setSyncModalOpen={setIsSyncModalOpen}
        syncStatus={syncStatus}
        currentUser={currentUser}
        activeUser={activeUser}
        isViewingManagedUser={isViewingManagedUser}
        onExitManagedView={() => setManagedUser(null)}
        onOpenMessage={() => setIsMessageModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenMap={() => setViewMode('map')}
        onLogout={handleLogout}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        hasUnsavedProgress={hasUnsavedProgress}
      />

      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} t={t} />
      <ImportModal
        isOpen={Boolean(pendingImport)}
        fileName={pendingImport?.fileName || ''}
        itemCount={pendingImport?.plans?.length || 0}
        onReplace={() => finalizeImport('replace')}
        onMerge={() => finalizeImport('merge')}
        onClose={() => setPendingImport(null)}
        t={t}
      />
      <MessageModal isOpen={isMessageModalOpen} onClose={() => setIsMessageModalOpen(false)} t={t} />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        t={t}
        onProfileUpdated={(user) => {
          setCurrentUser(user);
          if (!managedUser) {
            setManagedUser(null);
          }
        }}
      />
      <AdminPanel
        isOpen={isAdminPanelOpen && currentUser.role === 'admin'}
        onClose={() => setIsAdminPanelOpen(false)}
        currentUser={currentUser}
        t={t}
        viewedUserId={activeUser?.id}
        onOpenUserSchedule={(user) => {
          setManagedUser(user.id === currentUser.id ? null : user);
          setIsAdminPanelOpen(false);
        }}
        onAdminDataChanged={() => {
          if (activeUser) {
            refreshWorkspacePlans({ silent: true });
          }
        }}
        onRefreshCurrentUser={() => refreshWorkspacePlans({ silent: true })}
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
            activeUserId={activeUser?.id || ''}
            onCopyPlan={copyPlan}
            onPastePlan={pastePlanToDate}
            hasCopiedPlan={Boolean(copiedPlan)}
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
            activeUserId={activeUser?.id || ''}
            onCopyPlan={copyPlan}
            onPastePlan={pastePlanToDate}
            hasCopiedPlan={Boolean(copiedPlan)}
          />
        )}
        {viewMode === 'monthly' && <MonthlyView plans={plans} t={t} />}
        {viewMode === 'yearly' && <YearlyView plans={plans} addPlan={addPlan} t={t} />}
        {viewMode === 'map' && (
          <MapView
            activeUserId={activeUser?.id || ''}
            activeUserName={activeUser?.username || activeUser?.email || ''}
            language={language}
            onBackToSchedule={() => setViewMode('weekly')}
          />
        )}
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerLabel}>Version {APP_VERSION}</span>
        <span style={styles.footerDivider}>·</span>
        <span style={styles.footerLabel}>Deploy Time {buildLabel} (Shanghai)</span>
      </footer>
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
  shareState: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    color: 'var(--text-primary)',
    padding: '1rem',
  },
  shareStateTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  shareStateMessage: {
    margin: '0.45rem 0 0',
    color: 'var(--text-secondary)',
    fontSize: '0.86rem',
  },
  footer: {
    marginTop: '2.5rem',
    padding: '1rem 0 0.25rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
    color: 'var(--text-tertiary)',
    fontSize: '0.8rem',
    letterSpacing: '0.02em',
  },
  footerLabel: {
    whiteSpace: 'nowrap',
  },
  footerDivider: {
    opacity: 0.5,
  },
};

export default App;

import React, { useState, useEffect } from 'react';
import PlanCard from './PlanCard';
import PlanModal from './PlanModal';

const sharedCalendarNavText = {
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: '0.01em',
};

const DailyView = ({ plans, updatePlan, addPlan, deletePlan, weatherData, t, activeUserId, onCopyPlan, onPastePlan, hasCopiedPlan }) => {
  const [modalState, setModalState] = useState({ isOpen: false, date: null, editingPlan: null });
  // Start from Today
  const [currentDateObj, setCurrentDateObj] = useState(new Date());
  // Current time display
  const [currentTime, setCurrentTime] = useState(new Date());
  // Drag & drop state
  const [draggedPlan, setDraggedPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  // Get local date string (handles timezone correctly)
  const getLocalDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateStr = getLocalDateStr(currentDateObj);
  const isToday = dateStr === getLocalDateStr(new Date());
  
  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const dayWeather = weatherData.find(w => w.date === dateStr);
  
  const dayPlans = plans.filter(p => p.date === dateStr);
  dayPlans.sort((a,b) => {
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    return (a.time || '').localeCompare(b.time || '');
  });

  const getDayName = (dStr) => {
    return new Intl.DateTimeFormat(t.languageToggle === '🌐 English' ? 'en-US' : 'zh-CN', { weekday: 'long' }).format(new Date(dStr));
  };
  const getFullDateDisplay = (dStr) => {
    return new Intl.DateTimeFormat(t.languageToggle === '🌐 English' ? 'en-US' : 'zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(dStr));
  };

  const handlePrevDay = () => {
    const prev = new Date(currentDateObj);
    prev.setDate(prev.getDate() - 1);
    setCurrentDateObj(prev);
  };
  const handleNextDay = () => {
    const next = new Date(currentDateObj);
    next.setDate(next.getDate() + 1);
    setCurrentDateObj(next);
  };
  const handleToday = () => {
    setCurrentDateObj(new Date());
  };

  const handleEdit = (plan) => {
    setModalState({ isOpen: true, date: plan.date, editingPlan: plan });
  };

  // Drag & drop handlers
  const handleDragStart = (e, plan) => {
    setDraggedPlan(plan);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetDate) => {
    e.preventDefault();
    if (draggedPlan && draggedPlan.date !== targetDate) {
      updatePlan(draggedPlan.id, { date: targetDate });
    }
    setDraggedPlan(null);
  };

  const handleDragEnd = () => {
    setDraggedPlan(null);
  };

  const completedCount = dayPlans.filter(p => p.status === 'completed').length;
  const totalCount = dayPlans.length;
  const progressRatio = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  useEffect(() => {
    const activePlan = selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) : null;

    const isTypingTarget = (target) => {
      const tag = target?.tagName;
      return target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event) => {
      if ((!event.metaKey && !event.ctrlKey) || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c' && activePlan) {
        event.preventDefault();
        onCopyPlan?.(activePlan);
      }

      if (key === 'v' && hasCopiedPlan) {
        event.preventDefault();
        onPastePlan?.(dateStr);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dateStr, hasCopiedPlan, onCopyPlan, onPastePlan, plans, selectedPlanId]);

  return (
    <div className="animate-fade-in" style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null, editingPlan: null })}
        onSave={modalState.editingPlan ? updatePlan : addPlan}
        date={modalState.date}
        initialData={modalState.editingPlan}
        t={t}
      />

      {/* Focus Header */}
      <div className="glass-panel daily-focus-header" style={styles.focusHeader}>
        <div className="daily-header-top" style={styles.headerTop}>
          <button className="glass-button daily-nav-btn" style={styles.navBtn} onClick={handlePrevDay}>← {t.languageToggle === '🌐 English' ? 'Prev Day' : '前一天'}</button>
          
          <div className="daily-date-block" style={styles.dateBlock} onClick={handleToday} title={t.languageToggle === '🌐 English' ? 'Back to Today' : '回到今天'}>
            <div className="daily-date-hero" style={styles.dateHeroRow}>
              <div className="daily-date-headline" style={styles.dateHeadline}>
                <h1 style={styles.headerLine}>
                  <span style={styles.headerToken}>{getDayName(dateStr)}</span>
                  <span style={styles.headerDivider}>·</span>
                  <span style={styles.headerToken}>{getFullDateDisplay(dateStr)}</span>
                  {isToday && (
                    <>
                      <span style={styles.headerDivider}>·</span>
                      <span style={styles.headerToken}>
                        {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
                      </span>
                    </>
                  )}
                </h1>
              </div>
            </div>

            {!isToday && (
              <div className="daily-quick-actions" style={styles.quickActions}>
                <button className="glass-button" style={styles.todayShortcutBtn} onClick={(e) => {
                  e.stopPropagation();
                  handleToday();
                }}>
                  {t.backToToday}
                </button>
              </div>
            )}
          </div>

          <button className="glass-button daily-nav-btn" style={styles.navBtn} onClick={handleNextDay}>{t.languageToggle === '🌐 English' ? 'Next Day' : '后一天'} →</button>
        </div>

        {/* Weather Sub-panel for Daily Focus */}
        <div className="daily-insight-bar" style={styles.insightBar}>
            {new Date(dateStr) >= new Date(getLocalDateStr(new Date())) ? (
            dayWeather ? (
              <div className="daily-weather-widget" style={styles.weatherWidget}>
                <div style={styles.wMain}>
                  <span style={{ fontSize: '2rem' }}>{dayWeather.icon}</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{Math.round(dayWeather.tempMax)}°</span>
                </div>
                <div style={styles.wDetails}>
                  <span>💧 {t.languageToggle === '🌐 English' ? 'Hum' : '湿度'}: {dayWeather.humidity}%</span>
                  <span style={{ color: dayWeather.aqiLabel.color, fontWeight: 'bold' }}>
                    {t.languageToggle === '🌐 English' ? 'Air' : '空气'}: {dayWeather.aqiLabel.label}
                  </span>
                </div>
              </div>
            ) : (
                <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t.languageToggle === '🌐 English' ? 'Loading local weather...' : '正在加载天气...'}</div>
            )
          ) : (
            <div style={{ color: 'var(--text-tertiary)' }}>{t.languageToggle === '🌐 English' ? 'No weather data for past dates.' : '过去日期无天气数据。'}</div>
          )}

          {/* Daily Progress Widget */}
          <div className="daily-progress-widget" style={styles.progressWidget}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{t.languageToggle === '🌐 English' ? 'Daily Mission' : '今日目标'}</h3>
            <div style={styles.progressText}>
              <span style={{ fontSize: '2rem', fontWeight: 'bold', color: progressRatio === 100 ? 'var(--success-color)' : 'var(--text-primary)' }}>
                {completedCount}
              </span>
              <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}> / {totalCount}</span>
            </div>
            <div style={styles.pgBarBg}>
              <div style={{ ...styles.pgBarFill, width: `${progressRatio}%`, background: progressRatio === 100 ? 'var(--success-color)' : 'var(--accent-color)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Layout */}
      <div 
        className="daily-timeline-container" 
        style={styles.timelineContainer}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, dateStr)}
      >
        {dayPlans.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '4rem', margin: 0 }}>☕️</p>
            <h3 style={{ color: 'var(--text-secondary)' }}>{t.languageToggle === '🌐 English' ? 'No plans scheduled for this day yet.' : '今天还没有计划。'}</h3>
          </div>
        ) : (
          <div className="daily-plans-stack" style={styles.plansStack}>
            {dayPlans.map(plan => (
              <div key={plan.id} className="daily-plan-wrapper" style={styles.planWrapper}>
                {/* Visual Timeline Node */}
                <div className="daily-timeline-node-box" style={styles.timelineNodeBox}>
                  <div style={{
                    ...styles.timelineNode,
                    borderColor: plan.status === 'completed' ? 'var(--success-color)' : 'var(--text-tertiary)',
                    background: plan.status === 'completed' ? 'var(--success-color)' : 'transparent'
                  }} />
                  <div style={{
                     ...styles.timelineLine,
                     background: plan.status === 'completed' ? 'var(--success-color)' : 'var(--glass-border)'
                  }} />
                </div>
                
                {/* Resizing PlanCard for focus mode */}
                <div style={styles.expandedCard}>
                  <PlanCard 
                    plan={plan} 
                    updatePlan={updatePlan} 
                    deletePlan={deletePlan} 
                    onEdit={handleEdit}
                    activeUserId={activeUserId}
                    onDragStart={(e) => handleDragStart(e, plan)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedPlan?.id === plan.id}
                    isSelected={selectedPlanId === plan.id}
                    onSelect={(selectedPlan) => setSelectedPlanId(selectedPlan.id)}
                    t={t}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div 
          className="glass-button daily-add-button" 
          style={styles.hugeAddBtn}
          onClick={() => setModalState({ isOpen: true, date: dateStr, editingPlan: null })}
        >
          <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>+</span>
          {t.addPlan}
        </div>

        <button
          className="glass-button daily-fab"
          style={styles.mobileFab}
          onClick={() => setModalState({ isOpen: true, date: dateStr, editingPlan: null })}
          aria-label={t.addPlan}
        >
          +
        </button>
      </div>

    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem'
  },
  focusHeader: {
    display: 'flex',
    flexDirection: 'column',
    padding: '2rem',
    gap: '2rem'
  },
  dateHeroRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  dateHeadline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  headerLine: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.55rem',
    flexWrap: 'nowrap',
    width: '100%',
    color: 'var(--text-primary)',
    fontSize: '1.08rem',
    fontWeight: '500',
    lineHeight: 1.35,
    minWidth: 0,
  },
  headerToken: {
    fontSize: 'inherit',
    fontWeight: 'inherit',
    color: 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  headerDivider: {
    color: 'var(--text-tertiary)',
    fontWeight: '400',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  dateBlock: {
    textAlign: 'center',
    cursor: 'pointer',
    flex: 1,
    minWidth: '280px',
  },
  quickActions: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '0.9rem',
  },
  navBtn: {
    padding: '0.58rem 1.12rem',
    ...sharedCalendarNavText,
  },
  todayShortcutBtn: {
    padding: '0.55rem 1rem',
    fontSize: '0.92rem',
  },
  insightBar: {
    display: 'flex',
    justifyContent: 'space-between',
    background: 'rgba(0,0,0,0.1)',
    padding: '1.5rem',
    borderRadius: '16px',
    border: '1px solid var(--glass-border)'
  },
  weatherWidget: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem'
  },
  wMain: { display: 'flex', alignItems: 'center', gap: '0.8rem' },
  wDetails: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', color: 'var(--text-secondary)' },
  progressWidget: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: '200px'
  },
  progressText: {
    margin: '0.5rem 0'
  },
  pgBarBg: {
    width: '100%',
    height: '8px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  pgBarFill: {
    height: '100%',
    transition: 'width 0.4s ease'
  },
  timelineContainer: {
    padding: '1rem 0'
  },
  plansStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0'
  },
  planWrapper: {
    display: 'flex',
    gap: '1.5rem',
  },
  timelineNodeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '30px',
  },
  timelineNode: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '3px solid',
    marginTop: '1.5rem',
    zIndex: 2,
    flexShrink: 0
  },
  timelineLine: {
    width: '3px',
    flexGrow: 1,
    marginTop: '0.5rem',
    marginBottom: '-1.5rem',
    zIndex: 1
  },
  expandedCard: {
    flexGrow: 1,
    marginBottom: '1.5rem'
  },
  hugeAddBtn: {
    width: '100%',
    padding: '1.5rem',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    background: 'transparent',
    color: 'var(--text-secondary)',
    marginTop: '2rem'
  },
  mobileFab: {
    display: 'none',
    position: 'fixed',
    right: '1rem',
    bottom: '1rem',
    width: '60px',
    height: '60px',
    borderRadius: '999px',
    padding: 0,
    fontSize: '2rem',
    lineHeight: 1,
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent-color)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
    zIndex: 1200,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
    opacity: 0.6
  }
};

export default DailyView;

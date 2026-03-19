import React, { useEffect, useRef, useState } from 'react';
import PlanCard from './PlanCard';
import PlanModal from './PlanModal';

const DAY_COLUMN_BASE_WIDTH = 260;
const DAY_COLUMN_SELECTED_RATIO = 1.2;

const sharedCalendarNavText = {
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: '0.01em',
};

// Helper: Get local date string (handles timezone correctly)
const getLocalDateStr = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const WeeklyView = ({ plans, updatePlan, addPlan, deletePlan, weatherData, t, activeUserId, onCopyPlans, onCutPlans, onPastePlan, hasClipboard }) => {
  // Sliding window navigation state
  const [dayOffset, setDayOffset] = useState(0);
  const gridRef = useRef(null);
  const dayRefs = useRef({});
  
  // Generate a window of 7 days based on dayOffset, with today as the 3rd column by default
  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(today.getDate() - 2 + dayOffset);
  
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return getLocalDateStr(d);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth > 900) return;

    const todayStr = getLocalDateStr(new Date());
    const targetDate = days.includes(todayStr) ? todayStr : days[0];
    const targetNode = dayRefs.current[targetDate];

    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    } else if (gridRef.current) {
      gridRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [days]);

  const getDayName = (dateStr) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat(t.languageToggle === '🌐 English' ? 'en-US' : 'zh-CN', { weekday: 'long' }).format(d);
  };

  const [modalState, setModalState] = useState({ isOpen: false, date: null, editingPlan: null });
  const [draggedPlan, setDraggedPlan] = useState(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr(new Date()));

  useEffect(() => {
    if (days.length > 0 && !days.includes(selectedDate)) {
      setSelectedDate(days[0]);
    }
  }, [days, selectedDate]);

  useEffect(() => {
    const visiblePlanIdSet = new Set(
      plans
        .filter((plan) => days.includes(plan.date))
        .map((plan) => plan.id),
    );
    setSelectedPlanIds((prev) => prev.filter((id) => visiblePlanIdSet.has(id)));
  }, [days, plans]);

  const handlePlanSelect = (selectedPlan, event) => {
    if (!selectedPlan?.id) {
      return;
    }

    const useMultiSelect = Boolean(event?.metaKey || event?.ctrlKey);
    if (!useMultiSelect) {
      setSelectedPlanIds([selectedPlan.id]);
      setSelectedDate(selectedPlan.date);
      return;
    }

    setSelectedPlanIds((prev) => (
      prev.includes(selectedPlan.id)
        ? prev.filter((id) => id !== selectedPlan.id)
        : [...prev, selectedPlan.id]
    ));
    setSelectedDate(selectedPlan.date);
  };

  useEffect(() => {
    const selectedPlans = selectedPlanIds
      .map((planId) => plans.find((plan) => plan.id === planId))
      .filter(Boolean);

    const isTypingTarget = (target) => {
      const tag = target?.tagName;
      return target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event) => {
      if ((!event.metaKey && !event.ctrlKey) || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c' && selectedPlans.length > 0) {
        event.preventDefault();
        onCopyPlans?.(selectedPlans);
      }

      if (key === 'x' && selectedPlans.length > 0) {
        event.preventDefault();
        onCutPlans?.(selectedPlans);
      }

      if (key === 'v' && hasClipboard && selectedDate) {
        event.preventDefault();
        onPastePlan?.(selectedDate);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasClipboard, onCopyPlans, onCutPlans, onPastePlan, plans, selectedDate, selectedPlanIds]);

  const handleAddTask = (date) => {
    setModalState({ isOpen: true, date, editingPlan: null });
  };

  const handleEditTask = (plan) => {
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

  return (
    <div style={styles.weekContainer}>
      {/* Week navigation */}
      <div className="glass-panel weekly-nav" style={styles.weekNav}>
        <button 
          className="glass-button"
          onClick={() => setDayOffset(dayOffset - 7)}
          style={styles.navBtn}
        >
          ← {t.languageToggle === '🌐 English' ? 'Prev Week' : '前一周'}
        </button>
        
        <div style={styles.weekLabel}>
          <div style={styles.dayJumpBar}>
            <button
              className="glass-button"
              onClick={() => setDayOffset(dayOffset - 1)}
              style={styles.dayNavBtn}
            >
              ← {t.languageToggle === '🌐 English' ? 'Prev Day' : '前一天'}
            </button>

            <button
              className="glass-button"
              onClick={() => setDayOffset(dayOffset + 1)}
              style={styles.dayNavBtn}
            >
              {t.languageToggle === '🌐 English' ? 'Next Day' : '后一天'} →
            </button>
          </div>
        </div>
        
        <button 
          className="glass-button"
          onClick={() => setDayOffset(dayOffset + 7)}
          style={styles.navBtn}
        >
          {t.languageToggle === '🌐 English' ? 'Next Week' : '后一周'} →
        </button>
      </div>

      {/* Days grid */}
      <div ref={gridRef} className="weekly-grid" style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null, editingPlan: null })}
        onSave={modalState.editingPlan ? updatePlan : addPlan}
        date={modalState.date}
        initialData={modalState.editingPlan}
        t={t}
      />
      {days.map(dateStr => {
        const isToday = dateStr === getLocalDateStr(new Date());
        const isSelected = selectedDate === dateStr;
        const dayWidth = isSelected
          ? Math.round(DAY_COLUMN_BASE_WIDTH * DAY_COLUMN_SELECTED_RATIO)
          : DAY_COLUMN_BASE_WIDTH;
        
        const yesterday = new Date();
        yesterday.setDate(new Date().getDate() - 1);
        const isYesterday = dateStr === getLocalDateStr(yesterday);

        const dayWeather = weatherData.find(w => w.date === dateStr);
        const dayPlans = plans.filter(p => p.date === dateStr);

        // Sort plans: incomplete first, then time
        dayPlans.sort((a,b) => {
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          return (a.time || '').localeCompare(b.time || '');
        });

        return (
          <div 
            key={dateStr} 
            ref={(node) => {
              if (node) dayRefs.current[dateStr] = node;
            }}
            className="glass-panel weekly-day-column" 
            style={{
              ...styles.dayColumn,
              ...(isSelected ? styles.dayColumnSelected : {}),
              width: `${dayWidth}px`,
              minWidth: `${dayWidth}px`,
              maxWidth: `${dayWidth}px`,
              borderColor: isToday ? 'var(--accent-color)' : 'var(--glass-border)',
              boxShadow: isToday ? 'var(--accent-glow)' : 'var(--glass-shadow)',
              backgroundColor: draggedPlan ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)',
            }}
            onClick={() => setSelectedDate(dateStr)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, dateStr)}
          >
            <div className="weekly-day-header" style={styles.dayHeader}>
              <div style={styles.dateInfo}>
                <span style={styles.weekday}>{getDayName(dateStr)}</span>
                <span style={styles.dateText}>{dateStr.slice(5)}</span>
                {isToday && <span style={styles.todayBadge}>{t.languageToggle === '🌐 English' ? 'Today' : '今天'}</span>}
                {isYesterday && <span style={styles.yesterdayBadge}>{t.languageToggle === '🌐 English' ? 'Yesterday' : '昨天'}</span>}
              </div>
              
              {new Date(dateStr) >= new Date(getLocalDateStr(new Date())) ? (
                dayWeather ? (
                  <div className="weekly-weather-block" style={styles.weatherBlock}>
                    <div style={styles.weatherMain}>
                      <span style={styles.icon}>{dayWeather.icon}</span>
                      <span style={styles.temp}>{Math.round(dayWeather.tempMax)}°</span>
                    </div>
                    <div style={styles.weatherDetails}>
                      <span>💧 {dayWeather.humidity}%</span>
                      <span style={{ color: dayWeather.aqiLabel.color }}>
                        AQI {Math.round(dayWeather.aqi)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{minHeight: '66px'}}></div>
                )
              ) : (
                <div style={{minHeight: '66px'}}></div>
              )}
            </div>

            <div style={styles.planList}>
              {dayPlans.map(plan => (
                <div
                  key={plan.id}
                  style={{
                    opacity: draggedPlan?.id === plan.id ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <PlanCard 
                    plan={plan} 
                    updatePlan={updatePlan} 
                    deletePlan={deletePlan} 
                    onEdit={handleEditTask}
                    activeUserId={activeUserId}
                    onDragStart={(e) => handleDragStart(e, plan)}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedPlan?.id === plan.id}
                    isSelected={selectedPlanIds.includes(plan.id)}
                    onSelect={handlePlanSelect}
                    t={t}
                  />
                </div>
              ))}
              <div 
                className="glass-button add-btn" 
                style={styles.addBtn}
                onClick={() => handleAddTask(dateStr)}
              >
                + {t.addPlan}
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  );
};

const styles = {
  weekContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
  },
  weekNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    gap: '1rem',
  },
  navBtn: {
    padding: '0.58rem 1.12rem',
    ...sharedCalendarNavText,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  dayJumpBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  dayNavBtn: {
    padding: '0.58rem 1.12rem',
    ...sharedCalendarNavText,
    whiteSpace: 'nowrap',
  },
  container: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '1rem',
    width: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    minHeight: '600px',
    paddingBottom: '0.2rem',
  },
  dayColumn: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1rem',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.4)',
    transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease, outline-color 0.2s ease',
  },
  dayColumnSelected: {
    outline: '2px solid rgba(59, 130, 246, 0.2)',
    outlineOffset: '2px',
  },
  dayHeader: {
    borderBottom: '1px solid var(--glass-border)',
    paddingBottom: '1rem',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
  },
  dateInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  weekday: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: 'var(--text-primary)',
  },
  dateText: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
  },
  todayBadge: {
    background: 'var(--accent-color)',
    color: '#fff',
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: '10px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
  },
  yesterdayBadge: {
    background: 'var(--warning-color)',
    color: '#fff',
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: '10px',
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
  },
  weatherBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    minHeight: '66px',
  },
  weatherMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1.2rem',
  },
  weatherDetails: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    gap: '2px',
    marginTop: '4px',
  },
  planList: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: '0.5rem',
  },
  addBtn: {
    textAlign: 'center',
    padding: '0.8rem',
    borderStyle: 'dashed',
    background: 'transparent',
    color: 'var(--text-secondary)',
    marginTop: '0.5rem',
  }
};

export default WeeklyView;

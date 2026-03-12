import React, { useState } from 'react';
import PlanCard from './PlanCard';
import PlanModal from './PlanModal';

const WeeklyView = ({ plans, updatePlan, addPlan, deletePlan, weatherData, t }) => {
  // Week navigation state
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Generate a window of 5 days based on weekOffset
  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(today.getDate() - 1 + weekOffset * 7); // Monday of that week
  
  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const getDayName = (dateStr) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat(t.languageToggle === '🌐 English' ? 'en-US' : 'zh-CN', { weekday: 'long' }).format(d);
  };

  const [modalState, setModalState] = useState({ isOpen: false, date: null, editingPlan: null });
  const [draggedPlan, setDraggedPlan] = useState(null);

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
      <div className="glass-panel" style={styles.weekNav}>
        <button 
          className="glass-button"
          onClick={() => setWeekOffset(weekOffset - 1)}
          style={styles.navBtn}
        >
          ← {t.languageToggle === '🌐 English' ? 'Prev Week' : '前一周'}
        </button>
        
        <div style={styles.weekLabel}>
          <h3 style={styles.weekTitle}>
            {t.languageToggle === '🌐 English' ? `Week of ${days[0]}` : `${days[0]} 周`}
          </h3>
        </div>
        
        <button 
          className="glass-button"
          onClick={() => setWeekOffset(weekOffset + 1)}
          style={styles.navBtn}
        >
          {t.languageToggle === '🌐 English' ? 'Next Week' : '后一周'} →
        </button>
      </div>

      {/* Days grid */}
      <div style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null, editingPlan: null })}
        onSave={modalState.editingPlan ? updatePlan : addPlan}
        date={modalState.date}
        initialData={modalState.editingPlan}
        t={t}
      />
      {days.map(dateStr => {
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        
        const yesterday = new Date();
        yesterday.setDate(new Date().getDate() - 1);
        const isYesterday = dateStr === yesterday.toISOString().split('T')[0];

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
            className="glass-panel" 
            style={{
              ...styles.dayColumn,
              borderColor: isToday ? 'var(--accent-color)' : 'var(--glass-border)',
              boxShadow: isToday ? 'var(--accent-glow)' : 'var(--glass-shadow)',
              backgroundColor: draggedPlan ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.4)',
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, dateStr)}
          >
            <div style={styles.dayHeader}>
              <div style={styles.dateInfo}>
                <span style={styles.weekday}>{getDayName(dateStr)}</span>
                <span style={styles.dateText}>{dateStr.slice(5)}</span>
                {isToday && <span style={styles.todayBadge}>{t.languageToggle === '🌐 English' ? 'Today' : '今天'}</span>}
                {isYesterday && <span style={styles.yesterdayBadge}>{t.languageToggle === '🌐 English' ? 'Yesterday' : '昨天'}</span>}
              </div>
              
              {new Date(dateStr) >= new Date(new Date().toISOString().split('T')[0]) ? (
                dayWeather ? (
                  <div style={styles.weatherBlock}>
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
                  <div style={{minHeight: '66px', opacity: 0.5}}>{t.languageToggle === '🌐 English' ? 'Fetching weather...' : '获取天气中...'}</div>
                )
              ) : (
                <div style={{minHeight: '66px'}}></div>
              )}
            </div>

            <div style={styles.planList}>
              {dayPlans.map(plan => (
                <div
                  key={plan.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, plan)}
                  onDragEnd={handleDragEnd}
                  style={{
                    opacity: draggedPlan?.id === plan.id ? 0.5 : 1,
                    cursor: 'grab',
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <PlanCard 
                    plan={plan} 
                    updatePlan={updatePlan} 
                    deletePlan={deletePlan} 
                    onEdit={handleEditTask}
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
    padding: '0.6rem 1.2rem',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  weekTitle: {
    margin: 0,
    fontSize: '1.3rem',
    color: 'var(--text-primary)',
  },
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '1rem',
    width: '100%',
    minHeight: '600px',
  },
  dayColumn: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1rem',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.4)',
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

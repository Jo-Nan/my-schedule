import React, { useState } from 'react';
import { getHolidayInfo } from '../utils/holidays';

const sharedMonthlyControlText = {
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

const MonthlyView = ({ plans, t }) => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Get days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const resetToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };
  
  const calendarGrid = [];
  // Fill empty slots for first week
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarGrid.push(null);
  }
  
  // Fill actual days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayPlans = plans.filter(p => p.date === dateStr);
    const holiday = getHolidayInfo(dateStr);
    calendarGrid.push({ 
      day: i, 
      dateStr, 
      plans: dayPlans,
      holiday,
    });
  }

  const isEn = t.languageToggle === '🌐 English';
  const weekdays = isEn 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="glass-panel animate-fade-in monthly-shell" style={styles.container}>
      <div className="monthly-header" style={styles.header}>
        <div className="monthly-nav-controls" style={styles.navControls}>
          <button className="glass-button" style={styles.navBtn} onClick={prevMonth}>← {t.prevMonth}</button>
        </div>
        
        <h2 className="monthly-title" style={styles.title} onClick={resetToToday} title={isEn ? "Back to current month" : "回到本月"}>
          {new Intl.DateTimeFormat(isEn ? 'en-US' : 'zh-CN', { month: 'long', year: 'numeric' }).format(currentDate)}
        </h2>
        
        <div className="monthly-nav-controls" style={styles.navControls}>
          <button className="glass-button" style={styles.navBtn} onClick={nextMonth}>{t.nextMonth} →</button>
        </div>
      </div>
      
      <div className="monthly-grid" style={styles.grid}>
        {weekdays.map(day => (
          <div key={day} className="monthly-weekday-header" style={styles.weekdayHeader}>{day}</div>
        ))}
        
        {calendarGrid.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="monthly-empty-cell" style={styles.emptyCell} />;
          }
          
          const isToday = cell.dateStr === getLocalDateStr();
          
          return (
            <div key={cell.dateStr} className="monthly-day-cell" style={{
              ...styles.dayCell,
              borderColor: isToday
                ? 'var(--accent-color)'
                : cell.holiday
                  ? `${cell.holiday.color}55`
                  : 'var(--glass-border)',
              background: cell.holiday
                ? `${cell.holiday.color}18`
                : isToday
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'transparent'
            }}>
              <div className="monthly-day-top" style={styles.dayTopRow}>
                <span style={{
                  ...styles.dayNumber,
                  color: cell.holiday
                    ? cell.holiday.color
                    : isToday
                      ? 'var(--accent-color)'
                      : 'inherit',
                  fontWeight: isToday ? 'bold' : 'normal'
                }}>
                  {cell.day}
                </span>
              </div>
              
              <div className="monthly-task-list" style={styles.taskListContainer}>
                {cell.plans.slice(0, 4).map((plan, i) => (
                  <div key={i} style={{
                    ...styles.taskLabel,
                    borderLeftColor: plan.status === 'completed' ? 'var(--success-color)' : 
                                     plan.status === 'in-progress' ? 'var(--warning-color)' : 
                                     'var(--danger-color)',
                    textDecoration: plan.status === 'completed' ? 'line-through' : 'none',
                    opacity: plan.status === 'completed' ? 0.6 : 1
                  }} className="monthly-task-label" title={plan.event}>
                    {plan.event}
                  </div>
                ))}
                {cell.plans.length > 4 && <div className="monthly-more-text" style={styles.moreText}>...and {cell.plans.length - 4} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    padding: '0 1rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    cursor: 'pointer',
    color: 'var(--accent-color)',
    minWidth: 0,
    maxWidth: '100%',
    textAlign: 'center',
    flex: 1,
    overflowWrap: 'anywhere',
  },
  navControls: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
  },
  navBtn: {
    padding: '0.58rem 1.12rem',
    ...sharedMonthlyControlText,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.5rem',
    minWidth: 0,
  },
  weekdayHeader: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: 'var(--text-secondary)',
    paddingBottom: '0.5rem',
  },
  emptyCell: {
    minHeight: '120px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    minWidth: 0,
  },
  dayCell: {
    minHeight: '120px',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.6rem',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s',
    minWidth: 0,
    overflow: 'hidden',
  },
  dayTopRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: '0.5rem',
    gap: '0.35rem',
    minWidth: 0,
  },
  dayNumber: {
    fontSize: '0.9rem',
  },
  taskListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden',
    minWidth: 0,
  },
  planLabel: {
    fontSize: '0.7rem',
    background: 'var(--glass-bg)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block', // ensuring block for ellipsis to work reliably
    width: '100%',
  },
  taskLabel: {
    fontSize: '0.75rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
    borderLeft: '3px solid',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
    boxSizing: 'border-box',
    width: '100%',
    color: 'var(--text-secondary)',
    minWidth: 0,
  },
  moreText: {
    fontSize: '0.7rem',
    textAlign: 'center',
    color: 'var(--text-tertiary)',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
};

export default MonthlyView;

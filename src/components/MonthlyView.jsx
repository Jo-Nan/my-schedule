import React, { useState } from 'react';

// Static Holiday Dictionary for demonstration (Current and adjacent months)
const HOLIDAYS = {
  '2026-01-01': 'New Year',
  '2026-02-17': 'Spring Festival',
  '2026-04-05': 'Qingming',
  '2026-05-01': 'Labor Day',
  '2026-06-19': 'Dragon Boat',
  '2026-09-25': 'Mid-Autumn',
  '2026-10-01': 'National Day'
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
    calendarGrid.push({ 
      day: i, 
      dateStr, 
      plans: dayPlans,
      holiday: HOLIDAYS[dateStr] 
    });
  }

  const isEn = t.languageToggle === '🌐 English';
  const weekdays = isEn 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="glass-panel animate-fade-in" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.navControls}>
          <button className="glass-button" style={styles.navBtn} onClick={prevMonth}>← {isEn ? 'Prev' : '上个月'}</button>
        </div>
        
        <h2 style={styles.title} onClick={resetToToday} title={isEn ? "Back to current month" : "回到本月"}>
          {new Intl.DateTimeFormat(isEn ? 'en-US' : 'zh-CN', { month: 'long', year: 'numeric' }).format(currentDate)}
        </h2>
        
        <div style={styles.navControls}>
          <button className="glass-button" style={styles.navBtn} onClick={nextMonth}>{isEn ? 'Next' : '下个月'} →</button>
        </div>
      </div>
      
      <div style={styles.grid}>
        {weekdays.map(day => (
          <div key={day} style={styles.weekdayHeader}>{day}</div>
        ))}
        
        {calendarGrid.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} style={styles.emptyCell} />;
          }
          
          const isToday = cell.dateStr === today.toISOString().split('T')[0];
          
          return (
            <div key={cell.dateStr} style={{
              ...styles.dayCell,
              borderColor: isToday ? 'var(--accent-color)' : 'var(--glass-border)',
              background: isToday ? 'rgba(99, 102, 241, 0.15)' : 'transparent'
            }}>
              <div style={styles.dayTopRow}>
                {cell.holiday && <span style={styles.holidayBadge}>🏮 {cell.holiday}</span>}
                <span style={{
                  ...styles.dayNumber,
                  color: isToday ? 'var(--accent-color)' : 'inherit',
                  fontWeight: isToday ? 'bold' : 'normal'
                }}>
                  {cell.day}
                </span>
              </div>
              
              <div style={styles.taskListContainer}>
                {cell.plans.slice(0, 4).map((plan, i) => (
                  <div key={i} style={{
                    ...styles.taskLabel,
                    borderLeftColor: plan.status === 'completed' ? 'var(--success-color)' : 
                                     plan.status === 'in-progress' ? 'var(--warning-color)' : 
                                     'var(--danger-color)',
                    textDecoration: plan.status === 'completed' ? 'line-through' : 'none',
                    opacity: plan.status === 'completed' ? 0.6 : 1
                  }} title={plan.event}>
                    {plan.event}
                  </div>
                ))}
                {cell.plans.length > 4 && <div style={styles.moreText}>...and {cell.plans.length - 4} more</div>}
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    padding: '0 1rem',
  },
  title: {
    margin: 0,
    cursor: 'pointer',
    color: 'var(--accent-color)',
    minWidth: '200px',
    textAlign: 'center',
  },
  navControls: {
    display: 'flex',
    gap: '0.5rem',
  },
  navBtn: {
    padding: '0.4rem 1rem',
    fontSize: '0.9rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.5rem',
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
  },
  dayCell: {
    minHeight: '120px',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.6rem',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s',
  },
  dayTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  },
  dayNumber: {
    fontSize: '0.9rem',
  },
  holidayBadge: {
    fontSize: '0.6rem',
    background: 'rgba(239, 68, 68, 0.1)',
    color: 'var(--danger-color)',
    padding: '2px 4px',
    borderRadius: '4px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    fontWeight: 'bold',
  },
  taskListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden',
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
  },
  moreText: {
    fontSize: '0.7rem',
    textAlign: 'center',
    color: 'var(--text-tertiary)',
    marginTop: '2px',
  }
};

export default MonthlyView;

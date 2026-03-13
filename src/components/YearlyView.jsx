import React, { useState } from 'react';
import PlanModal from './PlanModal';
import { getHolidayInfo } from '../utils/holidays';

const sharedCalendarNavText = {
  fontSize: '0.98rem',
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

const YearlyView = ({ plans, addPlan, t }) => {
  const [modalState, setModalState] = useState({ isOpen: false, date: null });
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const months = Array.from({ length: 12 }, (_, i) => i);

  const handlePrevYear = () => setCurrentYear(y => y - 1);
  const handleNextYear = () => setCurrentYear(y => y + 1);
  const handleThisYear = () => setCurrentYear(new Date().getFullYear());

  const getDayStatusDot = (dateStr) => {
    const dayPlans = plans.filter(p => p.date === dateStr);
    if (dayPlans.length === 0) return null; // No point

    const completed = dayPlans.filter(p => p.status === 'completed').length;
    
    if (completed === dayPlans.length) {
      return 'var(--success-color)'; // All done
    } else if (completed === 0) {
      return 'var(--danger-color)'; // Nothing done
    } else {
      return 'var(--warning-color)'; // Partially done
    }
  };

  const getDaysInMonthArray = (year, month) => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDayOfMonth }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];
  };

  const isEn = t.languageToggle === '🌐 English';

  return (
    <div className="animate-fade-in" style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null })}
        onSave={addPlan}
        date={modalState.date}
        t={t}
      />

      <div style={styles.header}>
        <button className="glass-button" style={styles.navBtn} onClick={handlePrevYear}>← {t.prevYear}</button>
        <h2 style={styles.yearTitle} onClick={handleThisYear} title={t.backToCurrentYear}>{currentYear}</h2>
        <button className="glass-button" style={styles.navBtn} onClick={handleNextYear}>{t.nextYear} →</button>
      </div>

      <div style={styles.yearGrid}>
        {months.map(month => {
          const days = getDaysInMonthArray(currentYear, month);
          const monthName = new Intl.DateTimeFormat(isEn ? 'en-US' : 'zh-CN', { month: 'long' }).format(new Date(currentYear, month, 1));
          
          return (
            <div key={month} className="glass-panel" style={styles.monthCard}>
              <h4 style={styles.monthName}>{monthName}</h4>
              <div style={styles.daysGrid}>
                {days.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${month}-${index}`} style={styles.emptyDayCell} />;
                  }

                  const dateStr = `${currentYear}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dotColor = getDayStatusDot(dateStr);
                  const holiday = getHolidayInfo(dateStr);
                  const holidayColor = holiday?.color || null;
                  const isToday = dateStr === getLocalDateStr();

                  return (
                    <div 
                      key={day} 
                      style={{
                        ...styles.dayCell,
                        borderColor: isToday ? 'var(--accent-color)' : 'transparent',
                        background: holidayColor
                          ? 'rgba(239, 68, 68, 0.12)'
                          : isToday
                            ? 'rgba(255,255,255,0.05)'
                            : 'transparent'
                      }}
                      onClick={() => setModalState({ isOpen: true, date: dateStr })}
                      title={dateStr}
                    >
                      <span style={{
                        fontSize: '0.7rem',
                        color: holidayColor
                          ? 'var(--danger-color)'
                          : isToday
                            ? 'var(--text-primary)'
                            : 'var(--text-secondary)',
                        fontWeight: holidayColor ? '700' : '400'
                      }}>
                        {day}
                      </span>
                      <div style={{
                        ...styles.dot,
                        background: holidayColor ? 'transparent' : dotColor || 'rgba(0,0,0,0.1)',
                        opacity: holidayColor ? 0 : (dotColor ? 1 : 0.2)
                      }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem'
  },
  yearTitle: {
    fontSize: '2.5rem',
    margin: 0,
    cursor: 'pointer',
    color: 'var(--text-primary)'
  },
  navBtn: {
    padding: '0.58rem 1.12rem',
    ...sharedCalendarNavText,
  },
  yearGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1.5rem'
  },
  monthCard: {
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  monthName: {
    margin: 0,
    fontSize: '1.2rem',
    color: 'var(--accent-color)',
    textAlign: 'center'
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    alignItems: 'start'
  },
  emptyDayCell: {
    minHeight: '34px',
    borderRadius: '6px',
  },
  dayCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.2s'
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    marginTop: '2px'
  }
};

export default YearlyView;

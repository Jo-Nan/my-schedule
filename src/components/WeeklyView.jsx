import React, { useState } from 'react';
import PlanCard from './PlanCard';
import PlanModal from './PlanModal';

const WeeklyView = ({ plans, updatePlan, addPlan, deletePlan, weatherData }) => {
  // Generate a window of 5 days starting from yesterday so Today is column 2: [Today-1, Today, Today+1, Today+2, Today+3]
  const today = new Date();
  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 1 + i); // start from yesterday
    return d.toISOString().split('T')[0];
  });

  const getDayName = (dateStr) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
  };

  const [modalState, setModalState] = useState({ isOpen: false, date: null });

  const handleAddTask = (date) => {
    setModalState({ isOpen: true, date });
  };

  const handleSaveTask = (newPlan) => {
    addPlan(newPlan);
  };

  return (
    <div style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null })}
        onSave={handleSaveTask}
        date={modalState.date}
      />
      {days.map(dateStr => {
        const isToday = dateStr === today.toISOString().split('T')[0];
        
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const isYesterday = dateStr === yesterday.toISOString().split('T')[0];

        const dayWeather = weatherData.find(w => w.date === dateStr);
        const dayPlans = plans.filter(p => p.date === dateStr);

        // Sort plans: incomplete first, then time
        dayPlans.sort((a,b) => {
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          return a.time.localeCompare(b.time);
        });

        return (
          <div key={dateStr} className="glass-panel" style={{
            ...styles.dayColumn,
            borderColor: isToday ? 'var(--accent-color)' : 'var(--glass-border)',
            boxShadow: isToday ? 'var(--accent-glow)' : 'var(--glass-shadow)',
          }}>
            <div style={styles.dayHeader}>
              <div style={styles.dateInfo}>
                <span style={styles.weekday}>{getDayName(dateStr)}</span>
                <span style={styles.dateText}>{dateStr.slice(5)}</span>
                {isToday && <span style={styles.todayBadge}>Today</span>}
                {isYesterday && <span style={styles.yesterdayBadge}>Yesterday</span>}
              </div>
              
              {new Date(dateStr) >= new Date(today.toISOString().split('T')[0]) ? (
                dayWeather ? (
                  <div style={styles.weatherBlock}>
                    <div style={styles.weatherMain}>
                      <span style={styles.icon}>{dayWeather.icon}</span>
                      <span style={styles.temp}>{Math.round(dayWeather.tempMax)}°</span>
                    </div>
                    <div style={styles.weatherDetails}>
                      <span>💧 {dayWeather.humidity}%</span>
                      <span>💨 {Math.round(dayWeather.windSpeed)}</span>
                      <span style={{ color: dayWeather.aqiLabel.color }}>
                        AQI {Math.round(dayWeather.aqi)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{minHeight: '66px', opacity: 0.5}}>Fetching weather...</div>
                )
              ) : (
                <div style={{minHeight: '66px'}}></div>
              )}
            </div>

            <div style={styles.planList}>
              {dayPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan} updatePlan={updatePlan} deletePlan={deletePlan} />
              ))}
              <div 
                className="glass-button add-btn" 
                style={styles.addBtn}
                onClick={() => handleAddTask(dateStr)}
              >
                + Add Plan
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
};

const styles = {
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

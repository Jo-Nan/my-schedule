import React, { useState } from 'react';
import PlanCard from './PlanCard';
import PlanModal from './PlanModal';

const DailyView = ({ plans, updatePlan, addPlan, deletePlan, weatherData }) => {
  const [modalState, setModalState] = useState({ isOpen: false, date: null });
  // Start from Today
  const [currentDateObj, setCurrentDateObj] = useState(new Date());

  const dateStr = currentDateObj.toISOString().split('T')[0];
  const isToday = dateStr === new Date().toISOString().split('T')[0];
  
  const yesterdayObj = new Date();
  yesterdayObj.setDate(new Date().getDate() - 1);
  const isYesterday = dateStr === yesterdayObj.toISOString().split('T')[0];

  const dayWeather = weatherData.find(w => w.date === dateStr);
  
  const dayPlans = plans.filter(p => p.date === dateStr);
  dayPlans.sort((a,b) => {
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    return a.time.localeCompare(b.time);
  });

  const getDayName = (dStr) => {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(dStr));
  };
  const getFullDateDisplay = (dStr) => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(dStr));
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

  const completedCount = dayPlans.filter(p => p.status === 'completed').length;
  const totalCount = dayPlans.length;
  const progressRatio = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="animate-fade-in" style={styles.container}>
      <PlanModal 
        isOpen={modalState.isOpen} 
        onClose={() => setModalState({ isOpen: false, date: null })}
        onSave={addPlan}
        date={modalState.date}
      />

      {/* Focus Header */}
      <div className="glass-panel" style={styles.focusHeader}>
        <div style={styles.headerTop}>
          <button className="glass-button" style={styles.navBtn} onClick={handlePrevDay}>← Prev Day</button>
          
          <div style={styles.dateBlock} onClick={handleToday} title="Back to Today">
            <h1 style={styles.weekdayName}>
              {getDayName(dateStr)}
              {isToday && <span style={styles.badgeToday}>Today</span>}
              {isYesterday && <span style={styles.badgeYesterday}>Yesterday</span>}
            </h1>
            <p style={styles.fullDate}>{getFullDateDisplay(dateStr)}</p>
          </div>

          <button className="glass-button" style={styles.navBtn} onClick={handleNextDay}>Next Day →</button>
        </div>

        {/* Weather Sub-panel for Daily Focus */}
        <div style={styles.insightBar}>
          {new Date(dateStr) >= new Date(new Date().toISOString().split('T')[0]) ? (
            dayWeather ? (
              <div style={styles.weatherWidget}>
                <div style={styles.wMain}>
                  <span style={{ fontSize: '2rem' }}>{dayWeather.icon}</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{Math.round(dayWeather.tempMax)}°</span>
                </div>
                <div style={styles.wDetails}>
                  <span>💧 Hum: {dayWeather.humidity}%</span>
                  <span style={{ color: dayWeather.aqiLabel.color, fontWeight: 'bold' }}>
                    Air: {dayWeather.aqiLabel.label}
                  </span>
                </div>
              </div>
            ) : (
               <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Loading local weather...</div>
            )
          ) : (
            <div style={{ color: 'var(--text-tertiary)' }}>No weather data for past dates.</div>
          )}

          {/* Daily Progress Widget */}
          <div style={styles.progressWidget}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Daily Mission</h3>
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
      <div style={styles.timelineContainer}>
        {dayPlans.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '4rem', margin: 0 }}>☕️</p>
            <h3 style={{ color: 'var(--text-secondary)' }}>No plans scheduled for this day yet.</h3>
          </div>
        ) : (
          <div style={styles.plansStack}>
            {dayPlans.map(plan => (
              <div key={plan.id} style={styles.planWrapper}>
                {/* Visual Timeline Node */}
                <div style={styles.timelineNodeBox}>
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
                  <PlanCard plan={plan} updatePlan={updatePlan} deletePlan={deletePlan} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div 
          className="glass-button" 
          style={styles.hugeAddBtn}
          onClick={() => setModalState({ isOpen: true, date: dateStr })}
        >
          <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>+</span>
          Schedule a New Focused Action
        </div>
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
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dateBlock: {
    textAlign: 'center',
    cursor: 'pointer'
  },
  weekdayName: {
    margin: 0,
    fontSize: '2.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: 'var(--text-primary)'
  },
  fullDate: {
    margin: 0,
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    marginTop: '0.5rem'
  },
  navBtn: {
    padding: '0.6rem 1.2rem',
    fontSize: '1rem'
  },
  badgeToday: {
    background: 'var(--accent-color)',
    color: '#fff',
    fontSize: '0.9rem',
    padding: '4px 12px',
    borderRadius: '12px',
    verticalAlign: 'middle',
  },
  badgeYesterday: {
    background: 'var(--warning-color)',
    color: '#fff',
    fontSize: '0.9rem',
    padding: '4px 12px',
    borderRadius: '12px',
    verticalAlign: 'middle',
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

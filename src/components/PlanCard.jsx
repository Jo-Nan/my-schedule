import React, { useState, useRef, useEffect } from 'react';

const PlanCard = ({ plan, updatePlan, deletePlan, onEdit, t }) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);

  const handleDelete = () => {
    if (window.confirm(`${t.confirmDelete || 'Are you sure you want to delete'} "${plan.event}"?`)) {
      deletePlan(plan.id);
    }
  };

  // Status mapping: 'uncompleted', 'in-progress', 'completed'
  const isCompleted = plan.status === 'completed';
  const progressText = plan.progress || 0;

  const handleMouseDown = (e) => {
    if (isCompleted) return;
    const rect = sliderRef.current.getBoundingClientRect();
    // Only start dragging if mouse is in the upper half of the track
    if (e.clientY > rect.top + rect.height / 2) return;
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault(); // Prevent text selection
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isCompleted || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let newProgress = ((e.clientX - rect.left) / rect.width) * 100;
    newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));
    
    let newStatus = plan.status;
    if (newProgress === 100) newStatus = 'completed';
    else if (newProgress > 0) newStatus = 'in-progress';
    else newStatus = 'uncompleted';

    updatePlan(plan.id, { progress: newProgress, status: newStatus });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTrackClick = (e) => {
    if (isCompleted || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    // Only respond to clicks in the upper half of the track
    if (e.clientY > rect.top + rect.height / 2) return;
    let newProgress = ((e.clientX - rect.left) / rect.width) * 100;
    newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));
    
    let newStatus = plan.status;
    if (newProgress === 100) newStatus = 'completed';
    else if (newProgress > 0) newStatus = 'in-progress';
    else newStatus = 'uncompleted';

    updatePlan(plan.id, { progress: newProgress, status: newStatus });
  };

  const toggleStatus = () => {
    if (plan.status === 'completed') {
      updatePlan(plan.id, { status: 'uncompleted', progress: 0 });
    } else {
      updatePlan(plan.id, { status: 'completed', progress: 100 });
    }
  };

  return (
    <div className={`glass-panel plan-card ${isCompleted ? 'completed hover-disable' : ''}`} style={styles.card}>
      <div style={styles.header}>
        <h4 style={styles.event}>{plan.event}</h4>
        
        <div style={styles.headerActions}>
          <button 
            className="glass-button"
            onClick={() => onEdit(plan)}
            style={styles.editBtn}
            title={t.editPlan}
          >
            ✏️
          </button>
          <button 
            className="glass-button"
            onClick={handleDelete}
            style={styles.deleteBtn}
            title={t.deletePlan}
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div style={styles.metaRow}>
        {plan.time && <span style={styles.tag}>🕒 {plan.time}</span>}
        {plan.person && plan.person.toLowerCase() !== 'self' && (
          <span style={styles.tag}>👤 {plan.person}</span>
        )}
        {plan.ddl && <span style={styles.tag} className="ddl-tag">⚠️ {plan.ddl}</span>}
      </div>

      <div style={styles.bottomRow}>
        <div 
          onClick={toggleStatus}
          style={{
            ...styles.checkBtn,
            background: isCompleted ? 'var(--success-color)' : 'transparent',
            borderColor: isCompleted ? 'var(--success-color)' : 'var(--text-tertiary)'
          }}
          title={isCompleted ? "Mark uncompleted" : "Mark completed"}
        >
          {isCompleted && '✓'}
        </div>

        <div style={styles.progressContainer}>
          <div 
            ref={sliderRef}
            style={styles.sliderTrack} 
            onClick={handleTrackClick}
            onMouseDown={handleMouseDown}
          >
            <div style={styles.sliderBase} />
            <div style={{...styles.sliderFill, width: `${progressText}%`}} />
            <div 
              style={{
                ...styles.sliderThumb, 
                left: `${progressText}%`,
                cursor: isCompleted ? 'default' : (isDragging ? 'grabbing' : 'grab'),
                transform: `translate(-50%, -50%) scale(${isDragging ? 1.2 : 1})`,
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    padding: '1rem',
    marginBottom: '0.8rem',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  event: {
    fontSize: '1rem',
    color: 'var(--text-primary)',
    margin: 0,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  headerActions: {
    display: 'flex',
    gap: '0.4rem',
  },
  editBtn: {
    padding: '0.2rem',
    background: 'none',
    border: 'none',
    boxShadow: 'none',
    color: 'var(--text-secondary)',
    opacity: 0.6,
  },
  deleteBtn: {
    padding: '0.2rem',
    background: 'none',
    border: 'none',
    boxShadow: 'none',
    color: 'var(--text-secondary)',
    opacity: 0.6,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
    marginTop: '0.4rem',
  },
  checkBtn: {
    width: '20px',
    height: '20px',
    flexShrink: 0,
    borderRadius: '50%',
    border: '2px solid var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  tag: {
    fontSize: '0.7rem',
    padding: '0.1em 0.5em',
    background: 'var(--tag-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '4px',
    color: 'var(--tag-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    pointerEvents: 'none', // Prevent tags from blocking slider interaction
    userSelect: 'none',
  },
  progressContainer: {
    flex: 1, // fill remaining width next to check btn
    pointerEvents: 'auto',
    cursor: 'default',
  },
  sliderTrack: {
    height: '24px', // Invisible larger hit area
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    touchAction: 'none',
    pointerEvents: 'auto',
    cursor: 'pointer',
    width: '100%',
  },
  sliderBase: {
    width: '100%',
    height: '6px',
    background: 'rgba(150,150,150,0.2)',
    borderRadius: '3px',
    position: 'absolute',
  },
  sliderFill: {
    height: '6px',
    background: 'linear-gradient(90deg, var(--accent-color), #818cf8)',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
    position: 'absolute',
    left: 0,
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    width: '16px',
    height: '16px',
    background: '#fff',
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    transition: 'left 0.1s linear, transform 0.2s ease',
    zIndex: 2,
  }
};

export default PlanCard;

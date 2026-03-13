import { useState, useRef, useEffect } from 'react';

const PlanCard = ({ plan, updatePlan, deletePlan, onEdit, onDragStart, onDragEnd, isDragging: cardIsDragging, isSelected, onSelect, t }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localProgress, setLocalProgress] = useState(null);
  const sliderRef = useRef(null);
  const rafRef = useRef(null);
  const interactiveSelector = 'button, select, input, textarea, a, .plan-slider, .progress-control';

  const handleDelete = () => {
    if (window.confirm(`${t.confirmDelete || 'Are you sure you want to delete'} "${plan.event}"?`)) {
      deletePlan(plan.id);
    }
  };

  // Status mapping: 'uncompleted', 'in-progress', 'completed'
  const isCompleted = plan.status === 'completed';
  const progressText = isDragging && localProgress !== null ? localProgress : (plan.progress || 0);

  const handleMouseDown = (e) => {
    if (isCompleted) return;
    const rect = sliderRef.current.getBoundingClientRect();
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault(); // Prevent text selection
    e.stopPropagation(); // Prevent event bubbling
  };

  const handleMouseMove = (e) => {
    if (!isDragging || isCompleted || !sliderRef.current) return;
    e.stopPropagation(); // Prevent event bubbling
    
    if (rafRef.current) return; // Throttle with RAF
    
    rafRef.current = requestAnimationFrame(() => {
      if (!sliderRef.current) return; // Safety check
      const rect = sliderRef.current.getBoundingClientRect();
      let newProgress = ((e.clientX - rect.left) / rect.width) * 100;
      newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));
      setLocalProgress(newProgress);
      rafRef.current = null;
    });
  };

  const handleMouseUp = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (isDragging && localProgress !== null) {
      let newStatus = plan.status;
      if (localProgress === 100) newStatus = 'completed';
      else if (localProgress > 0) newStatus = 'in-progress';
      else newStatus = 'uncompleted';

      updatePlan(plan.id, { progress: localProgress, status: newStatus }, { saveStrategy: 'progress' });
    }
    setIsDragging(false);
    setLocalProgress(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleTrackClick = (e) => {
    if (isCompleted || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let newProgress = ((e.clientX - rect.left) / rect.width) * 100;
    newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));
    
    let newStatus = plan.status;
    if (newProgress === 100) newStatus = 'completed';
    else if (newProgress > 0) newStatus = 'in-progress';
    else newStatus = 'uncompleted';

    updatePlan(plan.id, { progress: newProgress, status: newStatus }, { saveStrategy: 'progress' });
  };

  const toggleStatus = () => {
    if (plan.status === 'completed') {
      updatePlan(plan.id, { status: 'uncompleted', progress: 0 }, { saveStrategy: 'general' });
    } else {
      updatePlan(plan.id, { status: 'completed', progress: 100 }, { saveStrategy: 'general' });
    }
  };

  return (
    <div 
      className={`glass-panel plan-card ${isCompleted ? 'completed hover-disable' : ''}`} 
      style={{
        ...styles.card,
        ...(cardIsDragging ? styles.cardDragging : {}),
        ...(isSelected ? styles.cardSelected : {}),
      }}
      tabIndex={0}
      onClick={() => onSelect?.(plan)}
      onFocus={() => onSelect?.(plan)}
      draggable
      onDragStart={(e) => {
        if (isDragging || e.target.closest(interactiveSelector)) {
          e.preventDefault();
          return;
        }
        if (onDragStart) onDragStart(e);
        // Set drag image to the entire card
        const card = e.target.closest('.plan-card');
        if (card) {
          e.dataTransfer.setDragImage(card, e.clientX - card.getBoundingClientRect().left, e.clientY - card.getBoundingClientRect().top);
        }
      }}
      onDragEnd={onDragEnd ? onDragEnd : undefined}
    >
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
          className="progress-control"
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
            className="plan-slider"
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

        <button 
          className="glass-button drag-handle"
          style={styles.dragBtn}
          title="拖拽移动任务"
          type="button"
        >
          <span style={styles.dragGrip} aria-hidden="true">
            <span style={styles.dragDot} />
            <span style={styles.dragDot} />
            <span style={styles.dragDot} />
            <span style={styles.dragDot} />
            <span style={styles.dragDot} />
            <span style={styles.dragDot} />
          </span>
        </button>
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
  cardDragging: {
    opacity: 0.7,
  },
  cardSelected: {
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
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
    flexShrink: 0,
  },
  dragBtn: {
    width: '34px',
    height: '30px',
    padding: 0,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.14)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
    color: 'var(--text-secondary)',
    opacity: 0.95,
    cursor: 'grab',
    borderRadius: '10px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragGrip: {
    width: '14px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '2px 3px',
  },
  dragDot: {
    width: '4px',
    height: '4px',
    borderRadius: '999px',
    background: 'currentColor',
    opacity: 0.78,
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
    minHeight: '1.6rem',
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
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

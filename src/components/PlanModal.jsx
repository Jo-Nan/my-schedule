import React, { useState, useEffect } from 'react';

const PlanModal = ({ isOpen, onClose, onSave, date, initialData, t }) => {
  const [formData, setFormData] = useState({
    event: '',
    time: '',
    person: '',
    ddl: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        event: initialData.event || '',
        time: initialData.time || '',
        person: initialData.person || '',
        ddl: initialData.ddl || ''
      });
    } else {
      setFormData({ event: '', time: '', person: '', ddl: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.event.trim()) {
      alert(t.eventRequired || 'Event name is required!');
      return;
    }
    
    if (initialData) {
      // Edit mode
      onSave(initialData.id, {
        ...formData,
        date: date || initialData.date
      });
    } else {
      // Add mode
      onSave({
        ...formData,
        date,
        id: Date.now().toString(),
        progress: 0,
        status: 'uncompleted'
      });
    }
    
    setFormData({ event: '', time: '', person: '', ddl: '' });
    onClose();
  };

  const isEdit = !!initialData;

  return (
    <div style={styles.overlay} className="animate-fade-in">
      <div style={styles.modal} className="glass-panel">
        <h3 style={styles.title}>
          {isEdit ? t.editPlan : t.addPlan} {date ? `(${date})` : ''}
        </h3>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>{t.eventLabel || 'Event'} *</label>
            <input
              className="glass-input"
              value={formData.event}
              onChange={(e) => setFormData({ ...formData, event: e.target.value })}
              placeholder={t.eventPlaceholder || "What needs to be done?"}
              autoFocus
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>{t.timeLabel || 'Time'}</label>
              <input
                className="glass-input"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="e.g. 14:00"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>{t.personLabel || 'Person'}</label>
              <input
                className="glass-input"
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                placeholder="Who's involved?"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>{t.ddlLabel || 'DDL'}</label>
            <input
              className="glass-input"
              value={formData.ddl}
              onChange={(e) => setFormData({ ...formData, ddl: e.target.value })}
              placeholder="Deadline details"
            />
          </div>

          <div style={styles.actions}>
            <button type="button" className="glass-button" onClick={onClose} style={styles.cancelBtn}>
              {t.cancel}
            </button>
            <button type="submit" className="glass-button" style={styles.saveBtn}>
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    padding: '2rem',
    width: '90%',
    maxWidth: '450px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  title: {
    margin: 0,
    color: 'var(--text-primary)',
    textAlign: 'center',
    fontSize: '1.3rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    flex: 1,
  },
  label: {
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    marginLeft: '4px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  cancelBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
  },
  saveBtn: {
    background: 'var(--accent-color)',
    color: '#fff',
    borderColor: 'var(--accent-color)',
    boxShadow: 'var(--accent-glow)',
  }
};

export default PlanModal;

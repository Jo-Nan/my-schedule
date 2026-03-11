import React, { useState } from 'react';

const PlanModal = ({ isOpen, onClose, onSave, date }) => {
  const [formData, setFormData] = useState({
    event: '',
    time: '',
    person: '',
    ddl: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.event.trim()) {
      alert('Event name is required!');
      return;
    }
    onSave({
      ...formData,
      date,
      id: Date.now().toString(),
      progress: 0,
      status: 'uncompleted'
    });
    setFormData({ event: '', time: '', person: '', ddl: '' });
    onClose();
  };

  return (
    <div style={styles.overlay} className="animate-fade-in">
      <div style={styles.modal} className="glass-panel">
        <h3 style={styles.title}>Add Plan for {date}</h3>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Event *</label>
            <input
              className="glass-input"
              value={formData.event}
              onChange={(e) => setFormData({ ...formData, event: e.target.value })}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Time</label>
              <input
                className="glass-input"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="e.g. 14:00"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Person</label>
              <input
                className="glass-input"
                value={formData.person}
                onChange={(e) => setFormData({ ...formData, person: e.target.value })}
                placeholder="Who's involved?"
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>DDL</label>
            <input
              className="glass-input"
              value={formData.ddl}
              onChange={(e) => setFormData({ ...formData, ddl: e.target.value })}
              placeholder="Deadline details"
            />
          </div>

          <div style={styles.actions}>
            <button type="button" className="glass-button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" className="glass-button" style={styles.saveBtn}>
              Save Plan
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

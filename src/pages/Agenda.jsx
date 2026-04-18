import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

const Agenda = ({ refreshKey }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    if (tasks.length === 0) setLoading(true);
    const data = await dbService.getTasks();
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [refreshKey]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    const task = {
      text: newTask,
      completed: false,
      date: new Date().toISOString()
    };

    const res = await dbService.saveTask(task);
    if (res.success) {
      setNewTask('');
      loadTasks();
    }
  };

  const toggleTask = async (task) => {
    const updated = { ...task, completed: !task.completed };
    const res = await dbService.saveTask(updated);
    if (res.success) {
      loadTasks();
    }
  };

  const deleteTask = async (id) => {
    if (window.confirm('¿Borrar esta tarea?')) {
      const res = await dbService.deleteTask(id);
      if (res.success) {
        loadTasks();
      }
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1px' }}>
            Mi <span style={{ color: 'var(--accent-color)' }}>Agenda</span>
          </h1>
          <p style={{ opacity: 0.6, margin: '5px 0 0 0' }}>Gestiona tus pendientes del día</p>
        </div>
        
        <div className="glass-panel" style={{ padding: '15px 25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Progreso del día</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{completedCount} / {tasks.length}</div>
           </div>
           <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              background: `conic-gradient(var(--accent-color) ${progress}%, rgba(255,255,255,0.1) 0)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
           }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: 'var(--bg-dark)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}>
                {Math.round(progress)}%
              </div>
           </div>
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '30px', padding: '10px' }}>
        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Escribe una nueva tarea..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '15px 20px',
              color: 'white',
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0 25px',
              borderRadius: '10px',
              background: 'var(--accent-color)',
              color: 'black',
              border: 'none',
              fontWeight: '900',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
          >
            AGREGAR
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>Cargando agenda...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {tasks.length === 0 ? (
            <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', opacity: 0.5 }}>
               <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✨</div>
               <h3>¡Todo listo! No hay tareas pendientes.</h3>
               <p>Usa el campo de arriba para anotar algo nuevo.</p>
            </div>
          ) : (
            tasks.map(task => (
              <div 
                key={task.id} 
                className="glass-panel" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '15px', 
                  padding: '20px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: task.completed ? 0.6 : 1,
                  borderLeft: task.completed ? '4px solid #10b981' : '4px solid var(--accent-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div 
                  onClick={() => toggleTask(task)}
                  style={{ 
                    width: '28px', 
                    height: '28px', 
                    borderRadius: '50%', 
                    border: '2px solid ' + (task.completed ? '#10b981' : 'rgba(255,255,255,0.3)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: task.completed ? '#10b981' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  {task.completed && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                </div>

                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleTask(task)}>
                  <div style={{ 
                    fontSize: '1.1rem', 
                    textDecoration: task.completed ? 'line-through' : 'none',
                    fontWeight: '500',
                    color: task.completed ? 'rgba(255,255,255,0.4)' : 'white'
                  }}>
                    {task.text}
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '4px' }}>
                    {new Date(task.date).toLocaleDateString()}
                  </div>
                </div>

                <button 
                  onClick={() => deleteTask(task.id)}
                  style={{ 
                    background: 'rgba(244,63,94,0.1)', 
                    color: '#f43f5e', 
                    border: 'none', 
                    borderRadius: '8px', 
                    width: '32px', 
                    height: '32px', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                  }}
                >
                  ×
                </button>

                {task.completed && (
                   <div style={{ 
                     position: 'absolute', 
                     right: '-10px', 
                     bottom: '-10px', 
                     fontSize: '4rem', 
                     opacity: 0.05, 
                     transform: 'rotate(-20deg)',
                     pointerEvents: 'none'
                   }}>
                     ✓
                   </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Agenda;

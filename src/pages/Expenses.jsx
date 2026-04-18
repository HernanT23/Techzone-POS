import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

const EXPENSE_CATEGORIES = ["Alquiler", "Sueldos", "Servicios (Luz/Internet)", "Mercancía", "Impuestos", "Publicidad", "Mantenimiento", "Otros"];

export default function Expenses({ refreshKey }) {
   const [expenses, setExpenses] = useState([]);
   const [loading, setLoading] = useState(true);
   const [editing, setEditing] = useState(null);
   const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', amount: '', category: 'Otros' });

   const loadExpenses = () => {
      dbService.query('SELECT * FROM EXPENSES').then(res => {
         if (res.success) setExpenses(res.data || []);
         setLoading(false);
      });
   };

   useEffect(() => {
      loadExpenses();
   }, [refreshKey]);

   const handleSave = async (e) => {
      e.preventDefault();
      const payload = { 
         ...form, 
         amount: parseFloat(form.amount) 
      };
      if (editing) payload.id = editing;

      const res = await dbService.saveExpense(payload);
      if (res.success) {
         setEditing(null);
         setForm({ date: new Date().toISOString().split('T')[0], description: '', amount: '', category: 'Otros' });
         loadExpenses();
      } else {
         alert('Error: ' + res.error);
      }
   };

   const handleDelete = async (id) => {
      if (window.confirm('¿Eliminar este gasto?')) {
         const res = await dbService.deleteExpense(id);
         if (res.success) loadExpenses();
      }
   };

   const handleEdit = (exp) => {
      setEditing(exp.id);
      setForm({
         date: exp.date,
         description: exp.description,
         amount: exp.amount,
         category: exp.category
      });
   };

   const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);

   return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '15px' }}>
               <span style={{ fontSize: '2rem' }}>💸</span> Gastos Operativos
            </h1>
            <div className="glass-panel" style={{ padding: '10px 25px', border: '1px solid var(--danger)', background: 'rgba(244, 63, 94, 0.05)', borderRadius: '15px' }}>
               <small style={{ opacity: 0.6, textTransform: 'uppercase', fontSize: '0.7rem', display: 'block' }}>EGRESO ACUMULADO</small>
               <h2 style={{ margin: 0, color: 'var(--danger)', fontWeight: '900', textShadow: '0 0 10px rgba(244,63,94,0.3)' }}>${totalExpenses.toFixed(2)}</h2>
            </div>
         </div>

         <div className="flex-responsive" style={{ display: 'flex', gap: '20px' }}>
            {/* Table Area */}
            <div className="glass-panel" style={{ flexGrow: 1, minWidth: 0 }}>
               <h3>Historial de Gastos</h3>
               <div className="table-responsive" style={{ marginTop: '15px' }}>
                  <table className="glass-table">
                     <thead>
                        <tr>
                           <th>Fecha</th>
                           <th>Descripción</th>
                           <th>Categoría</th>
                           <th>Monto (USD)</th>
                           <th>Acciones</th>
                        </tr>
                     </thead>
                     <tbody>
                        {expenses.length === 0 ? <tr><td colSpan="5" style={{textAlign:'center', opacity:0.5}}>No hay gastos registrados.</td></tr> : expenses.map(exp => (
                           <tr key={exp.id}>
                              <td>{exp.date}</td>
                              <td>{exp.description}</td>
                              <td>
                                 <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                                    {exp.category}
                                 </span>
                              </td>
                              <td style={{ fontWeight: 'bold', color: 'var(--danger)' }}>${parseFloat(exp.amount).toFixed(2)}</td>
                              <td>
                                 <button onClick={() => handleEdit(exp)} style={{ background: 'transparent', color: 'var(--accent-color)', border: 'none', cursor: 'pointer', marginRight: '10px' }}>Edit</button>
                                 <button onClick={() => handleDelete(exp.id)} style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}>Del</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Sidebar Form */}
            <div className="glass-panel" style={{ width: '320px', minWidth: '320px', height: 'fit-content', position: 'sticky', top: '0px' }}>
               <h3>{editing ? '📝 Editar Gasto' : '➕ Nuevo Gasto'}</h3>
               <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  <div>
                     <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Fecha</label>
                     <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                  </div>
                  <div>
                     <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Categoría</label>
                     <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}>
                        {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat} style={{background: '#1a1a1a'}}>{cat}</option>)}
                     </select>
                  </div>
                  <div>
                     <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Descripción</label>
                     <input required placeholder="Ej: Pago de Internet Fibra" value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                  </div>
                  <div>
                     <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Monto (USD)</label>
                     <input type="number" step="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                     <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Guardar</button>
                     {editing && <button type="button" onClick={() => {setEditing(null); setForm({date: new Date().toISOString().split('T')[0], description:'', amount:'', category:'Otros'});}} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '5px', cursor: 'pointer' }}>Can</button>}
                  </div>
               </form>
            </div>
         </div>
      </div>
   );
}

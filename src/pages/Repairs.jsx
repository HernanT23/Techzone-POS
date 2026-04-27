import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

const Repairs = ({ refreshKey, userRole }) => {
    const [repairs, setRepairs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentRepair, setCurrentRepair] = useState(null);
    const [filter, setFilter] = useState('Todos');

    const [formData, setFormData] = useState({
        customer: '',
        phone: '',
        device: '',
        serial: '',
        issue: '',
        observations: '',
        budget: 0,
        deposit: 0,
        partCost: 0,
        status: 'Recibido'
    });

    const loadData = async () => {
        setLoading(true);
        const [repRes, cusRes] = await Promise.all([
            dbService.getRepairs(),
            dbService.query('SELECT * FROM customers')
        ]);
        setRepairs(repRes || []);
        if (cusRes.success) setCustomers(cusRes.data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [refreshKey]);

    const handleOpenModal = (repair = null) => {
        if (repair) {
            setCurrentRepair(repair);
            setFormData({ ...repair });
        } else {
            setCurrentRepair(null);
            setFormData({
                customer: '', phone: '', device: '', serial: '', issue: '',
                observations: '', budget: 0, deposit: 0, partCost: 0, status: 'Recibido'
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const isNew = !currentRepair;
        const repairData = {
            ...formData,
            id: currentRepair ? currentRepair.id : Date.now(),
            date: currentRepair ? currentRepair.date : new Date().toISOString(),
            deliveredDate: formData.status === 'Entregado' ? new Date().toISOString() : (currentRepair ? currentRepair.deliveredDate : null)
        };

        // Si es nuevo y hay abono, registrarlo
        if (isNew && parseFloat(formData.deposit) > 0) {
            await dbService.saveAbono({
                date: new Date().toISOString(),
                amount: parseFloat(formData.deposit),
                clientId: formData.customer, // Usamos nombre como fallback si no hay ID
                clientName: formData.customer,
                method: 'Efectivo',
                reason: `Abono inicial: ${formData.device}`
            });
        }

        // Lógica de Venta al Entregar
        if (repairData.status === 'Entregado' && (!currentRepair || currentRepair.status !== 'Entregado')) {
            const pendiente = Number(repairData.budget) - Number(repairData.deposit);
            const manoDeObra = Number(repairData.budget) - (Number(repairData.partCost) || 0);
            const gananciaTienda = manoDeObra * 0.6;
            
            const confirmMsg = `EQUIPO LISTO PARA ENTREGA\n` +
                             `Presupuesto: $${repairData.budget}\n` +
                             `Ya abonó: $${repairData.deposit}\n` +
                             `----------------------------\n` +
                             `SALDO A COBRAR: $${pendiente.toFixed(2)}\n\n` +
                             `¿Registrar ganancia de $${gananciaTienda.toFixed(2)} en caja?`;
            
            if (window.confirm(confirmMsg)) {
                await dbService.saveRepairSale({
                    amount: gananciaTienda.toFixed(2),
                    device: repairData.device,
                    customer: repairData.customer,
                    id: repairData.id
                });
            }
        }

        const res = await dbService.saveRepair(repairData);
        if (res.success) {
            setShowModal(false);
            loadData();
        } else {
            alert('Error: ' + res.error);
        }
    };

    const quickStatusUpdate = async (repair, newStatus) => {
        if (newStatus === 'Entregado') {
            const pendiente = Number(repair.budget) - Number(repair.deposit);
            if (!window.confirm(`¿Entregar equipo? Saldo pendiente: $${pendiente.toFixed(2)}`)) return;
            
            const manoDeObra = Number(repair.budget) - (Number(repair.partCost) || 0);
            await dbService.saveRepairSale({
                amount: (manoDeObra * 0.6).toFixed(2),
                device: repair.device,
                customer: repair.customer,
                id: repair.id
            });
        }

        const res = await dbService.saveRepair({ ...repair, status: newStatus });
        if (res.success) loadData();
    };

    const getStatusColor = (s) => {
        const colors = { 'Recibido': '#fff', 'En Revisión': '#facc15', 'Reparado': 'var(--accent-color)', 'Entregado': '#3b82f6', 'Anulado': '#f43f5e' };
        return colors[s] || '#fff';
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1 style={{ margin: 0 }}>🛠️ Taller <span style={{ color: 'var(--accent-color)' }}>Techzone</span></h1>
                <button onClick={() => handleOpenModal()} style={{ padding: '15px 30px', background: 'var(--accent-color)', color: '#000', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>+ NUEVO INGRESO</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
                {['Todos', 'Recibido', 'En Revisión', 'Reparado', 'Entregado'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid ' + (filter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'), background: filter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)', color: filter === f ? '#000' : '#fff', cursor: 'pointer' }}>{f}</button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {repairs.filter(r => filter === 'Todos' || r.status === filter).map(r => (
                    <div key={r.id} className="glass-panel" style={{ padding: '20px', borderLeft: `5px solid ${getStatusColor(r.status)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <strong style={{ color: 'var(--accent-color)' }}>{r.device}</strong>
                            <span style={{ fontSize: '0.7rem', background: getStatusColor(r.status), color: '#000', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{r.status}</span>
                        </div>
                        <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>👤 {r.customer}</p>
                        <p style={{ margin: '5px 0', fontSize: '0.8rem', opacity: 0.6 }}>⚠️ {r.issue}</p>
                        
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between' }}>
                            <div><small style={{ opacity: 0.5 }}>Presupuesto</small><div style={{ fontWeight: 'bold' }}>${r.budget}</div></div>
                            <div><small style={{ opacity: 0.5 }}>Abono</small><div style={{ color: 'var(--success)', fontWeight: 'bold' }}>${r.deposit}</div></div>
                            <div style={{ textAlign: 'right' }}><small style={{ opacity: 0.5 }}>Pendiente</small><div style={{ color: '#f43f5e', fontWeight: 'bold' }}>${r.budget - r.deposit}</div></div>
                        </div>

                        <div style={{ display: 'flex', gap: '5px', marginTop: '15px' }}>
                            <button onClick={() => handleOpenModal(r)} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>VER</button>
                            {r.status === 'Reparado' && (
                                <button onClick={() => quickStatusUpdate(r, 'Entregado')} style={{ flex: 2, padding: '8px', background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>ENTREGAR</button>
                            )}
                            {r.status === 'Recibido' && (
                                <button onClick={() => quickStatusUpdate(r, 'En Revisión')} style={{ flex: 2, padding: '8px', background: '#facc15', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>REVISAR</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="glass-panel" style={{ width: '550px', padding: '30px' }}>
                        <h2>{currentRepair ? 'Editar' : 'Nuevo'} Ingreso</h2>
                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Cliente</label>
                                <input required className="dark-input" style={{ width: '100%' }} value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Equipo</label>
                                <input required className="dark-input" style={{ width: '100%' }} value={formData.device} onChange={e => setFormData({...formData, device: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Presupuesto $</label>
                                <input type="number" className="dark-input" style={{ width: '100%' }} value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Abono Inicial $</label>
                                <input type="number" className="dark-input" style={{ width: '100%' }} value={formData.deposit} onChange={e => setFormData({...formData, deposit: e.target.value})} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Estado</label>
                                <select className="dark-input" style={{ width: '100%', background: '#111' }} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <option>Recibido</option><option>En Revisión</option><option>Reparado</option><option>Entregado</option><option>Anulado</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff' }}>CANCELAR</button>
                                <button type="submit" style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'var(--accent-color)', color: '#000', fontWeight: 'bold', border: 'none' }}>GUARDAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`
                .dark-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; color: #fff; margin-top: 5px; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; }
            `}</style>
        </div>
    );
};

export default Repairs;

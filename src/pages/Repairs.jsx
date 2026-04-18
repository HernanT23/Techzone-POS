import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

const Repairs = ({ refreshKey, userRole }) => {
    const [repairs, setRepairs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentRepair, setCurrentRepair] = useState(null);
    const [filter, setFilter] = useState('Todos');

    // Estado del formulario
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

    const loadRepairs = async () => {
        if (repairs.length === 0) setLoading(true);
        const data = await dbService.getRepairs();
        setRepairs(data || []);
        setLoading(false);
    };

    useEffect(() => {
        loadRepairs();
    }, [refreshKey]);

    const handleOpenModal = (repair = null) => {
        if (repair) {
            setCurrentRepair(repair);
            setFormData({ ...repair });
        } else {
            setCurrentRepair(null);
            setFormData({
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
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const repairData = {
            ...formData,
            id: currentRepair ? currentRepair.id : Date.now(),
            date: currentRepair ? currentRepair.date : new Date().toISOString(),
            deliveredDate: formData.status === 'Entregado' ? new Date().toISOString() : (currentRepair ? currentRepair.deliveredDate : null)
        };

        // Lógica de Venta si se marca como Entregado desde el modal
        if (repairData.status === 'Entregado' && (!currentRepair || currentRepair.status !== 'Entregado')) {
            const manoDeObra = Number(repairData.budget) - (Number(repairData.partCost) || 0);
            const gananciaTienda = manoDeObra * 0.6;
            
            const confirmMsg = `Se marcará como ENTREGADO.\n` +
                             `Ganancia Tienda (60%): $${gananciaTienda.toFixed(2)}\n\n` +
                             `¿Registrar en caja diaria?`;
            
            if (window.confirm(confirmMsg)) {
                await dbService.saveRepairSale({
                    amount: gananciaTienda.toFixed(2),
                    device: repairData.device,
                    customer: repairData.customer,
                    id: repairData.id
                });
            } else {
                return; // Cancelar todo el guardado si no confirma la venta
            }
        }

        const res = await dbService.saveRepair(repairData);
        if (res.success) {
            setShowModal(false);
            loadRepairs();
        } else {
            alert('Error al guardar: ' + res.error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que deseas eliminar este registro técnico?')) {
            const res = await dbService.deleteRepair(id);
            if (res.success) loadRepairs();
            else alert('Error al eliminar: ' + res.error);
        }
    };

    const handleClearAll = async () => {
        const confirmMsg = '⚠️ ATENCIÓN: Se borrarán TODAS las reparaciones registradas en el taller y en la nube.\n\n' +
                          '¿Estás absolutamente seguro? Esta acción es irreversible.';
        
        if (window.confirm(confirmMsg)) {
            const finalConfirm = window.confirm('Doble verificación: ¿Realmente deseas eliminar TODO el historial del taller?');
            if (finalConfirm) {
                setLoading(true);
                const res = await dbService.clearAllRepairs();
                if (res.success) {
                    setRepairs([]);
                    alert('Taller vaciado con éxito');
                } else {
                    alert('Error: ' + res.error);
                }
                setLoading(false);
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Recibido': return '#ffffff';
            case 'En Revisión': return '#facc15';
            case 'Reparado': return 'var(--accent-color)';
            case 'Entregado': return '#3b82f6';
            case 'Anulado': return '#f43f5e';
            default: return 'white';
        }
    };

    const filteredRepairs = filter === 'Todos' 
        ? repairs 
        : repairs.filter(r => r.status === filter);

    const quickStatusUpdate = async (repair, newStatus) => {
        // Lógica de Ganancia para la Tienda cuando se Entrega
        if (newStatus === 'Entregado') {
            const manoDeObra = Number(repair.budget) - (Number(repair.partCost) || 0);
            const gananciaTienda = manoDeObra * 0.6;
            
            const confirmMsg = `¿Confirmas la entrega?\n\n` +
                             `Presupuesto: $${repair.budget}\n` +
                             `Costo Repuesto: $${repair.partCost || 0}\n` +
                             `----------------------------\n` +
                             `Ganancia Tienda (60%): $${gananciaTienda.toFixed(2)}`;
                             
            if (!window.confirm(confirmMsg)) return;

            // Registrar la ganancia en la caja diaria (Ventas)
            await dbService.saveRepairSale({
                amount: gananciaTienda.toFixed(2),
                device: repair.device,
                customer: repair.customer,
                id: repair.id
            });
        }

        const repairData = { 
            ...repair, 
            status: newStatus,
            deliveredDate: newStatus === 'Entregado' ? new Date().toISOString() : repair.deliveredDate
        };
        const res = await dbService.saveRepair(repairData);
        if (res.success) {
            loadRepairs();
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-1px' }}>
                        Servicio <span style={{ color: 'var(--accent-color)' }}>Técnico</span>
                    </h1>
                    <p style={{ opacity: 0.6, margin: '5px 0 0 0' }}>Gestión de ingresos y reparaciones de equipos</p>
                </div>
                
                <div style={{ display: 'flex', gap: '15px' }}>
                    {userRole === 'admin' && (
                        <button 
                            onClick={handleClearAll}
                            className="action-btn"
                            style={{ 
                                padding: '15px 25px', 
                                background: 'rgba(244,63,94,0.1)', 
                                color: '#f43f5e', 
                                fontWeight: 'bold', 
                                borderRadius: '12px',
                                border: '1px solid rgba(244,63,94,0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            🗑️ BORRAR TODO
                        </button>
                    )}
                    <button 
                        onClick={() => handleOpenModal()}
                        className="action-btn"
                        style={{ 
                            padding: '15px 30px', 
                            background: 'var(--accent-color)', 
                            color: 'black', 
                            fontWeight: 'bold', 
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>+</span> NUEVO INGRESO
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
                {['Todos', 'Recibido', 'En Revisión', 'Reparado', 'Entregado', 'Anulado'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '20px',
                            border: '1px solid ' + (filter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'),
                            background: filter === f ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                            color: filter === f ? 'black' : 'white',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>Cargando taller...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {filteredRepairs.length === 0 ? (
                        <div className="glass-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', opacity: 0.4 }}>
                            <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🔨</div>
                            <h3>No hay reparaciones en esta categoría</h3>
                            <p>Usa el botón "Nuevo Ingreso" para registrar un dispositivo.</p>
                        </div>
                    ) : (
                        filteredRepairs.map(repair => (
                            <div key={repair.id} className="glass-panel" style={{ 
                                padding: '20px', 
                                borderLeft: `5px solid ${getStatusColor(repair.status)}`,
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ 
                                        padding: '4px 10px', 
                                        borderRadius: '20px', 
                                        fontSize: '0.7rem', 
                                        fontWeight: 'bold',
                                        background: getStatusColor(repair.status),
                                        color: 'black'
                                    }}>
                                        {repair.status.toUpperCase()}
                                    </span>
                                </div>

                                <div style={{ 
                                    marginTop: 'auto',
                                    paddingTop: '12px', 
                                    borderTop: '1px solid rgba(255,255,255,0.1)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Presupuesto</div>
                                            <div style={{ fontWeight: 'bold' }}>${repair.budget}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Repuesto</div>
                                            <div style={{ color: '#f43f5e', fontWeight: 'bold' }}>-${repair.partCost || 0}</div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ 
                                        background: 'rgba(16,185,129,0.1)', 
                                        padding: '10px', 
                                        borderRadius: '8px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid rgba(16,185,129,0.2)'
                                    }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>UTILIDAD TIENDA (60%)</span>
                                        <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#10b981' }}>
                                            ${((Number(repair.budget) - (Number(repair.partCost) || 0)) * 0.6).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                    <button 
                                        onClick={() => handleOpenModal(repair)}
                                        style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Editar / Ver
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(repair.id)}
                                        style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: 'none', cursor: 'pointer' }}
                                    >
                                        ×
                                    </button>
                                </div>

                                {/* Botones de Acceso Rápido */}
                                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                                    {repair.status !== 'En Revisión' && (
                                        <button 
                                            onClick={() => quickStatusUpdate(repair, 'En Revisión')}
                                            style={{ flex: 1, padding: '10px 5px', borderRadius: '8px', background: 'rgba(250,204,21,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                        >
                                            🛠️ REVISAR
                                        </button>
                                    )}
                                    {repair.status !== 'Reparado' && repair.status !== 'Entregado' && (
                                        <button 
                                            onClick={() => quickStatusUpdate(repair, 'Reparado')}
                                            style={{ flex: 1, padding: '10px 5px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-color)', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                        >
                                            ✅ LISTO
                                        </button>
                                    )}
                                    {repair.status === 'Reparado' && (
                                        <button 
                                            onClick={() => quickStatusUpdate(repair, 'Entregado')}
                                            style={{ flex: 1, padding: '10px 5px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                        >
                                            📦 ENTREGAR
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal de Registro */}
            {showModal && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '20px'
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '25px', fontSize: '1.8rem' }}>
                            {currentRepair ? 'Editar' : 'Nuevo Ingreso'} de <span style={{ color: 'var(--accent-color)' }}>Taller</span>
                        </h2>

                        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Cliente</label>
                                <input 
                                    required
                                    className="dark-input" 
                                    style={{ width: '100%' }}
                                    value={formData.customer}
                                    onChange={e => setFormData({...formData, customer: e.target.value})}
                                    placeholder="Nombre completo"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Teléfono</label>
                                <input 
                                    className="dark-input" 
                                    style={{ width: '100%' }}
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    placeholder="Ej: 0424..."
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Equipo / Dispositivo</label>
                                <input 
                                    required
                                    className="dark-input" 
                                    style={{ width: '100%' }}
                                    value={formData.device}
                                    onChange={e => setFormData({...formData, device: e.target.value})}
                                    placeholder="Ej: iPhone 13 Pro"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Serial / IMEI / Clave</label>
                                <input 
                                    className="dark-input" 
                                    style={{ width: '100%' }}
                                    value={formData.serial}
                                    onChange={e => setFormData({...formData, serial: e.target.value})}
                                    placeholder="Opcional"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Estado</label>
                                <select 
                                    className="dark-input" 
                                    style={{ width: '100%', background: '#111' }}
                                    value={formData.status}
                                    onChange={e => setFormData({...formData, status: e.target.value})}
                                >
                                    <option>Recibido</option>
                                    <option>En Revisión</option>
                                    <option>Reparado</option>
                                    <option>Entregado</option>
                                    <option>Anulado</option>
                                </select>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Falla / Problema</label>
                                <input 
                                    required
                                    className="dark-input" 
                                    style={{ width: '100%' }}
                                    value={formData.issue}
                                    onChange={e => setFormData({...formData, issue: e.target.value})}
                                    placeholder="¿Qué le sucede al equipo?"
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>Observaciones Visuales</label>
                                <textarea 
                                    className="dark-input" 
                                    style={{ width: '100%', minHeight: '80px', paddingTop: '10px' }}
                                    value={formData.observations}
                                    onChange={e => setFormData({...formData, observations: e.target.value})}
                                    placeholder="Rayones, golpes, etc."
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '8px' }}>💰 PRESUPUESTO ($)</label>
                                    <input 
                                        type="number"
                                        className="money-input" 
                                        style={{ width: '100%' }}
                                        value={formData.budget}
                                        onChange={e => setFormData({...formData, budget: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>💵 ABONO / PAGO ($)</label>
                                    <input 
                                        type="number"
                                        className="money-input" 
                                        style={{ width: '100%' }}
                                        value={formData.deposit}
                                        onChange={e => setFormData({...formData, deposit: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#f43f5e', fontWeight: 'bold', marginBottom: '8px' }}>🛠️ COSTO REPUESTO ($)</label>
                                    <input 
                                        type="number"
                                        className="money-input" 
                                        style={{ width: '100%' }}
                                        value={formData.partCost}
                                        onChange={e => setFormData({...formData, partCost: e.target.value})}
                                        placeholder="Costo pantalla"
                                    />
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{ flex: 1, padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer' }}
                                >
                                    CANCELAR
                                </button>
                                <button 
                                    type="submit"
                                    style={{ flex: 2, padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', color: 'black', border: 'none', cursor: 'pointer', fontWeight: '900' }}
                                >
                                    GUARDAR REGISTRO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            <style>{`
                .dark-input {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 12px 15px;
                    border-radius: 8px;
                    color: white;
                    outline: none;
                    transition: border 0.3s;
                }
                .dark-input:focus {
                    border-color: var(--accent-color);
                }
                .money-input {
                    background: rgba(0,0,0,0.4);
                    border: 2px solid rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 10px;
                    color: white;
                    outline: none;
                    font-size: 1.2rem;
                    font-weight: bold;
                    text-align: center;
                    transition: all 0.3s;
                }
                .money-input:focus {
                    border-color: inherit;
                    background: rgba(0,0,0,0.6);
                    transform: translateY(-2px);
                }
                .action-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px var(--accent-color);
                }
            `}</style>
        </div>
    );
};

export default Repairs;

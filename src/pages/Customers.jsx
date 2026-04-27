import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

export default function Customers({ refreshKey, exchangeRate }) {
  const [customers, setCustomers] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [allAbonos, setAllAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, aRes, cRes] = await Promise.all([
        dbService.query('SELECT * FROM sales'),
        dbService.getAbonos(),
        dbService.query('SELECT * FROM customers')
      ]);

      if (sRes.success) {
        setAllSales(sRes.data);
        setAllAbonos(aRes);
        
        const cMap = {};
        // Primero procesar clientes base (si hay una tabla customers)
        if (cRes.success) {
          cRes.data.forEach(c => {
            cMap[c.id] = { ...c, visits: 0, totalSpentUSD: 0, totalDebt: 0, history: [], abonos: [] };
          });
        }

        // Luego cruzar con ventas
        sRes.data.forEach(sale => {
          if (!sale.clientName || sale.clientName === 'Cliente Anónimo') return;
          const id = sale.clientId && sale.clientId !== 'N/A' ? sale.clientId : sale.clientName;
          
          if (!cMap[id]) {
            cMap[id] = { name: sale.clientName, id: sale.clientId, visits: 0, totalSpentUSD: 0, totalDebt: 0, history: [], abonos: [] };
          }
          
          cMap[id].visits += 1;
          cMap[id].totalSpentUSD += sale.totalValueUSD;
          cMap[id].history.push(sale);
          
          if (sale.status === 'pending') {
            cMap[id].totalDebt += sale.totalValueUSD;
          }
        });

        // Cruzar con abonos
        aRes.forEach(abono => {
          const id = abono.clientId;
          if (cMap[id]) {
            cMap[id].abonos.push(abono);
            cMap[id].totalDebt -= parseFloat(abono.amount);
          }
        });

        setCustomers(Object.values(cMap).sort((a, b) => b.totalDebt - a.totalDebt));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSaveAbono = async () => {
    if (!abonoAmount || !selectedCustomer) return;
    try {
      const abono = {
        date: new Date().toISOString(),
        amount: parseFloat(abonoAmount),
        clientId: selectedCustomer.id || selectedCustomer.name,
        clientName: selectedCustomer.name,
        method: 'Efectivo'
      };
      await dbService.saveAbono(abono);
      
      // Registrar como ingreso en caja (opcional pero recomendado)
      await dbService.addCashTransaction({
        date: new Date().toISOString(),
        type: 'IN',
        amount: parseFloat(abonoAmount),
        currency: 'USD',
        reason: `Abono de Deuda: ${selectedCustomer.name}`
      });

      alert('Abono registrado con éxito');
      setAbonoAmount('');
      setShowAbonoModal(false);
      loadData();
    } catch (err) { alert(err.message); }
  };

  const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.id && String(c.id).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {selectedCustomer && (
        <div className="modal-overlay">
           <div className="glass-panel" style={{ width: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px', marginBottom: '20px' }}>
                 <div>
                    <h1 style={{ margin: 0, color: 'var(--accent-color)' }}>{selectedCustomer.name}</h1>
                    <p style={{ opacity: 0.6 }}>ID: {selectedCustomer.id || 'N/A'}</p>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>DEUDA PENDIENTE</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: selectedCustomer.totalDebt > 0.01 ? '#f43f5e' : 'var(--success)' }}>
                      ${Math.max(0, selectedCustomer.totalDebt).toFixed(2)}
                    </div>
                    {selectedCustomer.totalDebt > 0.01 && (
                      <button onClick={() => setShowAbonoModal(true)} style={{ marginTop: '10px', padding: '8px 20px', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>REGISTRAR ABONO</button>
                    )}
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div>
                  <h3>🛒 Ventas / Deudas</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedCustomer.history.slice().reverse().map(sale => (
                      <div key={sale.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', borderLeft: sale.status === 'pending' ? '4px solid #f43f5e' : '4px solid var(--success)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(sale.date).toLocaleDateString()}</span>
                          <strong style={{ color: sale.status === 'pending' ? '#f43f5e' : 'var(--success)' }}>${sale.totalValueUSD.toFixed(2)}</strong>
                        </div>
                        <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>{sale.items.map(i => i.name).join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>💰 Historial de Abonos</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {selectedCustomer.abonos.length > 0 ? selectedCustomer.abonos.map((a, i) => (
                      <div key={i} style={{ background: 'rgba(16,185,129,0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{new Date(a.date).toLocaleDateString()}</span>
                          <strong style={{ color: 'var(--success)' }}>+ ${parseFloat(a.amount).toFixed(2)}</strong>
                        </div>
                        <small style={{ opacity: 0.5 }}>Recibido en Caja</small>
                      </div>
                    )) : <p style={{ opacity: 0.4, textAlign: 'center', marginTop: '20px' }}>Sin abonos registrados</p>}
                  </div>
                </div>
              </div>
              
              <button onClick={() => setSelectedCustomer(null)} style={{ marginTop: '40px', width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}>CERRAR PERFIL</button>
           </div>
        </div>
      )}

      {showAbonoModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="glass-panel" style={{ width: '400px', padding: '30px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-color)' }}>REGISTRAR PAGO</h2>
            <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Ingrese el monto recibido de {selectedCustomer.name}</p>
            <input 
              type="number" autoFocus value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '2px solid var(--accent-color)', fontSize: '1.5rem', textAlign: 'center', margin: '20px 0' }}
              placeholder="0.00"
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAbonoModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff' }}>CANCELAR</button>
              <button onClick={handleSaveAbono} style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'var(--success)', border: 'none', color: '#fff', fontWeight: 'bold' }}>CONFIRMAR ABONO</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
         <div>
            <h1 style={{ margin: 0 }}>👥 Gestión de Créditos y CRM</h1>
            <p style={{ opacity: 0.6, margin: 0 }}>Control de saldos pendientes y fidelización</p>
         </div>
         <input 
            type="text" placeholder="🔍 Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '350px', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
         />
      </div>

      <div className="glass-panel" style={{ flexGrow: 1, overflow: 'hidden' }}>
         <table className="glass-table" style={{ width: '100%', textAlign: 'left' }}>
            <thead>
               <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '20px' }}>Nombre / Entidad</th>
                  <th style={{ textAlign: 'center' }}>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Total Invertido</th>
                  <th style={{ textAlign: 'right' }}>Deuda Pendiente</th>
                  <th style={{ textAlign: 'right', paddingRight: '20px' }}>Acción</th>
               </tr>
            </thead>
            <tbody>
               {filtered.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                     <td style={{ padding: '20px' }}>
                        <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                        <small style={{ opacity: 0.5 }}>ID: {c.id || 'N/A'}</small>
                     </td>
                     <td style={{ textAlign: 'center' }}>{c.visits} op.</td>
                     <td style={{ textAlign: 'right' }}>${c.totalSpentUSD.toFixed(2)}</td>
                     <td style={{ textAlign: 'right', color: c.totalDebt > 0.01 ? '#f43f5e' : 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        ${Math.max(0, c.totalDebt).toFixed(2)}
                     </td>
                     <td style={{ textAlign: 'right', paddingRight: '20px' }}>
                        <button onClick={() => setSelectedCustomer(c)} style={{ padding: '6px 15px', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '8px', cursor: 'pointer' }}>GESTIONAR</button>
                     </td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>
      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .glass-table th { opacity: 0.6; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
      `}</style>
    </div>
  );
}

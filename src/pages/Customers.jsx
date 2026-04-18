import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

export default function Customers({ refreshKey }) {
  const [customers, setCustomers] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    if (customers.length === 0) setLoading(true);
    dbService.query('SELECT * FROM sales').then(res => {
       if (res.success && res.data) {
          setAllSales(res.data);
          const cMap = {};
          res.data.forEach(sale => {
              if (!sale.clientName || sale.clientName === 'Cliente Anónimo') return;
              
              const id = sale.clientId && sale.clientId !== 'N/A' ? sale.clientId : sale.clientName;
              if (!cMap[id]) {
                  cMap[id] = {
                      name: sale.clientName,
                      id: sale.clientId,
                      visits: 0,
                      totalSpentUSD: 0,
                      lastVisit: sale.date,
                      history: []
                  };
              }
              cMap[id].visits += 1;
              cMap[id].totalSpentUSD += sale.totalValueUSD;
              cMap[id].history.push(sale);
              
              if (new Date(sale.date) > new Date(cMap[id].lastVisit)) {
                  cMap[id].lastVisit = sale.date;
              }
          });
          
          setCustomers(Object.values(cMap).sort((a, b) => b.totalSpentUSD - a.totalSpentUSD));
       }
       setLoading(false);
    });
  }, [refreshKey]);

  const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.id && c.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading && customers.length === 0) return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <h2 style={{ color: 'var(--accent-color)', animation: 'pulse-yellow 1s infinite' }}>🛰️ Sincronizando CRM...</h2>
      </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Customer Detail Overlay */}
      {selectedCustomer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
           <div className="glass-panel" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative' }}>
              <button 
                onClick={() => setSelectedCustomer(null)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer', opacity: 0.5 }}>
                &times;
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px', marginBottom: '20px' }}>
                 <div>
                    <h1 style={{ margin: 0, color: 'var(--accent-color)' }}>{selectedCustomer.name}</h1>
                    <p style={{ opacity: 0.6, margin: '5px 0' }}>ID / RIF: {selectedCustomer.id || 'No registrado'}</p>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Inversión Total del Cliente</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>${selectedCustomer.totalSpentUSD.toFixed(2)}</div>
                 </div>
              </div>

              <h3>📜 Historial de Compras y Servicios</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                 {selectedCustomer.history.slice().reverse().map(sale => (
                    <div key={sale.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', borderLeft: '5px solid var(--accent-color)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <strong>Venta #{String(sale.id).slice(-6)}</strong>
                          <span style={{ opacity: 0.6 }}>{new Date(sale.date).toLocaleDateString('es-VE')} {new Date(sale.date).toLocaleTimeString()}</span>
                       </div>
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {sale.items.map((item, idx) => (
                             <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                                {item.name} <span style={{opacity: 0.5}}>(x{item.qty})</span>
                             </div>
                          ))}
                       </div>
                       <div style={{ marginTop: '15px', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Total Facturado: ${sale.totalValueUSD.toFixed(2)}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
         <div>
            <h1 style={{ margin: 0 }}>👥 Directorio CRM</h1>
            <p style={{ opacity: 0.6, margin: 0 }}>Gestión de identidades y fidelización de clientes</p>
         </div>
         <input 
            type="text" 
            placeholder="🔍 Buscar prospecto por nombre o C.I..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '400px', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem' }}
         />
      </div>

      <div className="glass-panel" style={{ flexGrow: 1, padding: '0', overflow: 'hidden' }}>
         <div className="table-responsive">
            <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
               <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                     <th style={{ padding: '20px' }}>Nombre del Cliente / Entidad</th>
                     <th>ID / Documento</th>
                     <th style={{ textAlign: 'center' }}>Fidelidad</th>
                     <th style={{ textAlign: 'right' }}>Gasto Acumulado</th>
                     <th style={{ paddingRight: '20px', textAlign: 'right' }}>Acción</th>
                  </tr>
               </thead>
               <tbody>
                  {filtered.length === 0 ? (
                     <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '80px', opacity: 0.3 }}>
                           <div style={{fontSize: '3rem'}}>📂</div>
                           No hay clientes registrados en la base histórica.
                        </td>
                     </tr>
                  ) : filtered.map((c, i) => (
                     <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.3s' }}>
                        <td style={{ padding: '20px' }}>
                           <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>{c.name}</div>
                           <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Última visita: {new Date(c.lastVisit).toLocaleDateString()}</div>
                        </td>
                        <td style={{ opacity: 0.8 }}>{c.id || 'N/A'}</td>
                        <td style={{ textAlign: 'center' }}>
                           <div style={{ padding: '4px 12px', borderRadius: '20px', background: c.visits > 3 ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', display: 'inline-block', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              {c.visits} Operaciones
                           </div>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '800', fontSize: '1.3rem' }}>
                           ${c.totalSpentUSD.toFixed(2)}
                        </td>
                        <td style={{ paddingRight: '20px', textAlign: 'right' }}>
                           <button 
                              onClick={() => setSelectedCustomer(c)}
                              style={{ padding: '8px 20px', background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                              Ver Perfil
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

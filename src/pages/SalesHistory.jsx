import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

export default function SalesHistory({ exchangeRate, refreshKey, userRole }) {
  const [sales, setSales] = useState([]);
  const [deleting, setDeleting] = useState(null);

  const loadSales = () => {
    dbService.query('SELECT * FROM SALES').then(res => {
       if (res.success) {
          const sortedSales = res.data.sort((a, b) => b.id - a.id);
          setSales(sortedSales);
       }
    });
  };

  useEffect(() => {
    loadSales();
  }, [refreshKey]);

  const handleDeleteOne = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta venta?')) return;
    setDeleting(id);
    const res = await dbService.deleteSale(id);
    if (res.success) {
      setSales(prev => prev.filter(s => String(s.id) !== String(id)));
    } else {
      alert('Error: ' + res.error);
    }
    setDeleting(null);
  };

  const handleClearAll = async () => {
    if (!window.confirm(`⚠️ ¿ELIMINAR TODO EL HISTORIAL?`)) return;
    const res = await dbService.clearAllSales();
    if (res.success) {
      setSales([]);
    } else {
      alert('Error: ' + res.error);
    }
  };

  const isAdmin = userRole === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '15 ' }}>
             <span style={{fontSize: '2rem'}}>📋</span> Historial de Ventas
          </h1>
          <p style={{ opacity: 0.6, margin: '5px 0 0 0' }}>
            {sales.length} transacciones registradas en el sistema.
          </p>
        </div>
        {isAdmin && sales.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              padding: '12px 20px',
              background: 'rgba(244, 63, 94, 0.1)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: '900',
              fontSize: '0.8rem',
              transition: 'all 0.3s'
            }}
            onMouseOver={e => e.target.style.background='rgba(244, 63, 94, 0.2)'}
            onMouseOut={e => e.target.style.background='rgba(244, 63, 94, 0.1)'}
          >
            🗑 ELIMINAR TODO
          </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="glass-table">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '20px' }}>ID</th>
                <th>FECHA Y HORA</th>
                <th>PRODUCTOS</th>
                <th>TOTAL</th>
                <th>DESGLOSE PAGO</th>
                {isAdmin && <th>ACCIÓN</th>}
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', opacity: 0.3, padding: '80px' }}>
                    <div style={{fontSize: '3rem'}}>📂</div>
                    <p>No hay registros de ventas.</p>
                  </td>
                </tr>
              )}
              {sales.map(s => {
                 const saleDate = new Date(s.date);
                 const dateStr = saleDate.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                 const timeStr = saleDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
                 
                 const productNames = Array.isArray(s.items) && s.items.length > 0
                   ? s.items.map(i => `${i.name} (x${i.qty})`).join(', ')
                   : 'N/A';
                 const isBeingDeleted = deleting === s.id || deleting === String(s.id);
                 
                 return (
                  <tr key={s.id} style={{ opacity: isBeingDeleted ? 0.4 : 1, transition: 'all 0.3s' }}>
                    <td style={{ padding: '20px', fontWeight: 'bold', opacity: 0.5 }}>#{String(s.id).slice(-6)}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{dateStr}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{timeStr}</div>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                       <div style={{ fontSize: '0.85rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={productNames}>
                          {productNames}
                       </div>
                    </td>
                    <td>
                       <div style={{ color: 'var(--success)', fontWeight: '900', fontSize: '1.2rem' }}>${(s.totalValueUSD || 0).toFixed(2)}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>${(s.paidUSD || 0).toFixed(2)} <span style={{opacity: 0.3, fontWeight: 'normal'}}>Cash</span></div>
                        <div style={{ color: '#facc15', fontSize: '0.75rem' }}>Bs. {(s.paidBS || 0).toLocaleString()} <span style={{opacity: 0.5, fontWeight: 'normal'}}>Bs</span></div>
                      </div>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => handleDeleteOne(s.id)}
                          disabled={isBeingDeleted}
                          style={{
                            background: 'rgba(244, 63, 94, 0.1)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(244, 63, 94, 0.2)',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: isBeingDeleted ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem'
                          }}
                        >
                          {isBeingDeleted ? '...' : '🗑'}
                        </button>
                      </td>
                    )}
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

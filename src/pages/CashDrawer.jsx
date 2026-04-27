import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

export default function CashDrawer({ exchangeRate, refreshKey }) {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Withdrawals form state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('withdrawal'); // 'withdrawal' or 'deposit'
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [reason, setReason] = useState('');

  const [zTicket, setZTicket] = useState(null);

  const loadData = () => {
    Promise.all([
      dbService.query('SELECT * FROM SALES'),
      dbService.query('SELECT * FROM CASH_TRANSACTIONS'),
      dbService.query('SELECT * FROM DAILY_CLOSURES')
    ]).then(([salesRes, transRes, closuresRes]) => {
      if (salesRes.success) {
         const today = new Date().toLocaleDateString('en-CA'); 
         const todaySales = salesRes.data.filter(s => new Date(s.date).toLocaleDateString('en-CA') === today);
         setSales(todaySales);
      }
      if (transRes.success) {
         const today = new Date().toLocaleDateString('en-CA');
         const todayTrans = transRes.data.filter(t => new Date(t.date).toLocaleDateString('en-CA') === today);
         setTransactions(todayTrans);
      }
      if (closuresRes.success) {
         setClosings(closuresRes.data.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || amount <= 0) {
        alert("Ingrese un monto válido.");
        return;
    }
    
    const res = await dbService.addCashTransaction({
        date: new Date().toISOString(),
        type: modalMode,
        amount: parseFloat(amount),
        currency: currency,
        reason: reason || (modalMode === 'withdrawal' ? 'Retiro sin especificar' : 'Ingreso de capital')
    });
    
    if (res.success) {
        setShowModal(false);
        setAmount('');
        setReason('');
        loadData();
    } else {
        alert("Error al guardar: " + res.error);
    }
  };

  const handleWithdrawAll = () => {
    const total = currency === 'USD' ? currentCashUSD : currentCashBS;
    setAmount(total.toFixed(2));
  };

  const totalSalesUSD = sales.reduce((acc, s) => acc + (s.paidUSD > 0 ? s.paidUSD - (s.changeUSD||0) : 0), 0);
  const totalSalesBS = sales.reduce((acc, s) => acc + (s.paidBS > 0 ? s.paidBS - (s.changeBS||0) : 0), 0);

  const totalWithdrawalsUSD = transactions.filter(t => t.currency === 'USD' && t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawalsBS = transactions.filter(t => t.currency === 'BS' && t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0);

  const totalDepositsUSD = transactions.filter(t => t.currency === 'USD' && (t.type === 'deposit' || t.type === 'capital')).reduce((acc, t) => acc + t.amount, 0);
  const totalDepositsBS = transactions.filter(t => t.currency === 'BS' && (t.type === 'deposit' || t.type === 'capital')).reduce((acc, t) => acc + t.amount, 0);

  const currentCashUSD = totalSalesUSD + totalDepositsUSD - totalWithdrawalsUSD;
  const currentCashBS = totalSalesBS + totalDepositsBS - totalWithdrawalsBS;

  const handleZClose = async () => {
     if (!window.confirm("¿Estás seguro de hacer el Corte Z? Esto dejará la fecha marcada contablemente.")) return;
     const closureData = {
         totalSalesUSD,
         totalSalesBS,
         totalWithdrawalsUSD,
         totalWithdrawalsBS,
         netCashUSD: currentCashUSD,
         netCashBS: currentCashBS,
         transactionsCount: sales.length,
         withdrawalsCount: transactions.length
     };
     const res = await dbService.closeDay(closureData);
      if (res.success) {
         setZTicket(res.data);
         
         // 📡 Enviar reportes a Telegram
         try {
            const { notificationService } = await import('../services/notification.service');
            // Enviar resumen de ventas por usuario
            await notificationService.sendDailyReport();
            // Enviar ticket de cierre detallado
            await notificationService.sendClosureReport(res.data);
         } catch (e) {
            console.error("Telegram Reporting Fail:", e);
         }

         if (dbService.isElectron() && window.api.saveZClosePDF) {
           window.api.saveZClosePDF(res.data).catch(console.error);
        }
        
        setTimeout(() => {
           setZTicket(null);
           loadData();
        }, 500);
     } else {
        alert("Error de cierre: " + res.error);
     }
  };

  if (loading) return <h2 style={{color:'white'}}>Cargando Caja...</h2>;

  return (
    <>
    <div className="no-print" style={{ display: 'flex', gap: '20px', height: '100%', position: 'relative', overflowY: 'auto' }}>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' }}>
            <form onSubmit={handleTransaction} className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h3 style={{ margin: 0, color: modalMode === 'withdrawal' ? 'var(--danger)' : 'var(--success)' }}>
                  {modalMode === 'withdrawal' ? '💸 Retirar Dinero' : '💰 Ingresar Capital'}
                </h3>
                <div>
                   <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Monto:</label>
                   <div style={{ display: 'flex', gap: '10px' }}>
                       <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }} placeholder="Ej: 20.00" />
                       <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ padding: '10px', borderRadius: '5px', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                          <option value="USD">USD</option>
                          <option value="BS">Bs.</option>
                       </select>
                   </div>
                   {modalMode === 'withdrawal' && (
                     <button type="button" onClick={handleWithdrawAll} style={{ marginTop: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem' }}>
                       🏧 Retirar Todo
                     </button>
                   )}
                </div>
                <div>
                   <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Motivo / Concepto:</label>
                   <input type="text" required value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', color: 'white' }} placeholder={modalMode === 'withdrawal' ? "Pago de proveedor, pasajes..." : "Inyección de capital, base de caja..."} />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                   <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
                   <button type="submit" style={{ flex: 1, padding: '10px', background: modalMode === 'withdrawal' ? 'var(--danger)' : 'var(--success)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                     {modalMode === 'withdrawal' ? 'Extraer y Guardar' : 'Ingresar y Guardar'}
                   </button>
                </div>
            </form>
        </div>
      )}

      {/* LEFT: METRICS AND ACTION */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Arqueo de Hoy</h2>
            <button onClick={handleZClose} style={{ padding: '10px 20px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
               🚫 REALIZAR CIERRE DE TURNO (Z)
            </button>
         </div>

         <div style={{ display: 'flex', gap: '15px' }}>
             <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', opacity: 0.8 }}>Ingreso Físico USD</h3>
                <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--success)' }}>${currentCashUSD.toFixed(2)}</h1>
                <div style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.8 }}>
                  <p>+ Ventas: ${totalSalesUSD.toFixed(2)}</p>
                  <p>+ Capital/Base: ${totalDepositsUSD.toFixed(2)}</p>
                  <p style={{ color: 'var(--danger)' }}>- Retiros: ${totalWithdrawalsUSD.toFixed(2)}</p>
                </div>
             </div>

             <div style={{ flex: 1, background: 'rgba(0, 210, 255, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', opacity: 0.8 }}>Ingreso Físico BS</h3>
                <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--accent-color)' }}>Bs. {currentCashBS.toFixed(2)}</h1>
                <div style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.8 }}>
                  <p>+ Ventas: Bs. {totalSalesBS.toFixed(2)}</p>
                  <p>+ Capital/Base: Bs. {totalDepositsBS.toFixed(2)}</p>
                  <p style={{ color: 'var(--danger)' }}>- Retiros: Bs. {totalWithdrawalsBS.toFixed(2)}</p>
                </div>
             </div>
         </div>

          <div style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
                <h3 style={{ margin: 0 }}>Gestión de Efectivo</h3>
                <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>Registra ingresos de capital o pagos desde la gaveta.</p>
             </div>
             <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setModalMode('deposit'); setShowModal(true); }} style={{ padding: '15px 20px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  💰 Ingresar Capital
                </button>
                <button onClick={() => { setModalMode('withdrawal'); setShowModal(true); }} style={{ padding: '15px 20px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  💸 Registrar Retiro
                </button>
             </div>
          </div>
      </div>

      {/* MID: DETALLE DE VENTAS HOY */}
      <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column' }}>
         <h3 style={{ margin: '0 0 15px 0' }}>Ventas de Hoy</h3>
         <div style={{ flexGrow: 1, overflowY: 'auto' }}>
            {sales.length === 0 ? (
               <p style={{ opacity: 0.5, textAlign: 'center', marginTop: '20px' }}>Aún no hay ventas.</p>
            ) : (
               sales.slice().reverse().map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(16,185,129,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
                     <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Ticket #{String(s.id).slice(-6)}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{new Date(s.date).toLocaleTimeString()}</div>
                     </div>
                     <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                        +${(s.paidUSD > 0 ? (s.paidUSD - (s.changeUSD||0)) : s.totalValueUSD).toFixed(2)}
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>

      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
         {/* Historial Retiros Hoy */}
         <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Retiros de Hoy</h3>
            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '250px' }}>
               {transactions.length === 0 ? (
                  <p style={{ opacity: 0.5, textAlign: 'center', marginTop: '20px' }}>Caja Invicta.</p>
               ) : (
                  transactions.slice().reverse().map(t => (
                     <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,0,0,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
                        <div>
                           <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{t.reason}</div>
                           <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{new Date(t.date).toLocaleTimeString()}</div>
                        </div>
                        <div style={{ color: t.type === 'withdrawal' ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>
                           {t.type === 'withdrawal' ? '-' : '+'}{t.currency === 'USD' ? '$' : 'Bs.'}{t.amount.toFixed(2)}
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>

         {/* Historial Cierres Historicos */}
         <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <h3 style={{ margin: '0 0 10px 0' }}>Histórico Cierres (Z)</h3>
             <div style={{ overflowY: 'auto', maxHeight: '150px' }}>
                {closings.length === 0 ? <p style={{opacity: 0.5, fontSize: '0.9rem'}}>No hay cierres.</p> : closings.slice(0,5).map(c => (
                   <div key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px', marginBottom: '8px' }}>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>Día {new Date(c.timestamp).toLocaleDateString()} local</strong>
                      <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Bóveda: ${c.netCashUSD.toFixed(2)}</span>
                   </div>
                ))}
             </div>
         </div>
      </div>
    </div>

    {/* Z RECIBO PARA IMPRESORA */}
    {zTicket && (
       <div className="print-only" style={{ padding: '0 20px', fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', width: '300px', background: 'white', color: 'black' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px', paddingTop: '10px' }}>
             <h1 style={{ margin: '0', color: 'black', fontSize: '24px', letterSpacing: '2px', fontWeight: '900' }}>CIERRE DE CAJA</h1>
             <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', fontSize: '14px' }}>TICKET Z</p>
             <p style={{ margin: '2px 0 5px 0', fontSize: '12px' }}>TECHZONE RIF: J-507426785</p>
             <p style={{ margin: '5px 0', borderBottom: '1px dashed #ccc' }}></p>
          </div>

          <div style={{ marginBottom: '10px' }}>
             <p style={{ margin: '2px 0' }}>Expedido: {new Date(zTicket.timestamp).toLocaleString('es-VE')}</p>
             <p style={{ margin: '2px 0' }}>Cierre Ref: {zTicket.id}</p>
          </div>
          
          <p style={{ margin: '5px 0', borderBottom: '1px dotted #ccc' }}></p>
          
          <div style={{ margin: '10px 0', fontWeight: 'bold' }}>
             <h3 style={{ margin: '5px 0' }}>VENTAS BRUTAS</h3>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Operaciones:</span>
                <span>{zTicket.transactionsCount}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                <span>Ingreso USD:</span>
                <span>${zTicket.totalSalesUSD.toFixed(2)}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>Ingreso BS:</span>
                <span>Bs. {zTicket.totalSalesBS.toFixed(2)}</span>
             </div>
          </div>

          <p style={{ margin: '10px 0', borderBottom: '1px dotted #ccc' }}></p>

          <div style={{ margin: '10px 0' }}>
             <h3 style={{ margin: '5px 0', fontWeight: 'bold' }}>RETIROS Y GASTOS</h3>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Desc. USD:</span>
                <span>- ${zTicket.totalWithdrawalsUSD.toFixed(2)}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>Desc. BS:</span>
                <span>- Bs. {zTicket.totalWithdrawalsBS.toFixed(2)}</span>
             </div>
          </div>

          <p style={{ margin: '10px 0', borderBottom: '1px solid #000' }}></p>

          <div style={{ margin: '10px 0', fontSize: '14px', fontWeight: 'bold' }}>
             <h3 style={{ margin: '5px 0' }}>RECUENTO FINAL DE CAJA</h3>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>EFECTIVO USD:</span>
                <span>${zTicket.netCashUSD.toFixed(2)}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                <span>EFECTIVO BS:</span>
                <span>Bs. {zTicket.netCashBS.toFixed(2)}</span>
             </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '20px' }}>
             <p style={{ margin: '0 0 10px 0' }}>_________________________</p>
             <p style={{ margin: 0, fontWeight: 'bold' }}>FIRMA DEL GERENTE</p>
          </div>
       </div>
    )}
    </>
  );
}

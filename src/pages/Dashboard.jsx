import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

export default function Dashboard({ refreshKey }) {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
       dbService.query('SELECT * FROM products'),
       dbService.query('SELECT * FROM sales'),
       dbService.query('SELECT * FROM EXPENSES'),
       dbService.query('SELECT * FROM repairs')
    ]).then(([prodRes, salesRes, expRes, repairRes]) => {
       if (prodRes.success) setProducts(prodRes.data || []);
       if (salesRes.success) setSales(salesRes.data || []);
       if (expRes.success) setExpenses(expRes.data || []);
       if (repairRes.success) setRepairs(repairRes.data || []);
       setLoading(false);
    });
  }, [refreshKey]);

  // --- LÓGICA UNIFICADA ---
  const todayVal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
  const productPerformance = {};
  
  let bruteIncome = 0;
  let bruteIncomeToday = 0;
  let pureProfit = 0;
  let pureProfitToday = 0;
  let salesTodayCount = 0;

  // 1. Procesar Ventas (IGNORANDO registros de reparación para evitar duplicidad)
  sales.forEach(s => {
      const saleDateVE = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
      const isToday = saleDateVE === todayVal;
      
      const items = Array.isArray(s.items) ? s.items : [];
      // Filtramos para no contar reparaciones aquí (se cuentan desde la tabla repairs para ser la fuente de verdad)
      const nonRepairItems = items.filter(item => !item.isRepair);
      
      if (nonRepairItems.length > 0) {
          nonRepairItems.forEach(item => {
              const price = parseFloat(item.price) || 0;
              const qty = parseFloat(item.qty) || 1;
              const cost = parseFloat(item.cost) || 0;
              const lineTotal = price * qty;
              const lineCost = cost * qty;
              
              const profit = lineTotal - lineCost;
              pureProfit += profit;
              bruteIncome += lineTotal;

              if (isToday) {
                  pureProfitToday += profit;
                  bruteIncomeToday += lineTotal;
              }

              const name = item.name || 'Desconocido';
              if (!productPerformance[name]) productPerformance[name] = { qty: 0, revenue: 0 };
              productPerformance[name].qty += qty;
              productPerformance[name].revenue += lineTotal;
          });
          if (isToday) salesTodayCount++;
      }
  });

  // 2. Procesar Taller (Fuente Única de Verdad para Servicios)
  const deliveredRepairs = repairs.filter(r => r.status === 'Entregado');
  const workshopTotalCollected = deliveredRepairs.reduce((acc, r) => acc + (Number(r.budget) || 0), 0);
  const workshopPartCosts = deliveredRepairs.reduce((acc, r) => acc + (Number(r.partCost) || 0), 0);
  const workshopManoDeObra = workshopTotalCollected - workshopPartCosts;
  
  const techCommissions = workshopManoDeObra * 0.4;
  const workshopShopProfit = workshopManoDeObra * 0.6;

  // Integrar taller en Métricas Globales
  bruteIncome += workshopTotalCollected;
  pureProfit += workshopShopProfit;

  deliveredRepairs.forEach(r => {
      const dDateReg = r.deliveredDate || r.date;
      const dDateVE = new Date(dDateReg).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
      const isToday = dDateVE === todayVal;

      if (isToday) {
          const rManoDeObra = (Number(r.budget) || 0) - (Number(r.partCost) || 0);
          const rShopProfit = rManoDeObra * 0.6;
          
          bruteIncomeToday += (Number(r.budget) || 0);
          pureProfitToday += rShopProfit;
      }
  });

  // --- LÓGICA DE PRODUCTOS ---
  const totalProductsCount = products.length;
  const lowStockItems = products.filter(p => !p.isService && p.quantity <= 2);
  const totalInvestment = products.reduce((acc, p) => acc + ((parseFloat(p.cost)||0) * (parseFloat(p.quantity)||0)), 0);
  const totalPotentialRevenue = products.reduce((acc, p) => acc + ((parseFloat(p.price)||0) * (parseFloat(p.quantity)||0)), 0);

  const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
  const netUtility = pureProfit - totalExpenses;
  const realProfitMargin = bruteIncome > 0 ? ((netUtility / bruteIncome) * 100).toFixed(1) : 0;

  const bestSellers = Object.entries(productPerformance)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);

  const roiPotential = totalInvestment > 0 ? (((totalPotentialRevenue - totalInvestment) / totalInvestment) * 100).toFixed(1) : 0;

  // 📊 Cálculo de Tendencia (7 DÍAS) - Ahora incluye Taller
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
    
    // Sumamos ventas de productos
    const salesDay = sales
      .filter(s => new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) === dateStr)
      .reduce((acc, s) => {
          const items = Array.isArray(s.items) ? s.items.filter(it => !it.isRepair) : [];
          return acc + items.reduce((sum, it) => sum + (parseFloat(it.price)*parseFloat(it.qty) || 0), 0);
      }, 0);
    
    // Sumamos taller
    const workshopDay = repairs
      .filter(r => r.status === 'Entregado')
      .filter(r => new Date(r.deliveredDate || r.date).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' }) === dateStr)
      .reduce((acc, r) => acc + (Number(r.budget) || 0), 0);
      
    return { dateStr, dayName, total: salesDay + workshopDay };
  });

  const maxDailySale = Math.max(...last7Days.map(d => d.total), 1);

  if (loading) return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <h2 style={{ color: 'var(--accent-color)', animation: 'pulse-yellow 1s infinite' }}>🛰️ Cargando Centro de Mando...</h2>
      </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', height: '100%', overflowY: 'auto', paddingRight: '15px' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '15px' }}>
             <span style={{fontSize: '2.5rem'}}>📊</span> Panel Negocio Techzone
          </h1>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 20px', borderRadius: '30px', border: '1px solid var(--glass-border)', fontSize: '0.9rem', opacity: 0.8 }}>
             Ultima actualización: {new Date().toLocaleTimeString()}
          </div>
       </div>

       {/* 1. SECCION: CORTE DE HOY */}
       <div className="glass-panel" style={{ border: '1px solid var(--accent-color)', background: 'linear-gradient(135deg, rgba(0,210,255,0.05) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h3 style={{ margin: '0', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', letterSpacing: '1px' }}>
                📅 RESUMEN DE HOY <span style={{opacity: 0.5, fontSize: '0.9rem'}}>({todayVal})</span>
             </h3>
             <span style={{ fontSize: '0.8rem', background: 'var(--accent-color)', color: '#000', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>{salesTodayCount} OPERACIONES</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
             <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', borderLeft: '5px solid #fff' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '5px' }}>Ingresos Brutos (+)</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '900' }}>${bruteIncomeToday.toFixed(2)}</div>
             </div>
             <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '15px', borderLeft: '5px solid var(--success)', boxShadow: 'inset 0 0 20px rgba(16,185,129,0.05)' }}>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', marginBottom: '5px' }}>Utilidad Operativa</div>
                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--success)', textShadow: '0 0 15px rgba(16,185,129,0.2)' }}>${pureProfitToday.toFixed(2)}</div>
             </div>
          </div>
       </div>
       
       {/* 2. SECCION: METRICAS DE TALLER (60/40) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
           <div className="glass-panel" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>🛠️</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Total Taller</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#3b82f6' }}>${workshopTotalCollected.toFixed(2)}</div>
           </div>
           
           <div className="glass-panel" style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>📦</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Costo Repuestos</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f43f5e' }}>-${workshopPartCosts.toFixed(2)}</div>
           </div>

           <div className="glass-panel" style={{ background: 'rgba(250, 204, 21, 0.05)', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>👨‍🔧</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Pago Técnicos (40%)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#facc15' }}>${techCommissions.toFixed(2)}</div>
           </div>

           <div className="glass-panel" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', boxShadow: '0 0 15px rgba(16,185,129,0.1)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>💰</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', color: 'var(--success)' }}>Ganancia Tienda (60%)</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--success)' }}>${workshopShopProfit.toFixed(2)}</div>
           </div>
        </div>

        {/* 3. SECCION: HISTORICO Y UTILIDAD REAL */}
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px' }}>
          <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)' }}>
             <h3 style={{ margin: '0 0 10px 0', opacity: 0.6, fontSize: '0.75rem', textTransform: 'uppercase' }}>Ventas Históricas (+)</h3>
             <h2 style={{ margin: '0', fontSize: '2.2rem', color: 'white' }}>${bruteIncome.toLocaleString()}</h2>
          </div>

          <div className="glass-panel" style={{ border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.03)' }}>
             <h3 style={{ margin: '0 0 10px 0', color: 'var(--danger)', opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase' }}>Egresos (Gastos) (-)</h3>
             <h2 style={{ margin: '0', fontSize: '2.2rem', color: 'var(--danger)' }}>- ${totalExpenses.toLocaleString()}</h2>
          </div>

          <div className="glass-panel" style={{ border: '2px solid var(--success)', background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, transparent 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <h3 style={{ margin: '0 0 5px 0', opacity: 0.8, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Utilidad Neta Real (EBITDA)</h3>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
                 <h2 style={{ margin: '0', fontSize: '3rem', color: 'var(--success)', fontWeight: '900', textShadow: '0 0 20px rgba(16,185,129,0.3)' }}>${netUtility.toLocaleString()}</h2>
                 <span style={{ background: 'var(--success)', color: 'white', padding: '5px 15px', borderRadius: '25px', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: 'var(--success-glow)' }}>{realProfitMargin}% Margen Real</span>
             </div>
          </div>
       </div>

       {/* 3. TENDENCIA DE VENTAS */}
       <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
             <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📈 TENDENCIA GLOBAL (7 DÍAS)</h3>
             <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>VENTAS + TALLER EN USD</span>
          </div>
          
          <div className="chart-container">
             {last7Days.map(day => (
                <div 
                  key={day.dateStr} 
                  className="trend-bar" 
                  style={{ height: `${(day.total / maxDailySale) * 100}%` }}
                >
                   <div className="trend-value">${day.total.toFixed(0)}</div>
                   <div className="trend-label">{day.dayName}</div>
                </div>
             ))}
          </div>
       </div>

       {/* 4. ANALISIS DE INVENTARIO */}
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div className="glass-panel" style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '2rem' }}>💰</div>
             <h3 style={{ opacity: 0.6, fontSize: '0.8rem', margin: '10px 0 5px 0' }}>VALOR ACTIVO (COSTO)</h3>
             <h2 style={{ fontSize: '1.8rem', margin: '0' }}>${totalInvestment.toLocaleString()}</h2>
          </div>
          <div className="glass-panel" style={{ textAlign: 'center' }}>
             <div style={{ fontSize: '2rem' }}>📈</div>
             <h3 style={{ opacity: 0.6, fontSize: '0.8rem', margin: '10px 0 5px 0' }}>ROI PROYECTADO</h3>
             <h2 style={{ fontSize: '1.8rem', margin: '0', color: 'var(--accent-color)' }}>{roiPotential}%</h2>
          </div>
          <div className="glass-panel" style={{ textAlign: 'center', border: lowStockItems.length > 0 ? '1px solid var(--danger)' : '1px solid var(--success)' }}>
             <div style={{ fontSize: '2rem' }}>🚨</div>
             <h3 style={{ opacity: 0.6, fontSize: '0.8rem', margin: '10px 0 5px 0' }}>ALERTAS DE STOCK</h3>
             <h2 style={{ fontSize: '1.8rem', margin: '0', color: lowStockItems.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {lowStockItems.length} SKUs
             </h2>
          </div>
       </div>
    </div>
  );
}

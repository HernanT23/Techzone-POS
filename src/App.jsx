import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import SalesHistory from './pages/SalesHistory';
import Agenda from './pages/Agenda';
import CashDrawer from './pages/CashDrawer';
import Customers from './pages/Customers';
import Expenses from './pages/Expenses';
import Alerts from './pages/Alerts';
import Repairs from './pages/Repairs';

import { dbService } from './services/api.service';

function AppWrapper() {
   const [exchangeRate, setExchangeRate] = useState('40.00');
   const [role, setRole] = useState(null);
   const [loginPass, setLoginPass] = useState('');
   const [loginError, setLoginError] = useState('');
   const [isOnline, setIsOnline] = useState(navigator.onLine);
   const [syncStatus, setSyncStatus] = useState('online'); // 'online', 'syncing', 'error', 'offline'
   const [lowStockCount, setLowStockCount] = useState(0);
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   const [refreshKey, setRefreshKey] = useState(0);
   const [businessSettings, setBusinessSettings] = useState({
       name: 'TECHZONE',
       rif: 'J-507426785',
       tel: '04245655763'
   });

    // Auto-login for Mobile (No password)
    useEffect(() => {
       if (!dbService.isElectron()) {
          setRole('admin');
       }
    }, []);

    useEffect(() => {
      const handleStatusChange = () => setIsOnline(navigator.onLine);
      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);

      // Listener para estado real de sincronización en Desktop
      if (window.api && window.api.onSyncStatus) {
        window.api.onSyncStatus((status) => {
          setIsOnline(status.connected);
          setSyncStatus(status.syncing ? 'syncing' : (status.connected ? 'online' : 'offline'));
        });
      }

      const fetchData = () => {
        setRefreshKey(prev => prev + 1);
        dbService.query("SELECT * FROM SETTINGS").then(res => {
          if (res.success && res.data.length > 0) {
             const settingsMap = {};
             res.data.forEach(s => settingsMap[s.key] = s.value);
             if (settingsMap.exchange_rate_bs) setExchangeRate(settingsMap.exchange_rate_bs);
             setBusinessSettings({
                name: settingsMap.business_name || 'TECHZONE',
                rif: settingsMap.business_rif || 'J-507426785',
                tel: settingsMap.business_tel || '04245655763'
             });
          }
        });

        dbService.query('SELECT * FROM products').then(res => {
          if (res.success) {
            const low = res.data.filter(p => !p.isService && p.quantity <= 2).length;
            setLowStockCount(low);
          }
        });
      };

      fetchData();

      // Realtime Sync (Supabase)
      const unsubscribe = dbService.subscribeToChanges((payload) => {
         console.log("📡 Nube actualizada (Realtime), refrescando data...");
         fetchData();
      });

      // Desktop Sync Listener
      if (window.api && window.api.onDbUpdated) {
         window.api.onDbUpdated(() => {
            console.log("🔄 PC sincronizada, refrescando datos...");
            fetchData();
         });
      }

      return () => {
        unsubscribe();
        window.removeEventListener('online', handleStatusChange);
        window.removeEventListener('offline', handleStatusChange);
      };
    }, [role]); 

    const handleForceSync = async () => {
       if (syncStatus === 'syncing') return;
       setSyncStatus('syncing');
       try {
          await dbService.triggerSync();
          // La app se refrescará vía 'onDbUpdated' en Electron
       } catch (e) {
          console.error("Sync Error:", e);
       } finally {
          setTimeout(() => setSyncStatus('online'), 2000);
       }
    };

   const handleLogout = () => {
     setRole(null);
     setLoginPass('');
     setLoginError('');
   };

   const [selectedProfile, setSelectedProfile] = useState('admin');
   const [showMobilePass, setShowMobilePass] = useState(false);

   if (!role) {
      const isDesktop = dbService.isElectron();

      const handleDesktopLogin = async (e) => {
         e.preventDefault();
         if (selectedProfile === 'cashier') {
            setRole('cashier');
            return;
         }
         
         if (!loginPass) {
            setLoginError('❌ ERROR: Escribe la clave para entrar a Gerencia');
            return;
         }

         setLoginError('');
         try {
            const res = await dbService.login(loginPass, 'admin');
            if (res.success) {
               setRole(res.role);
            } else {
               setLoginError("❌ Clave de Gerencia INCORRECTA");
               setLoginPass('');
            }
         } catch (err) {
            setLoginError("⚠️ Error de conexión: " + err.message);
         }
      };

      return (
         <div className="login-split">
            {/* LEFT / BRANDING PANEL */}
             <div className="login-left">
                <h1>TECHZONE</h1>
                <h3 className="login-subtitle">ERP 2.0 Management Suite</h3>
                <div style={{ marginTop: '20px', opacity: 0.5, fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', display: 'inline-block' }}>
                   VERSION v1.1.3
                </div>
                <div className="security-badge">
                   <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                     <div className="status-dot online"></div>
                     {isDesktop ? 'Nodo Local de Escritorio' : 'Punto Remoto Vía Nube'}
                   </span>
                </div>
             </div>

            {/* RIGHT / AUTH PANEL */}
            <div className="login-right">
               <div className="glass-panel login-form-panel">
                  
                  {isDesktop ? (
                    <div className="desktop-login">
                       <div className="profile-selector" style={{ display: 'flex', gap: '15px', marginBottom: '30px', justifyContent: 'center' }}>
                          <div 
                             className={`profile-card ${selectedProfile === 'admin' ? 'active' : ''}`}
                             onClick={() => { setSelectedProfile('admin'); setLoginError(''); setLoginPass(''); }}
                          >
                             <span style={{ fontSize: '2.5rem' }}>👔</span>
                             <p>Gerencia</p>
                          </div>
                          <div 
                             className={`profile-card ${selectedProfile === 'cashier' ? 'active' : ''}`}
                             onClick={() => { setSelectedProfile('cashier'); setLoginError(''); setLoginPass(''); }}
                          >
                             <span style={{ fontSize: '2.5rem' }}>🛒</span>
                             <p>Ventas</p>
                          </div>
                       </div>

                       <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                          <h2 style={{ margin: '0', fontWeight: 600 }}>
                             {selectedProfile === 'admin' ? 'Perfil Gerencia' : 'Perfil Ventas'}
                          </h2>
                          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '5px' }}>
                             {selectedProfile === 'admin' ? 'Requiere clave de seguridad' : 'Acceso directo para ventas rápidas'}
                          </p>
                       </div>

                       {loginError && (
                          <div className="error-badge" style={{ background: '#ef4444', color: 'white', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem' }}>
                             {loginError}
                          </div>
                       )}

                       <form onSubmit={handleDesktopLogin} className="login-form">
                          {selectedProfile === 'admin' && (
                             <input 
                                type="password"
                                className="pin-input"
                                placeholder="ESCRIBE TU CLAVE AQUÍ"
                                value={loginPass}
                                onChange={(e) => setLoginPass(e.target.value)}
                                autoFocus
                                required
                             />
                          )}
                          
                          <button type="submit" className="login-btn">
                            {selectedProfile === 'admin' ? 'VALIDAR Y ENTRAR 🔓' : 'INGRESAR A VENDER 🛒'}
                          </button>
                       </form>
                    </div>
                  ) : (
                    /* MOBILE VIEW */
                    <div style={{ textAlign: 'center', width: '100%' }}>
                       <span style={{ fontSize: '5rem', marginBottom: '20px', display: 'block' }}>📱</span>
                       <h2 style={{ margin: '0 0 10px 0', fontWeight: 800 }}>MODO MÓVIL</h2>
                       <p style={{ opacity: 0.7, marginBottom: '30px' }}>Acceso directo a la administración del negocio</p>
                       
                       {showMobilePass ? (
                          <form onSubmit={handleDesktopLogin}>
                             <input 
                                type="password"
                                className="pin-input"
                                placeholder="PIN GERENCIA"
                                value={loginPass}
                                onChange={(e) => setLoginPass(e.target.value)}
                                autoFocus
                                required
                                style={{ width: '100%', padding: '15px', borderRadius: '8px', marginBottom: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid white', color: 'white', textAlign: 'center' }}
                             />
                             {loginError && <p style={{ color: 'red', fontSize: '0.8rem' }}>{loginError}</p>}
                             <button type="submit" className="login-btn" style={{ width: '100%' }}>ENTRAR 🔓</button>
                             <button onClick={() => setShowMobilePass(false)} style={{ marginTop: '10px', background: 'none', border: 'none', color: 'white', opacity: 0.5 }}>Regresar</button>
                          </form>
                       ) : (
                          <>
                             <button 
                               onClick={() => setShowMobilePass(true)} 
                               className="login-btn" 
                               style={{ width: '100%', padding: '20px', fontSize: '1.4rem' }}
                             >
                                ENTRAR A GERENCIA
                             </button>

                             <button 
                               onClick={() => setRole('cashier')} 
                               style={{ width: '100%', padding: '15px', marginTop: '15px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px' }}
                             >
                                Punto de Venta
                             </button>
                          </>
                       )}
                    </div>
                  )}
                  
                  <div style={{ marginTop: '30px', opacity: 0.3, fontSize: '0.7rem', textAlign: 'center' }}>
                     Cualquier intento de acceso no autorizado será registrado localmente.
                  </div>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className={`app-container ${isMenuOpen ? 'menu-open' : ''}`}>
        {/* Mobile Header */}
        <header className="mobile-header" style={{ display: 'flex', gap: '15px' }}>
           <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? '✕' : '☰'}
           </button>
           <h1 style={{ color: '#00d2ff', fontSize: '1.2rem', margin: 0, flex: 1 }}>TECHZONE</h1>
           
           <div className="header-rate-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,210,255,0.1)', padding: '5px 12px', borderRadius: '12px', border: '1px solid rgba(0,210,255,0.2)' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', opacity: 0.8 }}>TASA:</span>
              {role === 'admin' ? (
                <input 
                  type="text"
                  value={exchangeRate}
                  onChange={(e) => {
                    setExchangeRate(e.target.value);
                    if (dbService.saveSetting) dbService.saveSetting('exchange_rate_bs', e.target.value);
                  }}
                  style={{ background: 'none', border: 'none', color: '#00d2ff', fontWeight: 'bold', width: '60px', textAlign: 'center', outline: 'none', fontSize: '1rem' }}
                />
              ) : (
                <span style={{ color: '#00d2ff', fontWeight: 'bold' }}>{exchangeRate}</span>
              )}
           </div>

           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? 'var(--success)' : 'var(--danger)' }}></div>
        </header>

        <div className="main-layout">
           <aside className={`sidebar glass-panel ${isMenuOpen ? 'open' : ''}`}>
             <h1 className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               TECHZONE
               <span style={{ fontSize: '0.5rem', background: 'var(--success)', color: 'black', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', letterSpacing: '1px' }}>LIVE</span>
             </h1>
             
             <div className="status-badge-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <div className={`status-dot ${syncStatus}`}></div>
                   <span style={{ opacity: 0.8, fontSize: '0.75rem', fontWeight: '500' }}>
                     {syncStatus === 'syncing' ? 'Sincronizando...' : (isOnline ? 'Nube Conectada' : 'Modo Local Offline')}
                   </span>
                </div>
                {dbService.isElectron() && (
                   <button 
                      onClick={handleForceSync}
                      className={`sync-mini-btn ${syncStatus === 'syncing' ? 'spinning' : ''}`}
                      title="Sincronizar con la nube ahora"
                      disabled={syncStatus === 'syncing'}
                   >
                      🔄
                   </button>
                )}
             </div>
 
             <nav className="sidebar-nav" onClick={() => setIsMenuOpen(false)}>
               <NavLink to="/dashboard"><span>📊</span> Dashboard</NavLink>
               <NavLink to="/" end><span>🏠</span> Venta</NavLink>
               {role === 'admin' && <NavLink to="/drawer"><span>💰</span> Caja</NavLink>}
               {role === 'admin' && (
                  <NavLink to="/inventory" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>📦</span> Inventario
                     </div>
                     {lowStockCount > 0 && <span className="pulse-badge">{lowStockCount}</span>}
                  </NavLink>
               )}
                <NavLink to="/repairs"><span>🔨</span> Reparaciones</NavLink>
                <NavLink to="/agenda"><span>📅</span> Agenda</NavLink>
                <NavLink to="/sales"><span>📋</span> Historial</NavLink>
                <NavLink to="/customers"><span>👥</span> Clientes</NavLink>
                {role === 'admin' && <NavLink to="/alerts"><span>🤖</span> Alertas</NavLink>}
               
                <button onClick={handleLogout} style={{ marginTop: '30px', background: 'rgba(244,63,94,0.1)', border: 'none', color: 'var(--danger)', padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Salir del Sistema</button>
             </nav>
             
             <div className="rate-box">
                <label>Tasa BS:</label>
                {role === 'admin' ? (
                   <input 
                     value={exchangeRate} 
                     onChange={(e) => {
                       setExchangeRate(e.target.value);
                       if (dbService.saveSetting) {
                          dbService.saveSetting('exchange_rate_bs', e.target.value);
                       }
                     }}
                     style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--accent-color)', background: 'rgba(0,0,0,0.4)', color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', outline: 'none' }}
                   />
                ) : (
                   <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {exchangeRate}
                   </div>
                )}
             </div>
 
             <div style={{ marginTop: '20px', padding: '15px 0', opacity: 0.3, fontSize: '0.65rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                TECHZONE SMART CORE v1.1.3
             </div>
           </aside>
           
           <main className="content">
             <Routes>
               <Route path="/" element={<POS refreshKey={refreshKey} exchangeRate={exchangeRate} userRole={role} businessSettings={businessSettings} />} />
               {role === 'admin' && <Route path="/drawer" element={<CashDrawer refreshKey={refreshKey} exchangeRate={exchangeRate} />} />}
               {role === 'admin' && <Route path="/inventory" element={<Inventory refreshKey={refreshKey} exchangeRate={exchangeRate} />} />}
                <Route path="/agenda" element={<Agenda refreshKey={refreshKey} />} />
                <Route path="/repairs" element={<Repairs refreshKey={refreshKey} userRole={role} />} />
                <Route path="/sales" element={<SalesHistory refreshKey={refreshKey} exchangeRate={exchangeRate} userRole={role} />} />
               <Route path="/customers" element={<Customers refreshKey={refreshKey} />} />
               <Route path="/alerts" element={<Alerts />} />
               {role === 'admin' && <Route path="/expenses" element={<Expenses refreshKey={refreshKey} />} />}
               {role === 'admin' && <Route path="/dashboard" element={<Dashboard refreshKey={refreshKey} exchangeRate={exchangeRate} />} />}
             </Routes>
           </main>
        </div>
      </div>
   );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;

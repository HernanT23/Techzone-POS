import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/api.service';

export default function POS({ refreshKey, exchangeRate, userRole, businessSettings }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  const [showModal, setShowModal] = useState(false);
  const [amountUSD, setAmountUSD] = useState('');
  const [amountBS, setAmountBS] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const searchInputRef = useRef(null);

  // Categorías Únicas
  const categories = ['Todos', ...new Set(products.map(p => p.category || 'Otros'))];
  
  // Atajos de Teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + B -> Buscar
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      // Esc -> Limpiar búsqueda o Salir de Modal
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        else {
          setSearchTerm('');
          setSelectedCategory('Todos');
        }
      }

      // F2 -> Cobrar (Si hay productos)
      if (e.key === 'F2' && cart.length > 0 && !showModal) {
        e.preventDefault();
        setShowModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, cart]);
  
  useEffect(() => {
     dbService.query('SELECT * FROM products').then(res => {
        if (res.success) {
           const sorted = (res.data || []).sort((a, b) => 
              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
           );
           setProducts(sorted);
        }
     });
  }, [refreshKey]);

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const [lastSale, setLastSale] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalUSD = cart.reduce((acc, item) => acc + (parseFloat(item.price) * item.qty), 0);
  const totalBS = totalUSD * parseFloat(exchangeRate);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    const rUSD = parseFloat(amountUSD) || 0;
    const rBS = parseFloat(amountBS) || 0;
    const totalRecUSD = rUSD + (rBS / parseFloat(exchangeRate));
    const cUSD = totalRecUSD - totalUSD;
    const cBS = cUSD * parseFloat(exchangeRate);

    if (cUSD < -0.01) {
       alert("Monto insuficiente");
       return;
    }

    setIsProcessing(true);
    
    const saleData = {
       id: Date.now(),
       date: new Date().toISOString(),
       items: [...cart],
       totalValueUSD: totalUSD,
       totalValueBS: totalBS,
       paidUSD: rUSD,
       paidBS: rBS,
       changeUSD: cUSD > 0 ? cUSD : 0,
       changeBS: cBS > 0 ? cBS : 0,
       clientName: clientName || 'Cliente Anónimo',
       clientId: clientId || 'N/A',
       processedBy: userRole || 'Desconocido'
    };
    
    try {
      const res = await dbService.processSale(saleData);
      if (res.success) {
         setLastSale(saleData);
         
         // 📡 Notificación instantánea si NO es el gerente
         if (userRole !== 'admin') {
            const { notificationService } = await import('../services/notification.service');
            notificationService.sendSaleAlert(saleData).catch(console.error);
         }

         if (dbService.isElectron() && window.api.saveReceiptPDF) {
            window.api.saveReceiptPDF(saleData).catch(e => console.error("PDF Fail:", e));
         }
         alert('¡Venta Cobrada con Éxito!');
         setCart([]);
         setShowModal(false);
         setAmountUSD('');
         setAmountBS('');
         setClientName('');
         setClientId('');
         setLastSale(null);
         
         const r = await dbService.query('SELECT * FROM products');
         if (r.success) setProducts(r.data);
      } else {
         alert('Error: ' + res.error);
      }
    } catch (err) {
      alert("Error crítico: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeAccents = (str) => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredProducts = products.filter(p => {
     const n = p.name ? removeAccents(p.name) : '';
     const s = p.sku ? removeAccents(p.sku) : '';
     const t = removeAccents(searchTerm || '');
     const categoryMatch = selectedCategory === 'Todos' || p.category === selectedCategory;
     return (categoryMatch) && (n.includes(t) || s.includes(t));
  });


  const handleSearchKeyDown = (e) => {
     if (e.key === 'Enter') {
        const term = String(searchTerm || '').toLowerCase();
        const exactMatch = products.find(p => p.sku && String(p.sku).toLowerCase() === term);
        if (exactMatch) {
           addToCart(exactMatch);
           setSearchTerm('');
        } else if (filteredProducts.length === 1) {
           addToCart(filteredProducts[0]);
           setSearchTerm('');
        }
     }
  };

  const currentUSD = parseFloat(amountUSD) || 0;
  const currentBS = parseFloat(amountBS) || 0;
  const currentTotalRecUSD = currentUSD + (currentBS / parseFloat(exchangeRate));
  const currentChangeUSD = currentTotalRecUSD - totalUSD;
  const currentChangeBS = currentChangeUSD * parseFloat(exchangeRate);

  return (
    <>
    <div className="no-print" style={{ display: 'flex', gap: '15px', height: '100%', position: 'relative' }}>
      
      {/* Checkout Modal Overlay */}
      {showModal && (
        <div className="modal-overlay">
            <div className="glass-panel modal-content checkout-modal" style={{ border: '1px solid var(--accent-color)', boxShadow: '0 0 50px rgba(0,210,255,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{margin: 0, fontSize: '1.8rem', letterSpacing: '1px'}}>💰 COBRAR VENTA</h2>
                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', opacity: 0.7 }}>MODO MULTIMONEDA</span>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(0,210,255,0.1) 0%, rgba(0,0,0,0.3) 100%)', padding: '25px', borderRadius: '15px', border: '1px solid rgba(0,210,255,0.2)', marginBottom: '20px', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 5px 0', opacity: 0.7, textTransform: 'uppercase', fontSize: '0.9rem' }}>Total Neto a Pagar</h3>
                    <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--accent-color)', textShadow: '0 0 20px rgba(0,210,255,0.3)' }}>${totalUSD.toFixed(2)}</div>
                    <div style={{ margin: '5px 0 0 0', color: 'white', opacity: 0.6, fontSize: '1.2rem' }}>≈ Bs. {totalBS.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                   <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px', display: 'block' }}>CLIENTE (OPCIONAL)</label>
                       <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} placeholder="Nombre" />
                   </div>
                   <div style={{ flex: 1 }}>
                       <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px', display: 'block' }}>ID / C.I</label>
                       <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }} placeholder="V-00.000.000" />
                   </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                    <div className="payment-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                            <span>💵</span> ABONO DÓLARES
                        </label>
                        <input 
                           type="number" 
                           autoFocus 
                           value={amountUSD} 
                           onChange={e => setAmountUSD(e.target.value)} 
                           onKeyDown={(e) => { if(e.key === 'Enter' && currentChangeUSD >= -0.01 && !isProcessing) handleCheckout(); }}
                           style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid rgba(0,210,255,0.3)', background: 'rgba(0,210,255,0.05)', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', outline: 'none' }} 
                           placeholder="0.00" 
                        />
                    </div>
                    <div className="payment-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label style={{ color: '#facc15', fontWeight: 'bold', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                            <span>🇻🇪</span> ABONO BOLÍVARES
                        </label>
                        <input 
                           type="number" 
                           value={amountBS} 
                           onChange={e => setAmountBS(e.target.value)} 
                           onKeyDown={(e) => { if(e.key === 'Enter' && currentChangeUSD >= -0.01 && !isProcessing) handleCheckout(); }}
                           style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid rgba(250, 204, 21, 0.3)', background: 'rgba(250, 204, 21, 0.05)', color: 'white', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', outline: 'none' }} 
                           placeholder="0.00" 
                        />
                    </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '15px', border: currentChangeUSD >= -0.01 ? '1px solid var(--success)' : '1px solid var(--danger)', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                       <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>VUELTO (CAMBIO):</span>
                       {currentChangeUSD < -0.01 ? (
                          <div style={{ color: 'var(--danger)', fontWeight: 'bold' }}>PENDIENTE: ${Math.abs(currentChangeUSD).toFixed(2)}</div>
                       ) : (
                          <div style={{ color: 'var(--success)', fontWeight: '900', fontSize: '1.5rem', textShadow: '0 0 10px rgba(16,185,129,0.3)' }}>${Math.max(0, currentChangeUSD).toFixed(2)} USD</div>
                       )}
                   </div>
                   {currentChangeUSD >= 0 && (
                      <div style={{ textAlign: 'right', opacity: 0.7 }}>
                          <small>En Bolívares:</small>
                          <div style={{ fontWeight: 'bold' }}>Bs. {Math.max(0, currentChangeBS).toLocaleString()}</div>
                      </div>
                   )}
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                   <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }} onMouseOver={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e => e.target.style.background='rgba(255,255,255,0.05)'}>CANCELAR</button>
                   <button 
                     onClick={handleCheckout} 
                     disabled={((currentUSD > 0 || currentBS > 0) && currentChangeUSD < -0.01) || isProcessing || cart.length === 0} 
                     style={{ 
                       flex: 2, padding: '18px', 
                       background: (currentChangeUSD >= -0.01 && !isProcessing && cart.length > 0) ? 'var(--success)' : '#334155', 
                       color: 'white', border: 'none', borderRadius: '12px', 
                       cursor: (currentChangeUSD < -0.01 || isProcessing) ? 'not-allowed' : 'pointer', 
                       fontWeight: '900', fontSize: '1.2rem', letterSpacing: '1px',
                       boxShadow: (currentChangeUSD >= -0.01 && !isProcessing) ? 'var(--success-glow)' : 'none',
                       transition: 'all 0.3s transform'
                     }}
                     onMouseEnter={e => { if(currentChangeUSD >= 0) e.target.style.transform='scale(1.02)'; }}
                     onMouseLeave={e => { e.target.style.transform='scale(1)'; }}
                   >
                     {isProcessing ? '⏳ PROCESANDO...' : '✅ COMPLETAR VENTA'}
                   </button>
                </div>
            </div>
        </div>
      )}

      {/* Product List Panel */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="🔍 Buscar producto o SKU... (Ctrl + B)"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{ 
              width: '100%', 
              padding: '18px 25px', 
              borderRadius: '16px', 
              border: '1px solid rgba(255,255,255,0.1)', 
              background: 'rgba(255,255,255,0.05)', 
              color: 'white', 
              outline: 'none',
              fontSize: '1.1rem',
              boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.1)',
              transition: 'all 0.3s'
            }}
          />
          
          <div className="category-bar">
             {categories.map(cat => (
               <button
                 key={cat}
                 onClick={() => setSelectedCategory(cat)}
                 className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
               >
                 {cat}
               </button>
             ))}
          </div>
        </div>

        <div className="product-grid" style={{ overflowY: 'auto' }}>
          {filteredProducts.map(product => (
            <div 
               key={product.id} 
               className={`product-card glass-panel ${product.quantity <= 2 && !product.isService ? 'low-stock' : ''}`} 
               onClick={() => addToCart(product)}
               style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px', 
                  minHeight: '220px',
                  justifyContent: 'space-between',
                  border: product.quantity <= 2 && !product.isService ? '1px solid rgba(244,63,94,0.4)' : '1px solid var(--glass-border)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 100%)'
               }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, fontWeight: 'bold' }}>{product.sku || 'N/A'}</p>
                 {!product.isService ? (
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: product.quantity <= 2 ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.05)', color: product.quantity <= 2 ? 'var(--danger)' : 'white', fontWeight: 'bold' }}>
                       Stock: {product.quantity}
                    </span>
                 ) : (
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(0,210,255,0.1)', color: 'var(--accent-color)', fontWeight: 'bold' }}>SERVICIO</span>
                 )}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '8px', margin: '5px 0' }}>
                 <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '900', color: 'var(--accent-color)', textShadow: '0 0 10px rgba(0,210,255,0.3)' }}>
                    {product.name || 'SIN NOMBRE'}
                 </h3>
              </div>
              <div style={{ marginTop: 'auto' }}>
                 <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-color)' }}>${parseFloat(product.price).toFixed(2)}</div>
                 <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Bs. {(parseFloat(product.price) * parseFloat(exchangeRate)).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Panel */}
      <aside className="cart-panel glass-panel" style={{ width: '420px', display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <h2 style={{ margin: 0 }}>🛒 Carrito</h2>
           <button onClick={() => setCart([])} style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--danger)', border: 'none', padding: '5px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>BORRAR TODO</button>
        </div>
        
        <div className="cart-items" style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.3 }}>
               <span style={{ fontSize: '4rem' }}>🛒</span>
               <p>Nada por aquí...</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '15px', padding: '15px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', flex: 1 }}>{item.name}</h4>
                  <strong style={{ color: 'var(--accent-color)', marginLeft: '10px' }}>${(parseFloat(item.price) * item.qty).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>${parseFloat(item.price).toFixed(2)} x {item.qty}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => updateQty(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer' }}>-</button>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer' }}>+</button>
                    <button onClick={() => removeFromCart(item.id)} style={{ marginLeft: '5px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>✕</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ opacity: 0.6 }}>RESUMEN TOTAL:</span>
            <span style={{ fontWeight: '900', fontSize: '1.8rem', color: 'var(--accent-color)' }}>${totalUSD.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '1rem', color: 'white', opacity: 0.5 }}>
            Bs. {totalBS.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </div>
          <button 
             disabled={cart.length === 0}
             onClick={() => setShowModal(true)}
             style={{ width: '100%', marginTop: '20px', padding: '20px', borderRadius: '15px', border: 'none', background: cart.length === 0 ? '#334155' : 'var(--accent-color)', color: '#000', fontWeight: '900', fontSize: '1.3rem', cursor: cart.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.3s', boxShadow: cart.length > 0 ? 'var(--accent-glow)' : 'none' }}
          >
            PAGAR AHORA (F2)
          </button>
        </div>
      </aside>
    </div>
    
    <style>{`
       .product-card {
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
       }
       .product-card:hover {
          transform: translateY(-8px) scale(1.02);
          background: rgba(255,255,255,0.08) !important;
          border-color: var(--accent-color) !important;
          box-shadow: var(--accent-glow);
       }
       .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(12px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          animation: modalFadeIn 0.3s ease;
       }
       @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
       }
       .modal-content {
          width: 580px;
          max-width: 95vw;
          padding: 35px !important;
          animation: modalSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
       }
       @keyframes modalSlideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
       }
       .search-input:focus {
          border-color: var(--accent-color) !important;
          box-shadow: var(--accent-glow);
       }
       .payment-card input:focus {
          border-color: inherit !important;
          box-shadow: 0 0 15px rgba(255,255,255,0.1);
       }
    `}</style>
    </>
  );
}

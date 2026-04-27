import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/api.service';

export default function POS({ refreshKey, exchangeRate, userRole, businessSettings }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  const [showModal, setShowModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' or 'credit'
  const [amountUSD, setAmountUSD] = useState('');
  const [amountBS, setAmountBS] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const searchInputRef = useRef(null);

  // Categorías Únicas
  const categories = ['Todos', ...new Set(products.map(p => p.category || 'Otros'))];
  
  // Atajos de Teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        else {
          setSearchTerm('');
          setSelectedCategory('Todos');
        }
      }
      if (e.key === 'F2' && cart.length > 0 && !showModal) {
        e.preventDefault();
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, cart]);
  
  useEffect(() => {
     loadInitialData();
  }, [refreshKey]);

  const loadInitialData = async () => {
    const [pRes, cRes] = await Promise.all([
      dbService.query('SELECT * FROM products'),
      dbService.query('SELECT * FROM customers')
    ]);
    if (pRes.success) {
      setProducts(pRes.data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }
    if (cRes.success) {
      setCustomers(cRes.data);
    }
  };

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

  const [isProcessing, setIsProcessing] = useState(false);

  const totalUSD = cart.reduce((acc, item) => acc + (parseFloat(item.price) * item.qty), 0);
  const totalBS = totalUSD * parseFloat(exchangeRate);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
    if (paymentMode === 'credit' && !selectedCustomer && !clientName) {
      alert("Para ventas a crédito debe indicar un cliente.");
      return;
    }

    const rUSD = parseFloat(amountUSD) || 0;
    const rBS = parseFloat(amountBS) || 0;
    const totalRecUSD = rUSD + (rBS / parseFloat(exchangeRate));
    const cUSD = totalRecUSD - totalUSD;
    const cBS = cUSD * parseFloat(exchangeRate);

    if (paymentMode === 'cash' && cUSD < -0.01) {
       alert("Monto insuficiente para pago en efectivo.");
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
       changeUSD: (paymentMode === 'cash' && cUSD > 0) ? cUSD : 0,
       changeBS: (paymentMode === 'cash' && cBS > 0) ? cBS : 0,
       status: paymentMode === 'credit' ? 'pending' : 'paid',
       clientName: selectedCustomer ? selectedCustomer.name : (clientName || 'Cliente Anónimo'),
       clientId: selectedCustomer ? selectedCustomer.id : (clientId || 'N/A'),
       processedBy: userRole || 'Desconocido'
    };
    
    try {
      const res = await dbService.processSale(saleData);
      if (res.success) {
         if (userRole !== 'admin') {
            const { notificationService } = await import('../services/notification.service');
            notificationService.sendSaleAlert(saleData).catch(console.error);
         }
         alert(paymentMode === 'credit' ? 'Venta a Crédito Registrada' : 'Venta Cobrada con Éxito');
         setCart([]);
         setShowModal(false);
         setAmountUSD('');
         setAmountBS('');
         setClientName('');
         setClientId('');
         setSelectedCustomer(null);
         setPaymentMode('cash');
         loadInitialData();
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

  const currentUSD = parseFloat(amountUSD) || 0;
  const currentBS = parseFloat(amountBS) || 0;
  const currentTotalRecUSD = currentUSD + (currentBS / parseFloat(exchangeRate));
  const currentChangeUSD = currentTotalRecUSD - totalUSD;

  return (
    <>
    <div className="no-print" style={{ display: 'flex', gap: '15px', height: '100%', position: 'relative' }}>
      
      {showModal && (
        <div className="modal-overlay">
            <div className="glass-panel modal-content checkout-modal" style={{ border: '1px solid var(--accent-color)', width: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{margin: 0, fontSize: '1.5rem'}}>💰 FINALIZAR VENTA</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <button 
                         onClick={() => setPaymentMode('cash')}
                         style={{ padding: '8px 15px', borderRadius: '10px', border: 'none', background: paymentMode === 'cash' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: paymentMode === 'cash' ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                       >EFECTIVO</button>
                       <button 
                         onClick={() => setPaymentMode('credit')}
                         style={{ padding: '8px 15px', borderRadius: '10px', border: 'none', background: paymentMode === 'credit' ? '#f43f5e' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                       >FIADO / CRÉDITO</button>
                    </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '15px', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-color)' }}>${totalUSD.toFixed(2)}</div>
                    <div style={{ opacity: 0.6 }}>Bs. {totalBS.toLocaleString()}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                   <div>
                       <label style={{ fontSize: '0.7rem', opacity: 0.6, display: 'block', marginBottom: '5px' }}>CLIENTE</label>
                       <select 
                         value={selectedCustomer?.id || ''} 
                         onChange={e => {
                           const c = customers.find(cus => String(cus.id) === e.target.value);
                           setSelectedCustomer(c || null);
                         }}
                         style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                       >
                         <option value="">-- Seleccionar Cliente --</option>
                         {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                   </div>
                   <div>
                       <label style={{ fontSize: '0.7rem', opacity: 0.6, display: 'block', marginBottom: '5px' }}>O ESCRIBIR NOMBRE</label>
                       <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} placeholder="Nombre" />
                   </div>
                </div>

                {paymentMode === 'cash' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--accent-color)' }}>💵 RECIBIDO $</label>
                          <input type="number" value={amountUSD} onChange={e => setAmountUSD(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '10px', background: 'rgba(0,210,255,0.05)', color: '#fff', border: '1px solid var(--accent-color)', fontSize: '1.2rem', textAlign: 'center' }} />
                      </div>
                      <div>
                          <label style={{ fontSize: '0.7rem', color: '#facc15' }}>🇻🇪 RECIBIDO BS</label>
                          <input type="number" value={amountBS} onChange={e => setAmountBS(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '10px', background: 'rgba(250,204,21,0.05)', color: '#fff', border: '1px solid #facc15', fontSize: '1.2rem', textAlign: 'center' }} />
                      </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: 'rgba(244,63,94,0.1)', borderRadius: '15px', marginBottom: '20px', border: '1px solid rgba(244,63,94,0.3)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#f43f5e' }}>LA VENTA SE REGISTRARÁ COMO DEUDA PENDIENTE</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '15px' }}>
                   <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '15px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>CANCELAR</button>
                   <button 
                     onClick={handleCheckout} 
                     disabled={isProcessing || (paymentMode === 'cash' && currentChangeUSD < -0.01)}
                     style={{ flex: 2, padding: '15px', borderRadius: '10px', border: 'none', background: paymentMode === 'cash' ? 'var(--success)' : '#f43f5e', color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
                   >
                     {isProcessing ? 'PROCESANDO...' : 'CONFIRMAR'}
                   </button>
                </div>
            </div>
        </div>
      )}

      {/* Main POS Interface */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
        <input ref={searchInputRef} type="text" placeholder="🔍 Buscar producto... (Ctrl + B)" className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '15px' }} />
        <div className="category-bar" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}>{cat}</button>
          ))}
        </div>
        <div className="product-grid" style={{ overflowY: 'auto', flex: 1 }}>
          {filteredProducts.map(p => (
            <div key={p.id} className="product-card glass-panel" onClick={() => addToCart(p)} style={{ padding: '15px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <small style={{ opacity: 0.5 }}>{p.sku}</small>
                <h3 style={{ margin: '5px 0', fontSize: '1rem', color: 'var(--accent-color)' }}>{p.name}</h3>
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>${p.price.toFixed(2)}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{p.quantity} disponibles</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="cart-panel glass-panel" style={{ width: '380px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2>🛒 Carrito</h2>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.map(item => (
            <div key={item.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                <strong>${(item.price * item.qty).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                <small>${item.price} x {item.qty}</small>
                <div>
                  <button onClick={() => updateQty(item.id, -1)}>-</button>
                  <span style={{ margin: '0 10px' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-color)' }}>
            <span>TOTAL:</span> <span>${totalUSD.toFixed(2)}</span>
          </div>
          <button onClick={() => setShowModal(true)} disabled={cart.length === 0} style={{ width: '100%', marginTop: '15px', padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>PAGAR (F2)</button>
        </div>
      </aside>
    </div>
    <style>{`
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 2000; }
      .product-card { cursor: pointer; transition: 0.2s; }
      .product-card:hover { transform: translateY(-5px); border-color: var(--accent-color); }
      .category-chip { padding: 8px 15px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: none; color: #fff; cursor: pointer; white-space: nowrap; }
      .category-chip.active { background: var(--accent-color); color: #000; border-color: var(--accent-color); }
    `}</style>
    </>
  );
}

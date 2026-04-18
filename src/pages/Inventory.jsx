import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';

const CATEGORIES = ["Vidrios", "Cargadores", "Cables", "Forros", "Audio", "Otros"];

export default function Inventory({ exchangeRate, refreshKey }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Show/Hide costs
  const [showCosts, setShowCosts] = useState(true);

  // Search & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Form state
  const [form, setForm] = useState({ name: '', sku: '', cost: 0, price: 0, quantity: 0, category: 'Otros' });

  const loadProducts = () => {
    if (products.length === 0) setLoading(true);
    dbService.query('SELECT * FROM products').then(res => {
       if (res.success) setProducts(res.data);
       setLoading(false);
    });
  };

  useEffect(() => {
    loadProducts();
  }, [refreshKey]);

  const handleEdit = (p) => {
    setEditing(p.id);
    setForm({ 
      name: p.name, 
      sku: p.sku, 
      cost: p.cost || 0, 
      price: p.price || 0, 
      quantity: p.quantity,
      category: p.category || 'Otros'
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', sku: '', cost: 0, price: 0, quantity: 0, category: 'Otros' });
  };

  const handleCostChange = (e) => {
    const newCost = parseFloat(e.target.value) || 0;
    const suggestedPrice = (newCost / 0.4).toFixed(2);
    setForm({...form, cost: newCost, price: suggestedPrice });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { 
        ...form, 
        cost: parseFloat(form.cost), 
        price: parseFloat(form.price), 
        quantity: parseInt(form.quantity, 10),
        category: form.category || 'Otros'
    };
    if (editing) payload.id = editing;
    
    const res = await dbService.saveProduct(payload);
    if (res.success) {
       cancelEdit();
       loadProducts();
    } else {
       alert('Error: ' + res.error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este producto de la base de datos?")) {
       await dbService.deleteProduct(id);
       loadProducts();
    }
  };

  const handleInlinePriceChange = async (id, newPriceVal) => {
     const val = parseFloat(newPriceVal);
     if (isNaN(val)) return;
     const p = products.find(prod => prod.id === id);
     if (p && p.price !== val) {
        await dbService.saveProduct({ ...p, price: val });
        loadProducts();
     }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredProducts = [...products]
    .filter(p => {
      const term = searchTerm.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const skuMatch = (p.sku || '').toLowerCase().includes(term);
      return nameMatch || skuMatch;
    })
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA = a[key] || 0;
      let valB = b[key] || 0;

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const rate = parseFloat(exchangeRate) || 1;

  if (loading && products.length === 0) return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
         <h2 style={{ color: 'var(--accent-color)', animation: 'pulse-yellow 1s infinite' }}>🛰️ Sincronizando Inventario...</h2>
      </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex-responsive" style={{ display: 'flex', gap: '20px' }}>
         <div className="glass-panel" style={{ flexGrow: 1, minWidth: 0 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
             <div>
                <h2 style={{ margin: '0 0 5px 0' }}>Inventario Total</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', opacity: 0.8, fontSize: '0.9rem' }}>
                   <input type="checkbox" checked={showCosts} onChange={e => setShowCosts(e.target.checked)} />
                   Mostrar Costos y Márgenes Internos
                </label>
             </div>
             <div style={{ position: 'relative', width: '300px' }}>
                <input 
                  type="text"
                  placeholder="🔍 Buscar por nombre o SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ 
                    width: '100%', padding: '10px 15px', paddingLeft: '40px', 
                    borderRadius: '10px', border: '1px solid var(--glass-border)', 
                    background: 'rgba(255,255,255,0.05)', color: 'white', outline: 'none' 
                  }}
                />
             </div>
           </div>

           <div className="table-responsive">
             <table className="glass-table">
               <thead>
                 <tr>
                    <th onClick={() => handleSort('sku')} style={{cursor: 'pointer'}}>SKU {sortConfig.key === 'sku' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>Nombre {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th onClick={() => handleSort('category')} style={{cursor: 'pointer'}}>Categoría {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th onClick={() => handleSort('cost')} style={{cursor: 'pointer'}}>{showCosts ? 'Costo (USD)' : 'Costo'} {sortConfig.key === 'cost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    {showCosts && <th>Margin</th>}
                    <th onClick={() => handleSort('price')} style={{cursor: 'pointer'}}>Precio (USD) {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th onClick={() => handleSort('quantity')} style={{cursor: 'pointer'}}>Cant. Inventario {sortConfig.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                    <th>Acciones</th>
                 </tr>
               </thead>
               <tbody>
                 {sortedAndFilteredProducts.map(p => {
                   const c = p.cost || 0;
                   const pr = p.price || 0;
                   const verifiedMargin = pr > 0 ? ((1 - (c / pr)) * 100).toFixed(0) : 0;
                   return (
                   <tr key={p.id}>
                     <td>{p.sku}</td>
                     <td>{p.name}</td>
                     <td>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                           {p.category || 'Otros'}
                        </span>
                     </td>
                     <td style={{ color: showCosts ? 'var(--accent-color)' : 'grey' }}>
                        {showCosts ? `$${c.toFixed(2)}` : '***'}
                     </td>
                     {showCosts && <td><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{verifiedMargin}%</span></td>}
                     <td>
                       <input 
                         key={pr} 
                         type="number" 
                         step="0.01" 
                         defaultValue={pr.toFixed(2)} 
                         onBlur={(e) => handleInlinePriceChange(p.id, e.target.value)} 
                         onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                         style={{ width: '80px', padding: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '4px', fontWeight: 'bold' }} 
                       />
                     </td>
                     <td>
                       <span style={{ 
                          padding: '4px 8px', 
                          background: p.quantity < 5 ? 'var(--danger)' : 'var(--glass-bg)', 
                          borderRadius: '5px' 
                       }}>
                         {p.quantity}
                       </span>
                     </td>
                     <td>
                        <button onClick={() => handleEdit(p)} style={{ background: 'transparent', color: 'var(--accent-color)', border: 'none', cursor: 'pointer', marginRight: '10px' }}>Edit</button>
                        <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}>Del</button>
                     </td>
                   </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
         </div>

          <div className="glass-panel" style={{ 
            width: '300px', 
            height: 'fit-content', 
            minWidth: '300px',
            position: 'sticky',
            top: '20px',
            zIndex: 10 
          }}>
             <h3>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h3>
             <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                <div>
                   <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Nombre</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Categoría</label>
                  <select 
                    value={form.category} 
                    onChange={e => setForm({...form, category: e.target.value})}
                    style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                  >
                     {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input 
                     placeholder="O escribe una nueva..."
                     value={CATEGORIES.includes(form.category) ? '' : form.category}
                     onChange={e => setForm({...form, category: e.target.value})}
                     style={{ width: '100%', marginTop: '5px', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.8rem' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Código (SKU)</label>
                  <input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
               </div>
               {showCosts && (
               <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Costo (USD)</label>
                  <input type="number" step="0.01" required value={form.cost} onChange={handleCostChange} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
               </div>
               )}
               <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Precio a Mostrar (USD)</label>
                  <input type="number" step="0.01" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px' }}>Unidades (Stock)</label>
                  <input type="number" required value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white' }} />
               </div>
               <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" style={{ flex: 1, padding: '10px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Guardar</button>
                  {editing && <button type="button" onClick={cancelEdit} style={{ flex: 1, padding: '10px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>}
               </div>
             </form>
          </div>
      </div>
    </div>
  );
}

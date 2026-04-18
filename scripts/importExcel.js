const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup JSON database path
const OS_APPDATA = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const userDataPath = path.join(OS_APPDATA, 'Techzone ERP', 'database.json');
const dbPath = fs.existsSync(userDataPath) ? userDataPath : path.resolve(__dirname, '../db/database.json');
const excelPath = path.resolve(__dirname, '../inventory.xlsx'); 

// Supabase Credentials (from src/supabase.js)
const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

async function runImport() {
  console.log('--- 🚀 Iniciando Importación Universal y Sincronización ---');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Error: No se pudo encontrar el archivo Excel en ${excelPath}`);
    process.exit(1);
  }

  try {
    console.log(`Reading Excel: ${excelPath}`);
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const productsRows = xlsx.utils.sheet_to_json(sheet);
    
    let productsArray = [];
    let importedCount = 0;
    
    for (const prod of productsRows) {
      const keys = Object.keys(prod);
      const getVal = (possibleKeys) => {
        for (let baseKey of possibleKeys) {
          const match = keys.find(k => k.trim().toLowerCase() === baseKey.trim().toLowerCase());
          if (match) return prod[match];
        }
        return null;
      };

      const rawName = getVal(['Nombre', 'Name', 'Producto']);
      const rawSku = getVal(['ID', 'SKU', 'Codigo']);
      const rawPrice = getVal(['Precio', 'Price', 'Precio USD', 'Costo USDT', 'Costo']);
      const rawCost = getVal(['Costo USDT', 'Costo', 'Cost']);
      const rawStock = getVal(['Stock', 'Quantity', 'Cantidad']);

      if (!rawName) continue;
      
      const name = String(rawName).trim();
      const sku = rawSku ? String(rawSku).trim() : `SKU-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      
      let price = 0;
      if (rawPrice !== null && rawPrice !== undefined) {
        price = parseFloat(String(rawPrice).replace(',', '.').replace(/[^0-9.-]+/g,""));
      }

      let cost = 0;
      if (rawCost !== null && rawCost !== undefined) {
        cost = parseFloat(String(rawCost).replace(',', '.').replace(/[^0-9.-]+/g,""));
        if (!price && cost > 0) price = cost / (1 - 0.6);
      }

      let quantity = 0;
      if (rawStock !== null && rawStock !== undefined) {
        quantity = parseInt(String(rawStock).replace(/[^0-9-]+/g,""), 10);
      }
      
      productsArray.push({
        id: importedCount + 1,
        name,
        sku,
        price: isNaN(price) ? 0 : price,
        cost: isNaN(cost) ? 0 : cost,
        quantity: isNaN(quantity) ? 0 : quantity
      });
      importedCount++;
    }

    // --- DB MERGE LOGIC ---
    let dbData = {
      settings: { 
        exchange_rate_bs: 477.6,
        business_name: 'TECHZONE',
        business_rif: 'J-507426785',
        business_tel: '04245655763'
      },
      products: [],
      sales: [],
      daily_closures: [],
      cash_transactions: [],
      users: [{ id: 1, role: 'admin', password: '' }]
    };

    if (fs.existsSync(dbPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        dbData = { ...dbData, ...existing };
      } catch (e) {}
    }

    dbData.products = productsArray;
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf-8');
    console.log(`✅ local: ${importedCount} productos guardados.`);

    // --- CLOUD SYNC LOGIC ---
    console.log('☁️ Sincronizando con Supabase...');

    // 1. Sync Products
    const cloudProducts = productsArray.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: p.price,
      cost: p.cost,
      quantity: p.quantity
    }));
    const { error: pErr } = await supabase.from('products').upsert(cloudProducts);
    if (pErr) console.error('❌ Error cloud products:', pErr.message);
    else console.log('✅ Cloud: Inventario actualizado.');

    // 2. Sync Settings
    const settingsToSync = Object.entries(dbData.settings).map(([k, v]) => ({ key: k, value: v }));
    const { error: sErr } = await supabase.from('settings').upsert(settingsToSync, { onConflict: 'key' });
    if (sErr) console.error('❌ Error cloud settings:', sErr.message);
    else console.log('✅ Cloud: Configuraciones actualizadas.');

    const adminId = '00000000-0000-0000-0000-000000000001'; // Valid UUID for admin
    const cloudUsers = dbData.users.map(u => ({ id: adminId, role: u.role, pin: u.password }));
    const { error: uErr } = await supabase.from('users').upsert(cloudUsers);
    if (uErr) console.error('❌ Error cloud users:', uErr.message);
    else console.log('✅ Cloud: Perfiles actualizados.');

    console.log('\n✨ ¡PROCESO COMPLETADO CON ÉXITO! ✨');
    console.log('Ahora puedes revisar tu teléfono para ver los cambios.');

  } catch (error) {
    console.error('❌ Critical Error:', error.message);
  }
}

runImport();

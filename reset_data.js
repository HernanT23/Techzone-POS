
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const xlsx = require('xlsx');

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

async function masterReset() {
    console.log('--- STARTING MASTER RESET ---');

    // 1. DELETE FROM SUPABASE
    console.log('🗑 Cleaning Supabase tables...');
    
    // We use a trick to delete all: where id is not null
    const tables = ['sales', 'daily_closures', 'cash_transactions', 'products'];
    for (const table of tables) {
        // Try deleting everything using a numeric filter first, then string filter if it fails
        let { error } = await supabase.from(table).delete().neq('id', -1); 
        
        if (error && error.code === '22P02') { // Type mismatch
           const { error: error2 } = await supabase.from(table).delete().neq('id', '_RESET_FORCE_');
           error = error2;
        }

        if (error) {
            console.error(`❌ Error cleaning ${table}:`, error.message);
        } else {
            console.log(`✅ Table ${table} cleaned.`);
        }
    }

    // 2. READ EXCEL
    console.log('📖 Reading inventory.xlsx...');
    const wb = xlsx.readFile('inventory.xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawProducts = xlsx.utils.sheet_to_json(sheet);

    // 3. MAP DATA & CATEGORIZE
    console.log('🏷 Mapping products and applying categories...');
    const products = rawProducts.map(p => {
        const name = p.Nombre || 'Producto Sin Nombre';
        
        let category = 'Otros';
        const n = name.toLowerCase();
        if (n.includes('vidrio') || n.includes('ceramica')) category = 'Vidrios';
        else if (n.includes('cargador') || n.includes('taco')) category = 'Cargadores';
        else if (n.includes('cable')) category = 'Cables';
        else if (n.includes('forro')) category = 'Forros';
        else if (n.includes('audifono') || n.includes('corneta') || n.includes('audio')) category = 'Audio';

        return {
            id: p.ID,
            sku: String(p.ID),
            name: name,
            price: p["Costo USDT"] || 0,
            cost: p["Costo USDT"] || 0,
            quantity: p.Stock || 0,
            category: category,
            isService: false
        };
    });

    // 4. UPDATE LOCAL DATABASE
    console.log('💾 Updating database.json...');
    const path = require('path');
    const osAppData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const userDataPath = path.join(osAppData, 'Techzone ERP', 'database.json');
    const dbPath = fs.existsSync(userDataPath) ? userDataPath : 'db/database.json';
    
    console.log(`💾 Updating database from: ${dbPath}`);
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    db.products = products;
    db.sales = [];
    db.customers = [];
    db.cash_transactions = [];
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('✅ database.json updated.');

    // 5. PUSH NEW INVENTORY TO SUPABASE
    console.log('☁️ Pushing fresh inventory to Supabase...');
    const supabaseProducts = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        cost: p.cost,
        quantity: p.quantity,
        category: p.category,
        is_service: p.isService
    }));

    const { error: pushError } = await supabase.from('products').upsert(supabaseProducts);
    if (pushError) {
        console.error('❌ Error pushing to Supabase:', pushError.message);
    } else {
        console.log('✅ Cloud inventory updated.');
    }

    console.log('--- MASTER RESET COMPLETE ---');
}

masterReset();


const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

async function pushToSupabase() {
    const path = require('path');
    const osAppData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const userDataPath = path.join(osAppData, 'Techzone ERP', 'database.json');
    const dbPath = fs.existsSync(userDataPath) ? userDataPath : 'db/database.json';
    
    console.log(`📖 Reading database from: ${dbPath}`);
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const products = db.products.map(p => ({
        id: p.id,
        sku: p.sku || '',
        name: p.name || '',
        price: p.price || 0,
        cost: p.cost || 0,
        quantity: p.quantity || 0,
        category: p.category || 'Otros',
        is_service: p.isService || false
    }));

    console.log(`Pushing ${products.length} products to Supabase...`);
    const { error } = await supabase.from('products').upsert(products);
    
    if (error) {
        console.error('Error pushing data:', error.message);
        if (error.message.includes('column "category" of relation "products" does not exist')) {
            console.log('⚠️ Need to add "category" column to Supabase table.');
        }
    } else {
        console.log('✅ Cloud data updated successfully!');
    }
}

pushToSupabase();

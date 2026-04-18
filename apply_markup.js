
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

async function applyMarkup() {
    console.log('📈 Applying 60% margin (Retail Formula) to all products...');
    
    const path = require('path');
    const osAppData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const userDataPath = path.join(osAppData, 'Techzone ERP', 'database.json');
    const dbPath = fs.existsSync(userDataPath) ? userDataPath : 'db/database.json';
    
    console.log(`📖 Reading database from: ${dbPath}`);
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    const updatedProducts = db.products.map(p => {
        const cost = p.cost || 0;
        // Formula de Margen del 60%: Precio = Costo / (1 - 0.6) = Costo / 0.4
        // Esto garantiza que el 60% del precio final sea ganancia.
        const newPrice = cost / 0.4;
        return { ...p, price: parseFloat(newPrice.toFixed(2)) };
    });

    db.products = updatedProducts;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('✅ Local database updated.');

    const supabaseProducts = updatedProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        cost: p.cost,
        quantity: p.quantity,
        category: p.category,
        is_service: p.isService
    }));

    console.log('☁️ Pushing updated prices to Supabase...');
    const { error } = await supabase.from('products').upsert(supabaseProducts);
    
    if (error) {
        console.error('❌ Error updating Supabase:', error.message);
    } else {
        console.log('✅ Cloud synced successfully!');
    }
}

applyMarkup();

const fs = require('fs');
const path = require('path');

async function updatePrices() {
    const osAppData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const userDataPath = path.join(osAppData, 'valery-pos', 'database.json');
    const oldUserDataPath = path.join(osAppData, 'Techzone ERP', 'database.json'); // Backup check
    
    let dbPath = 'db/database.json';
    if (fs.existsSync(userDataPath)) dbPath = userDataPath;
    else if (fs.existsSync(oldUserDataPath)) dbPath = oldUserDataPath;

    console.log(`📖 Leyendo base de datos desde: ${dbPath}`);
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    let modifiedCount = 0;
    const now = Date.now();

    db.products = db.products.map(p => {
        const name = (p.name || "").toLowerCase();
        const category = (p.category || "").toLowerCase();
        let newPrice = p.price;
        let changed = false;

        // Regla 1: Vidrios y Cerámicas -> $3
        if (category === 'vidrios' || name.includes('vidrio') || name.includes('ceramica')) {
            newPrice = 3.0;
            changed = true;
        }

        // Regla 2: Forros -> $5 (pero si dice 360 -> $6)
        if (category === 'forros' || name.includes('forro') || name.includes('360')) {
            if (name.includes('360')) {
                newPrice = 6.0;
            } else {
                newPrice = 5.0;
            }
            changed = true;
        }

        if (changed && p.price !== newPrice) {
            modifiedCount++;
            return { 
                ...p, 
                price: newPrice, 
                localUpdatedAt: now // Marcamos para protección de sync
            };
        }
        return p;
    });

    if (modifiedCount > 0) {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        console.log(`✅ ¡Éxito! Se actualizaron precios para ${modifiedCount} productos.`);
        console.log(`🛡️ Todos los cambios tienen el flag de protección local activo.`);
    } else {
        console.log("ℹ️ No se encontraron productos que cumplieran los criterios o ya tenían esos precios.");
    }
}

updatePrices().catch(console.error);

const fs = require('fs');
const pathLib = require('path');
const OS_APPDATA = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const userDataPath = pathLib.join(OS_APPDATA, 'Techzone ERP', 'database.json');
const activePath = fs.existsSync(userDataPath) ? userDataPath : 'db/database.json';

console.log(`📖 Migrating database at: ${activePath}`);
const db = JSON.parse(fs.readFileSync(activePath, 'utf8'));

db.products = db.products.map(p => {
    const name = (p.name || "").toLowerCase();
    let category = "Otros";
    
    if (name.includes("vidrio") || name.includes("ceramica") || name.includes("mica")) category = "Vidrios";
    else if (name.includes("cargador") || name.includes("power bank") || name.includes("enchufe")) category = "Cargadores";
    else if (name.includes("cable") || name.includes("usb") || name.includes("lightning")) category = "Cables";
    else if (name.includes("forro") || name.includes("estuche") || name.includes("funda")) category = "Forros";
    else if (name.includes("audifono") || name.includes("handsfree") || name.includes("corneta") || name.includes("speaker") || name.includes("bluetooth")) category = "Audio";
    
    return { ...p, category };
});

fs.writeFileSync(activePath, JSON.stringify(db, null, 2));
console.log("✅ Base de datos migrada con éxito.");

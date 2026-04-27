const fs = require('fs');
const xlsx = require('xlsx');

const dbPath = 'C:/Users/Hernan2d/AppData/Roaming/valery-pos/database.json';
const excelPath = 'C:/Users/Hernan2d/OneDrive/Escritorio/Trabajo/inventory.xlsx';

let dbData;
try {
  dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (e) {
  console.log("No DB found");
  process.exit(1);
}

const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

let imported = 0;

rows.forEach((row, index) => {
  const keys = Object.keys(row);
  const getVal = (possibleKeys) => {
    for (let baseKey of possibleKeys) {
      const match = keys.find(k => k.trim().toLowerCase() === baseKey.trim().toLowerCase());
      if (match) return row[match];
    }
    return null;
  };

  const name = getVal(['Nombre', 'Name', 'Producto']);
  if (!name) return;

  // Fix the ID issue exactly like I did in main.js
  const sku = getVal(['ID', 'SKU', 'Codigo']) || (Date.now() + index).toString();
  const rawPrice = getVal(['Precio', 'Price', 'Precio USD']);
  const rawCost = getVal(['Costo', 'Cost', 'Costo USDT']);
  const rawStock = getVal(['Stock', 'Quantity', 'Cantidad']);

  let cost = parseFloat(String(rawCost || 0).replace(',', '.').replace(/[^0-9.-]+/g,"")) || 0;
  let price = parseFloat(String(rawPrice || 0).replace(',', '.').replace(/[^0-9.-]+/g,"")) || (cost > 0 ? cost / 0.4 : 0);
  let stock = parseInt(String(rawStock || 0).replace(/[^0-9-]+/g,""), 10) || 0;

  const product = {
    id: sku,
    name: String(name).trim(),
    sku: String(sku).trim(),
    price: price,
    cost: cost,
    quantity: stock,
    category: getVal(['Categoria', 'Category']) || 'Otros',
    localUpdatedAt: new Date().toISOString()
  };

  const idx = dbData.products.findIndex(p => String(p.sku) === String(product.sku));
  if (idx !== -1) {
    dbData.products[idx] = { ...dbData.products[idx], ...product };
  } else {
    dbData.products.push(product);
  }
  imported++;
});

fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
console.log('Successfully imported', imported, 'products to the database.');

const fs = require('fs');
const xlsx = require('xlsx');

const excelPath = 'C:/Users/Hernan2d/OneDrive/Escritorio/Trabajo/inventory.xlsx';
const workbook = xlsx.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet);

let imported = 0;
let errors = [];

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

  const sku = getVal(['ID', 'SKU', 'Codigo']) || `EXCEL-${Date.now()}-${index}`;
  const rawPrice = getVal(['Precio', 'Price', 'Precio USD']);
  const rawCost = getVal(['Costo', 'Cost', 'Costo USDT']);
  const rawStock = getVal(['Stock', 'Quantity', 'Cantidad']);

  let cost = parseFloat(String(rawCost || 0).replace(',', '.').replace(/[^0-9.-]+/g,"")) || 0;
  let price = parseFloat(String(rawPrice || 0).replace(',', '.').replace(/[^0-9.-]+/g,"")) || (cost > 0 ? cost / 0.4 : 0);
  let stock = parseInt(String(rawStock || 0).replace(/[^0-9-]+/g,""), 10) || 0;

  const product = {
    id: sku, // Use SKU as unique ID for simpler merging
    name: String(name).trim(),
    sku: String(sku).trim(),
    price: price,
    cost: cost,
    quantity: stock,
    category: getVal(['Categoria', 'Category']) || 'Otros',
    localUpdatedAt: new Date().toISOString()
  };
  
  if (name.includes('tecno')) {
    console.log("Found tecno:", product);
  }

  imported++;
});

console.log("Total imported logic count:", imported);

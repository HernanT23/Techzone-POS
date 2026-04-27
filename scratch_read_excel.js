const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('C:/Users/Hernan2d/OneDrive/Escritorio/Trabajo/inventory.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);
  
  console.log("Total rows in excel:", rows.length);
  console.log("Last 5 rows:", rows.slice(-5));
} catch (e) {
  console.log("Error reading excel:", e.message);
}

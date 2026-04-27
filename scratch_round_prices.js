const fs = require('fs');

const dbPath = 'C:/Users/Hernan2d/AppData/Roaming/valery-pos/database.json';
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let updated = 0;

dbData.products.forEach(p => {
  const roundedPrice = Math.round(p.price * 2) / 2;
  if (p.price !== roundedPrice) {
    p.price = roundedPrice;
    p.localUpdatedAt = new Date().toISOString();
    updated++;
  }
});

fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
console.log(`Rounded prices for ${updated} products.`);

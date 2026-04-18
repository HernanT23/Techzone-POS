const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.resolve(__dirname, '../db/database.json');
const backupPath = path.resolve(__dirname, '../db/database_test_backup.json');

console.log('--- 🧪 Iniciando Prueba de Persistencia de Datos ---');

// 1. Crear Backup
if (fs.existsSync(dbPath)) {
  fs.copyFileSync(dbPath, backupPath);
}

try {
  // 2. Insertar Ventas de Prueba
  console.log('1. Insertando ventas de prueba (Simulando 14/04 y 15/04)...');
  let dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  const testSale1 = {
    id: 999001,
    date: '2026-04-14T10:00:00.000Z',
    totalValueUSD: 10,
    items: [{ id: 1, name: 'Producto Prueba', price: 10, qty: 1 }]
  };
  
  const testSale2 = {
    id: 999002,
    date: '2026-04-15T10:00:00.000Z',
    totalValueUSD: 20,
    items: [{ id: 2, name: 'Producto Prueba 2', price: 20, qty: 1 }]
  };
  
  dbData.sales.push(testSale1, testSale2);
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
  console.log('✅ Ventas insertadas.');

  // 3. Ejecutar el Script de Importación (EL QUE ESTABA FALLANDO)
  console.log('2. Ejecutando scripts/importExcel.js (Versión Corregida)...');
  execSync('node scripts/importExcel.js', { stdio: 'inherit' });

  // 4. Verificar Resultados
  console.log('3. Verificando persistencia...');
  const finalData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  const s1 = finalData.sales.find(s => s.id === 999001);
  const s2 = finalData.sales.find(s => s.id === 999002);
  
  if (s1 && s2) {
    console.log('🎉 ¡PRUEBA EXITOSA! Las ventas del 14 y 15 persistieron tras la importación.');
  } else {
    console.error('❌ ERROR: Las ventas desaparecieron tras la importación.');
  }

} catch (err) {
  console.error('❌ Error durante la prueba:', err.message);
} finally {
  // Restaurar backup
  // console.log('Restaurando base de datos original...');
  // fs.copyFileSync(backupPath, dbPath);
}

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configuración de Logs para Auto-Update
log.transports.file.level = "info";
autoUpdater.logger = log;
log.info('Techzone ERP cargando...');

// Configuración de Supabase
const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

const dbPath = path.join(app.getPath('userData'), 'database.json');

// Logs del sistema
function logSync(msg) {
  console.log(`[SYNC] ${new Date().toLocaleTimeString()}: ${msg}`);
}

function readDb() {
  if (!fs.existsSync(dbPath)) {
    const initialData = { 
       products: [], 
       sales: [], 
       daily_closures: [], 
       cash_transactions: [], 
       settings: { exchange_rate_bs: 40.0, admin_password: 'holaadio01' },
       tasks: [],
       repairs: [],
       expenses: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (!data.expenses) data.expenses = [];
  return data;
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function createBackup() {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const backupPath = path.join(backupDir, `database_backup_${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.copyFileSync(dbPath, backupPath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'techzone_icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Handlers locales
  ipcMain.handle('get-db', () => readDb());
  ipcMain.handle('save-db', (event, data) => {
    writeDb(data);
    return { success: true };
  });

  ipcMain.handle('select-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });
    if (canceled) return null;
    return filePaths[0];
  });

  createBackup();

  // --- AGENTE DE NUBE TECHZONE ---
  let isSyncing = false;
  let syncLocks = {
     products: false,
     sales: false,
     repairs: false,
     tasks: false,
     cash_transactions: false,
     settings: false
  };

  const pullStateFromCloud = async () => {
    try {
      console.log('📥 Sincronizando desde la nube (Pull)...');
      let dbData = readDb();
      let changed = false;

      // 1. Pull Products
      if (!syncLocks.products) {
        const { data: cloudProducts, error: pErr } = await supabase.from('products').select('*');
        if (!pErr && cloudProducts) {
          const cloudProductIds = new Set(cloudProducts.map(cp => String(cp.id)));
          const beforeCount = dbData.products.length;
          dbData.products = dbData.products.filter(lp => 
             cloudProductIds.has(String(lp.id)) || lp.localUpdatedAt
          );
          if (dbData.products.length !== beforeCount) changed = true;
          cloudProducts.forEach(cp => {
            const localIdx = dbData.products.findIndex(p => String(p.id) === String(cp.id));
            if (localIdx === -1) {
               dbData.products.push(cp);
               changed = true;
            } else if (!dbData.products[localIdx].localUpdatedAt || new Date(cp.updated_at) > new Date(dbData.products[localIdx].localUpdatedAt)) {
               dbData.products[localIdx] = { ...dbData.products[localIdx], ...cp, localUpdatedAt: null };
               changed = true;
            }
          });
        }
      }

      // 2. Pull Sales
      if (!syncLocks.sales) {
        const { data: cloudSales, error: sErr } = await supabase.from('sales').select('*');
        if (!sErr && cloudSales) {
          cloudSales.forEach(cs => {
             if (!dbData.sales.find(ls => String(ls.id) === String(cs.id))) {
                dbData.sales.push(cs);
                changed = true;
             }
          });
        }
      }

      // 3. Pull Settings
      if (!syncLocks.settings) {
        const { data: cloudSettings, error: stErr } = await supabase.from('settings').select('*');
        if (!stErr && cloudSettings) {
          cloudSettings.forEach(cs => {
            const key = cs.key.toLowerCase();
            if (dbData.settings[key] !== cs.value) {
               dbData.settings[key] = cs.value;
               changed = true;
            }
          });
        }
      }

      // 4. Pull Cash Transactions
      if (!syncLocks.cash_transactions) {
        const { data: cloudCash, error: cErr } = await supabase.from('cash_transactions').select('*');
        if (!cErr && cloudCash) {
           cloudCash.forEach(cc => {
              if (!dbData.cash_transactions.find(lc => String(lc.id) === String(cc.id))) {
                 dbData.cash_transactions.push(cc);
                 changed = true;
              }
           });
        }
      }

      // 5. Pull Tasks
      if (!syncLocks.tasks) {
        const { data: cloudTasks, error: tErr } = await supabase.from('tasks').select('*');
        if (!tErr && cloudTasks) {
           dbData.tasks = dbData.tasks || [];
           const cloudTaskIds = new Set(cloudTasks.map(ct => String(ct.id)));
           const beforeCount = dbData.tasks.length;
           dbData.tasks = dbData.tasks.filter(lt => cloudTaskIds.has(String(lt.id)));
           if (dbData.tasks.length !== beforeCount) changed = true;
           cloudTasks.forEach(ct => {
              const localIdx = dbData.tasks.findIndex(t => String(t.id) === String(ct.id));
              if (localIdx === -1) {
                 dbData.tasks.push(ct);
                 changed = true;
              } else {
                 dbData.tasks[localIdx] = { ...dbData.tasks[localIdx], ...ct };
              }
           });
        }
      }

      // 6. Pull Repairs
      if (!syncLocks.repairs) {
        const { data: cloudRepairs, error: repErr } = await supabase.from('repairs').select('*');
        if (!repErr && cloudRepairs) {
           const cloudRepIds = new Set(cloudRepairs.map(cr => String(cr.id)));
           const beforeRep = dbData.repairs ? dbData.repairs.length : 0;
           dbData.repairs = (dbData.repairs || []).filter(lr => cloudRepIds.has(String(lr.id)));
           if (dbData.repairs.length !== beforeRep) changed = true;
           cloudRepairs.forEach(cr => {
              const localIdx = (dbData.repairs || []).findIndex(r => String(r.id) === String(cr.id));
              if (localIdx === -1) {
                 if (!dbData.repairs) dbData.repairs = [];
                 dbData.repairs.push({
                    id: cr.id, customer: cr.customer, phone: cr.phone, 
                    device: cr.device, serial: cr.serial, issue: cr.issue,
                    observations: cr.observations, budget: cr.budget,
                    deposit: cr.deposit, status: cr.status, date: cr.date,
                    deliveryDate: cr.delivery_date
                 });
                 changed = true;
              } else if (dbData.repairs[localIdx].status !== cr.status || dbData.repairs[localIdx].budget !== cr.budget) {
                 dbData.repairs[localIdx] = { ...dbData.repairs[localIdx], status: cr.status, budget: cr.budget, deposit: cr.deposit };
                 changed = true;
              }
           });
        }
      }

      // 7. Sync Admin Password for Offline use
      try {
        const { data: adminUser, error: uErr } = await supabase
          .from('users')
          .select('password')
          .eq('role', 'admin')
          .single();
        
        if (!uErr && adminUser && dbData.settings.admin_password !== adminUser.password) {
          dbData.settings.admin_password = adminUser.password;
          changed = true;
        }
      } catch (passErr) {
        console.error('Password sync error:', passErr.message);
      }

      if (changed) {
        writeDb(dbData);
        logSync('✅ Base de datos local armonizada.');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) mainWindow.webContents.send('db-updated');
      }
    } catch (err) {
      console.error('⚠️ Pull error:', err.message);
    }
  };

  const pushStateToCloud = async () => {
    try {
      console.log('📤 Sincronizando hacia la nube (Push)...');
      let dbData = readDb();

      // 1. Sync Products
      const productsToSync = (dbData.products || []).filter(p => p.localUpdatedAt).map(p => ({
         id: p.id, sku: p.sku, name: p.name, price: p.price, cost: p.cost, 
         quantity: p.quantity, category: p.category, isService: p.isService,
         updated_at: new Date().toISOString()
      }));
      if (productsToSync.length > 0) {
         await supabase.from('products').upsert(productsToSync);
         dbData.products = dbData.products.map(p => ({...p, localUpdatedAt: null}));
         writeDb(dbData);
      }

      // 2. Sync Sales
      if (dbData.sales && dbData.sales.length > 0) {
         await supabase.from('sales').upsert(dbData.sales);
      }

      // 3. Sync Cash Transactions
      if (dbData.cash_transactions && dbData.cash_transactions.length > 0) {
         await supabase.from('cash_transactions').upsert(dbData.cash_transactions);
      }

      // 4. Sync Settings
      const settingsArray = Object.entries(dbData.settings || {}).map(([k, v]) => ({ key: k, value: v }));
      if (settingsArray.length > 0) {
         await supabase.from('settings').upsert(settingsArray);
      }

      // 5. Sync Tasks
      if (dbData.tasks && dbData.tasks.length > 0) {
         await supabase.from('tasks').upsert(dbData.tasks);
      }

      // 6. Sync Repairs
      if (dbData.repairs && dbData.repairs.length > 0) {
         const cloudRepairs = dbData.repairs.map(r => ({
            id: r.id, customer: r.customer, phone: r.phone, device: r.device,
            serial: r.serial, issue: r.issue, observations: r.observations,
            budget: r.budget, deposit: r.deposit, status: r.status, date: r.date,
            delivery_date: r.deliveryDate
         }));
         await supabase.from('repairs').upsert(cloudRepairs);
      }

      logSync('✅ Nube actualizada.');
    } catch (err) {
      console.error('⚠️ Push error:', err.message);
    }
  };

  const performFullSync = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      await pullStateFromCloud();
      await pushStateToCloud();
    } finally {
      isSyncing = false;
    }
  };

  performFullSync();
  setInterval(performFullSync, 1000 * 60 * 5);

  const realtimeChannel = supabase
    .channel('cloud-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => pullStateFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => pullStateFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => pullStateFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transactions' }, () => pullStateFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => pullStateFromCloud())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repairs' }, () => pullStateFromCloud())
    .subscribe((status) => {
       logSync(`📡 Canal Realtime: ${status}`);
       if (status === 'SUBSCRIBED') {
          const mainWindow = BrowserWindow.getAllWindows()[0];
          if (mainWindow) mainWindow.webContents.send('sync-status', { connected: true, syncing: false });
       }
    });

  // Auth Handler
  ipcMain.handle('login', async (event, password) => {
    try {
      // 1. Intentar validar con Supabase (Nube)
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('password', password)
        .eq('role', 'admin')
        .single();

      if (!error && data) {
        return { success: true, role: data.role };
      }

      // 2. Fallback: Validar localmente (Modo Offline)
      const dbData = readDb();
      const localPass = dbData.settings?.admin_password || 'holaadio01';
      
      if (password === localPass) {
        return { success: true, role: 'admin' };
      }

      return { success: false, error: 'Clave incorrecta' };
    } catch (err) {
      console.error('Login error:', err.message);
      // Último recurso: hardcoded fallback
      if (password === 'holaadio01') return { success: true, role: 'admin' };
      return { success: false, error: err.message };
    }
  });

  // Query Handler
  ipcMain.handle('db-query', (event, query, params = []) => {
    try {
      const q = query.trim().toUpperCase();
      let dbData = readDb();
      const tableMatch = q.match(/SELECT \* FROM ([A-Z0-9_]+)/i);
      if (!tableMatch) return { success: false, error: 'Query not supported' };
      const tableName = tableMatch[1].toLowerCase();
      let data = dbData[tableName] || [];
      if (tableName === 'settings') {
         data = Object.entries(dbData.settings || {}).map(([k,v]) => ({key: k.toLowerCase(), value: v}));
      }
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('save-repair', async (event, repair) => {
     try {
        let dbData = readDb();
        if (!dbData.repairs) dbData.repairs = [];
        const index = dbData.repairs.findIndex(r => String(r.id) === String(repair.id));
        if (index !== -1) {
           dbData.repairs[index] = repair;
        } else {
           repair.id = repair.id || Date.now();
           dbData.repairs.unshift(repair);
        }
        writeDb(dbData);
        pushStateToCloud();
        return { success: true, data: repair };
     } catch (e) {
        return { success: false, error: e.message };
     }
  });

  ipcMain.handle('delete-repair', async (event, id) => {
     try {
        syncLocks.repairs = true;
        let dbData = readDb();
        dbData.repairs = (dbData.repairs || []).filter(r => String(r.id) !== String(id));
        writeDb(dbData);
        await supabase.from('repairs').delete().eq('id', id);
        setTimeout(() => { syncLocks.repairs = false; }, 3000);
        return { success: true };
     } catch (e) {
        syncLocks.repairs = false;
        return { success: false, error: e.message };
     }
  });

  ipcMain.handle('clear-all-repairs', async () => {
    try {
      syncLocks.repairs = true;
      let dbData = readDb();
      dbData.repairs = [];
      writeDb(dbData);
      await supabase.from('repairs').delete().neq('customer', '---SYNCCLEAN---');
      setTimeout(() => { syncLocks.repairs = false; }, 3000);
      return { success: true };
    } catch (error) {
      syncLocks.repairs = false;
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('add-cash-transaction', (event, transaction) => {
     let dbData = readDb();
     if (!dbData.cash_transactions) dbData.cash_transactions = [];
     dbData.cash_transactions.push({ ...transaction, id: Date.now() });
     writeDb(dbData);
     performFullSync();
     return { success: true };
  });

  ipcMain.handle('close-day', (event, closureData) => {
     let dbData = readDb();
     if (!dbData.daily_closures) dbData.daily_closures = [];
     const closure = { ...closureData, id: 'Z-' + Date.now(), timestamp: new Date().toISOString() };
     dbData.daily_closures.push(closure);
     writeDb(dbData);
     pushStateToCloud();
     return { success: true, data: closure };
  });

  ipcMain.handle('save-setting', (event, key, val) => {
     let dbData = readDb();
     dbData.settings[key] = val;
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('save-product', (event, product) => {
     let dbData = readDb();
     const idx = dbData.products.findIndex(p => String(p.id) === String(product.id));
     const updatedProduct = { ...product, localUpdatedAt: new Date().toISOString() };
     if (idx !== -1) {
        dbData.products[idx] = updatedProduct;
     } else {
        dbData.products.push(updatedProduct);
     }
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('save-products', (event, products) => {
     let dbData = readDb();
     products.forEach(p => {
        const idx = dbData.products.findIndex(lp => String(lp.id) === String(p.id));
        const updated = { ...p, localUpdatedAt: new Date().toISOString() };
        if (idx !== -1) dbData.products[idx] = updated;
        else dbData.products.push(updated);
     });
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('delete-product', async (event, id) => {
     let dbData = readDb();
     dbData.products = dbData.products.filter(p => String(p.id) !== String(id));
     writeDb(dbData);
     await supabase.from('products').delete().eq('id', id);
     return { success: true };
  });

  ipcMain.handle('get-tasks', () => {
     const dbData = readDb();
     return { success: true, data: dbData.tasks || [] };
  });

  ipcMain.handle('save-task', (event, task) => {
     let dbData = readDb();
     if (!dbData.tasks) dbData.tasks = [];
     const idx = dbData.tasks.findIndex(t => String(t.id) === String(task.id));
     if (idx !== -1) {
        dbData.tasks[idx] = task;
     } else {
        dbData.tasks.push({ ...task, id: task.id || Date.now() });
     }
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('delete-task', (event, id) => {
     let dbData = readDb();
     dbData.tasks = (dbData.tasks || []).filter(t => String(t.id) !== String(id));
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('save-expense', (event, expense) => {
     let dbData = readDb();
     if (!dbData.expenses) dbData.expenses = [];
     const idx = dbData.expenses.findIndex(e => String(e.id) === String(expense.id));
     if (idx !== -1) {
        dbData.expenses[idx] = expense;
     } else {
        dbData.expenses.push({ ...expense, id: expense.id || Date.now() });
     }
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('delete-expense', (event, id) => {
     let dbData = readDb();
     dbData.expenses = (dbData.expenses || []).filter(e => String(e.id) !== String(id));
     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('process-sale', async (event, saleData) => {
     let dbData = readDb();
     dbData.sales.push(saleData);
     
     // Update Stock locally
     saleData.items.forEach(item => {
        if (!item.isService) {
           const pIdx = dbData.products.findIndex(p => String(p.id) === String(item.id));
           if (pIdx !== -1) {
              dbData.products[pIdx].quantity -= item.qty;
              dbData.products[pIdx].localUpdatedAt = new Date().toISOString();
           }
        }
     });

     writeDb(dbData);
     pushStateToCloud();
     return { success: true };
  });

  ipcMain.handle('delete-sale', async (event, id) => {
     let dbData = readDb();
     dbData.sales = dbData.sales.filter(s => String(s.id) !== String(id));
     writeDb(dbData);
     await supabase.from('sales').delete().eq('id', id);
     return { success: true };
  });

  ipcMain.handle('trigger-sync', async () => {
     await performFullSync();
     return { success: true };
  });

  ipcMain.handle('get-repairs', () => {
     const dbData = readDb();
     return { success: true, data: dbData.repairs || [] };
  });

  ipcMain.handle('clear-all-sales', async () => {
     let dbData = readDb();
     dbData.sales = [];
     writeDb(dbData);
     await supabase.from('sales').delete().neq('id', 0);
     return { success: true };
  });

  ipcMain.handle('clear-all-closures', async () => {
     let dbData = readDb();
     dbData.daily_closures = [];
     writeDb(dbData);
     await supabase.from('daily_closures').delete().neq('id', 'EMPTY');
     return { success: true };
  });

  ipcMain.handle('clear-cash-transactions', async () => {
     let dbData = readDb();
     dbData.cash_transactions = [];
     writeDb(dbData);
     await supabase.from('cash_transactions').delete().neq('id', 0);
     return { success: true };
  });

  ipcMain.handle('send-telegram', (event, text) => {
     console.log('Telegram placeholder:', text);
     return { success: true };
  });

  const generatePDFOffline = async (htmlContent, folderName, fileName) => {
      const targetDir = path.join(app.getPath('userData'), folderName);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetFile = path.join(targetDir, fileName + '.pdf');
      const win = new BrowserWindow({ show: false });
      const template = `<!DOCTYPE html><html><body>${htmlContent}</body></html>`;
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(template)}`);
      const pdfBytes = await win.webContents.printToPDF({});
      fs.writeFileSync(targetFile, pdfBytes);
      win.destroy();
      return { success: true, file: targetFile };
  };

  ipcMain.handle('save-receipt-pdf', async (event, sale) => {
      const html = `<h1>TECHZONE</h1><p>Factura #${String(sale.id).slice(-6)}</p><p>Total: $${sale.totalValueUSD.toFixed(2)}</p>`;
      return await generatePDFOffline(html, 'Facturas_PDF', `Factura_${String(sale.id).slice(-6)}`);
  });

  ipcMain.handle('save-zclose-pdf', async (event, z) => {
      const html = `<h1>CIERRE DE CAJA</h1><p>ID: ${z.id}</p><p>Ventas: $${z.totalSalesUSD.toFixed(2)}</p>`;
      return await generatePDFOffline(html, 'CierresZ_PDF', `Cierre_${z.id}`);
  });

  createWindow();

  // --- CONFIGURACIÓN DE AUTO-UPDATE ---
  autoUpdater.on('update-available', () => {
    log.info('¡Nueva actualización detectada!');
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Actualización descargada. Lista para instalar.');
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Reiniciar y Actualizar Now', 'Recordar más tarde'],
      title: 'Actualización Lista',
      message: `La versión ${info.version} de Techzone ERP ya está lista para instalar.`,
      detail: 'El programa se reiniciará automáticamente.'
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Error en el auto-updater:', err);
  });

  // Solo buscar actualizaciones en producción para evitar avisos molestos en desarrollo
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

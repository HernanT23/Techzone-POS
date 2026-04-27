const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', query, params),
  saveSetting: (key, val) => ipcRenderer.invoke('save-setting', key, val),
  login: (password) => ipcRenderer.invoke('login', password),
  processSale: (cart) => ipcRenderer.invoke('process-sale', cart),
  saveProduct: (product) => ipcRenderer.invoke('save-product', product),
  saveProducts: (products) => ipcRenderer.invoke('save-products', products),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  addCashTransaction: (transaction) => ipcRenderer.invoke('add-cash-transaction', transaction),
  closeDay: (closureData) => ipcRenderer.invoke('close-day', closureData),
  saveExpense: (expense) => ipcRenderer.invoke('save-expense', expense),
  deleteExpense: (id) => ipcRenderer.invoke('delete-expense', id),
  
  // PDF Generator Pipes
  saveReceiptPDF: (saleData) => ipcRenderer.invoke('save-receipt-pdf', saleData),
  saveZClosePDF: (zTicket) => ipcRenderer.invoke('save-zclose-pdf', zTicket),
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  deleteSale: (id) => ipcRenderer.invoke('delete-sale', id),
  saveSale: (sale) => ipcRenderer.invoke('process-sale', sale),
  clearAllSales: () => ipcRenderer.invoke('clear-all-sales'),
  clearAllClosures: () => ipcRenderer.invoke('clear-all-closures'),
  clearCashTransactions: () => ipcRenderer.invoke('clear-cash-transactions'),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  saveTask: (task) => ipcRenderer.invoke('save-task', task),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  sendTelegram: (text) => ipcRenderer.invoke('send-telegram', text),
  getRepairs: () => ipcRenderer.invoke('get-repairs'),
  saveRepair: (repair) => ipcRenderer.invoke('save-repair', repair),
  deleteRepair: (id) => ipcRenderer.invoke('delete-repair', id),
  saveAbono: (abono) => ipcRenderer.invoke('save-abono', abono),
  getAbonos: () => ipcRenderer.invoke('get-abonos'),
  clearAllRepairs: () => ipcRenderer.invoke('clear-all-repairs'),
  importExcel: () => ipcRenderer.invoke('import-excel'),

  onSyncStatus: (callback) => ipcRenderer.on('sync-status', (event, value) => callback(value)),
  onDbUpdated: (callback) => ipcRenderer.on('db-updated', () => callback())
});

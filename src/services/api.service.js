import { supabase } from '../supabase';

const isElectron = !!(window.api && window.api.dbQuery);

export const dbService = {
  isElectron: () => isElectron,

  query: async (sql, params = []) => {
    if (isElectron) return window.api.dbQuery(sql, params);

    const q = sql.trim().toUpperCase();
    
    // Generic mapper for Supabase logic
    try {
      if (q.includes('SELECT * FROM PRODUCTS')) {
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
        if (error) return { success: false, error: error.message };
        // Normalizar snake_case -> camelCase
        const normalized = (data || []).map(p => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          cost: p.cost,
          quantity: p.quantity,
          isService: p.is_service,
          category: p.category || 'Otros'
        }));
        return { success: true, data: normalized };
      }
      
      if (q.includes('SELECT * FROM SALES')) {
        const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
        if (error) return { success: false, error: error.message };
        // Normalizar snake_case -> camelCase (mismo formato que la PC local)
        const normalized = (data || []).map(s => ({
          id: s.id,
          date: s.date,
          totalValueUSD: s.total_usd,
          totalValueBS: s.total_bs,
          exchangeRateUsed: s.exchange_rate,
          items: s.items || [],
          clientName: s.client_name,
          clientId: s.client_id,
          processedBy: s.processed_by
        }));
        return { success: true, data: normalized };
      }
      
      if (q.includes('SELECT * FROM DAILY_CLOSURES')) {
        const { data, error } = await supabase.from('daily_closures').select('*').order('timestamp', { ascending: false });
        if (error) return { success: false, error: error.message };
        const normalized = (data || []).map(z => ({
          id: z.id,
          timestamp: z.timestamp,
          totalSalesUSD: z.total_sales_usd,
          totalSalesBS: z.total_sales_bs,
          netCashUSD: z.net_cash_usd,
          netCashBS: z.net_cash_bs,
          transactionsCount: z.transactions_count
        }));
        return { success: true, data: normalized };
      }

      if (q.includes('SELECT * FROM CASH_TRANSACTIONS')) {
        const { data, error } = await supabase.from('cash_transactions').select('*').order('date', { ascending: false });
        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
      }

      if (q.includes('SELECT * FROM SETTINGS')) {
        const { data, error } = await supabase.from('settings').select('*');
        return { success: !error, data, error: error?.message };
      }

      if (q.includes("SELECT VALUE FROM SETTINGS WHERE KEY = 'EXCHANGE_RATE_BS'")) {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'exchange_rate_bs').single();
        if (error) return { success: true, data: [{ value: 40.0 }] }; // Default fallback
        return { success: true, data: [data] };
      }

      if (q.includes('SELECT * FROM EXPENSES')) {
        const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
        if (error) return { success: false, error: error.message };
        return { success: true, data: data || [] };
      }

      if (q.includes('SELECT * FROM REPAIRS')) {
        const { data, error } = await supabase.from('repairs').select('*').order('date', { ascending: false });
        if (error) return { success: false, error: error.message };
        const normalized = (data || []).map(r => ({
          ...r,
          partCost: r.part_cost
        }));
        return { success: true, data: normalized };
      }

      return { success: false, error: 'Query mapping needed for Web Mode: ' + q.substring(0, 50) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  processSale: async (saleData) => {
    if (isElectron) return window.api.processSale(saleData);

    // Mapeo para Supabase (Mobile Mode)
    const { error: saleError } = await supabase.from('sales').insert([{
        id: saleData.id,
        date: saleData.date,
        total_usd: saleData.totalValueUSD,
        total_bs: saleData.totalValueBS,
        exchange_rate: saleData.exchangeRateUsed,
        items: saleData.items,
        client_name: saleData.clientName,
        client_id: saleData.clientId,
        processed_by: saleData.processedBy
    }]);

    if (saleError) return { success: false, error: saleError.message };

    // Actualizar Stock en la Nube
    for (const item of saleData.items) {
      if (!item.isService) {
        const { data: current } = await supabase.from('products').select('quantity').eq('id', item.id).single();
        if (current) {
          await supabase.from('products').update({ quantity: current.quantity - item.qty }).eq('id', item.id);
        }
      }
    }

    return { success: true };
  },

  login: async (password, requestedRole = 'admin') => {
    if (requestedRole === 'cashier') return { success: true, role: 'cashier' };
    
    if (isElectron) return window.api.login(password);

    // Búsqueda en Supabase para modo Web
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('password', password)
      .eq('role', 'admin')
      .single();

    if (error || !data) {
      return { success: false, error: 'Contraseña de Gerencia incorrecta.' };
    }
    return { success: true, role: data.role };
  },

  saveSetting: async (key, value) => {
    if (isElectron) return window.api.saveSetting(key, value);
    
    const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' });
    return { success: !error, error: error?.message };
  },

  saveProduct: async (product) => {
    if (isElectron) return window.api.saveProduct(product);
    
    const { error } = await supabase.from('products').upsert({
      id: product.id || Date.now(),
      sku: product.sku,
      name: product.name,
      price: product.price,
      cost: product.cost,
      quantity: product.quantity,
      is_service: product.isService,
      category: product.category || 'Otros'
    });
    return { success: !error, error: error?.message };
  },

  deleteProduct: async (id) => {
    if (isElectron) return window.api.deleteProduct(id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    return { success: !error, error: error?.message };
  },

  addCashTransaction: async (transaction) => {
    if (isElectron) return window.api.addCashTransaction(transaction);
    const { error } = await supabase.from('cash_transactions').insert([{
        date: transaction.date,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        reason: transaction.reason
    }]);
    return { success: !error, error: error?.message };
  },

  closeDay: async (closureData) => {
    if (isElectron) return window.api.closeDay(closureData);
    
    const zClosure = {
        id: 'Z-' + Date.now(),
        timestamp: new Date().toISOString(),
        total_sales_usd: closureData.totalSalesUSD,
        total_sales_bs: closureData.totalSalesBS,
        net_cash_usd: closureData.netCashUSD,
        net_cash_bs: closureData.netCashBS,
        transactions_count: closureData.transactionsCount
    };

    const { error } = await supabase.from('daily_closures').insert([zClosure]);
    return { success: !error, data: zClosure, error: error?.message };
  },

  deleteSale: async (id) => {
    if (isElectron) return window.api.deleteSale(id);
    const { error } = await supabase.from('sales').delete().eq('id', id);
    return { success: !error, error: error?.message };
  },

  clearAllSales: async () => {
    if (isElectron) return window.api.clearAllSales();
    const { error } = await supabase.from('sales').delete().neq('id', 0);
    return { success: !error, error: error?.message };
  },

  clearAllClosures: async () => {
    if (isElectron) {
       await window.api.clearAllClosures();
    }
    const { error } = await supabase.from('daily_closures').delete().neq('id', 'EMPTY');
    return { success: !error, error: error?.message };
  },

  clearCashTransactions: async () => {
     if (isElectron) {
        await window.api.clearCashTransactions();
     }
     const { error } = await supabase.from('cash_transactions').delete().neq('id', 0);
     return { success: !error, error: error?.message };
  },

  saveExpense: async (expense) => {
    if (isElectron) return window.api.saveExpense(expense);
    const { error } = await supabase.from('expenses').upsert({
       id: expense.id || Date.now(),
       date: expense.date,
       description: expense.description,
       amount: expense.amount,
       category: expense.category
    });
    return { success: !error, error: error?.message };
  },

  deleteExpense: async (id) => {
    if (isElectron) return window.api.deleteExpense(id);
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    return { success: !error, error: error?.message };
  },

  getTasks: async () => {
     if (isElectron) {
        const res = await window.api.getTasks();
        if (res.success) return res.data;
     }

     const { data, error } = await supabase.from('tasks').select('*').order('date', { ascending: false });
     return error ? [] : data;
  },

  saveTask: async (task) => {
     if (isElectron) return window.api.saveTask(task);
     
     const { error } = await supabase.from('tasks').upsert({
        id: task.id || Date.now(),
        text: task.text,
        completed: task.completed,
        date: task.date
     });
     return { success: !error, error: error?.message };
  },

  deleteTask: async (id) => {
     if (isElectron) return window.api.deleteTask(id);
     const { error } = await supabase.from('tasks').delete().eq('id', id);
     return { success: !error, error: error?.message };
  },

  getRepairs: async () => {
    if (isElectron) {
      const res = await window.api.getRepairs();
      if (res.success) return res.data;
    }
    const { data, error } = await supabase.from('repairs').select('*').order('date', { ascending: false });
    return error ? [] : data;
  },

  saveRepair: async (repair) => {
    if (isElectron) return window.api.saveRepair(repair);
    const { error } = await supabase.from('repairs').upsert({
      id: repair.id || Date.now(),
      date: repair.date,
      customer: repair.customer,
      phone: repair.phone,
      device: repair.device,
      serial: repair.serial,
      issue: repair.issue,
      observations: repair.observations,
      budget: Number(repair.budget) || 0,
      deposit: Number(repair.deposit) || 0,
      part_cost: Number(repair.partCost) || 0,
      status: repair.status,
      delivery_date: repair.deliveryDate
    });
    return { success: !error, error: error?.message };
  },

  deleteRepair: async (id) => {
    if (isElectron) return window.api.deleteRepair(id);
    const { error } = await supabase.from('repairs').delete().eq('id', id);
    return { success: !error, error: error?.message };
  },

  clearAllRepairs: async () => {
    if (isElectron) return window.api.clearAllRepairs();
    const { error } = await supabase.from('repairs').delete().neq('id', 0);
    return { success: !error, error: error?.message };
  },

  getAbonos: async () => {
    if (isElectron) {
      const res = await window.api.getAbonos();
      return res.success ? res.data : [];
    }
    const { data } = await supabase.from('abonos').select('*');
    return data || [];
  },

  saveAbono: async (abono) => {
    if (isElectron) return window.api.saveAbono(abono);
    const { error } = await supabase.from('abonos').upsert(abono);
    return { success: !error, error: error?.message };
  },

  saveRepairSale: async (saleData) => {
    // Esta función registra el ingreso neto (60%) en el historial de ventas
    const sale = {
      id: Date.now(),
      date: new Date().toISOString(),
      totalValueUSD: Number(saleData.amount),
      totalValueBS: 0,
      paidUSD: Number(saleData.amount), // Garantiza el reflejo en Caja Diaria
      changeUSD: 0,
      paidBS: 0,
      changeBS: 0,
      exchangeRateUsed: 1, 
      items: [{ 
        name: `Reparación: ${saleData.device}`, 
        price: Number(saleData.amount), 
        quantity: 1,
        isRepair: true,
        repairId: saleData.id // Referencia cruzada
      }],
      clientName: saleData.customer || 'Cliente Taller',
      processedBy: 'Sistema Taller',
      isElectron: isElectron
    };

    if (isElectron) {
      return window.api.saveSale(sale);
    } else {
      const { error } = await supabase.from('sales').upsert({
        id: sale.id,
        date: sale.date,
        total_usd: sale.totalValueUSD,
        total_bs: sale.totalValueBS,
        exchange_rate: sale.exchangeRateUsed,
        items: sale.items,
        client_name: sale.clientName,
        processed_by: sale.processedBy
      });
      return { success: !error, error: error?.message };
    }
  },

  subscribeToChanges: (onUpdate) => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transactions' }, onUpdate)
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  },

  triggerSync: async () => {
    if (isElectron && window.api.triggerSync) {
      return window.api.triggerSync();
    }
    return { success: true };
  },

  importExcel: async () => {
    if (isElectron && window.api.importExcel) {
      return window.api.importExcel();
    }
    return { success: false, error: 'Función solo disponible en la versión de escritorio.' };
  }
};

import { dbService } from './api.service';

let botToken = '';
let chatId = '';

// Cargar configuración inicial
const loadConfig = async () => {
    const res = await dbService.query("SELECT * FROM SETTINGS WHERE KEY IN ('tg_bot_token', 'tg_chat_id')");
    if (res.success && res.data) {
        res.data.forEach(s => {
            if (s.key === 'tg_bot_token') botToken = s.value;
            if (s.key === 'tg_chat_id') chatId = s.value;
        });
    }
};

loadConfig();

export const notificationService = {
    updateConfig: (token, id) => {
        botToken = token;
        chatId = id;
    },

    sendMessage: async (text) => {
        // En modo Electron, usar el puente directo para saltar CORS/Seguridad
        if (window.api && window.api.sendTelegram) {
            return await window.api.sendTelegram(text);
        }

        // Modo Web (Fallback)
        await loadConfig();
        if (!botToken || !chatId) {
            console.warn("Telegram Bot no configurado.");
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
            const data = await response.json();
            return { success: data.ok, data };
        } catch (err) {
            console.error("Telegram Error:", err);
            return { success: false, error: err.message };
        }
    },

    sendSaleAlert: async (sale) => {
        const itemsList = sale.items.map(i => `• ${i.name} (x${i.qty})`).join('\n');
        const message = `
<b>💰 NUEVA VENTA PROCESADA</b>
━━━━━━━━━━━━━━━━━━
<b>Monto:</b> $${sale.totalValueUSD.toFixed(2)}
<b>Método:</b> ${sale.paidUSD > 0 ? 'Dólares' : ''} ${sale.paidBS > 0 ? 'Bolívares' : ''}
<b>Cliente:</b> ${sale.clientName}
<b>Usuario:</b> ${sale.processedBy}
━━━━━━━━━━━━━━━━━━
<b>Artículos:</b>
${itemsList}
        `;
        return notificationService.sendMessage(message.trim());
    },

    sendDailyReport: async () => {
        const today = new Date().toLocaleDateString('en-CA');
        const res = await dbService.query("SELECT * FROM SALES");
        if (!res.success) return;

        const todaySales = res.data.filter(s => new Date(s.date).toLocaleDateString('en-CA') === today);
        if (todaySales.length === 0) return;

        const totalUSD = todaySales.reduce((acc, s) => acc + s.totalValueUSD, 0);
        
        // Agrupar por usuario
        const byUser = todaySales.reduce((acc, s) => {
            const user = s.processedBy || 'Desconocido';
            acc[user] = (acc[user] || 0) + s.totalValueUSD;
            return acc;
        }, {});

        let userBreakdown = '';
        Object.entries(byUser).forEach(([user, amount]) => {
            userBreakdown += `👤 <b>${user}:</b> $${amount.toFixed(2)}\n`;
        });

        const message = `
<b>📊 REPORTE DE VENTAS DIARIO</b>
━━━━━━━━━━━━━━━━━━
<b>Fecha:</b> ${new Date().toLocaleDateString()}
<b>Total General:</b> $${totalUSD.toFixed(2)}
<b>Operaciones:</b> ${todaySales.length}
━━━━━━━━━━━━━━━━━━
<b>DESGLOSE POR USUARIO:</b>
${userBreakdown}
━━━━━━━━━━━━━━━━━━
        `;
        return notificationService.sendMessage(message.trim());
    },

    sendClosureReport: async (zData) => {
        const message = `
<b>🚫 CIERRE DE CAJA (CORTE Z)</b>
━━━━━━━━━━━━━━━━━━
<b>Fecha:</b> ${new Date(zData.timestamp).toLocaleString()}
<b>ID Cierre:</b> #${String(zData.id).slice(-6)}
━━━━━━━━━━━━━━━━━━
<b>💵 INGRESOS BRUTOS:</b>
• USD: $${zData.totalSalesUSD.toFixed(2)}
• BS: Bs. ${zData.totalSalesBS.toFixed(2)}

<b>💸 RETIROS/GASTOS:</b>
• USD: -$${zData.totalWithdrawalsUSD.toFixed(2)}
• BS: -Bs. ${zData.totalWithdrawalsBS.toFixed(2)}
━━━━━━━━━━━━━━━━━━
<b>💰 TOTAL FÍSICO EN CAJA:</b>
<b>• USD: $${zData.netCashUSD.toFixed(2)}</b>
<b>• BS: Bs. ${zData.netCashBS.toFixed(2)}</b>
━━━━━━━━━━━━━━━━━━
        `;
        return notificationService.sendMessage(message.trim());
    }
};

import React, { useState, useEffect } from 'react';
import { dbService } from '../services/api.service';
import { notificationService } from '../services/notification.service';

export default function Alerts() {
    const [token, setToken] = useState('');
    const [chatId, setChatId] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            const res = await dbService.query("SELECT * FROM SETTINGS WHERE KEY IN ('tg_bot_token', 'tg_chat_id')");
            if (res.success && res.data) {
                res.data.forEach(s => {
                    if (s.key === 'tg_bot_token') setToken(s.value);
                    if (s.key === 'tg_chat_id') setChatId(s.value);
                });
            }
            setLoading(false);
        };
        loadConfig();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus('Guardando...');
        
        try {
            const cleanToken = token.trim();
            const cleanChatId = chatId.trim();

            await dbService.saveSetting('tg_bot_token', cleanToken);
            await dbService.saveSetting('tg_chat_id', cleanChatId);
            notificationService.updateConfig(cleanToken, cleanChatId);
            
            setStatus('🚀 Conectando con Telegram...');
            
            // Probar envío
            const test = await notificationService.sendMessage("<b>✅ Techzone Vinculado con éxito.</b>\nTu bot ya está listo para enviarte reportes.");
            
            if (test.success) {
                setStatus('✅ ¡Bot vinculado con éxito! Revisa tu Telegram.');
            } else {
                setStatus(`⚠️ Telegram falló: ${test.error || 'Desconocido'}`);
            }
        } catch (err) {
            setStatus('❌ Error Local: ' + err.message);
        }
    };

    if (loading) return <div className="glass-panel"><p>Cargando configuración...</p></div>;

    return (
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--accent-color)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🤖</span> Configuración de Inteligencia (Telegram)
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>TELEGRAM BOT TOKEN</label>
                        <input 
                            type="password" 
                            value={token} 
                            onChange={e => setToken(e.target.value)} 
                            placeholder="1234567890:ABCDE..." 
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }} 
                        />
                    </div>

                    <div className="glass-panel" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px' }}>TU CHAT ID (ID DE USUARIO)</label>
                        <input 
                            type="text" 
                            value={chatId} 
                            onChange={e => setChatId(e.target.value)} 
                            placeholder="987654321" 
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white' }} 
                        />
                    </div>

                    <button type="submit" style={{ padding: '18px', background: 'var(--accent-color)', color: 'black', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '1.1rem' }}>
                        GUARDAR Y VINCULAR BOT
                    </button>
                    
                    {status && <p style={{ textAlign: 'center', fontWeight: 'bold' }}>{status}</p>}
                </form>

                <div className="glass-panel" style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem' }}>📝 Guía de Activación (1 Minuto)</h3>
                    <ol style={{ fontSize: '0.9rem', paddingLeft: '20px', lineHeight: '1.6', opacity: 0.8 }}>
                        <li style={{ marginBottom: '10px' }}>Busca a <b>@BotFather</b> en Telegram y envíale <code>/newbot</code>. Sigue los pasos y copia el <b>API Token</b>.</li>
                        <li style={{ marginBottom: '10px' }}>Busca a <b>@userinfobot</b> y reenvíale un mensaje o escríbele para obtener tu <b>Id</b> (Chat ID).</li>
                        <li style={{ marginBottom: '10px' }}>Pega ambos datos aquí y dale a Guardar.</li>
                        <li><b>¡Listo!</b> Recibirás un mensaje de confirmación en tu celular.</li>
                    </ol>
                    <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem' }}>
                        💡 <i>Tip: Una vez vinculado, recibirás alertas automáticas de ventas y reportes de cierres sin costo alguno.</i>
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>🔒 Seguridad de Alertas</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                    Las notificaciones de ventas solo se enviarán cuando otros usuarios procesen transacciones. 
                    Tus propias ventas como "Gerencia" no dispararán alertas para evitar saturar tu chat.
                </p>
            </div>
        </div>
    );
}

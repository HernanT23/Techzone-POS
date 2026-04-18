const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Config
const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';
const supabase = createClient(SB_URL, SB_KEY);

const dbPath = path.join(process.env.APPDATA, 'valery-pos', 'database.json');

async function clearData() {
    console.log('🚀 Iniciando borrado de arqueos y cierres...');

    // 1. Local Clear
    if (fs.existsSync(dbPath)) {
        try {
            const raw = fs.readFileSync(dbPath, 'utf8');
            const data = JSON.parse(raw);
            data.daily_closures = [];
            data.cash_transactions = [];
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            console.log('✅ Base de datos local (JSON) limpiada.');
        } catch (e) {
            console.error('❌ Error limpiando local:', e.message);
        }
    }

    // 2. Cloud Clear
    try {
        const { error: err1 } = await supabase.from('daily_closures').delete().neq('id', 'EMPTY');
        if (err1) console.error('❌ Error borrando cierres en la nube:', err1.message);
        else console.log('✅ Cierres en la nube borrados.');

        const { error: err2 } = await supabase.from('cash_transactions').delete().neq('id', 0);
        if (err2) console.error('❌ Error borrando transacciones en la nube:', err2.message);
        else console.log('✅ Transacciones de caja en la nube borradas.');

    } catch (e) {
        console.error('❌ Error en conexión Supabase:', e.message);
    }

    console.log('✨ Proceso de limpieza completado.');
    process.exit(0);
}

clearData();

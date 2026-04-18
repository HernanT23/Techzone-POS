const { createClient } = require('@supabase/supabase-js');

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';

const supabase = createClient(SB_URL, SB_KEY);

async function testDelete() {
    console.log('🔍 Probando borrado de reparaciones...');
    
    // 1. Ver qué hay
    const { data: before, error: e1 } = await supabase.from('repairs').select('id');
    if (e1) {
        console.error('❌ Error al leer reparaciones:', e1.message);
        return;
    }
    console.log(`📊 Reparaciones encontradas: ${before.length}`);

    if (before.length === 0) {
        console.log('⚠️ No hay nada que borrar.');
        return;
    }

    // 2. Intentar borrar todas
    console.log('🗑️ Intentando borrar todas con .neq("id", 0)...');
    const { error: e2 } = await supabase.from('repairs').delete().neq('id', 0);
    if (e2) {
        console.error('❌ Error en el borrado masivo:', e2.message);
        console.error('Detalles:', e2.details);
    } else {
        console.log('✅ Comando de borrado enviado sin errores.');
    }

    // 3. Verificar si siguen ahí
    const { data: after, error: e3 } = await supabase.from('repairs').select('id');
    console.log(`📊 Reparaciones remanentes: ${after ? after.length : 'error'}`);
    
    if (after && after.length > 0) {
        console.log('🚨 FALLO: Las reparaciones NO se borraron de la nube.');
        console.log('Intentando borrado por ID específico de la primera reparacion:', after[0].id);
        const { error: e4 } = await supabase.from('repairs').delete().eq('id', after[0].id);
        if (e4) console.error('❌ Error borrado individual:', e4.message);
        else console.log('✅ Borrado individual exitoso. El problema es el filtro masivo.');
    } else {
        console.log('✨ ÉXITO: La nube está limpia.');
    }
}

testDelete();

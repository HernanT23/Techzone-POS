import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://xoxnajvnrpvhgiopxpqf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhveG5hanZucnB2aGdpb3B4cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTc0MzAsImV4cCI6MjA5MTc3MzQzMH0.dTM8ey3g49GaijjOGaMe-JF4MvS8ezRDenUyDfYJh-0';

const supabase = createClient(SB_URL, SB_KEY);

async function updateDashboardLabel() {
    console.log('🔄 Actualizando etiqueta del dashboard en Supabase...');
    const { error } = await supabase
        .from('settings')
        .upsert({ key: 'dashboard_label', value: 'Negocio' }, { onConflict: 'key' });

    if (error) {
        console.error('❌ Error updating setting:', error.message);
    } else {
        console.log('✅ Etiqueta actualizada a "Negocio" correctamente.');
    }
}

updateDashboardLabel();

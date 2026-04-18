const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uevdfuizisovxghfnyix.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('⚠️ Error: VITE_SUPABASE_ANON_KEY no está definido en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log('🚀 Iniciando configuración de Supabase...');

  // 1. Crear tabla cash_transactions (Si no existe - via RPC o asumimos si falla el insert)
  console.log('--- Configurando Tablas (Asumiendo que existen o creándolas vía SQL editor si es posible) ---');
  
  // Nota: Desde JS no podemos crear tablas directamente sin privilegios de admin/postgres.
  // Pero podemos intentar un insert para verificar si la tabla existe.
  try {
    const { error: tErr } = await supabase.from('cash_transactions').select('*').limit(1);
    if (tErr) {
       console.log('⚠️ Tabla cash_transactions no encontrada o inaccesible:', tErr.message);
       console.log('👉 RECOMENDACIÓN: Ejecuta este SQL en el editor de Supabase:');
       console.log(`
          CREATE TABLE IF NOT EXISTS cash_transactions (
             id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
             date TIMESTAMPTZ DEFAULT now(),
             type TEXT,
             amount FLOAT8,
             currency TEXT,
             reason TEXT
          );
          ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
          CREATE POLICY "Allow All" ON cash_transactions FOR ALL USING (true) WITH CHECK (true);
       `);
    } else {
       console.log('✅ Tabla cash_transactions verificada.');
    }
  } catch (e) {
    console.error('Error al verificar tablas:', e);
  }

  // 2. Asegurar usuario admin con clave 'holaadio01'
  console.log('--- Verificando Usuario Gerencia ---');
  const { data: user, error: uErr } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .single();

  if (uErr && uErr.code !== 'PGRST116') {
     console.error('Error al buscar usuario:', uErr.message);
  } else if (!user) {
     console.log('➕ Creando usuario admin por defecto...');
     await supabase.from('users').insert([{ 
        role: 'admin', 
        password: 'holaadio01',
        name: 'Gerente Techzone'
     }]);
  } else {
     console.log('✅ Usuario admin ya existe. Asegurando clave...');
     await supabase.from('users').update({ password: 'holaadio01' }).eq('role', 'admin');
  }

  console.log('🏁 Configuración finalizada.');
}

setup();

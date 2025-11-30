// Configuración de Supabase - REEMPLAZA con tus credenciales
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-publico';

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exportar para usar en otros archivos
window.supabaseClient = supabase;

console.log('✅ Supabase client inicializado');
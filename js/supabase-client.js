// Configuración de Supabase - REEMPLAZA con tus credenciales
const SUPABASE_URL = 'https://exvicrpylcrjsxlgunrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dmljcnB5bGNyanN4bGd1bnJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0OTE5MzIsImV4cCI6MjA4MDA2NzkzMn0.DIzbbs_0Qbg8winEmxyyulOW3OpHIle2SxVmWx733PY';

// Inicializar cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exportar para usar en otros archivos
window.supabaseClient = supabase;


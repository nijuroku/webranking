// Verificar conexión a Supabase y datos
async function verificarSistema() {
    console.log('=== VERIFICANDO SISTEMA ===');
    
    // 1. Verificar Supabase
    console.log('1. Conectando a Supabase...');
    try {
        const { data, error } = await window.supabaseClient
            .from('administradores')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('❌ Error de conexión:', error);
            return false;
        }
        console.log('✅ Conexión a Supabase OK');
    } catch (e) {
        console.error('❌ Error grave:', e);
        return false;
    }
    
    // 2. Verificar administradores
    console.log('2. Verificando administradores...');
    const { data: admins, error: adminError } = await window.supabaseClient
        .from('administradores')
        .select('*');
        
    if (adminError) {
        console.error('❌ Error leyendo administradores:', adminError);
        return false;
    }
    
    console.log('✅ Administradores encontrados:', admins);
    
    // 3. Verificar hash de contraseña
    console.log('3. Verificando contraseña "admin"...');
    const password = 'admin';
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('Hash MD5 de "admin":', hashHex);
    console.log('Hash esperado:', '21232f297a57a5a743894a0e4a801fc3');
    
    // 4. Verificar si coincide
    const admin = admins.find(a => a.usuario === 'admin');
    if (admin) {
        console.log('Hash en BD:', admin.password_hash);
        console.log('Coinciden?:', hashHex === admin.password_hash);
    }
    
    return true;
}

// Ejecutar verificación
verificarSistema();
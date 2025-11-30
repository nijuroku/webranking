class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userLevel = 0; // 0: Público, 1: Admin, 2: Super Admin
        this.init();
    }

    async init() {
    // Acceso público automático
    this.accessAsPublic();
    this.setupEventListeners();
    
    // Intentar cargar sesión de admin en segundo plano
    this.checkExistingSession();
}

    async checkExistingSession() {
        try {
            const savedSession = localStorage.getItem('adminSession');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
                    await this.validateAdminUser(session.usuario);
                } else {
                    localStorage.removeItem('adminSession');
                }
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }
        // Nuevo método para acceso público
    accessAsPublic() {
        this.currentUser = null;
        this.userLevel = 0;
        this.showMainApp();
    }

    async validateAdminUser(usuario) {
        try {
            console.log('Validando usuario:', usuario);
            
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', usuario)
                .eq('activo', true)
                .single();

            if (error || !admin) {
                console.error('Admin no encontrado o inactivo:', error);
                this.showNotification('Usuario no autorizado', 'error');
                await this.logout();
                return;
            }

            this.currentUser = admin;
            this.userLevel = admin.nivel_acceso;
            this.showMainApp();
            
            console.log('Usuario validado correctamente:', admin.usuario);
            
        } catch (error) {
            console.error('Error validating admin:', error);
            this.showLogin();
        }
    }

    async login(usuario, password) {
        try {
            console.log('Intentando login para:', usuario);
            
            // Primero, buscar el administrador en la base de datos
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', usuario)
                .eq('activo', true)
                .single();

            if (error || !admin) {
                console.error('Admin no encontrado:', error);
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            console.log('Admin encontrado, verificando contraseña...');

            // Verificar contraseña (hash MD5)
            const passwordHash = await this.hashPassword(password);
            console.log('Hash ingresado:', passwordHash);
            console.log('Hash en BD:', admin.password_hash);
            
            if (passwordHash !== admin.password_hash) {
                console.error('Contraseña incorrecta');
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            this.currentUser = admin;
            this.userLevel = admin.nivel_acceso;
            
            // Guardar sesión en localStorage
            localStorage.setItem('adminSession', JSON.stringify({
                usuario: admin.usuario,
                nivel: admin.nivel_acceso,
                timestamp: Date.now()
            }));

            this.showMainApp();
            this.showNotification(`Bienvenido, ${admin.nombre_completo || admin.usuario}`, 'success');
            return true;

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Error al iniciar sesión', 'error');
            return false;
        }
    }

    async hashPassword(password) {
        // Usar SHA-256 que SÍ está soportado
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    async logout() {
        this.currentUser = null;
        this.userLevel = 0;
        localStorage.removeItem('adminSession');
        this.showLogin();
        this.showNotification('Sesión cerrada correctamente', 'success');
    }

    showLogin() {
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('loading').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        this.updateUI();
        
        // Cargar datos iniciales
        setTimeout(() => {
            if (window.rankingManager) window.rankingManager.loadRankingMain();
            if (window.rankingManager) window.rankingManager.loadRankingExtra();
            if (window.equipoManager) window.equipoManager.loadEquipos();
        }, 500);
    }

    updateUI() {
        
        const userInfo = document.getElementById('userInfo');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminTabs = document.getElementById('adminTabs');
        
        if (this.userLevel === 0) {
            // Modo público
            userInfo.innerHTML = '<span>👤 Modo Público</span>';
            logoutBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
            adminTabs.style.display = 'none';
            
            // Ocultar pestañas de administración
            this.hideAdminTabs();
        } else {
            // Modo administrador
            document.getElementById('userName').textContent = this.currentUser.nombre_completo || this.currentUser.usuario;
            
            const badge = document.getElementById('userBadge');
            badge.textContent = this.userLevel >= 2 ? 'Super Admin' : 'Admin';
            badge.style.background = this.userLevel >= 2 ? '#e74c3c' : '#3498db';
            
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';
            
            // Mostrar pestañas de admin según nivel
            if (this.userLevel >= 2) {
                adminTabs.style.display = 'block';
            } else {
                adminTabs.style.display = 'none';
            }
        }
    }
    hideAdminTabs() {
        // Ocultar pestañas de administración
        const adminTabIds = ['usuarios', 'gestion-usuarios', 'administradores'];
        adminTabIds.forEach(tabId => {
            const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
            if (tabBtn) tabBtn.style.display = 'none';
        });
        
        // Si está en una pestaña admin, redirigir a ranking
        const currentTab = document.querySelector('.tab-content.active');
        if (currentTab && adminTabIds.includes(currentTab.id)) {
            this.switchTab('ranking-main');
        }
    }
    switchTab(tabName) {
        // Ocultar todas las pestañas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Mostrar pestaña seleccionada
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Actualizar botones de navegación
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    setupEventListeners() {
        // Botón de login/logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (this.userLevel === 0) {
                // Si es público, mostrar login
                this.showLogin();
            } else {
                // Si es admin, cerrar sesión
                this.logout();
            }
        });

        // Botón de acceso público en el login
        const loginForm = document.getElementById('loginForm');
        if (!document.getElementById('publicAccessBtn')) {
            const publicBtn = document.createElement('button');
            publicBtn.type = 'button';
            publicBtn.id = 'publicAccessBtn';
            publicBtn.className = 'btn btn-outline btn-large';
            publicBtn.innerHTML = '<i class="fas fa-eye"></i> Acceder como Público';
            publicBtn.addEventListener('click', () => {
                this.accessAsPublic();
            });
            loginForm.appendChild(publicBtn);
        }
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notifications.appendChild(notification);

        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserLevel() {
        return this.userLevel;
    }

    hasAccess(requiredLevel) {
        return this.userLevel >= requiredLevel;
    }
}

// Inicializar el sistema de autenticación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userLevel = 0;
        this.init();
    }

    async init() {
        await this.checkExistingSession();
        this.setupEventListeners();
    }

    async checkExistingSession() {
        try {
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            
            if (error) throw error;
            
            if (session?.user) {
                await this.validateAdminUser(session.user.email);
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error('Error checking session:', error);
            this.showLogin();
        }
    }

    async validateAdminUser(email) {
        try {
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', email)
                .eq('activo', true)
                .single();

            if (error || !admin) {
                this.showNotification('Usuario no autorizado', 'error');
                await this.logout();
                return;
            }

            this.currentUser = admin;
            this.userLevel = admin.nivel_acceso;
            this.showMainApp();
            
        } catch (error) {
            console.error('Error validating admin:', error);
            this.showLogin();
        }
    }

    async login(usuario, password) {
        try {
            // Para Supabase, necesitamos usar el sistema de autenticación por email
            // Pero como estamos usando tabla personalizada, hacemos la validación directa
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', usuario)
                .eq('activo', true)
                .single();

            if (error || !admin) {
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            // Verificar contraseña (hash MD5)
            const passwordHash = await this.hashPassword(password);
            if (passwordHash !== admin.password_hash) {
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            this.currentUser = admin;
            this.userLevel = admin.nivel_acceso;
            
            // Crear sesión en localStorage
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
        // Usar Web Crypto API para hash (más seguro que MD5, pero compatible con lo existente)
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    }

    updateUI() {
        // Actualizar información del usuario
        document.getElementById('userName').textContent = this.currentUser.nombre_completo || this.currentUser.usuario;
        
        const badge = document.getElementById('userBadge');
        badge.textContent = this.userLevel >= 2 ? 'Super Admin' : 'Admin';
        badge.style.background = this.userLevel >= 2 ? '#e74c3c' : '#3498db';

        // Mostrar/ocultar pestañas de admin
        const adminTabs = document.getElementById('adminTabs');
        if (this.userLevel >= 2) {
            adminTabs.style.display = 'block';
        } else {
            adminTabs.style.display = 'none';
            // Si está en una pestaña admin, redirigir a ranking
            const currentTab = document.querySelector('.tab-content.active').id;
            if (currentTab === 'administradores' || currentTab === 'gestion-usuarios') {
                this.switchTab('ranking-main');
            }
        }
    }

    switchTab(tabName) {
        // Ocultar todas las pestañas
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Mostrar pestaña seleccionada
        document.getElementById(tabName).classList.add('active');
        
        // Actualizar botones de navegación
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    setupEventListeners() {
        // Formulario de login
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const usuario = document.getElementById('loginUsuario').value;
            const password = document.getElementById('loginPassword').value;
            
            await this.login(usuario, password);
        });

        // Botón de logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Navegación por pestañas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Verificar sesión al cargar desde localStorage
        const savedSession = localStorage.getItem('adminSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            // Verificar que la sesión no tenga más de 24 horas
            if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
                this.validateAdminUser(session.usuario);
            } else {
                localStorage.removeItem('adminSession');
            }
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
            notification.remove();
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

// Inicializar el sistema de autenticación
window.authManager = new AuthManager();
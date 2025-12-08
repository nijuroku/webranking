class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userLevel = 0;
        this.init();
    }

    async init() {
        this.hideLoading();
        this.setupEventListeners();
        await this.checkExistingSession();
    }

    async sha256(message) {
        try {
            // encode as UTF-8
            const msgBuffer = new TextEncoder().encode(message);
            
            // hash the message
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            
            // convert ArrayBuffer to Array
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            
            // convert bytes to hex string
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (error) {
            console.error('Error en SHA-256:', error);
            // Fallback simple (NO usar en producción, solo para debugging)
            return this.simpleHash(message);
        }
    }

    // Método de fallback para debugging
    simpleHash(message) {
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    async login(usuario, password) {
        try {
            console.log('🔐 Intentando login para:', usuario);
            
            // Validar campos
            if (!usuario || !password) {
                this.showNotification('Usuario y contraseña son obligatorios', 'error');
                return false;
            }

            // Buscar administrador en la base de datos
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', usuario)
                .eq('activo', true)
                .single();

            if (error) {
                console.error('Error en consulta Supabase:', error);
                
                if (error.code === 'PGRST116') {
                    // No se encontró el usuario
                    this.showNotification('Usuario o contraseña incorrectos', 'error');
                } else {
                    this.showNotification('Error de conexión con la base de datos', 'error');
                }
                return false;
            }

            if (!admin) {
                console.error('Admin no encontrado o inactivo');
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            console.log('👤 Admin encontrado:', admin.usuario);
            console.log('🔑 Hash en BD:', admin.password_hash);

            // VERIFICACIÓN SHA-256
            const passwordHash = await this.sha256(password);
            console.log('🔑 Hash calculado:', passwordHash);
            
            if (passwordHash !== admin.password_hash) {
                console.error('❌ Contraseña incorrecta');
                console.log('Comparando:', passwordHash, 'con', admin.password_hash);
                this.showNotification('Usuario o contraseña incorrectos', 'error');
                return false;
            }

            console.log('✅ Contraseña válida');

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
            
            // Forzar recarga de datos
            await this.forceReloadData();
            
            return true;

        } catch (error) {
            console.error('❌ Error completo en login:', error);
            this.showNotification('Error al iniciar sesión: ' + error.message, 'error');
            return false;
        }
    }

    async checkExistingSession() {
        try {
            const savedSession = localStorage.getItem('adminSession');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                // Validar que la sesión no tenga más de 24 horas
                if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
                    await this.validateAdminUser(session.usuario);
                    return;
                } else {
                    console.log('⚠️ Sesión expirada');
                    localStorage.removeItem('adminSession');
                }
            }
            // Si no hay sesión válida, mostrar acceso público
            this.accessAsPublic();
        } catch (error) {
            console.error('Error checking session:', error);
            this.accessAsPublic();
        }
    }

    async validateAdminUser(usuario) {
        try {
            console.log('🔍 Validando sesión existente para:', usuario);
            
            const { data: admin, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .eq('usuario', usuario)
                .eq('activo', true)
                .single();

            if (error || !admin) {
                console.error('Admin no encontrado o inactivo:', error);
                localStorage.removeItem('adminSession');
                this.accessAsPublic();
                return;
            }

            this.currentUser = admin;
            this.userLevel = admin.nivel_acceso;
            this.showMainApp();
            
            console.log('✅ Sesión validada correctamente:', admin.usuario);
            
        } catch (error) {
            console.error('Error validating admin:', error);
            localStorage.removeItem('adminSession');
            this.accessAsPublic();
        }
    }

  

  // Nuevo método para acceso público
  accessAsPublic() {
    this.currentUser = null;
    this.userLevel = 0;
    this.showMainApp();
    console.log("Acceso público activado");
  }

  async logout() {
    this.currentUser = null;
    this.userLevel = 0;
    localStorage.removeItem("adminSession");
    this.accessAsPublic();
    this.showNotification("Sesión cerrada correctamente", "success");
  }

  hideLoading() {
    document.getElementById("loading").style.display = "none";
  }

  showLogin() {
    document.getElementById("mainApp").style.display = "none";
    document.getElementById("loginModal").style.display = "flex";
  }

  showMainApp() {
    this.hideLoading();
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("mainApp").style.display = "block";

    // Forzar actualización de UI inmediatamente
    this.updateUI();

    console.log(
      "🏠 Main app mostrada - Usuario:",
      this.currentUser?.usuario,
      "Nivel:",
      this.userLevel
    );

    // Cargar datos iniciales con retardo para asegurar que la UI esté lista
    setTimeout(() => {
      this.loadInitialData();
    }, 100);
  }

  // 🔄 AGREGAR ESTE MÉTODO TAMBIÉN
  async loadInitialData() {
    console.log("📊 Cargando datos iniciales...");

    try {
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
        await window.rankingManager.loadRankingExtra();
      }

      if (window.equipoManager) {
        await window.equipoManager.loadEquipos();
      }

      if (window.usuarioManager) {
        await window.usuarioManager.loadUsuarios();
      }

      console.log("✅ Todos los datos cargados correctamente");
    } catch (error) {
      console.error("❌ Error cargando datos iniciales:", error);
    }
  }

  updateUI() {
    const userInfo = document.getElementById("userInfo");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminTabs = document.getElementById("adminTabs");

    if (this.userLevel === 0) {
      // Modo público
      userInfo.innerHTML = "<span>👤 Modo Público</span>";
      logoutBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
      adminTabs.style.display = "none";

      // Ocultar pestañas de administración
      this.hideAdminTabs();
    } else {
      // Modo administrador
      document.getElementById("userName").textContent =
        this.currentUser.nombre_completo || this.currentUser.usuario;

      const badge = document.getElementById("userBadge");
      badge.textContent = this.userLevel >= 2 ? "Super Admin" : "Admin";
      badge.style.background = this.userLevel >= 2 ? "#e74c3c" : "#3498db";

      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';

      // Mostrar pestañas de admin según nivel
      if (this.userLevel >= 2) {
        adminTabs.style.display = "block";
      } else {
        adminTabs.style.display = "none";
      }
    }
  }

  hideAdminTabs() {
    // Ocultar pestañas de administración
    const adminTabIds = ["usuarios", "gestion-usuarios", "administradores"];
    adminTabIds.forEach((tabId) => {
      const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
      if (tabBtn) tabBtn.style.display = "none";
    });

    // Si está en una pestaña admin, redirigir a ranking
    const currentTab = document.querySelector(".tab-content.active");
    if (currentTab && adminTabIds.includes(currentTab.id)) {
      this.switchTab("ranking-main");
    }
  }

  switchTab(tabName) {
    // Ocultar todas las pestañas
    document.querySelectorAll(".tab-content").forEach((tab) => {
      tab.classList.remove("active");
    });

    // Mostrar pestaña seleccionada
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
      targetTab.classList.add("active");
    }

    // Actualizar botones de navegación
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
      targetBtn.classList.add("active");
    }
  }

  setupEventListeners() {
    // Formulario de login
    document
      .getElementById("loginForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const usuario = document.getElementById("loginUsuario").value;
        const password = document.getElementById("loginPassword").value;

        if (!usuario || !password) {
          this.showNotification(
            "Usuario y contraseña son obligatorios",
            "error"
          );
          return;
        }

        await this.login(usuario, password);
      });

    // Botón de login/logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
      if (this.userLevel === 0) {
        // Si es público, mostrar login
        this.showLogin();
      } else {
        // Si es admin, cerrar sesión
        this.logout();
      }
    });

    // Botón de acceso público en el login
    const publicAccessBtn = document.getElementById("publicAccessBtn");
    if (publicAccessBtn) {
      publicAccessBtn.addEventListener("click", () => {
        this.accessAsPublic();
      });
    }

    // Navegación por pestañas
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.getAttribute("data-tab");
        this.switchTab(tabName);
      });
    });
  }

  showNotification(message, type = "info") {
    const notifications = document.getElementById("notifications");
    const notification = document.createElement("div");
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
document.addEventListener("DOMContentLoaded", () => {
  window.authManager = new AuthManager();
});

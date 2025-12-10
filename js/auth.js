class AuthManager {
<<<<<<< Updated upstream
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

    // ... resto de los métodos se mantienen igual ...
    accessAsPublic() {
        this.currentUser = null;
        this.userLevel = 0;
        this.showMainApp();
        console.log('🌐 Acceso público activado');
    }

    async logout() {
        this.currentUser = null;
        this.userLevel = 0;
        localStorage.removeItem('adminSession');
        this.accessAsPublic();
        this.showNotification('Sesión cerrada correctamente', 'success');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    showLogin() {
        const mainApp = document.getElementById('mainApp');
        const loginModal = document.getElementById('loginModal');
        
        if (mainApp) mainApp.style.display = 'none';
        if (loginModal) loginModal.style.display = 'flex';
    }

    showMainApp() {
        this.hideLoading();
        
        const loginModal = document.getElementById('loginModal');
        const mainApp = document.getElementById('mainApp');
        
        if (loginModal) loginModal.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        this.updateUI();
        
        console.log('🏠 Main app mostrada - Usuario:', this.currentUser?.usuario, 'Nivel:', this.userLevel);
    }

    updateUI() {
        const userInfo = document.getElementById('userInfo');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminTabs = document.getElementById('adminTabs');
        
        if (!userInfo || !logoutBtn) return;

        if (this.userLevel === 0) {
            // Modo público
            userInfo.innerHTML = '<span>👤 Modo Público</span>';
            logoutBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
            if (adminTabs) adminTabs.style.display = 'none';
            this.hideAdminTabs();
        } else {
            // Modo administrador
            const userName = document.getElementById('userName');
            const userBadge = document.getElementById('userBadge');
            
            if (userName) {
                userName.textContent = this.currentUser.nombre_completo || this.currentUser.usuario;
            }
            
            if (userBadge) {
                userBadge.textContent = this.userLevel >= 2 ? 'Super Admin' : 'Admin';
                userBadge.style.background = this.userLevel >= 2 ? '#e74c3c' : '#3498db';
            }
            
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';
            
            // Mostrar pestañas de admin según nivel
            if (adminTabs) {
                adminTabs.style.display = this.userLevel >= 2 ? 'block' : 'none';
            }
        }
    }

    hideAdminTabs() {
        const adminTabIds = ['usuarios', 'gestion-usuarios', 'administradores'];
        adminTabIds.forEach(tabId => {
            const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
            if (tabBtn) tabBtn.style.display = 'none';
        });
        
        const currentTab = document.querySelector('.tab-content.active');
        if (currentTab && adminTabIds.includes(currentTab.id)) {
            this.switchTab('ranking-main');
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    setupEventListeners() {
        // Formulario de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const usuario = document.getElementById('loginUsuario')?.value;
                const password = document.getElementById('loginPassword')?.value;
                
                if (!usuario || !password) {
                    this.showNotification('Usuario y contraseña son obligatorios', 'error');
                    return;
                }
                
                await this.login(usuario, password);
            });
        }

        // Botón de login/logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (this.userLevel === 0) {
                    this.showLogin();
                } else {
                    this.logout();
                }
            });
        }

        // Botón de acceso público
        const publicAccessBtn = document.getElementById('publicAccessBtn');
        if (publicAccessBtn) {
            publicAccessBtn.addEventListener('click', () => {
                this.accessAsPublic();
            });
        }

        // Navegación por pestañas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        notifications.appendChild(notification);

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

    async forceReloadData() {
        console.log('🔄 Forzando recarga de datos después del login...');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            if (window.rankingManager) {
                await window.rankingManager.loadRankingMain();
                await window.rankingManager.loadRankingExtra();
                console.log('✅ Rankings recargados');
            }
            
            if (window.equipoManager) {
                await window.equipoManager.loadEquipos();
                console.log('✅ Equipos recargados');
            }
            
            if (window.usuarioManager) {
                await window.usuarioManager.loadUsuarios();
                console.log('✅ Usuarios recargados');
            }
            
            if (window.adminManager && this.userLevel >= 2) {
                await window.adminManager.loadAdministradores();
                console.log('✅ Administradores recargados');
            }
            
            if (window.historialManager) {
                await window.historialManager.loadHistorial();
                console.log('✅ Historial recargado');
            }
            
        } catch (error) {
            console.error('Error recargando datos:', error);
        }
    }
}

// Inicializar el sistema de autenticación
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
=======
  constructor() {
    this.currentUser = null;
    this.userLevel = 0; // 0: Público, 1: Admin, 2: Super Admin
    this.init();
  }

  async init() {
    console.log("🔐 AuthManager inicializando...");

    // Ocultar loading inmediatamente
    this.hideLoading();

    // Configurar event listeners primero
    this.setupEventListeners();

    // Intentar cargar sesión existente
    await this.checkExistingSession();
  }

  async checkExistingSession() {
    try {
      console.log("🔍 Verificando sesión existente...");
      const savedSession = localStorage.getItem("adminSession");

      if (savedSession) {
        const session = JSON.parse(savedSession);
        const sessionAge = Date.now() - session.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas

        if (sessionAge < maxAge) {
          console.log(
            "✅ Sesión válida encontrada, validando usuario:",
            session.usuario
          );
          await this.validateAdminUser(session.usuario);
          return;
        } else {
          console.log("⏰ Sesión expirada, eliminando...");
          localStorage.removeItem("adminSession");
        }
      }

      // Si no hay sesión válida, mostrar acceso público
      console.log("👤 No hay sesión válida, accediendo como público");
      this.accessAsPublic();
    } catch (error) {
      console.error("❌ Error checking session:", error);
      this.accessAsPublic();
    }
  }

  async validateAdminUser(usuario) {
    try {
      console.log("🔑 Validando usuario:", usuario);

      const { data: admin, error } = await window.supabaseClient
        .from("administradores")
        .select("*")
        .eq("usuario", usuario)
        .eq("activo", true)
        .single();

      if (error || !admin) {
        console.error("❌ Admin no encontrado o inactivo:", error);
        this.showNotification("Usuario no autorizado", "error");
        this.accessAsPublic();
        return;
      }

      this.currentUser = admin;
      this.userLevel = admin.nivel_acceso;

      console.log(
        `✅ Usuario validado: ${admin.usuario}, Nivel: ${admin.nivel_acceso}`
      );
      this.showMainApp();
    } catch (error) {
      console.error("❌ Error validating admin:", error);
      this.accessAsPublic();
    }
  }

  async login(usuario, password) {
    try {
      console.log("🔐 Intentando login para:", usuario);

      // Validaciones básicas
      if (!usuario || !password) {
        this.showNotification("Usuario y contraseña son obligatorios", "error");
        return false;
      }

      // Buscar administrador
      const { data: admin, error } = await window.supabaseClient
        .from("administradores")
        .select("*")
        .eq("usuario", usuario)
        .eq("activo", true)
        .single();

      if (error || !admin) {
        console.error("❌ Admin no encontrado o inactivo:", error);
        this.showNotification("Usuario o contraseña incorrectos", "error");
        return false;
      }

      // VERIFICACIÓN SHA-256
      const passwordHash = await this.sha256(password);
      console.log("🔐 Hash ingresado:", passwordHash.substring(0, 10) + "...");
      console.log(
        "🔐 Hash en BD:",
        admin.password_hash.substring(0, 10) + "..."
      );

      if (passwordHash !== admin.password_hash) {
        console.error("❌ Contraseña incorrecta");
        this.showNotification("Usuario o contraseña incorrectos", "error");
        return false;
      }

      this.currentUser = admin;
      this.userLevel = admin.nivel_acceso;

      // Guardar sesión en localStorage
      localStorage.setItem(
        "adminSession",
        JSON.stringify({
          usuario: admin.usuario,
          nivel: admin.nivel_acceso,
          timestamp: Date.now(),
        })
      );

      this.showMainApp();
      this.showNotification(
        `Bienvenido, ${admin.nombre_completo || admin.usuario}`,
        "success"
      );

      // Forzar actualización de datos después del login
      await this.forceReloadData();

      return true;
    } catch (error) {
      console.error("❌ Login error:", error);

      if (error.code === "PGRST116") {
        // Error específico de Supabase cuando no se encuentra el registro
        this.showNotification("Usuario o contraseña incorrectos", "error");
      } else {
        this.showNotification("Error al iniciar sesión", "error");
      }

      return false;
    }
  }

  // Método SHA-256 (reemplaza el md5)
  async sha256(message) {
    try {
      // encode as UTF-8
      const msgBuffer = new TextEncoder().encode(message);

      // hash the message
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

      // convert ArrayBuffer to Array
      const hashArray = Array.from(new Uint8Array(hashBuffer));

      // convert bytes to hex string
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      console.error("❌ Error en SHA-256:", error);
      throw error;
    }
  }

  // Nuevo método para acceso público
  accessAsPublic() {
    this.currentUser = null;
    this.userLevel = 0;
    this.showMainApp();
    console.log("👤 Acceso público activado");
  }

  async logout() {
    console.log("🚪 Cerrando sesión...");

    // Limpiar datos de usuario
    this.currentUser = null;
    this.userLevel = 0;

    // Eliminar sesión almacenada
    localStorage.removeItem("adminSession");

    // Mostrar mensaje y volver a acceso público
    this.showNotification("Sesión cerrada correctamente", "success");
    this.accessAsPublic();
  }

  hideLoading() {
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
  }

  showLogin() {
    const mainApp = document.getElementById("mainApp");
    const loginModal = document.getElementById("loginModal");

    if (mainApp) mainApp.style.display = "none";
    if (loginModal) loginModal.style.display = "flex";

    console.log("🔐 Mostrando pantalla de login");
  }

  showMainApp() {
    console.log("🏠 Mostrando aplicación principal");

    this.hideLoading();

    const loginModal = document.getElementById("loginModal");
    const mainApp = document.getElementById("mainApp");

    if (loginModal) loginModal.style.display = "none";
    if (mainApp) mainApp.style.display = "block";

    // Forzar actualización de UI inmediatamente
    this.updateUI();

    console.log(
      `📊 Estado: Usuario: ${this.currentUser?.usuario || "Público"}, Nivel: ${
        this.userLevel
      }`
    );

    // Cargar datos iniciales con retardo para asegurar que la UI esté lista
    setTimeout(() => {
      this.loadInitialData();
    }, 100);
  }

  // Método para cargar datos iniciales
  // En el método loadInitialData, agrega:
  async loadInitialData() {
    console.log("📊 Cargando datos iniciales...");

    try {
      // Cargar rankings
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
        await window.rankingManager.loadRankingExtra();
        console.log("✅ Rankings cargados");
      }

      // Cargar equipos
      if (window.equipoManager) {
        await window.equipoManager.loadEquipos();
        console.log("✅ Equipos cargados");
      }

      // Cargar usuarios
      if (window.usuarioManager) {
        await window.usuarioManager.loadUsuarios();
        console.log("✅ Usuarios cargados");
      }

      // Cargar administradores solo si es Super Admin
      if (window.adminManager && this.userLevel >= 2) {
        await window.adminManager.loadAdministradores();
        console.log("✅ Administradores cargados");
      }

      // Cargar brackets si existe el manager
      if (window.bracketsManager) {
        // loadBrackets no es async, no necesita await
        window.bracketsManager.loadBrackets();
        console.log("✅ Brackets cargados");
      }

      // Cargar historial si existe
      if (window.historialManager) {
        await window.historialManager.loadHistorial();
        console.log("✅ Historial cargado");
      }

      console.log("🎉 Todos los datos cargados correctamente");
    } catch (error) {
      console.error("❌ Error cargando datos iniciales:", error);
    }
  }

  // Forzar recarga de datos después del login
  async forceReloadData() {
    console.log("🔄 Forzando recarga de datos después del login...");

    // Pequeña pausa para asegurar que la UI se actualice
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Recargar todos los datos
    try {
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
        await window.rankingManager.loadRankingExtra();
        console.log("✅ Rankings recargados");
      }

      if (window.equipoManager) {
        await window.equipoManager.loadEquipos();
        console.log("✅ Equipos recargados");
      }

      if (window.usuarioManager) {
        await window.usuarioManager.loadUsuarios();
        console.log("✅ Usuarios recargados");
      }

      if (window.adminManager && this.userLevel >= 2) {
        await window.adminManager.loadAdministradores();
        console.log("✅ Administradores recargados");
      }

      if (window.bracketsManager) {
        // loadBrackets no es async
        window.bracketsManager.loadBrackets();
        console.log("✅ Brackets recargados");
      }

      if (window.historialManager) {
        await window.historialManager.loadHistorial();
        console.log("✅ Historial recargado");
      }
    } catch (error) {
      console.error("❌ Error recargando datos:", error);
    }
  }

  updateUI() {
    const userInfo = document.getElementById("userInfo");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminTabs = document.getElementById("adminTabs");
    const userName = document.getElementById("userName");
    const userBadge = document.getElementById("userBadge");

    if (!userInfo || !logoutBtn) return;

    if (this.userLevel === 0) {
      // Modo público
      userInfo.innerHTML = "<span>👤 Modo Público</span>";

      if (logoutBtn) {
        logoutBtn.innerHTML =
          '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        logoutBtn.className = "btn btn-primary";
      }

      if (adminTabs) adminTabs.style.display = "none";

      // Ocultar pestañas de administración
      this.hideAdminTabs();
    } else {
      // Modo administrador
      const nombreMostrar =
        this.currentUser.nombre_completo || this.currentUser.usuario;

      if (userName) userName.textContent = nombreMostrar;

      if (userBadge) {
        userBadge.textContent = this.userLevel >= 2 ? "Super Admin" : "Admin";
        userBadge.className =
          "user-badge " + (this.userLevel >= 2 ? "super-admin" : "admin");
      }

      if (logoutBtn) {
        logoutBtn.innerHTML =
          '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';
        logoutBtn.className = "btn btn-outline";
      }

      // Mostrar pestañas de admin según nivel
      if (adminTabs) {
        if (this.userLevel >= 2) {
          adminTabs.style.display = "block";
        } else {
          adminTabs.style.display = "none";
        }
      }
    }
  }

  hideAdminTabs() {
    // Ocultar pestañas de administración
    const adminTabIds = ["usuarios", "gestion-usuarios", "administradores"];
    adminTabIds.forEach((tabId) => {
      const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
      if (tabBtn) {
        tabBtn.style.display = "none";
        tabBtn.classList.remove("active");
      }
    });

    // Si está en una pestaña admin, redirigir a ranking
    const currentTab = document.querySelector(".tab-content.active");
    if (currentTab && adminTabIds.includes(currentTab.id)) {
      this.switchTab("ranking-main");
    }
  }

  switchTab(tabName) {
    console.log(`📌 Cambiando a pestaña: ${tabName}`);

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

    // Cargar datos específicos de la pestaña
    // Usar setTimeout para asegurar que la UI se actualice primero
    setTimeout(() => {
      this.loadTabData(tabName);
    }, 100);
  }

  // En el método loadTabData, agrega el caso para brackets
  loadTabData(tabName) {
    console.log(`📌 Cargando datos para pestaña: ${tabName}`);

    switch (tabName) {
      case "ranking-main":
        if (window.rankingManager) window.rankingManager.loadRankingMain();
        break;
      case "ranking-extra":
        if (window.rankingManager) window.rankingManager.loadRankingExtra();
        break;
      case "usuarios":
        if (window.usuarioManager) window.usuarioManager.loadUsuarios();
        break;
      case "equipos":
        if (window.equipoManager) window.equipoManager.loadEquipos();
        break;
      case "gestion-usuarios":
        // Los datos de usuarios ya se cargan cuando se selecciona un usuario
        break;
      case "administradores":
        if (window.adminManager && this.userLevel >= 2) {
          window.adminManager.loadAdministradores();
        }
        break;
      case "brackets":
        if (window.bracketsManager) {
          // Cargar brackets (esto es síncrono)
          window.bracketsManager.loadBrackets();
        }
        break;
    }
  }

  setupEventListeners() {
    console.log("🔧 Configurando event listeners de autenticación");

    // Formulario de login
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
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
    }

    // Botón de login/logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (this.userLevel === 0) {
          // Si es público, mostrar login
          this.showLogin();
        } else {
          // Si es admin, cerrar sesión
          this.logout();
        }
      });
    }

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

        // Verificar permisos para pestañas admin
        if (tabName === "administradores" && this.userLevel < 2) {
          this.showNotification(
            "Se requiere Super Admin para acceder a esta sección",
            "error"
          );
          return;
        }

        if (tabName === "gestion-usuarios" && this.userLevel < 1) {
          this.showNotification(
            "Se requiere Admin para acceder a esta sección",
            "error"
          );
          return;
        }

        this.switchTab(tabName);
      });
    });
  }

  showNotification(message, type = "info") {
    console.log(`📢 Notificación (${type}): ${message}`);

    const notifications = document.getElementById("notifications");
    if (!notifications) return;

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.opacity = "0";
    notification.style.transform = "translateY(-10px)";

    notifications.appendChild(notification);

    // Animación de entrada
    setTimeout(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateY(0)";
      notification.style.transition = "all 0.3s ease";
    }, 10);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = "0";
        notification.style.transform = "translateY(-10px)";

        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
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
    const hasAccess = this.userLevel >= requiredLevel;
    if (!hasAccess) {
      console.log(
        `🚫 Acceso denegado: Se requiere nivel ${requiredLevel}, usuario tiene nivel ${this.userLevel}`
      );
    }
    return hasAccess;
  }
}

// Inicializar el sistema de autenticación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM cargado, inicializando AuthManager...");
  window.authManager = new AuthManager();
});
>>>>>>> Stashed changes

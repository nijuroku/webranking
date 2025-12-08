class AdminManager {
  constructor() {
    this.administradores = [];
    this.setupEventListeners();
  }

  async loadAdministradores() {
    try {
      console.log("📋 Cargando administradores...");

      // Verificar permisos ANTES de hacer la consulta
      if (!window.authManager || !window.authManager.hasAccess(2)) {
        console.log("❌ No tiene permisos para ver administradores");
        return;
      }

      const { data: administradores, error } = await window.supabaseClient
        .from("administradores")
        .select("*")
        .order("nivel_acceso", { ascending: false })
        .order("usuario");

      if (error) {
        console.error("Error en consulta:", error);
        throw error;
      }

      this.administradores = administradores;
      this.renderAdministradores();

      console.log(`✅ ${administradores.length} administradores cargados`);
    } catch (error) {
      console.error("Error loading admins:", error);
      if (window.authManager) {
        window.authManager.showNotification(
          "Error al cargar los administradores",
          "error"
        );
      }
    }
  }

  async crearAdministrador(usuario, password, nombreCompleto, nivelAcceso) {
    // VERIFICAR PERMISOS
    if (!window.authManager || !window.authManager.hasAccess(2)) {
      window.authManager.showNotification(
        "Solo Super Admins pueden crear administradores",
        "error"
      );
      return false;
    }

    try {
      console.log("🆕 Creando nuevo administrador:", usuario);

      // Usar SHA-256 (mismo método que auth.js)
      const passwordHash = await this.sha256(password);

      const { data, error } = await window.supabaseClient
        .from("administradores")
        .insert([
          {
            usuario: usuario,
            password_hash: passwordHash,
            nombre_completo: nombreCompleto,
            nivel_acceso: parseInt(nivelAcceso),
            activo: true,
          },
        ])
        .select();

      if (error) throw error;

      window.authManager.showNotification(
        `Administrador "${usuario}" creado correctamente`,
        "success"
      );
      await this.loadAdministradores();
      return true;
    } catch (error) {
      console.error("Error creating admin:", error);

      if (error.code === "23505") {
        window.authManager.showNotification("El usuario ya existe", "error");
      } else {
        window.authManager.showNotification(
          "Error al crear administrador: " + error.message,
          "error"
        );
      }
      return false;
    }
  }

  async sha256(message) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      console.error("Error en SHA-256:", error);
      throw error;
    }
  }

  async toggleEstadoAdmin(adminId) {
    if (!window.authManager || !window.authManager.hasAccess(2)) {
      window.authManager.showNotification(
        "Solo Super Admins pueden modificar administradores",
        "error"
      );
      return false;
    }

    const admin = this.administradores.find((a) => a.id === adminId);
    if (!admin) {
      window.authManager.showNotification(
        "Administrador no encontrado",
        "error"
      );
      return false;
    }

    // No permitir desactivarse a sí mismo
    const currentUser = window.authManager.getCurrentUser();
    if (currentUser && admin.id === currentUser.id) {
      window.authManager.showNotification(
        "No puedes desactivar tu propia cuenta",
        "error"
      );
      return false;
    }

    const nuevoEstado = !admin.activo;

    try {
      const { error } = await window.supabaseClient
        .from("administradores")
        .update({ activo: nuevoEstado })
        .eq("id", adminId);

      if (error) throw error;

      const estadoTexto = nuevoEstado ? "activado" : "desactivado";
      window.authManager.showNotification(
        `Administrador "${admin.usuario}" ${estadoTexto} correctamente`,
        "success"
      );

      await this.loadAdministradores();
      return true;
    } catch (error) {
      console.error("Error toggling admin status:", error);
      window.authManager.showNotification(
        "Error al cambiar estado del administrador",
        "error"
      );
      return false;
    }
  }

  async eliminarAdministrador(adminId) {
    if (!window.authManager || !window.authManager.hasAccess(2)) {
      window.authManager.showNotification(
        "Solo Super Admins pueden eliminar administradores",
        "error"
      );
      return false;
    }

    const admin = this.administradores.find((a) => a.id === adminId);
    if (!admin) {
      window.authManager.showNotification(
        "Administrador no encontrado",
        "error"
      );
      return false;
    }

    // No permitir eliminarse a sí mismo
    const currentUser = window.authManager.getCurrentUser();
    if (currentUser && admin.id === currentUser.id) {
      window.authManager.showNotification(
        "No puedes eliminar tu propia cuenta",
        "error"
      );
      return false;
    }

    // Confirmación
    if (
      !confirm(
        `¿Estás seguro de eliminar al administrador "${admin.usuario}"?\n\nEsta acción no se puede deshacer.`
      )
    ) {
      return false;
    }

    try {
      const { error } = await window.supabaseClient
        .from("administradores")
        .delete()
        .eq("id", adminId);

      if (error) throw error;

      window.authManager.showNotification(
        `Administrador "${admin.usuario}" eliminado correctamente`,
        "success"
      );
      await this.loadAdministradores();
      return true;
    } catch (error) {
      console.error("Error deleting admin:", error);

      if (error.code === "23503") {
        window.authManager.showNotification(
          "No se puede eliminar el administrador porque tiene registros relacionados",
          "error"
        );
      } else {
        window.authManager.showNotification(
          "Error al eliminar administrador",
          "error"
        );
      }
      return false;
    }
  }

  renderAdministradores() {
    const tbody = document.getElementById("tbodyAdmins");
    if (!tbody) {
      console.error("❌ No se encontró tbodyAdmins en el DOM");
      return;
    }

    tbody.innerHTML = "";

    if (this.administradores.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">
                        No hay administradores registrados
                    </td>
                </tr>
            `;
      return;
    }

    const currentUser = window.authManager
      ? window.authManager.getCurrentUser()
      : null;
    const esSuperAdmin = currentUser ? window.authManager.hasAccess(2) : false;

    this.administradores.forEach((admin) => {
      const nivelTexto =
        admin.nivel_acceso >= 2 ? "Super Admin" : "Admin Normal";
      const estadoTexto = admin.activo
        ? '<span class="badge badge-success">✅ Activo</span>'
        : '<span class="badge badge-danger">❌ Inactivo</span>';

      const fechaCorta = new Date(admin.fecha_creacion).toLocaleDateString(
        "es-ES"
      );

      // Determinar si mostrar botones
      const esUsuarioActual = currentUser && admin.id === currentUser.id;
      const puedeEliminar = esSuperAdmin && !esUsuarioActual;
      const puedeToggle = esSuperAdmin && !esUsuarioActual;

      const row = document.createElement("tr");

      if (esUsuarioActual) {
        row.classList.add("current-user");
      }

      row.innerHTML = `
                <td>
                    <div class="admin-usuario">
                        ${admin.usuario}
                        ${
                          esUsuarioActual
                            ? '<span class="badge-you">(Tú)</span>'
                            : ""
                        }
                    </div>
                </td>
                <td>${admin.nombre_completo || "-"}</td>
                <td>
                    <span class="badge ${
                      admin.nivel_acceso >= 2 ? "badge-danger" : "badge-primary"
                    }">
                        ${nivelTexto}
                    </span>
                </td>
                <td>${estadoTexto}</td>
                <td>${fechaCorta}</td>
                <td>
                    <div class="admin-actions">
                        ${
                          puedeToggle
                            ? `
                            <button class="btn btn-warning btn-small toggle-admin" 
                                    data-admin-id="${admin.id}"
                                    data-admin-usuario="${admin.usuario}"
                                    title="${
                                      admin.activo ? "Desactivar" : "Activar"
                                    }">
                                <i class="fas fa-power-off"></i>
                            </button>
                        `
                            : ""
                        }
                        
                        ${
                          puedeEliminar
                            ? `
                            <button class="btn btn-danger btn-small delete-admin" 
                                    data-admin-id="${admin.id}"
                                    data-admin-usuario="${admin.usuario}"
                                    title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        `
                            : ""
                        }
                        
                        ${
                          !puedeToggle && !puedeEliminar
                            ? '<span class="text-muted" title="No disponible para tu cuenta">-</span>'
                            : ""
                        }
                    </div>
                </td>
            `;

      tbody.appendChild(row);
    });

    // Agregar event listeners DESPUÉS de renderizar
    this.bindAdminActions();
  }

  bindAdminActions() {
    const tbody = document.getElementById("tbodyAdmins");
    if (!tbody) return;

    // Remover listeners anteriores para evitar duplicados
    tbody.querySelectorAll(".toggle-admin").forEach((btn) => {
      btn.replaceWith(btn.cloneNode(true));
    });

    tbody.querySelectorAll(".delete-admin").forEach((btn) => {
      btn.replaceWith(btn.cloneNode(true));
    });

    // Agregar nuevos listeners
    tbody.addEventListener("click", async (e) => {
      const target = e.target;

      // Buscar el botón clicado (o sus hijos)
      const toggleBtn = target.closest(".toggle-admin");
      const deleteBtn = target.closest(".delete-admin");

      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();

        const adminId = toggleBtn.getAttribute("data-admin-id");
        const adminUsuario = toggleBtn.getAttribute("data-admin-usuario");

        console.log(
          `🔄 Activando/Desactivando admin: ${adminUsuario} (ID: ${adminId})`
        );
        await this.toggleEstadoAdmin(adminId);
      }

      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();

        const adminId = deleteBtn.getAttribute("data-admin-id");
        const adminUsuario = deleteBtn.getAttribute("data-admin-usuario");

        console.log(`🗑️ Eliminando admin: ${adminUsuario} (ID: ${adminId})`);
        await this.eliminarAdministrador(adminId);
      }
    });
  }

  setupEventListeners() {
    console.log("🔧 Configurando event listeners para AdminManager");

    // 1. Formulario para crear administrador
    const formCrearAdmin = document.getElementById("formCrearAdmin");
    if (formCrearAdmin) {
      formCrearAdmin.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!window.authManager || !window.authManager.hasAccess(2)) {
          window.authManager.showNotification(
            "Solo Super Admins pueden crear administradores",
            "error"
          );
          return;
        }

        const usuario = document.getElementById("nuevoAdminUsuario").value;
        const password = document.getElementById("nuevoAdminPassword").value;
        const nombreCompleto =
          document.getElementById("nuevoAdminNombre").value;
        const nivelAcceso = document.getElementById("nuevoAdminNivel").value;

        if (!usuario || !password) {
          window.authManager.showNotification(
            "Usuario y contraseña son obligatorios",
            "error"
          );
          return;
        }

        if (password.length < 6) {
          window.authManager.showNotification(
            "La contraseña debe tener al menos 6 caracteres",
            "error"
          );
          return;
        }

        if (
          await this.crearAdministrador(
            usuario,
            password,
            nombreCompleto,
            nivelAcceso
          )
        ) {
          e.target.reset();
          document.getElementById("nuevoAdminNivel").value = "1";
        }
      });
    }

    // 2. Botón para actualizar lista
    const refreshAdminsBtn = document.getElementById("refreshAdmins");
    if (refreshAdminsBtn) {
      refreshAdminsBtn.addEventListener("click", () => {
        this.loadAdministradores();
      });
    }

    // 3. Cargar cuando se haga clic en la pestaña
    const adminTabBtn = document.querySelector('[data-tab="administradores"]');
    if (adminTabBtn) {
      adminTabBtn.addEventListener("click", () => {
        // Pequeño retraso para asegurar que la pestaña esté visible
        setTimeout(() => {
          this.loadAdministradores();
        }, 100);
      });
    }

    // 4. También cargar si la pestaña ya está activa al cargar la página
    setTimeout(() => {
      const adminTab = document.getElementById("administradores");
      if (adminTab && adminTab.classList.contains("active")) {
        this.loadAdministradores();
      }
    }, 1500);
  }
}

// Inicializar el manager de administradores
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!window.adminManager) {
      window.adminManager = new AdminManager();
      console.log("✅ AdminManager inicializado");

      // Verificar si ya estamos en la pestaña de administradores
      const adminTab = document.getElementById("administradores");
      if (adminTab && adminTab.classList.contains("active")) {
        window.adminManager.loadAdministradores();
      }
    }
  }, 1000);
});

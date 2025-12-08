class UsuarioManager {
  constructor() {
    this.usuarios = [];
    this.usuariosOrdenados = []; // Para mantener el orden por puntos
    this.setupEventListeners();
  }

  async loadUsuarios() {
    try {
      const { data: usuarios, error } = await window.supabaseClient
        .from("usuarios")
        .select(
          `
                    *,
                    equipos (nombre, tag)
                `
        )
        .order("nombre");

      if (error) throw error;

      this.usuarios = usuarios;
      this.usuariosOrdenados = [...usuarios].sort(
        (a, b) => b.puntos_main - a.puntos_main
      );

      this.updateUsuarioSelects();
      this.renderListadoUsuarios(); // Nueva función
    } catch (error) {
      console.error("Error loading users:", error);
      window.authManager.showNotification(
        "Error al cargar los usuarios",
        "error"
      );
    }
  }
  // NUEVO MÉTODO: Renderizar listado de usuarios
  renderListadoUsuarios() {
    const tbody = document.getElementById("tbodyUsuariosList");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (this.usuarios.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">
                        No hay usuarios registrados
                    </td>
                </tr>
            `;
      return;
    }

    this.usuarios.forEach((usuario, index) => {
      const posicion = this.obtenerPosicionUsuario(usuario.id);
      const equipoTag = usuario.equipos?.tag || "SIN";
      const equipoNombre = usuario.equipos?.nombre || "Sin Equipo";

      // Determinar emoji según posición
      let emoji = "";
      if (posicion === 1) emoji = "🥇";
      else if (posicion === 2) emoji = "🥈";
      else if (posicion === 3) emoji = "🥉";
      else if (posicion <= 10) emoji = "⭐";

      // Crear nombre con TAG al inicio
      const nombreConTag = `<strong>[#${equipoTag}]</strong> ${usuario.nombre}`;

      const row = document.createElement("tr");

      // Aplicar clases según posición
      if (posicion === 1) row.classList.add("first-place");
      else if (posicion === 2) row.classList.add("second-place");
      else if (posicion === 3) row.classList.add("third-place");
      else if (posicion <= 10) row.classList.add("top-ten");

      row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <div class="usuario-con-tag">
                        ${nombreConTag}
                    </div>
                </td>
                <td>
                    <div class="equipo-info">
                        <span class="tag-badge">#${equipoTag}</span>
                        <span class="equipo-nombre">${equipoNombre}</span>
                    </div>
                </td>
                <td>
                    <span class="puntos-main">${usuario.puntos_main}</span>
                    <span class="puntos-trend ${this.obtenerTendencia(
                      usuario.id
                    )}">
                        ${this.obtenerIconoTendencia(usuario.id)}
                    </span>
                </td>
                <td>
                    <span class="posicion-badge">
                        ${emoji} #${posicion}
                    </span>
                </td>
            `;

      tbody.appendChild(row);
    });
  }

  // Método auxiliar para obtener posición
  obtenerPosicionUsuario(usuarioId) {
    const index = this.usuariosOrdenados.findIndex((u) => u.id === usuarioId);
    return index !== -1 ? index + 1 : 0;
  }

  // Métodos auxiliares para tendencia (puedes implementar lógica real)
  obtenerTendencia(usuarioId) {
    // Aquí puedes implementar lógica real de tendencia
    // Por ahora devolvemos un valor aleatorio para ejemplo
    const tendencias = ["up", "down", "neutral"];
    return tendencias[Math.floor(Math.random() * tendencias.length)];
  }

  obtenerIconoTendencia(usuarioId) {
    const tendencia = this.obtenerTendencia(usuarioId);
    if (tendencia === "up") return "↗️";
    if (tendencia === "down") return "↘️";
    return "➡️";
  }

  updateUsuarioSelects() {
    const selects = [
      "usuarioPuntosMain",
      "usuarioPuntosExtra",
      "selectUsuarioGestion",
    ];

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = '<option value="">Seleccionar usuario...</option>';

        this.usuarios.forEach((usuario) => {
          const equipoTag = usuario.equipos?.tag || "SIN";
          const displayText = `[#${equipoTag}] ${usuario.nombre}`;

          const option = document.createElement("option");
          option.value = usuario.id;
          option.textContent = displayText;
          select.appendChild(option);
        });
      }
    });
  }

  // MÉTODO agregarUsuario - ACTUALIZADO
  async agregarUsuario(nombre, equipoId, puntosIniciales = 0) {
    if (!window.authManager.hasAccess(1)) {
      window.authManager.showNotification(
        "No tienes permisos para agregar usuarios",
        "error"
      );
      return false;
    }

    try {
      // Obtener información del equipo si existe
      let equipoInfo = null;
      if (equipoId) {
        const { data: equipoData } = await window.supabaseClient
          .from("equipos")
          .select("*")
          .eq("id", equipoId)
          .single();
        equipoInfo = equipoData;
      }

      // Crear usuario
      const { data, error } = await window.supabaseClient
        .from("usuarios")
        .insert([
          {
            nombre: nombre,
            equipo_id: equipoId,
            puntos_main: parseInt(puntosIniciales),
          },
        ])
        .select();

      if (error) throw error;

      const nuevoUsuario = data[0];
      window.authManager.showNotification(
        `Usuario "${nombre}" agregado correctamente`,
        "success"
      );

      // REGISTRAR EN HISTORIAL SI HAY PUNTOS INICIALES - CORREGIDO
      if (puntosIniciales > 0 && window.historialManager) {
        const admin = window.authManager.getCurrentUser();
        const usuarioConEquipo = {
          ...nuevoUsuario,
          equipos: equipoInfo,
        };

        await window.historialManager.registrarPuntos(
          admin,
          usuarioConEquipo,
          parseInt(puntosIniciales),
          "inicial",
          "Puntos iniciales al crear usuario"
        );
      }

      await this.loadUsuarios();
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
      }
      return true;
    } catch (error) {
      console.error("Error adding user:", error);

      if (error.code === "23505") {
        window.authManager.showNotification(
          "El nombre de usuario ya existe",
          "error"
        );
      } else {
        window.authManager.showNotification(
          "Error al agregar usuario",
          "error"
        );
      }
      return false;
    }
  }

  async sumarPuntosMain(usuarioId, puntos) {
    if (!window.authManager.hasAccess(1)) {
      window.authManager.showNotification(
        "No tienes permisos para esta acción",
        "error"
      );
      return false;
    }

    try {
      // Obtener puntos actuales
      const { data: usuario, error: errorGet } = await window.supabaseClient
        .from("usuarios")
        .select("puntos_main")
        .eq("id", usuarioId)
        .single();

      if (errorGet) throw errorGet;

      const nuevosPuntos = usuario.puntos_main + parseInt(puntos);

      const { error } = await window.supabaseClient
        .from("usuarios")
        .update({ puntos_main: nuevosPuntos })
        .eq("id", usuarioId);

      if (error) throw error;

      // Obtener información completa del usuario para el historial
      const { data: usuarioCompleto, error: errorUsuario } =
        await window.supabaseClient
          .from("usuarios")
          .select(
            `
                *,
                equipos (id, nombre, tag)
            `
          )
          .eq("id", usuarioId)
          .single();

      const usuarioNombre =
        usuarioCompleto?.nombre ||
        this.usuarios.find((u) => u.id === usuarioId)?.nombre;

      window.authManager.showNotification(
        `${puntos} puntos sumados a ${usuarioNombre}`,
        "success"
      );

      // REGISTRAR EN HISTORIAL - CORREGIDO
      if (window.historialManager) {
        const admin = window.authManager.getCurrentUser();
        await window.historialManager.registrarPuntos(
          admin,
          usuarioCompleto || { id: usuarioId, nombre: usuarioNombre },
          parseInt(puntos),
          "main",
          "Suma de puntos principales"
        );
      }

      await this.loadUsuarios();
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
      }
      return true;
    } catch (error) {
      console.error("Error adding points:", error);
      window.authManager.showNotification("Error al sumar puntos", "error");
      return false;
    }
  }

  // MÉTODO sumarPuntosExtra - ACTUALIZADO
  async sumarPuntosExtra(usuarioId, puntos, evento) {
    try {
      // Obtener información del usuario primero para el historial
      const { data: usuarioData, error: errorUsuario } =
        await window.supabaseClient
          .from("usuarios")
          .select(
            `
                *,
                equipos (id, nombre, tag)
            `
          )
          .eq("id", usuarioId)
          .single();

      if (errorUsuario) {
        throw errorUsuario;
      }

      // Insertar puntos extra
      const { data, error } = await window.supabaseClient
        .from("ranking_extra")
        .insert([
          {
            usuario_id: usuarioId,
            puntos_extra: parseInt(puntos),
            evento_nombre: evento,
          },
        ])
        .select();

      if (error) throw error;

      window.authManager.showNotification(
        `${puntos} puntos extra sumados a ${usuarioData.nombre}`,
        "success"
      );

      // REGISTRAR EN HISTORIAL - CORREGIDO
      if (window.historialManager) {
        const admin = window.authManager.getCurrentUser();
        // Si no hay admin (modo público), no registrar
        if (admin) {
          await window.historialManager.registrarPuntos(
            admin,
            usuarioData,
            parseInt(puntos),
            "extra",
            "Suma de puntos extra",
            evento
          );
        }
      }

      if (window.rankingManager) {
        await window.rankingManager.loadRankingExtra();
      }
      return true;
    } catch (error) {
      console.error("Error adding extra points:", error);
      window.authManager.showNotification(
        "Error al sumar puntos extra",
        "error"
      );
      return false;
    }
  }

  async cargarUsuarioGestion(usuarioId) {
    try {
      const { data: usuario, error } = await window.supabaseClient
        .from("usuarios")
        .select(
          `
                    *,
                    equipos (id, nombre, tag)
                `
        )
        .eq("id", usuarioId)
        .single();

      if (error) throw error;

      this.mostrarUsuarioGestion(usuario);
    } catch (error) {
      console.error("Error loading user for management:", error);
      window.authManager.showNotification("Error al cargar usuario", "error");
    }
  }

  mostrarUsuarioGestion(usuario) {
    document.getElementById("infoId").textContent = usuario.id;
    document.getElementById("infoPosicion").textContent = this.obtenerPosicion(
      usuario.id
    );
    document.getElementById("infoCreacion").textContent = new Date(
      usuario.fecha_creacion
    ).toLocaleDateString();

    document.getElementById("editUsuarioNombre").value = usuario.nombre;
    document.getElementById("editUsuarioPuntos").value = usuario.puntos_main;

    // Seleccionar equipo
    const equipoSelect = document.getElementById("editUsuarioEquipo");
    if (usuario.equipos) {
      equipoSelect.value = usuario.equipos.id;
    }

    document.getElementById("usuarioInfo").style.display = "block";
  }

  obtenerPosicion(usuarioId) {
    const usuario = this.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return "-";

    const sorted = [...this.usuarios].sort(
      (a, b) => b.puntos_main - a.puntos_main
    );
    const posicion = sorted.findIndex((u) => u.id === usuarioId) + 1;
    return `#${posicion}`;
  }

  async guardarCambiosUsuario(usuarioId, nuevosDatos) {
    if (!window.authManager.hasAccess(1)) {
      window.authManager.showNotification(
        "No tienes permisos para esta acción",
        "error"
      );
      return false;
    }

    try {
      const { error } = await window.supabaseClient
        .from("usuarios")
        .update(nuevosDatos)
        .eq("id", usuarioId);

      if (error) throw error;

      window.authManager.showNotification(
        "Usuario actualizado correctamente",
        "success"
      );
      await this.loadUsuarios();
      await window.rankingManager.loadRankingMain();
      return true;
    } catch (error) {
      console.error("Error updating user:", error);
      window.authManager.showNotification(
        "Error al actualizar usuario",
        "error"
      );
      return false;
    }
  }

  // MÉTODO eliminarUsuario - AGREGAR HISTORIAL
  async eliminarUsuario(usuarioId) {
    if (!window.authManager.hasAccess(1)) {
      window.authManager.showNotification(
        "No tienes permisos para eliminar usuarios",
        "error"
      );
      return false;
    }

    const usuario = this.usuarios.find((u) => u.id === usuarioId);
    if (!usuario) return false;

    if (!confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
      return false;
    }

    try {
      // Primero obtener información completa para el historial
      const { data: usuarioCompleto, error: errorUsuario } =
        await window.supabaseClient
          .from("usuarios")
          .select(
            `
                *,
                equipos (id, nombre, tag)
            `
          )
          .eq("id", usuarioId)
          .single();

      // Primero eliminar puntos extra
      await window.supabaseClient
        .from("ranking_extra")
        .delete()
        .eq("usuario_id", usuarioId);

      // Luego eliminar usuario
      const { error } = await window.supabaseClient
        .from("usuarios")
        .delete()
        .eq("id", usuarioId);

      if (error) throw error;

      window.authManager.showNotification(
        `Usuario "${usuario.nombre}" eliminado correctamente`,
        "success"
      );

      // REGISTRAR EN HISTORIAL - CORREGIDO
      if (window.historialManager && usuarioCompleto) {
        const admin = window.authManager.getCurrentUser();
        await window.historialManager.registrarPuntos(
          admin,
          usuarioCompleto,
          0,
          "limpieza",
          "Usuario eliminado del sistema",
          null,
          `Se eliminó el usuario "${usuario.nombre}" y todos sus puntos`
        );
      }

      await this.loadUsuarios();
      if (window.rankingManager) {
        await window.rankingManager.loadRankingMain();
      }
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      window.authManager.showNotification("Error al eliminar usuario", "error");
      return false;
    }
  }

  setupEventListeners() {
    // Agregar usuario
    document
      .getElementById("formAgregarUsuario")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nuevoUsuarioNombre").value;
        const equipoId = document.getElementById("nuevoUsuarioEquipo").value;
        const puntos = document.getElementById("nuevoUsuarioPuntos").value || 0;

        if (await this.agregarUsuario(nombre, equipoId, puntos)) {
          e.target.reset();
        }
      });

    // Sumar puntos main
    document
      .getElementById("formSumarPuntosMain")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuarioId = document.getElementById("usuarioPuntosMain").value;
        const puntos = document.getElementById("cantidadPuntosMain").value;

        if (await this.sumarPuntosMain(usuarioId, puntos)) {
          e.target.reset();
        }
      });

    // Sumar puntos extra
    document
      .getElementById("formSumarPuntosExtra")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const usuarioId = document.getElementById("usuarioPuntosExtra").value;
        const puntos = document.getElementById("cantidadPuntosExtra").value;
        const evento = document.getElementById("eventoPuntos").value;

        if (await this.sumarPuntosExtra(usuarioId, puntos, evento)) {
          e.target.reset();
        }
      });

    // Gestión de usuarios
    document
      .getElementById("selectUsuarioGestion")
      .addEventListener("change", (e) => {
        if (e.target.value) {
          this.cargarUsuarioGestion(e.target.value);
        } else {
          document.getElementById("usuarioInfo").style.display = "none";
        }
      });

    // Guardar cambios usuario
    document
      .getElementById("guardarUsuario")
      .addEventListener("click", async () => {
        const usuarioId = document.getElementById("selectUsuarioGestion").value;
        const nuevosDatos = {
          nombre: document.getElementById("editUsuarioNombre").value,
          equipo_id: document.getElementById("editUsuarioEquipo").value,
          puntos_main: parseInt(
            document.getElementById("editUsuarioPuntos").value
          ),
        };

        if (await this.guardarCambiosUsuario(usuarioId, nuevosDatos)) {
          // Recargar datos del usuario
          this.cargarUsuarioGestion(usuarioId);
        }
        if (!window.authManager.hasAccess(1)) {
          window.authManager.showNotification(
            "No tienes permisos para esta acción",
            "error"
          );
          return false;
        }
      });

    // Eliminar usuario
    document
      .getElementById("eliminarUsuario")
      .addEventListener("click", async () => {
        const usuarioId = document.getElementById("selectUsuarioGestion").value;
        if (await this.eliminarUsuario(usuarioId)) {
          document.getElementById("selectUsuarioGestion").value = "";
          document.getElementById("usuarioInfo").style.display = "none";
        }
        if (!window.authManager.hasAccess(1)) {
          window.authManager.showNotification(
            "No tienes permisos para esta acción",
            "error"
          );
          return false;
        }
      });
    // Nuevo event listener para actualizar listado
    document
      .getElementById("refreshUsuariosList")
      ?.addEventListener("click", () => {
        this.loadUsuarios();
      });

    // Cargar usuarios cuando se muestre la pestaña
    document
      .querySelector('[data-tab="usuarios"]')
      ?.addEventListener("click", () => {
        this.loadUsuarios();
      });
  }
}

// Inicializar el manager de usuarios
window.usuarioManager = new UsuarioManager();

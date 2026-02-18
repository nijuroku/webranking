class EquipoManager {
  constructor() {
    this.equipos = [];
    this.isLoading = false;
    this.lastLoadTime = 0;
    this.loadDelay = 1000; // 1 segundo entre cargas
    this.setupEventListeners();
  }
  async loadEquipos() {
    // Evitar múltiples cargas simultáneas
    if (this.isLoading) {
      console.log("⚠️ loadEquipos ya está en ejecución, ignorando llamada...");
      return;
    }

    // Verificar si se cargó recientemente
    const now = Date.now();
    if (now - this.lastLoadTime < this.loadDelay) {
      console.log("⚠️ loadEquipos llamado demasiado rápido, ignorando...");
      return;
    }

    try {
      this.isLoading = true;
      console.log("🔄 Cargando equipos...");

      const { data: equipos, error } = await window.supabaseClient
        .from("equipos")
        .select("*")
        .order("nombre");

      if (error) throw error;

      // Limpiar el array antes de asignar nuevos datos
      this.equipos = equipos || [];

      // Actualizar selects y renderizar solo si hay cambios
      this.updateEquipoSelects();
      await this.renderEquipos();

      this.lastLoadTime = Date.now();
    } catch (error) {
      console.error("❌ Error loading teams:", error);
      if (window.authManager) {
        window.authManager.showNotification(
          "Error al cargar los equipos",
          "error"
        );
      }
    } finally {
      this.isLoading = false;
    }
  }

  updateEquipoSelects() {
    const selects = ["nuevoUsuarioEquipo", "editUsuarioEquipo"];

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (select) {
        // Solo actualizar si el select existe
        select.innerHTML = '<option value="">Seleccionar equipo...</option>';

        this.equipos.forEach((equipo) => {
          const option = document.createElement("option");
          option.value = equipo.id;
          option.textContent = equipo.nombre;
          select.appendChild(option);
        });
      }
    });
  }

  async renderEquipos() {
    const tbody = document.getElementById("tbodyEquipos");
    if (!tbody) {
      console.log("⚠️ tbodyEquipos no encontrado");
      return;
    }

    // Limpiar el tbody antes de renderizar
    tbody.innerHTML = "";

    if (this.equipos.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">No hay equipos registrados</td>
                </tr>
            `;
      return;
    }

    // Usar Promise.all para obtener los datos de usuarios en paralelo
    const equiposConDatos = await Promise.all(
      this.equipos.map(async (equipo) => {
        try {
          const { data: usuarios, error } = await window.supabaseClient
            .from("usuarios")
            .select("puntos_main")
            .eq("equipo_id", equipo.id);

          if (error) {
            console.error(
              `Error obteniendo usuarios para equipo ${equipo.id}:`,
              error
            );
            return { ...equipo, miembros: 0, puntosTotales: 0 };
          }

          const miembros = usuarios ? usuarios.length : 0;
          const puntosTotales = usuarios
            ? usuarios.reduce((sum, user) => sum + (user.puntos_main || 0), 0)
            : 0;

          return { ...equipo, miembros, puntosTotales };
        } catch (error) {
          console.error(`Error procesando equipo ${equipo.id}:`, error);
          return { ...equipo, miembros: 0, puntosTotales: 0 };
        }
      })
    );

    // Renderizar todos los equipos de una vez
    equiposConDatos.forEach((equipo) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                <td>${equipo.nombre}</td>
                <td><span class="tag-badge">#${equipo.tag}</span></td>
                <td>${equipo.miembros}</td>
                <td><strong>${equipo.puntosTotales}</strong></td>
                <td>
                    <button class="btn btn-danger btn-small" data-equipo-id="${equipo.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            `;

      tbody.appendChild(row);
    });

    // Agregar event listeners a los botones de eliminar
    tbody.querySelectorAll(".btn-danger").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const equipoId = btn.getAttribute("data-equipo-id");
        await this.eliminarEquipo(equipoId);
      });
    });
  }

  setupEventListeners() {
    // Crear equipo
    const formCrearEquipo = document.getElementById("formCrearEquipo");
    if (formCrearEquipo) {
      formCrearEquipo.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nuevoEquipoNombre").value;
        const tag = document.getElementById("nuevoEquipoTag").value;

        if (tag.length > 5) {
          window.authManager.showNotification(
            "El TAG no puede tener más de 5 caracteres",
            "error"
          );
          return;
        }

        if (await this.crearEquipo(nombre, tag)) {
          e.target.reset();
        }
      });
    }

    // Actualizar lista de equipos - CON DEBOUNCE
    const refreshEquipos = document.getElementById("refreshEquipos");
    if (refreshEquipos) {
      const debouncedLoadEquipos = debounce(() => {
        this.loadEquipos();
      }, 500);

      refreshEquipos.addEventListener("click", debouncedLoadEquipos);
    }

    // Validar TAG en tiempo real
    const tagInput = document.getElementById("nuevoEquipoTag");
    if (tagInput) {
      tagInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase().slice(0, 5);
      });
    }
  }
}

// Función debounce para prevenir múltiples ejecuciones rápidas
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
// Inicializar el manager de equipos
window.equipoManager = new EquipoManager();

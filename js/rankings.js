class RankingManager {
  constructor() {
    this.currentEvento = "Evento For Fun";
  }

  async loadRankingMain() {
    try {
      this.showLoading("main");

      const { data: usuarios, error } = await window.supabaseClient
        .from("usuarios")
        .select(
          `
                    *,
                    equipos (nombre, tag)
                `
        )
        .order("puntos_main", { ascending: false });

      if (error) throw error;

      this.renderRankingMain(usuarios);
      this.hideLoading("main");
    } catch (error) {
      console.error("Error loading main ranking:", error);
      window.authManager.showNotification(
        "Error al cargar el ranking main",
        "error"
      );
      this.hideLoading("main");
    }
  }

  async loadRankingExtra() {
    try {
      // ⬇️ Agregar esta verificación
        if (!window.supabaseClient) {
            console.error("❌ Supabase client no está disponible");
            window.authManager?.showNotification("Error de conexión a la base de datos", "error");
            this.hideLoading("extra");
            return;
        }
        
        this.showLoading("extra");

      const evento =
        document.getElementById("eventoNombre").value || this.currentEvento;
      this.currentEvento = evento;

      const { data: puntosExtra, error } = await window.supabaseClient
        .from("ranking_extra")
        .select(
          `
                    puntos_extra,
                    usuarios (
                        nombre,
                        equipos (nombre, tag)
                    )
                `
        )
        .eq("evento_nombre", evento);

      if (error) throw error;

      // Agrupar puntos por usuario
      const usuariosMap = new Map();

      puntosExtra.forEach((item) => {
        const usuarioNombre = item.usuarios.nombre;
        const equipoTag = item.usuarios.equipos?.tag || "NONE";
        const equipoNombre = item.usuarios.equipos?.nombre || "Sin Equipo";

        if (!usuariosMap.has(usuarioNombre)) {
          usuariosMap.set(usuarioNombre, {
            nombre: usuarioNombre,
            equipo_tag: equipoTag,
            equipo_nombre: equipoNombre,
            puntos_extra: 0,
          });
        }

        usuariosMap.get(usuarioNombre).puntos_extra += item.puntos_extra;
      });

      const usuarios = Array.from(usuariosMap.values())
        .filter((user) => user.puntos_extra > 0)
        .sort((a, b) => b.puntos_extra - a.puntos_extra);

      this.renderRankingExtra(usuarios);
      this.hideLoading("extra");
    } catch (error) {
      console.error("Error loading extra ranking:", error);
      window.authManager.showNotification(
        "Error al cargar el ranking extra",
        "error"
      );
      this.hideLoading("extra");
    }
  }

  renderRankingMain(usuarios) {
    const tbody = document.getElementById("tbodyMain");
    tbody.innerHTML = "";

    usuarios.forEach((usuario, index) => {
      const posicion = index + 1;
      const equipoNombre = usuario.equipos?.nombre || "Sin Equipo";
      const equipoTag = usuario.equipos?.tag || "NONE";

      let emoji = "";
      if (posicion === 1) emoji = "🥇";
      else if (posicion === 2) emoji = "🥈";
      else if (posicion === 3) emoji = "🥉";

      const row = document.createElement("tr");

      if (posicion === 1) row.classList.add("first-place");
      else if (posicion === 2) row.classList.add("second-place");
      else if (posicion === 3) row.classList.add("third-place");

      row.innerHTML = `
                <td><strong>${emoji} ${posicion}</strong></td>
                <td><span class="tag-badge">#${equipoTag}</span></td>
                <td>${usuario.nombre}</td>
                <td>${equipoNombre}</td>
                <td><strong>${usuario.puntos_main}</strong></td>
                <td class="trend-neutral">⭐</td>
            `;

      tbody.appendChild(row);
    });

    if (usuarios.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">No hay usuarios en el ranking</td>
                </tr>
            `;
    }
  }

  renderRankingExtra(usuarios) {
    const tbody = document.getElementById("tbodyExtra");
    tbody.innerHTML = "";

    usuarios.forEach((usuario, index) => {
      const posicion = index + 1;

      let emoji = "";
      if (posicion === 1) emoji = "🎯";
      else if (posicion === 2) emoji = "🎪";
      else if (posicion === 3) emoji = "🎮";

      const row = document.createElement("tr");

      if (posicion === 1) row.classList.add("first-place");
      else if (posicion === 2) row.classList.add("second-place");
      else if (posicion === 3) row.classList.add("third-place");

      row.innerHTML = `
                <td><strong>${emoji} ${posicion}</strong></td>
                <td><span class="tag-badge">#${usuario.equipo_tag}</span></td>
                <td>${usuario.nombre}</td>
                <td>${usuario.equipo_nombre}</td>
                <td><strong>${usuario.puntos_extra}</strong></td>
                <td>${this.currentEvento}</td>
            `;

      tbody.appendChild(row);
    });

    if (usuarios.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-data">No hay puntos para este evento</td>
                </tr>
            `;
    }
  }

  async limpiarRankingExtra() {
    if (!window.authManager.hasAccess(1)) {
      window.authManager.showNotification(
        "No tienes permisos para esta acción",
        "error"
      );
      return;
    }

    const evento =
      document.getElementById("eventoNombre").value || this.currentEvento;

    if (
      !confirm(
        `¿Estás seguro de eliminar todos los puntos del evento "${evento}"?`
      )
    ) {
      return;
    }

    try {
      // Primero obtener conteo de registros a eliminar para el historial
      const { count, error: countError } = await window.supabaseClient
        .from("ranking_extra")
        .select("*", { count: "exact", head: true })
        .eq("evento_nombre", evento);

      if (countError) throw countError;

      const { error } = await window.supabaseClient
        .from("ranking_extra")
        .delete()
        .eq("evento_nombre", evento);

      if (error) throw error;

      window.authManager.showNotification(
        `Ranking extra "${evento}" limpiado correctamente`,
        "success"
      );

      // REGISTRAR EN HISTORIAL - CORREGIDO
      if (window.historialManager) {
        const admin = window.authManager.getCurrentUser();
        await window.historialManager.registrarPuntos(
          admin,
          null, // No hay usuario específico
          0, // Cantidad 0 para limpieza
          "limpieza",
          "Limpieza completa del ranking extra",
          evento,
          `Se eliminaron ${count || 0} registros del evento "${evento}"`
        );
      }

      this.loadRankingExtra();
    } catch (error) {
      console.error("Error cleaning extra ranking:", error);
      window.authManager.showNotification(
        "Error al limpiar el ranking extra",
        "error"
      );
    }
  }

  exportRanking(tipo) {
    let tabla, filename;

    if (tipo === "main") {
      tabla = document.getElementById("tablaMain");
      filename = "ranking-main.csv";
    } else {
      tabla = document.getElementById("tablaExtra");
      filename = "ranking-extra.csv";
    }

    let csv = [];
    const rows = tabla.querySelectorAll("tr");

    for (let i = 0; i < rows.length; i++) {
      let row = [],
        cols = rows[i].querySelectorAll("td, th");

      for (let j = 0; j < cols.length; j++) {
        // Limpiar emojis y formato
        let text = cols[j].innerText.replace(/[🥇🥈🥉🎯🎪🎮]/g, "").trim();
        row.push('"' + text + '"');
      }

      csv.push(row.join(","));
    }

    const csvString = csv.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, filename);
    } else {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    window.authManager.showNotification(
      `Ranking ${tipo} exportado correctamente`,
      "success"
    );
  }

  showLoading(tipo) {
    const tbody =
      tipo === "main"
        ? document.getElementById("tbodyMain")
        : document.getElementById("tbodyExtra");

    tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <div class="loading-spinner-small"></div>
                    Cargando...
                </td>
            </tr>
        `;
  }

  hideLoading(tipo) {
    // El loading se reemplaza cuando se cargan los datos
  }
}

// Inicializar el manager de rankings
window.rankingManager = new RankingManager();

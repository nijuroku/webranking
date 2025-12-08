class HistorialManager {
    constructor() {
        this.historial = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Botón para ver historial en el footer
        const viewHistoryBtn = document.getElementById('viewHistory');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.showHistoryModal();
                this.loadHistorial();
            });
        }

        // Cerrar modal
        const closeHistoryBtn = document.getElementById('closeHistory');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => {
                this.hideHistoryModal();
            });
        }

        // Filtrar historial
        const historyFilter = document.getElementById('historyFilter');
        if (historyFilter) {
            historyFilter.addEventListener('change', (e) => {
                this.filterHistorial(e.target.value);
            });
        }

        // Actualizar historial
        const refreshHistoryBtn = document.getElementById('refreshHistory');
        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => {
                this.loadHistorial();
            });
        }

        // Cerrar modal al hacer clic fuera
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('historyModal');
            if (e.target === modal) {
                this.hideHistoryModal();
            }
        });

        // Cerrar con Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('historyModal').style.display === 'flex') {
                this.hideHistoryModal();
            }
        });
    }

    showHistoryModal() {
        document.getElementById('historyModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hideHistoryModal() {
        document.getElementById('historyModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async loadHistorial() {
        try {
            this.showLoading();
            
            const { data, error } = await window.supabaseClient
                .from('historial_puntos')
                .select(`
                    *,
                    usuario:usuarios!historial_puntos_usuario_id_fkey (
                        nombre,
                        equipos (nombre, tag)
                    ),
                    admin:administradores!historial_puntos_admin_id_fkey (
                        usuario,
                        nombre_completo
                    )
                `)
                .order('fecha_registro', { ascending: false })
                .limit(100);

            if (error) throw error;

            this.historial = data;
            this.renderHistorial();
            
        } catch (error) {
            console.error('Error loading history:', error);
            if (window.authManager) {
                window.authManager.showNotification('Error al cargar el historial', 'error');
            }
            this.hideLoading();
        }
    }

    renderHistorial(filterType = 'all') {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const filteredData = filterType === 'all' 
            ? this.historial 
            : this.historial.filter(item => item.tipo_puntos === filterType);

        if (filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">No hay registros en el historial</td>
                </tr>
            `;
            return;
        }

        filteredData.forEach(item => {
            const fecha = new Date(item.fecha_registro);
            const fechaFormateada = fecha.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Usar datos del historial o de las tablas relacionadas
            const adminNombre = item.admin_nombre || item.admin?.nombre_completo || item.admin_usuario || item.admin?.usuario || 'Sistema';
            const usuarioNombre = item.usuario_nombre || item.usuario?.nombre || 'Usuario eliminado';
            const equipoNombre = item.equipo_nombre || item.usuario?.equipos?.nombre || '';
            const equipoTag = item.equipo_tag || item.usuario?.equipos?.tag || '';
            
            let tipoBadge = '';
            let badgeClass = '';
            if (item.tipo_puntos === 'main') {
                tipoBadge = 'Main';
                badgeClass = 'badge-primary';
            } else if (item.tipo_puntos === 'extra') {
                tipoBadge = 'Extra';
                badgeClass = 'badge-warning';
            } else if (item.tipo_puntos === 'limpieza') {
                tipoBadge = 'Limpieza';
                badgeClass = 'badge-danger';
            } else if (item.tipo_puntos === 'inicial') {
                tipoBadge = 'Inicial';
                badgeClass = 'badge-success';
            }

            const eventoInfo = item.evento_nombre ? `<br><small>Evento: ${item.evento_nombre}</small>` : '';
            const detallesInfo = item.detalles ? `<br><small>${item.detalles}</small>` : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="date-time">
                        <div class="date">${fecha.toLocaleDateString('es-ES')}</div>
                        <div class="time">${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </td>
                <td>${adminNombre}</td>
                <td>${item.accion}${eventoInfo}${detallesInfo}</td>
                <td>
                    <div>${usuarioNombre}</div>
                    ${equipoTag ? `<div class="team-info"><span class="tag-badge">#${equipoTag}</span> ${equipoNombre}</div>` : ''}
                </td>
                <td class="points-change ${item.cantidad > 0 ? 'positive' : item.cantidad === 0 ? 'neutral' : 'negative'}">
                    ${item.cantidad > 0 ? '+' : ''}${item.cantidad}
                </td>
                <td><span class="badge ${badgeClass}">${tipoBadge}</span></td>
            `;

            tbody.appendChild(row);
        });
    }

    filterHistorial(filterType) {
        this.renderHistorial(filterType);
    }

    async registrarPuntos(adminId, adminUsuario, adminNombre, usuarioId, usuarioNombre, equipoId, equipoNombre, equipoTag, cantidad, tipoPuntos, accion, eventoNombre = null, detalles = null) {
        try {
            const historialData = {
                admin_id: adminId,
                admin_usuario: adminUsuario,
                admin_nombre: adminNombre,
                usuario_id: usuarioId,
                usuario_nombre: usuarioNombre,
                equipo_id: equipoId,
                equipo_nombre: equipoNombre,
                equipo_tag: equipoTag,
                cantidad: cantidad,
                tipo_puntos: tipoPuntos,
                accion: accion,
                evento_nombre: eventoNombre,
                detalles: detalles,
                fecha_registro: new Date().toISOString()
            };

            console.log('📝 Registrando historial:', historialData);

            const { error } = await window.supabaseClient
                .from('historial_puntos')
                .insert([historialData]);

            if (error) throw error;

            console.log('✅ Historial registrado exitosamente');

            // Actualizar el historial si el modal está abierto
            if (document.getElementById('historyModal').style.display === 'flex') {
                this.loadHistorial();
            }

        } catch (error) {
            console.error('❌ Error registrando historial:', error);
        }
    }

    showLoading() {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">
                    <div class="loading-spinner-small"></div>
                    Cargando historial...
                </td>
            </tr>
        `;
    }

    hideLoading() {
        // Se maneja en renderHistorial
    }

    // Método helper para registrar desde otros managers
    async registrarDesdeUsuarios(admin, usuario, cantidad, tipoPuntos, accion, eventoNombre = null, detalles = null) {
        if (!admin || !usuario) return;
        
        const equipoInfo = usuario.equipos || {};
        
        await this.registrarPuntos(
            admin.id,
            admin.usuario,
            admin.nombre_completo || admin.usuario,
            usuario.id,
            usuario.nombre,
            usuario.equipo_id,
            equipoInfo.nombre,
            equipoInfo.tag,
            cantidad,
            tipoPuntos,
            accion,
            eventoNombre,
            detalles
        );
    }
}

// Inicializar el manager de historial cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.historialManager = new HistorialManager();
        console.log('✅ HistorialManager inicializado');
    }, 500);
});
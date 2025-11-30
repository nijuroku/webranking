class EquipoManager {
    constructor() {
        this.equipos = [];
        this.setupEventListeners();
    }

    async loadEquipos() {
        try {
            const { data: equipos, error } = await window.supabaseClient
                .from('equipos')
                .select('*')
                .order('nombre');

            if (error) throw error;

            this.equipos = equipos;
            this.updateEquipoSelects();
            this.renderEquipos();
            
        } catch (error) {
            console.error('Error loading teams:', error);
            window.authManager.showNotification('Error al cargar los equipos', 'error');
        }
    }

    updateEquipoSelects() {
        const selects = [
            'nuevoUsuarioEquipo',
            'editUsuarioEquipo'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Seleccionar equipo...</option>';
                
                this.equipos.forEach(equipo => {
                    const option = document.createElement('option');
                    option.value = equipo.id;
                    option.textContent = equipo.nombre;
                    select.appendChild(option);
                });
            }
        });
    }

    async crearEquipo(nombre, tag) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para crear equipos', 'error');
            return false;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('equipos')
                .insert([
                    {
                        nombre: nombre,
                        tag: tag.toUpperCase()
                    }
                ])
                .select();

            if (error) throw error;

            window.authManager.showNotification(`Equipo "${nombre}" creado correctamente`, 'success');
            await this.loadEquipos();
            return true;
            
        } catch (error) {
            console.error('Error creating team:', error);
            
            if (error.code === '23505') {
                if (error.message.includes('nombre')) {
                    window.authManager.showNotification('El nombre del equipo ya existe', 'error');
                } else {
                    window.authManager.showNotification('El TAG del equipo ya existe', 'error');
                }
            } else {
                window.authManager.showNotification('Error al crear equipo', 'error');
            }
            return false;
        }
    }

    async eliminarEquipo(equipoId) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para eliminar equipos', 'error');
            return false;
        }

        const equipo = this.equipos.find(e => e.id === equipoId);
        if (!equipo) return false;

        // Verificar si el equipo tiene usuarios
        const { data: usuarios, error: usuariosError } = await window.supabaseClient
            .from('usuarios')
            .select('id')
            .eq('equipo_id', equipoId);

        if (usuariosError) {
            window.authManager.showNotification('Error al verificar usuarios del equipo', 'error');
            return false;
        }

        if (usuarios && usuarios.length > 0) {
            window.authManager.showNotification(
                `No se puede eliminar el equipo "${equipo.nombre}" porque tiene ${usuarios.length} usuario(s) asignados`, 
                'error'
            );
            return false;
        }

        if (!confirm(`¿Estás seguro de eliminar el equipo "${equipo.nombre}"?`)) {
            return false;
        }

        try {
            const { error } = await window.supabaseClient
                .from('equipos')
                .delete()
                .eq('id', equipoId);

            if (error) throw error;

            window.authManager.showNotification(`Equipo "${equipo.nombre}" eliminado correctamente`, 'success');
            await this.loadEquipos();
            return true;
            
        } catch (error) {
            console.error('Error deleting team:', error);
            window.authManager.showNotification('Error al eliminar equipo', 'error');
            return false;
        }
    }

    async renderEquipos() {
        const tbody = document.getElementById('tbodyEquipos');
        tbody.innerHTML = '';

        for (const equipo of this.equipos) {
            // Obtener número de miembros
            const { data: usuarios, error } = await window.supabaseClient
                .from('usuarios')
                .select('puntos_main')
                .eq('equipo_id', equipo.id);

            if (error) continue;

            const miembros = usuarios ? usuarios.length : 0;
            const puntosTotales = usuarios ? usuarios.reduce((sum, user) => sum + user.puntos_main, 0) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${equipo.nombre}</td>
                <td><span class="tag-badge">#${equipo.tag}</span></td>
                <td>${miembros}</td>
                <td><strong>${puntosTotales}</strong></td>
                <td>
                    <button class="btn btn-danger btn-small" data-equipo-id="${equipo.id}">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        }

        if (this.equipos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-data">No hay equipos registrados</td>
                </tr>
            `;
        }

        // Agregar event listeners a los botones de eliminar
        tbody.querySelectorAll('.btn-danger').forEach(btn => {
            btn.addEventListener('click', async () => {
                const equipoId = btn.getAttribute('data-equipo-id');
                await this.eliminarEquipo(equipoId);
            });
        });
    }

    setupEventListeners() {
        // Crear equipo
        document.getElementById('formCrearEquipo').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nuevoEquipoNombre').value;
            const tag = document.getElementById('nuevoEquipoTag').value;

            if (tag.length > 5) {
                window.authManager.showNotification('El TAG no puede tener más de 5 caracteres', 'error');
                return;
            }

            if (await this.crearEquipo(nombre, tag)) {
                e.target.reset();
            }
        });

        // Actualizar lista de equipos
        document.getElementById('refreshEquipos').addEventListener('click', () => {
            this.loadEquipos();
        });

        // Validar TAG en tiempo real
        document.getElementById('nuevoEquipoTag').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 5);
        });
    }
}

// Inicializar el manager de equipos
window.equipoManager = new EquipoManager();
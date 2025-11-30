class AdminManager {
    constructor() {
        this.administradores = [];
        this.setupEventListeners();
    }

    async loadAdministradores() {
        if (!window.authManager.hasAccess(2)) {
            return;
        }

        try {
            const { data: administradores, error } = await window.supabaseClient
                .from('administradores')
                .select('*')
                .order('nivel_acceso', { ascending: false })
                .order('usuario');

            if (error) throw error;

            this.administradores = administradores;
            this.renderAdministradores();
            
        } catch (error) {
            console.error('Error loading admins:', error);
            window.authManager.showNotification('Error al cargar los administradores', 'error');
        }
    }

    async crearAdministrador(usuario, password, nombreCompleto, nivelAcceso) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para esta acción', 'error');
            return false;
        }

        try {
            const passwordHash = await window.authManager.hashPassword(password);

            const { data, error } = await window.supabaseClient
                .from('administradores')
                .insert([
                    {
                        usuario: usuario,
                        password_hash: passwordHash,
                        nombre_completo: nombreCompleto,
                        nivel_acceso: parseInt(nivelAcceso)
                    }
                ])
                .select();

            if (error) throw error;

            window.authManager.showNotification(`Administrador "${usuario}" creado correctamente`, 'success');
            await this.loadAdministradores();
            return true;
            
        } catch (error) {
            console.error('Error creating admin:', error);
            
            if (error.code === '23505') {
                window.authManager.showNotification('El usuario ya existe', 'error');
            } else {
                window.authManager.showNotification('Error al crear administrador', 'error');
            }
            return false;
        }
    }

    async toggleEstadoAdmin(adminId) {
        if (!window.authManager.hasAccess(2)) {
            window.authManager.showNotification('No tienes permisos para esta acción', 'error');
            return false;
        }

        const admin = this.administradores.find(a => a.id === adminId);
        if (!admin) return false;

        // No permitir desactivarse a sí mismo
        if (admin.usuario === window.authManager.getCurrentUser().usuario) {
            window.authManager.showNotification('No puedes desactivar tu propia cuenta', 'error');
            return false;
        }

        const nuevoEstado = !admin.activo;

        try {
            const { error } = await window.supabaseClient
                .from('administradores')
                .update({ activo: nuevoEstado })
                .eq('id', adminId);

            if (error) throw error;

            const estadoTexto = nuevoEstado ? 'activado' : 'desactivado';
            window.authManager.showNotification(
                `Administrador "${admin.usuario}" ${estadoTexto} correctamente`, 
                'success'
            );
            
            await this.loadAdministradores();
            return true;
            
        } catch (error) {
            console.error('Error toggling admin status:', error);
            window.authManager.showNotification('Error al cambiar estado del administrador', 'error');
            return false;
        }
    }

    async eliminarAdministrador(adminId) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para esta acción', 'error');
            return false;
        }

        const admin = this.administradores.find(a => a.id === adminId);
        if (!admin) return false;

        // No permitir eliminarse a sí mismo
        if (admin.usuario === window.authManager.getCurrentUser().usuario) {
            window.authManager.showNotification('No puedes eliminar tu propia cuenta', 'error');
            return false;
        }

        if (!confirm(`¿Estás seguro de eliminar al administrador "${admin.usuario}"?`)) {
            return false;
        }

        try {
            const { error } = await window.supabaseClient
                .from('administradores')
                .delete()
                .eq('id', adminId);

            if (error) throw error;

            window.authManager.showNotification(`Administrador "${admin.usuario}" eliminado correctamente`, 'success');
            await this.loadAdministradores();
            return true;
            
        } catch (error) {
            console.error('Error deleting admin:', error);
            window.authManager.showNotification('Error al eliminar administrador', 'error');
            return false;
        }
    }

    renderAdministradores() {
        const tbody = document.getElementById('tbodyAdmins');
        tbody.innerHTML = '';

        this.administradores.forEach(admin => {
            const nivelTexto = admin.nivel_acceso >= 2 ? 'Super Admin' : 'Admin Normal';
            const estadoTexto = admin.activo ? '✅ Activo' : '❌ Inactivo';
            const fechaCorta = new Date(admin.fecha_creacion).toLocaleDateString();

            const row = document.createElement('tr');
            
            // Resaltar el usuario actual
            if (admin.usuario === window.authManager.getCurrentUser().usuario) {
                row.classList.add('current-user');
            }

            row.innerHTML = `
                <td>${admin.usuario}</td>
                <td>${admin.nombre_completo || '-'}</td>
                <td>${nivelTexto}</td>
                <td>${estadoTexto}</td>
                <td>${fechaCorta}</td>
                <td>
                    <div class="admin-actions">
                        <button class="btn btn-warning btn-small toggle-admin" data-admin-id="${admin.id}">
                            <i class="fas fa-power-off"></i> ${admin.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button class="btn btn-danger btn-small delete-admin" data-admin-id="${admin.id}">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });

        // Agregar event listeners
        tbody.querySelectorAll('.toggle-admin').forEach(btn => {
            btn.addEventListener('click', async () => {
                const adminId = btn.getAttribute('data-admin-id');
                await this.toggleEstadoAdmin(adminId);
            });
        });

        tbody.querySelectorAll('.delete-admin').forEach(btn => {
            btn.addEventListener('click', async () => {
                const adminId = btn.getAttribute('data-admin-id');
                await this.eliminarAdministrador(adminId);
            });
        });
    }

    setupEventListeners() {
        // Crear administrador
        document.getElementById('formCrearAdmin').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usuario = document.getElementById('nuevoAdminUsuario').value;
            const password = document.getElementById('nuevoAdminPassword').value;
            const nombreCompleto = document.getElementById('nuevoAdminNombre').value;
            const nivelAcceso = document.getElementById('nuevoAdminNivel').value;

            if (await this.crearAdministrador(usuario, password, nombreCompleto, nivelAcceso)) {
                e.target.reset();
                document.getElementById('nuevoAdminNivel').value = '1';
            }
        });

        // Actualizar lista de administradores
        document.getElementById('refreshAdmins').addEventListener('click', () => {
            this.loadAdministradores();
        });

        // Cargar administradores cuando se muestre la pestaña
        document.querySelector('[data-tab="administradores"]').addEventListener('click', () => {
            this.loadAdministradores();
        });
    }
}

// Inicializar el manager de administradores
window.adminManager = new AdminManager();
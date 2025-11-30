class UsuarioManager {
    constructor() {
        this.usuarios = [];
        this.setupEventListeners();
    }

    async loadUsuarios() {
        try {
            const { data: usuarios, error } = await window.supabaseClient
                .from('usuarios')
                .select(`
                    *,
                    equipos (nombre, tag)
                `)
                .order('nombre');

            if (error) throw error;

            this.usuarios = usuarios;
            this.updateUsuarioSelects();
            
        } catch (error) {
            console.error('Error loading users:', error);
            window.authManager.showNotification('Error al cargar los usuarios', 'error');
        }
    }

    updateUsuarioSelects() {
        const selects = [
            'usuarioPuntosMain',
            'usuarioPuntosExtra',
            'selectUsuarioGestion'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Seleccionar usuario...</option>';
                
                this.usuarios.forEach(usuario => {
                    const option = document.createElement('option');
                    option.value = usuario.id;
                    option.textContent = usuario.nombre;
                    select.appendChild(option);
                });
            }
        });
    }

    async agregarUsuario(nombre, equipoId, puntosIniciales = 0) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para agregar usuarios', 'error');
            return false;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('usuarios')
                .insert([
                    {
                        nombre: nombre,
                        equipo_id: equipoId,
                        puntos_main: parseInt(puntosIniciales)
                    }
                ])
                .select();

            if (error) throw error;

            window.authManager.showNotification(`Usuario "${nombre}" agregado correctamente`, 'success');
            await this.loadUsuarios();
            await window.rankingManager.loadRankingMain();
            return true;
            
        } catch (error) {
            console.error('Error adding user:', error);
            
            if (error.code === '23505') {
                window.authManager.showNotification('El nombre de usuario ya existe', 'error');
            } else {
                window.authManager.showNotification('Error al agregar usuario', 'error');
            }
            return false;
        }
    }

    async sumarPuntosMain(usuarioId, puntos) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para sumar puntos', 'error');
            return false;
        }

        try {
            // Obtener puntos actuales
            const { data: usuario, error: errorGet } = await window.supabaseClient
                .from('usuarios')
                .select('puntos_main')
                .eq('id', usuarioId)
                .single();

            if (errorGet) throw errorGet;

            const nuevosPuntos = usuario.puntos_main + parseInt(puntos);

            const { error } = await window.supabaseClient
                .from('usuarios')
                .update({ puntos_main: nuevosPuntos })
                .eq('id', usuarioId);

            if (error) throw error;

            const usuarioNombre = this.usuarios.find(u => u.id === usuarioId)?.nombre;
            window.authManager.showNotification(
                `${puntos} puntos sumados a ${usuarioNombre}`, 'success'
            );
            
            await this.loadUsuarios();
            await window.rankingManager.loadRankingMain();
            return true;
            
        } catch (error) {
            console.error('Error adding points:', error);
            window.authManager.showNotification('Error al sumar puntos', 'error');
            return false;
        }
    }

    async sumarPuntosExtra(usuarioId, puntos, evento) {
        try {
            const { data, error } = await window.supabaseClient
                .from('ranking_extra')
                .insert([
                    {
                        usuario_id: usuarioId,
                        puntos_extra: parseInt(puntos),
                        evento_nombre: evento
                    }
                ])
                .select();

            if (error) throw error;

            const usuarioNombre = this.usuarios.find(u => u.id === usuarioId)?.nombre;
            window.authManager.showNotification(
                `${puntos} puntos extra sumados a ${usuarioNombre}`, 'success'
            );
            
            await window.rankingManager.loadRankingExtra();
            return true;
            
        } catch (error) {
            console.error('Error adding extra points:', error);
            window.authManager.showNotification('Error al sumar puntos extra', 'error');
            return false;
        }
    }

    async cargarUsuarioGestion(usuarioId) {
        try {
            const { data: usuario, error } = await window.supabaseClient
                .from('usuarios')
                .select(`
                    *,
                    equipos (id, nombre, tag)
                `)
                .eq('id', usuarioId)
                .single();

            if (error) throw error;

            this.mostrarUsuarioGestion(usuario);
            
        } catch (error) {
            console.error('Error loading user for management:', error);
            window.authManager.showNotification('Error al cargar usuario', 'error');
        }
    }

    mostrarUsuarioGestion(usuario) {
        document.getElementById('infoId').textContent = usuario.id;
        document.getElementById('infoPosicion').textContent = this.obtenerPosicion(usuario.id);
        document.getElementById('infoCreacion').textContent = new Date(usuario.fecha_creacion).toLocaleDateString();
        
        document.getElementById('editUsuarioNombre').value = usuario.nombre;
        document.getElementById('editUsuarioPuntos').value = usuario.puntos_main;
        
        // Seleccionar equipo
        const equipoSelect = document.getElementById('editUsuarioEquipo');
        if (usuario.equipos) {
            equipoSelect.value = usuario.equipos.id;
        }

        document.getElementById('usuarioInfo').style.display = 'block';
    }

    obtenerPosicion(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return '-';
        
        const sorted = [...this.usuarios].sort((a, b) => b.puntos_main - a.puntos_main);
        const posicion = sorted.findIndex(u => u.id === usuarioId) + 1;
        return `#${posicion}`;
    }

    async guardarCambiosUsuario(usuarioId, nuevosDatos) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para modificar usuarios', 'error');
            return false;
        }

        try {
            const { error } = await window.supabaseClient
                .from('usuarios')
                .update(nuevosDatos)
                .eq('id', usuarioId);

            if (error) throw error;

            window.authManager.showNotification('Usuario actualizado correctamente', 'success');
            await this.loadUsuarios();
            await window.rankingManager.loadRankingMain();
            return true;
            
        } catch (error) {
            console.error('Error updating user:', error);
            window.authManager.showNotification('Error al actualizar usuario', 'error');
            return false;
        }
    }

    async eliminarUsuario(usuarioId) {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para eliminar usuarios', 'error');
            return false;
        }

        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return false;

        if (!confirm(`¿Estás seguro de eliminar al usuario "${usuario.nombre}"?`)) {
            return false;
        }

        try {
            // Primero eliminar puntos extra
            await window.supabaseClient
                .from('ranking_extra')
                .delete()
                .eq('usuario_id', usuarioId);

            // Luego eliminar usuario
            const { error } = await window.supabaseClient
                .from('usuarios')
                .delete()
                .eq('id', usuarioId);

            if (error) throw error;

            window.authManager.showNotification(`Usuario "${usuario.nombre}" eliminado correctamente`, 'success');
            await this.loadUsuarios();
            await window.rankingManager.loadRankingMain();
            return true;
            
        } catch (error) {
            console.error('Error deleting user:', error);
            window.authManager.showNotification('Error al eliminar usuario', 'error');
            return false;
        }
    }

    setupEventListeners() {
        // Agregar usuario
        document.getElementById('formAgregarUsuario').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nuevoUsuarioNombre').value;
            const equipoId = document.getElementById('nuevoUsuarioEquipo').value;
            const puntos = document.getElementById('nuevoUsuarioPuntos').value || 0;

            if (await this.agregarUsuario(nombre, equipoId, puntos)) {
                e.target.reset();
            }
        });

        // Sumar puntos main
        document.getElementById('formSumarPuntosMain').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usuarioId = document.getElementById('usuarioPuntosMain').value;
            const puntos = document.getElementById('cantidadPuntosMain').value;

            if (await this.sumarPuntosMain(usuarioId, puntos)) {
                e.target.reset();
            }
        });

        // Sumar puntos extra
        document.getElementById('formSumarPuntosExtra').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usuarioId = document.getElementById('usuarioPuntosExtra').value;
            const puntos = document.getElementById('cantidadPuntosExtra').value;
            const evento = document.getElementById('eventoPuntos').value;

            if (await this.sumarPuntosExtra(usuarioId, puntos, evento)) {
                e.target.reset();
            }
        });

        // Gestión de usuarios
        document.getElementById('selectUsuarioGestion').addEventListener('change', (e) => {
            if (e.target.value) {
                this.cargarUsuarioGestion(e.target.value);
            } else {
                document.getElementById('usuarioInfo').style.display = 'none';
            }
        });

        // Guardar cambios usuario
        document.getElementById('guardarUsuario').addEventListener('click', async () => {
            const usuarioId = document.getElementById('selectUsuarioGestion').value;
            const nuevosDatos = {
                nombre: document.getElementById('editUsuarioNombre').value,
                equipo_id: document.getElementById('editUsuarioEquipo').value,
                puntos_main: parseInt(document.getElementById('editUsuarioPuntos').value)
            };

            if (await this.guardarCambiosUsuario(usuarioId, nuevosDatos)) {
                // Recargar datos del usuario
                this.cargarUsuarioGestion(usuarioId);
            }
        });

        // Eliminar usuario
        document.getElementById('eliminarUsuario').addEventListener('click', async () => {
            const usuarioId = document.getElementById('selectUsuarioGestion').value;
            if (await this.eliminarUsuario(usuarioId)) {
                document.getElementById('selectUsuarioGestion').value = '';
                document.getElementById('usuarioInfo').style.display = 'none';
            }
        });
    }
}

// Inicializar el manager de usuarios
window.usuarioManager = new UsuarioManager();
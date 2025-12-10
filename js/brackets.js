class BracketsManager {
    constructor() {
        this.brackets = [];
        this.participantes = [];
        this.partidos = [];
        this.currentBracket = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Crear nuevo bracket
        document.getElementById('formCrearBracket').addEventListener('submit', (e) => {
            e.preventDefault();
            this.crearBracket();
        });

        // Refrescar brackets
        document.getElementById('refreshBrackets').addEventListener('click', () => {
            this.loadBrackets();
        });

        // Cargar bracket seleccionado
        document.getElementById('bracketSeleccionado').addEventListener('change', (e) => {
            const bracketId = e.target.value;
            if (bracketId) {
                this.cargarBracketCompleto(bracketId);
            } else {
                this.clearBracketData();
            }
        });

        // Agregar participante
        document.getElementById('addParticipante').addEventListener('click', () => {
            this.agregarParticipante();
        });

        // Remover participante
        document.getElementById('participantesSeleccionados').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-participant')) {
                const usuarioId = e.target.getAttribute('data-user-id');
                this.removerParticipante(usuarioId);
            }
        });

        // Confirmar participantes
        document.getElementById('confirmarParticipantes').addEventListener('click', () => {
            this.confirmarParticipantes();
        });

        // Generar primera ronda
        document.getElementById('generarRonda1').addEventListener('click', () => {
            this.generarRonda1();
        });

        // Generar siguiente ronda
        document.getElementById('generarSiguienteRonda').addEventListener('click', () => {
            this.generarSiguienteRonda();
        });

        // Finalizar bracket
        document.getElementById('finalizarBracket').addEventListener('click', () => {
            this.finalizarBracket();
        });
    }

    async crearBracket() {
        if (!window.authManager.hasAccess(1)) {
            window.authManager.showNotification('No tienes permisos para crear brackets', 'error');
            return false;
        }

        const nombre = document.getElementById('nuevoBracketNombre').value;
        const puntosParaGanar = document.getElementById('nuevoBracketPuntos').value;

        if (!nombre) {
            window.authManager.showNotification('El nombre del bracket es obligatorio', 'error');
            return false;
        }

        if (!puntosParaGanar || puntosParaGanar < 1) {
            window.authManager.showNotification('Los puntos para ganar deben ser mayor a 0', 'error');
            return false;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('brackets')
                .insert([{
                    nombre: nombre,
                    puntos_para_ganar: parseInt(puntosParaGanar),
                    estado: 'creado',
                    ronda_actual: 1
                }])
                .select();

            if (error) throw error;

            window.authManager.showNotification(`Bracket "${nombre}" creado correctamente`, 'success');
            await this.loadBrackets();
            
            // Seleccionar el nuevo bracket
            document.getElementById('bracketSeleccionado').value = data[0].id;
            await this.cargarBracketCompleto(data[0].id);
            
            document.getElementById('formCrearBracket').reset();
            return true;
            
        } catch (error) {
            console.error('Error creating bracket:', error);
            window.authManager.showNotification('Error al crear bracket', 'error');
            return false;
        }
    }

    async loadBrackets() {
        try {
            const { data: brackets, error } = await window.supabaseClient
                .from('brackets')
                .select('*')
                .order('fecha_creacion', { ascending: false });

            if (error) throw error;

            this.brackets = brackets;
            this.actualizarSelectBrackets();
            
        } catch (error) {
            console.error('Error loading brackets:', error);
            window.authManager.showNotification('Error al cargar los brackets', 'error');
        }
    }

    actualizarSelectBrackets() {
        const select = document.getElementById('bracketSeleccionado');
        select.innerHTML = '<option value="">Seleccionar bracket...</option>';
        
        this.brackets.forEach(bracket => {
            const option = document.createElement('option');
            option.value = bracket.id;
            option.textContent = `${bracket.nombre} (Ronda ${bracket.ronda_actual}, ${bracket.estado})`;
            select.appendChild(option);
        });
    }

    async cargarBracketCompleto(bracketId) {
        try {
            // Cargar bracket
            const { data: bracket, error: bracketError } = await window.supabaseClient
                .from('brackets')
                .select('*')
                .eq('id', bracketId)
                .single();

            if (bracketError) throw bracketError;

            this.currentBracket = bracket;
            
            // Cargar participantes
            await this.cargarParticipantes(bracketId);
            
            // Cargar partidos
            await this.cargarPartidos(bracketId);
            
            // Actualizar UI
            this.actualizarUIBracket();
            
        } catch (error) {
            console.error('Error loading bracket:', error);
            window.authManager.showNotification('Error al cargar el bracket', 'error');
        }
    }

    async cargarParticipantes(bracketId) {
        try {
            const { data: participantes, error } = await window.supabaseClient
                .from('bracket_participantes')
                .select(`
                    *,
                    usuarios:usuario_id (id, nombre, equipos (nombre, tag))
                `)
                .eq('bracket_id', bracketId)
                .eq('activo', true)
                .order('semilla');

            if (error) throw error;

            this.participantes = participantes || [];
            this.renderParticipantes();
            
            // Actualizar estadísticas
            this.actualizarEstadisticasBracket();
            
            // Cargar usuarios disponibles
            await this.cargarUsuariosDisponibles();
            
        } catch (error) {
            console.error('Error loading participants:', error);
            window.authManager.showNotification('Error al cargar participantes', 'error');
        }
    }

    async cargarUsuariosDisponibles() {
        try {
            const { data: usuarios, error } = await window.supabaseClient
                .from('usuarios')
                .select(`
                    *,
                    equipos (nombre, tag)
                `)
                .order('nombre');

            if (error) throw error;

            // Filtrar usuarios que ya están en el bracket
            const usuariosIdsEnBracket = this.participantes.map(p => p.usuario_id);
            const usuariosDisponibles = usuarios.filter(u => !usuariosIdsEnBracket.includes(u.id));
            
            const select = document.getElementById('usuarioParaBracket');
            select.innerHTML = '<option value="">Seleccionar usuario...</option>';
            
            usuariosDisponibles.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = `${usuario.nombre} (#${usuario.equipos?.tag || 'NONE'})`;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading available users:', error);
            window.authManager.showNotification('Error al cargar usuarios disponibles', 'error');
        }
    }

    async agregarParticipante() {
        const bracketId = document.getElementById('bracketSeleccionado').value;
        const usuarioId = document.getElementById('usuarioParaBracket').value;
        const semilla = document.getElementById('semillaParticipante').value || null;

        if (!bracketId) {
            window.authManager.showNotification('Primero selecciona un bracket', 'error');
            return;
        }

        if (!usuarioId) {
            window.authManager.showNotification('Selecciona un usuario', 'error');
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('bracket_participantes')
                .insert([{
                    bracket_id: bracketId,
                    usuario_id: usuarioId,
                    semilla: semilla ? parseInt(semilla) : null,
                    victorias: 0,
                    derrotas: 0,
                    puntos_acumulados: 0,
                    activo: true
                }])
                .select(`
                    *,
                    usuarios:usuario_id (id, nombre, equipos (nombre, tag))
                `);

            if (error) throw error;

            window.authManager.showNotification('Participante agregado al bracket', 'success');
            this.participantes.push(data[0]);
            this.renderParticipantes();
            this.actualizarEstadisticasBracket();
            
            // Actualizar lista de usuarios disponibles
            await this.cargarUsuariosDisponibles();
            document.getElementById('usuarioParaBracket').value = '';
            document.getElementById('semillaParticipante').value = '';
            
        } catch (error) {
            console.error('Error adding participant:', error);
            if (error.code === '23505') {
                window.authManager.showNotification('Este usuario ya está en el bracket', 'error');
            } else {
                window.authManager.showNotification('Error al agregar participante', 'error');
            }
        }
    }

    async removerParticipante(usuarioId) {
        const bracketId = document.getElementById('bracketSeleccionado').value;

        if (!bracketId) {
            window.authManager.showNotification('Primero selecciona un bracket', 'error');
            return;
        }

        const participante = this.participantes.find(p => p.usuario_id == usuarioId);
        if (!participante) return;

        if (!confirm(`¿Estás seguro de eliminar a ${participante.usuarios.nombre} del bracket?`)) {
            return;
        }

        try {
            const { error } = await window.supabaseClient
                .from('bracket_participantes')
                .update({ activo: false })
                .eq('bracket_id', bracketId)
                .eq('usuario_id', usuarioId);

            if (error) throw error;

            window.authManager.showNotification('Participante eliminado del bracket', 'success');
            
            // Remover de la lista local
            this.participantes = this.participantes.filter(p => p.usuario_id != usuarioId);
            this.renderParticipantes();
            this.actualizarEstadisticasBracket();
            
            // Actualizar lista de usuarios disponibles
            await this.cargarUsuariosDisponibles();
            
        } catch (error) {
            console.error('Error removing participant:', error);
            window.authManager.showNotification('Error al eliminar participante', 'error');
        }
    }

    renderParticipantes() {
        const container = document.getElementById('participantesSeleccionados');
        container.innerHTML = '';

        // Ordenar por semilla si existe
        const participantesOrdenados = [...this.participantes].sort((a, b) => {
            if (a.semilla && b.semilla) return a.semilla - b.semilla;
            if (a.semilla) return -1;
            if (b.semilla) return 1;
            return a.usuarios.nombre.localeCompare(b.usuarios.nombre);
        });

        participantesOrdenados.forEach((participante, index) => {
            const usuario = participante.usuarios;
            const equipoTag = usuario.equipos?.tag || 'NONE';
            const semillaTexto = participante.semilla ? `Semilla #${participante.semilla}` : 'Sin semilla';
            const estadisticas = `V:${participante.victorias} D:${participante.derrotas} P:${participante.puntos_acumulados}`;

            const item = document.createElement('div');
            item.className = 'participante-item';
            item.innerHTML = `
                <span class="participante-info">
                    <span class="participante-numero">${index + 1}.</span>
                    <span class="tag-badge">#${equipoTag}</span>
                    <strong>${usuario.nombre}</strong>
                    <small class="semilla-info">${semillaTexto}</small>
                    <small class="estadisticas">${estadisticas}</small>
                </span>
                <button class="btn btn-danger btn-small remove-participant" data-user-id="${usuario.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(item);
        });

        if (this.participantes.length === 0) {
            container.innerHTML = '<p class="no-data">No hay participantes seleccionados</p>';
        }
    }

    actualizarEstadisticasBracket() {
        const cantidad = this.participantes.length;
        document.getElementById('cantidadParticipantes').textContent = cantidad;
        
        // Calcular la siguiente potencia de 2
        const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(Math.max(2, cantidad))));
        const byes = nextPowerOfTwo - cantidad;
        
        document.getElementById('tamanioBracket').textContent = nextPowerOfTwo;
        document.getElementById('byesNecesarios').textContent = byes;
        
        // Actualizar puntos para ganar
        if (this.currentBracket) {
            document.getElementById('puntosParaGanar').textContent = this.currentBracket.puntos_para_ganar;
        }
    }

    actualizarUIBracket() {
        if (!this.currentBracket) return;

        // Actualizar información del bracket
        document.getElementById('nombreBracket').textContent = this.currentBracket.nombre;
        document.getElementById('rondaActual').textContent = this.currentBracket.ronda_actual;
        document.getElementById('estadoBracket').textContent = this.currentBracket.estado;
        document.getElementById('puntosParaGanar').textContent = this.currentBracket.puntos_para_ganar;

        // Mostrar/ocultar botones según estado
        const puedeGenerarRonda1 = this.currentBracket.estado === 'creado' && this.participantes.length >= 2;
        const puedeGenerarSiguienteRonda = this.currentBracket.estado === 'en_progreso' && 
                                           this.todasLasRondasCompletadas();
        const puedeFinalizar = this.currentBracket.estado === 'en_progreso' && 
                               this.participantes.length <= 1;

        document.getElementById('generarRonda1').disabled = !puedeGenerarRonda1;
        document.getElementById('generarSiguienteRonda').disabled = !puedeGenerarSiguienteRonda;
        document.getElementById('finalizarBracket').disabled = !puedeFinalizar;
    }

    async confirmarParticipantes() {
        const bracketId = document.getElementById('bracketSeleccionado').value;

        if (!bracketId) {
            window.authManager.showNotification('Selecciona un bracket primero', 'error');
            return;
        }

        const cantidad = this.participantes.length;
        
        if (cantidad < 2) {
            window.authManager.showNotification('Se necesitan al menos 2 participantes', 'error');
            return;
        }

        try {
            // Actualizar estado del bracket
            const { error } = await window.supabaseClient
                .from('brackets')
                .update({ estado: 'en_progreso' })
                .eq('id', bracketId);

            if (error) throw error;

            window.authManager.showNotification(
                `${cantidad} participantes confirmados`, 
                'success'
            );
            
            // Actualizar UI
            this.currentBracket.estado = 'en_progreso';
            this.actualizarUIBracket();
            
        } catch (error) {
            console.error('Error confirming participants:', error);
            window.authManager.showNotification('Error al confirmar participantes', 'error');
        }
    }

    async generarRonda1() {
        if (!this.currentBracket) {
            window.authManager.showNotification('Selecciona un bracket primero', 'error');
            return;
        }

        const cantidad = this.participantes.length;
        
        if (cantidad < 2) {
            window.authManager.showNotification('Se necesitan al menos 2 participantes', 'error');
            return;
        }

        const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, cantidad))));
        const participantesConSemilla = this.participantes.filter(p => p.semilla);
        const participantesSinSemilla = this.participantes.filter(p => !p.semilla);

        // Ordenar por semilla
        const participantesOrdenados = [...participantesConSemilla.sort((a, b) => a.semilla - b.semilla), ...participantesSinSemilla];
        
        // Generar partidos para la primera ronda
        const partidosRonda1 = this.generarPartidosRonda1(participantesOrdenados, bracketSize);
        
        try {
            // Insertar partidos en la base de datos
            const partidosParaInsertar = partidosRonda1.map((partido, index) => ({
                bracket_id: this.currentBracket.id,
                ronda: 1,
                partido_numero: index + 1,
                usuario1_id: partido.usuario1_id,
                usuario2_id: partido.usuario2_id,
                puntos_para_ganar: this.currentBracket.puntos_para_ganar,
                estado: partido.usuario2_id ? 'pendiente' : 'finalizado',
                ganador_id: partido.usuario2_id ? null : partido.usuario1_id
            }));

            const { error } = await window.supabaseClient
                .from('bracket_partidos')
                .insert(partidosParaInsertar);

            if (error) throw error;

            window.authManager.showNotification('Primera ronda generada correctamente', 'success');
            
            // Actualizar bracket
            await this.cargarPartidos(this.currentBracket.id);
            
        } catch (error) {
            console.error('Error generating first round:', error);
            window.authManager.showNotification('Error al generar primera ronda', 'error');
        }
    }

    generarPartidosRonda1(participantes, bracketSize) {
        const partidos = [];
        const byes = bracketSize - participantes.length;
        
        // Si hay participantes sin semilla, mezclarlos aleatoriamente
        const participantesSinSemilla = participantes.filter(p => !p.semilla);
        if (participantesSinSemilla.length > 0) {
            // Mezclar aleatoriamente los participantes sin semilla
            for (let i = participantesSinSemilla.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [participantesSinSemilla[i], participantesSinSemilla[j]] = 
                [participantesSinSemilla[j], participantesSinSemilla[i]];
            }
        }

        // Colocar byes primero (partidos con solo un jugador)
        for (let i = 0; i < byes; i++) {
            partidos.push({
                usuario1_id: participantes[i].usuario_id,
                usuario2_id: null, // BYE
                es_bye: true
            });
        }

        // Colocar el resto de partidos
        const participantesRestantes = participantes.slice(byes);
        const pares = Math.floor(participantesRestantes.length / 2);

        // Emparejar semilla alta con baja
        for (let i = 0; i < pares; i++) {
            partidos.push({
                usuario1_id: participantesRestantes[i].usuario_id,
                usuario2_id: participantesRestantes[participantesRestantes.length - 1 - i].usuario_id,
                es_bye: false
            });
        }

        // Si queda un participante impar, agregar bye adicional
        if (participantesRestantes.length % 2 !== 0) {
            partidos.push({
                usuario1_id: participantesRestantes[pares].usuario_id,
                usuario2_id: null,
                es_bye: true
            });
        }

        return partidos;
    }

    async cargarPartidos(bracketId) {
        try {
            const { data: partidos, error } = await window.supabaseClient
                .from('bracket_partidos')
                .select(`
                    *,
                    usuario1:usuario1_id (id, nombre, equipos (nombre, tag)),
                    usuario2:usuario2_id (id, nombre, equipos (nombre, tag)),
                    ganador:ganador_id (id, nombre),
                    perdedor:perdedor_id (id, nombre)
                `)
                .eq('bracket_id', bracketId)
                .order('ronda', { ascending: true })
                .order('partido_numero', { ascending: true });

            if (error) throw error;

            this.partidos = partidos || [];
            this.renderBracket();
            this.actualizarUIBracket();
            
        } catch (error) {
            console.error('Error loading matches:', error);
            window.authManager.showNotification('Error al cargar partidos del bracket', 'error');
        }
    }

    renderBracket() {
        const container = document.getElementById('bracketVisualizacion');
        container.innerHTML = '';

        // Agrupar partidos por ronda
        const partidosPorRonda = {};
        this.partidos.forEach(partido => {
            if (!partidosPorRonda[partido.ronda]) {
                partidosPorRonda[partido.ronda] = [];
            }
            partidosPorRonda[partido.ronda].push(partido);
        });

        // Crear estructura del bracket
        const bracketContainer = document.createElement('div');
        bracketContainer.className = 'bracket-container';

        // Para cada ronda
        Object.keys(partidosPorRonda).sort((a, b) => a - b).forEach(ronda => {
            const rondaContainer = document.createElement('div');
            rondaContainer.className = 'bracket-ronda';
            
            const rondaHeader = document.createElement('div');
            rondaHeader.className = 'ronda-header';
            rondaHeader.innerHTML = `<h4>Ronda ${ronda}</h4>`;
            rondaContainer.appendChild(rondaHeader);

            const partidosContainer = document.createElement('div');
            partidosContainer.className = 'partidos-container';

            partidosPorRonda[ronda].forEach(partido => {
                const partidoElement = this.crearElementoPartido(partido);
                partidosContainer.appendChild(partidoElement);
            });

            rondaContainer.appendChild(partidosContainer);
            bracketContainer.appendChild(rondaContainer);
        });

        container.appendChild(bracketContainer);
        
        // Agregar event listeners a los botones de guardar
        this.agregarEventListenersPartidos();
    }

    crearElementoPartido(partido) {
        const partidoElement = document.createElement('div');
        partidoElement.className = `partido ${partido.estado}`;
        partidoElement.setAttribute('data-partido-id', partido.id);

        const usuario1Nombre = partido.usuario1 ? 
            `${partido.usuario1.nombre} (#${partido.usuario1.equipos?.tag || 'NONE'})` : 
            (partido.usuario1_id ? 'Por definir' : 'BYE');
        
        const usuario2Nombre = partido.usuario2 ? 
            `${partido.usuario2.nombre} (#${partido.usuario2.equipos?.tag || 'NONE'})` : 
            (partido.usuario2_id ? 'Por definir' : 'BYE');

        // Determinar si hay ganador
        const tieneGanador = partido.ganador_id !== null;
        const esGanador1 = partido.ganador_id === partido.usuario1_id;
        const esGanador2 = partido.ganador_id === partido.usuario2_id;

        // Verificar si se alcanzaron los puntos para ganar
        const puntosParaGanar = partido.puntos_para_ganar || this.currentBracket?.puntos_para_ganar || 3;
        const usuario1Gano = partido.puntos_usuario1 >= puntosParaGanar;
        const usuario2Gano = partido.puntos_usuario2 >= puntosParaGanar;
        const partidoCompletado = usuario1Gano || usuario2Gano;

        let accionesHTML = '';
        if (partido.estado === 'pendiente' && !partidoCompletado) {
            accionesHTML = `
                <div class="partido-acciones">
                    <button class="btn btn-primary btn-small guardar-partido" data-partido-id="${partido.id}">
                        <i class="fas fa-save"></i> Guardar Puntos
                    </button>
                </div>
            `;
        }

        partidoElement.innerHTML = `
            <div class="partido-header">
                <span class="partido-numero">Partido ${partido.partido_numero}</span>
                <span class="partido-estado ${partido.estado}">${partido.estado}</span>
            </div>
            <div class="jugadores">
                <div class="jugador ${esGanador1 ? 'ganador' : ''} ${usuario1Gano ? 'alcanzo-puntos' : ''}">
                    <div class="jugador-nombre">${usuario1Nombre}</div>
                    <div class="puntos-container">
                        <input type="number" class="puntos-input" data-partido-id="${partido.id}" data-jugador="1" 
                               value="${partido.puntos_usuario1 || 0}" min="0" ${partidoCompletado ? 'disabled' : ''}>
                        ${usuario1Gano ? '<span class="puntos-alcanzados">✓</span>' : ''}
                    </div>
                </div>
                <div class="jugador ${esGanador2 ? 'ganador' : ''} ${usuario2Gano ? 'alcanzo-puntos' : ''}">
                    <div class="jugador-nombre">${usuario2Nombre}</div>
                    <div class="puntos-container">
                        <input type="number" class="puntos-input" data-partido-id="${partido.id}" data-jugador="2" 
                               value="${partido.puntos_usuario2 || 0}" min="0" ${partidoCompletado ? 'disabled' : ''}>
                        ${usuario2Gano ? '<span class="puntos-alcanzados">✓</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="partido-info">
                <small>Puntos para ganar: ${puntosParaGanar}</small>
                ${partido.ganador ? `<div class="ganador-info">Ganador: ${partido.ganador.nombre}</div>` : ''}
            </div>
            ${accionesHTML}
        `;

        return partidoElement;
    }

    agregarEventListenersPartidos() {
        // Agregar event listeners a los botones de guardar
        document.querySelectorAll('.guardar-partido').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const partidoId = e.target.getAttribute('data-partido-id');
                this.guardarPuntosPartido(partidoId);
            });
        });
    }

    async guardarPuntosPartido(partidoId) {
        try {
            const partidoElement = document.querySelector(`[data-partido-id="${partidoId}"]`);
            if (!partidoElement) return;

            const puntosJugador1 = parseInt(partidoElement.querySelector('[data-jugador="1"]').value) || 0;
            const puntosJugador2 = parseInt(partidoElement.querySelector('[data-jugador="2"]').value) || 0;

            const partido = this.partidos.find(p => p.id == partidoId);
            if (!partido) return;

            // Verificar si es un BYE
            if (!partido.usuario2_id) {
                // Es un BYE, usuario1 gana automáticamente
                await this.finalizarPartido(partidoId, partido.usuario1_id, null, puntosJugador1, 0);
                return;
            }

            if (!partido.usuario1_id) {
                // Es un BYE, usuario2 gana automáticamente
                await this.finalizarPartido(partidoId, partido.usuario2_id, null, 0, puntosJugador2);
                return;
            }

            const puntosParaGanar = partido.puntos_para_ganar || this.currentBracket?.puntos_para_ganar || 3;
            const usuario1Gano = puntosJugador1 >= puntosParaGanar;
            const usuario2Gano = puntosJugador2 >= puntosParaGanar;

            if (usuario1Gano && usuario2Gano) {
                window.authManager.showNotification('No puede haber dos ganadores, revisa los puntos', 'error');
                return;
            }

            // Actualizar puntos en la base de datos
            const { error } = await window.supabaseClient
                .from('bracket_partidos')
                .update({
                    puntos_usuario1: puntosJugador1,
                    puntos_usuario2: puntosJugador2
                })
                .eq('id', partidoId);

            if (error) throw error;

            // Si algún jugador alcanzó los puntos para ganar, finalizar el partido
            if (usuario1Gano || usuario2Gano) {
                const ganadorId = usuario1Gano ? partido.usuario1_id : partido.usuario2_id;
                const perdedorId = usuario1Gano ? partido.usuario2_id : partido.usuario1_id;
                
                await this.finalizarPartido(partidoId, ganadorId, perdedorId, puntosJugador1, puntosJugador2);
            } else {
                window.authManager.showNotification('Puntos guardados correctamente', 'success');
            }

            // Recargar partidos para actualizar la UI
            await this.cargarPartidos(this.currentBracket.id);
            
        } catch (error) {
            console.error('Error saving match points:', error);
            window.authManager.showNotification('Error al guardar puntos', 'error');
        }
    }

    async finalizarPartido(partidoId, ganadorId, perdedorId, puntosJugador1, puntosJugador2) {
        try {
            const partido = this.partidos.find(p => p.id == partidoId);
            if (!partido) return;

            // Determinar qué jugador es el ganador y perdedor
            let ganadorFinal = ganadorId;
            let perdedorFinal = perdedorId;
            let puntosGanador = 0;
            let puntosPerdedor = 0;

            if (ganadorId === partido.usuario1_id) {
                puntosGanador = puntosJugador1 || partido.puntos_usuario1;
                puntosPerdedor = puntosJugador2 || partido.puntos_usuario2;
            } else if (ganadorId === partido.usuario2_id) {
                puntosGanador = puntosJugador2 || partido.puntos_usuario2;
                puntosPerdedor = puntosJugador1 || partido.puntos_usuario1;
            } else if (perdedorId === partido.usuario1_id) {
                // Si solo tenemos perdedor, el otro es ganador
                perdedorFinal = partido.usuario1_id;
                ganadorFinal = partido.usuario2_id;
                puntosPerdedor = puntosJugador1 || partido.puntos_usuario1;
                puntosGanador = puntosJugador2 || partido.puntos_usuario2;
            } else if (perdedorId === partido.usuario2_id) {
                perdedorFinal = partido.usuario2_id;
                ganadorFinal = partido.usuario1_id;
                puntosPerdedor = puntosJugador2 || partido.puntos_usuario2;
                puntosGanador = puntosJugador1 || partido.puntos_usuario1;
            }

            // Actualizar partido
            const { error } = await window.supabaseClient
                .from('bracket_partidos')
                .update({
                    ganador_id: ganadorFinal,
                    perdedor_id: perdedorFinal,
                    puntos_usuario1: partido.usuario1_id === ganadorFinal ? puntosGanador : puntosPerdedor,
                    puntos_usuario2: partido.usuario2_id === ganadorFinal ? puntosGanador : puntosPerdedor,
                    estado: 'finalizado',
                    fecha_jugado: new Date().toISOString()
                })
                .eq('id', partidoId);

            if (error) throw error;

            // Actualizar estadísticas de los participantes
            if (ganadorFinal) {
                await this.actualizarEstadisticasParticipante(ganadorFinal, true, puntosGanador);
            }
            if (perdedorFinal) {
                await this.actualizarEstadisticasParticipante(perdedorFinal, false, puntosPerdedor);
            }

            window.authManager.showNotification('Partido finalizado', 'success');
            
        } catch (error) {
            console.error('Error finishing match:', error);
            window.authManager.showNotification('Error al finalizar partido', 'error');
        }
    }

    async actualizarEstadisticasParticipante(usuarioId, esVictoria, puntosObtenidos) {
        try {
            // Obtener estadísticas actuales
            const { data: participante, error: getError } = await window.supabaseClient
                .from('bracket_participantes')
                .select('*')
                .eq('bracket_id', this.currentBracket.id)
                .eq('usuario_id', usuarioId)
                .single();

            if (getError) throw getError;

            // Calcular nuevos valores
            const victorias = esVictoria ? participante.victorias + 1 : participante.victorias;
            const derrotas = esVictoria ? participante.derrotas : participante.derrotas + 1;
            
            // Los puntos acumulados SON los puntos que obtuvo en el partido
            // Si gana: suma sus puntos, si pierde: resta sus puntos
            const puntosAcumulados = esVictoria 
                ? participante.puntos_acumulados + (puntosObtenidos || 0)
                : participante.puntos_acumulados - (puntosObtenidos || 0);

            const { error } = await window.supabaseClient
                .from('bracket_participantes')
                .update({
                    victorias: victorias,
                    derrotas: derrotas,
                    puntos_acumulados: puntosAcumulados
                })
                .eq('id', participante.id);

            if (error) throw error;

            // Registrar puntos en ranking extra
            await this.registrarPuntosRankingExtra(usuarioId, esVictoria, puntosObtenidos);
            
        } catch (error) {
            console.error('Error updating participant stats:', error);
        }
    }

    async registrarPuntosRankingExtra(usuarioId, esVictoria, puntosObtenidos) {
        try {
            // Los puntos en el ranking extra son exactamente los puntos que obtuvo en el partido
            // Si gana: suma sus puntos, si pierde: resta sus puntos
            const puntos = esVictoria 
                ? (puntosObtenidos || 0)  // Si gana, suma sus puntos
                : -(puntosObtenidos || 0); // Si pierde, resta sus puntos

            if (puntos === 0) return; // No registrar si no hay puntos

            const { data: usuario, error: usuarioError } = await window.supabaseClient
                .from('usuarios')
                .select('*')
                .eq('id', usuarioId)
                .single();

            if (usuarioError) throw usuarioError;

            // Insertar en ranking extra con el nombre del bracket
            const { error } = await window.supabaseClient
                .from('ranking_extra')
                .insert([{
                    usuario_id: usuarioId,
                    puntos_extra: puntos,
                    evento_nombre: this.currentBracket.nombre
                }]);

            if (error) throw error;

            console.log(`Puntos registrados en ranking extra: ${puntos} para ${usuario.nombre}`);
            
        } catch (error) {
            console.error('Error registering points in extra ranking:', error);
        }
    }

    todasLasRondasCompletadas() {
        if (!this.partidos.length) return false;
        
        // Obtener la ronda actual
        const rondaActual = this.currentBracket?.ronda_actual || 1;
        const partidosRondaActual = this.partidos.filter(p => p.ronda === rondaActual);
        
        // Verificar si todos los partidos de la ronda actual están finalizados
        return partidosRondaActual.length > 0 && 
               partidosRondaActual.every(p => p.estado === 'finalizado');
    }

    async generarSiguienteRonda() {
        if (!this.currentBracket) {
            window.authManager.showNotification('Selecciona un bracket primero', 'error');
            return;
        }

        const rondaActual = this.currentBracket.ronda_actual;
        const partidosRondaActual = this.partidos.filter(p => p.ronda === rondaActual);
        
        if (!this.todasLasRondasCompletadas()) {
            window.authManager.showNotification('Deben finalizar todos los partidos de la ronda actual', 'error');
            return;
        }

        // Obtener ganadores de la ronda actual
        const ganadores = partidosRondaActual
            .map(p => p.ganador_id)
            .filter(id => id !== null);

        if (ganadores.length < 2) {
            window.authManager.showNotification('No hay suficientes ganadores para la siguiente ronda', 'error');
            return;
        }

        try {
            const siguienteRonda = rondaActual + 1;
            
            // Crear partidos para la siguiente ronda
            const nuevosPartidos = [];
            for (let i = 0; i < ganadores.length; i += 2) {
                if (i + 1 < ganadores.length) {
                    nuevosPartidos.push({
                        bracket_id: this.currentBracket.id,
                        ronda: siguienteRonda,
                        partido_numero: Math.floor(i / 2) + 1,
                        usuario1_id: ganadores[i],
                        usuario2_id: ganadores[i + 1],
                        puntos_para_ganar: this.currentBracket.puntos_para_ganar,
                        estado: 'pendiente'
                    });
                } else {
                    // Si queda un ganador impar (pasa directo a la siguiente ronda)
                    nuevosPartidos.push({
                        bracket_id: this.currentBracket.id,
                        ronda: siguienteRonda,
                        partido_numero: Math.floor(i / 2) + 1,
                        usuario1_id: ganadores[i],
                        usuario2_id: null, // BYE
                        puntos_para_ganar: this.currentBracket.puntos_para_ganar,
                        estado: 'finalizado',
                        ganador_id: ganadores[i]
                    });
                }
            }
            
            // Insertar nuevos partidos
            const { error: insertError } = await window.supabaseClient
                .from('bracket_partidos')
                .insert(nuevosPartidos);

            if (insertError) throw insertError;

            // Actualizar bracket
            const { error: updateError } = await window.supabaseClient
                .from('brackets')
                .update({ ronda_actual: siguienteRonda })
                .eq('id', this.currentBracket.id);

            if (updateError) throw updateError;

            window.authManager.showNotification(`Ronda ${siguienteRonda} generada correctamente`, 'success');
            
            // Recargar datos
            await this.cargarBracketCompleto(this.currentBracket.id);
            
        } catch (error) {
            console.error('Error generating next round:', error);
            window.authManager.showNotification('Error al generar siguiente ronda', 'error');
        }
    }

    async finalizarBracket() {
        if (!this.currentBracket) {
            window.authManager.showNotification('Selecciona un bracket primero', 'error');
            return;
        }

        // Verificar que solo quede un participante activo
        const participantesActivos = this.participantes.filter(p => p.activo);
        if (participantesActivos.length > 1) {
            window.authManager.showNotification('El bracket no ha terminado, aún hay múltiples participantes', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de finalizar el bracket "${this.currentBracket.nombre}"?`)) {
            return;
        }

        try {
            // Actualizar estado del bracket
            const { error } = await window.supabaseClient
                .from('brackets')
                .update({ estado: 'finalizado' })
                .eq('id', this.currentBracket.id);

            if (error) throw error;

            window.authManager.showNotification(
                `Bracket "${this.currentBracket.nombre}" finalizado`, 
                'success'
            );
            
            // Recargar datos
            await this.cargarBracketCompleto(this.currentBracket.id);
            
        } catch (error) {
            console.error('Error finishing bracket:', error);
            window.authManager.showNotification('Error al finalizar bracket', 'error');
        }
    }

    clearBracketData() {
        this.currentBracket = null;
        this.participantes = [];
        this.partidos = [];
        
        // Limpiar UI
        document.getElementById('participantesSeleccionados').innerHTML = '<p class="no-data">No hay participantes seleccionados</p>';
        document.getElementById('bracketVisualizacion').innerHTML = '<p class="no-data">Selecciona un bracket</p>';
        
        // Limpiar estadísticas
        document.getElementById('nombreBracket').textContent = '-';
        document.getElementById('rondaActual').textContent = '-';
        document.getElementById('estadoBracket').textContent = '-';
        document.getElementById('cantidadParticipantes').textContent = '0';
        document.getElementById('tamanioBracket').textContent = '0';
        document.getElementById('byesNecesarios').textContent = '0';
        document.getElementById('puntosParaGanar').textContent = '-';
        
        // Deshabilitar botones
        document.getElementById('generarRonda1').disabled = true;
        document.getElementById('generarSiguienteRonda').disabled = true;
        document.getElementById('finalizarBracket').disabled = true;
    }
}

// Inicializar el manager de brackets
window.bracketsManager = new BracketsManager();
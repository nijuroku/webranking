class MainApp {
    constructor() {
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
    }

    async loadInitialData() {
        // Cargar datos iniciales cuando el usuario esté autenticado
        if (window.authManager.getCurrentUser()) {
            await window.rankingManager.loadRankingMain();
            await window.usuarioManager.loadUsuarios();
            await window.equipoManager.loadEquipos();
        }
    }

    setupEventListeners() {
        // Botones de exportación
        document.getElementById('exportMain').addEventListener('click', () => {
            window.rankingManager.exportRanking('main');
        });

        document.getElementById('exportExtra').addEventListener('click', () => {
            window.rankingManager.exportRanking('extra');
        });

        // Botones de actualización
        document.getElementById('refreshMain').addEventListener('click', () => {
            window.rankingManager.loadRankingMain();
        });

        document.getElementById('refreshExtra').addEventListener('click', () => {
            window.rankingManager.loadRankingExtra();
        });

        // Limpiar ranking extra
        document.getElementById('limpiarExtra').addEventListener('click', () => {
            window.rankingManager.limpiarRankingExtra();
        });

        // Cambio de evento en ranking extra
        document.getElementById('eventoNombre').addEventListener('change', () => {
            window.rankingManager.loadRankingExtra();
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.mainApp = new MainApp();
});
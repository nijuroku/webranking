class MainApp {
    constructor() {
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        // Esperar a que authManager esté listo
        setTimeout(() => {
            this.loadInitialData();
        }, 1000);
    }

    async loadInitialData() {
        // Cargar datos iniciales cuando la app esté lista
        if (window.rankingManager) {
            await window.rankingManager.loadRankingMain();
            await window.rankingManager.loadRankingExtra();
        }
        if (window.equipoManager) {
            await window.equipoManager.loadEquipos();
        }
    }

    setupEventListeners() {
        // Botones de exportación
        document.getElementById('exportMain').addEventListener('click', () => {
            if (window.rankingManager) window.rankingManager.exportRanking('main');
        });

        document.getElementById('exportExtra').addEventListener('click', () => {
            if (window.rankingManager) window.rankingManager.exportRanking('extra');
        });

        // Botones de actualización
        document.getElementById('refreshMain').addEventListener('click', () => {
            if (window.rankingManager) window.rankingManager.loadRankingMain();
        });

        document.getElementById('refreshExtra').addEventListener('click', () => {
            if (window.rankingManager) window.rankingManager.loadRankingExtra();
        });

        // Limpiar ranking extra
        document.getElementById('limpiarExtra').addEventListener('click', () => {
            if (window.rankingManager) window.rankingManager.limpiarRankingExtra();
        });

        // Cambio de evento en ranking extra
        document.getElementById('eventoNombre').addEventListener('change', () => {
            if (window.rankingManager) window.rankingManager.loadRankingExtra();
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.mainApp = new MainApp();
});
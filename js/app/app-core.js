window.app = window.app || {};

Object.assign(window.app, {
    async init() {
        lucide.createIcons();
        try {
            await db.init();
            // Cargar metadata persistente desde IndexedDB al arrancar
            state.records = await db.getAll();
        } catch (e) {
            console.error("IndexedDB no está disponible en este contexto.", e);
        }
    },

    // --- NUEVO SISTEMA DE SEGURIDAD (TRIPLE TAP) PARA EVITAR ZOOM MOBILE ---
    adminTapCount: 0,
    adminTapTimer: null,
    handleAdminTap() {
        this.adminTapCount++;
        if (this.adminTapCount === 1) {
            this.adminTapTimer = setTimeout(() => { this.adminTapCount = 0; }, 800); // 800ms para hacer los 3 toques
        } else if (this.adminTapCount >= 3) {
            clearTimeout(this.adminTapTimer);
            this.adminTapCount = 0;
            this.unlockAdmin();
        }
    },

    unlockAdmin() {
        if (state.isAdmin) {
            alert("Ya estás en modo de Edición Administrativa."); return;
        }
        const pwd = prompt("ACCESO RESTRINGIDO\nIngrese clave de archivista para crear/editar paquetes .xlb:");

        if (pwd === "1234" || pwd === "admin") {
            state.isAdmin = true;
            document.getElementById('lbl-role-status').innerText = "MODO EDICIÓN (ARCHIVISTA)";
            document.getElementById('lbl-role-status').classList.replace('text-gt-sky', 'text-gt-accent');

            document.getElementById('btn-scan-local').classList.remove('hidden');
            document.getElementById('btn-scan-local').classList.add('flex');
            document.getElementById('btn-finalize').classList.remove('hidden');
            document.getElementById('btn-finalize').classList.add('flex');
            document.getElementById('admin-tools').classList.remove('hidden');
            document.getElementById('btn-add-field').classList.remove('hidden');
            document.getElementById('btn-add-field').classList.add('flex');

            alert("Credenciales aceptadas. Herramientas de digitalización y escritura en BD desbloqueadas.");
            if (state.view === 'workspace') this.renderForm();
        } else if (pwd !== null) {
            alert("Contraseña incorrecta.");
        }
    },

    showLoader(title, subtitle) {
        document.getElementById('global-loader-title').innerText = title;
        document.getElementById('global-loader-subtitle').innerText = subtitle;
        document.getElementById('global-loader').classList.remove('hidden');
    },
    hideLoader() {
        document.getElementById('global-loader').classList.add('hidden');
    },

    downloadCompressionTool() {
        // Detectar si el usuario está en Windows o en otro sistema (Linux/Mac)
        const isWindows = navigator.platform.toLowerCase().includes('win') || navigator.userAgent.toLowerCase().includes('windows');
        
        let fileUrl = 'convertir_a_xlb.sh';
        let fileName = 'convertir_a_xlb.sh';

        if (isWindows) {
            fileUrl = 'convertir_a_xlb.bat';
            fileName = 'convertir_a_xlb.bat';
        }

        // Crear un enlace temporal para forzar la descarga
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});

window.app = window.app || {};

Object.assign(window.app, {
    async init() {
        lucide.createIcons();
        try {
            await db.init();

            let sysConfig = await db.get('__system_config__');
            if (sysConfig && sysConfig[0]) {
                const config = sysConfig[0];
                if (config.consult_pwd) {
                    const pwd = prompt("Colección Protegida\nIngrese la contraseña de consulta para acceder al catálogo:");
                    if (pwd !== config.consult_pwd) {
                        alert("Contraseña incorrecta. Acceso denegado.");
                        return; // Abort loading
                    }
                }
                state.collectionPasswords = {
                    consult: config.consult_pwd || '',
                    admin: config.archivista_pwd || ''
                };
                state.collectionConfig = {
                    mode: config.mode || 'standard',
                    groupField: config.groupField || ''
                };
            }

            state.records = await db.getAll();
            delete state.records['__system_config__'];
            
            if (Object.keys(state.records).length > 0) {
                document.getElementById('welcome-screen').classList.add('hidden');
                document.getElementById('btn-nav-dashboard').classList.remove('hidden');
                
                // Set default schema if empty but records exist
                if (state.schema.length === 0 && Object.keys(state.records).length > 0) {
                    const sample = Object.values(state.records)[0];
                    let sArr = Array.isArray(sample) ? sample[0] : sample;
                    Object.keys(sArr).forEach(k => {
                        state.schema.push({ id: k, label: k.replace(/_/g, ' ').toUpperCase(), type: 'text' });
                    });
                }
                
                app.switchView('dashboard');
            }
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

        let expectedAdmin = (state.collectionPasswords && state.collectionPasswords.admin) ? state.collectionPasswords.admin : null;
        let isCorrect = false;
        if (expectedAdmin) {
            isCorrect = (pwd === expectedAdmin);
        } else {
            isCorrect = (pwd === "1234" || pwd === "admin");
        }

        if (isCorrect) {
            state.isAdmin = true;
            document.getElementById('lbl-role-status').innerText = "MODO EDICIÓN (ARCHIVISTA)";
            document.getElementById('lbl-role-status').classList.replace('text-gt-sky', 'text-gt-accent');

            document.getElementById('btn-scan-local').classList.remove('hidden');
            document.getElementById('btn-scan-local').classList.add('flex');
            document.getElementById('btn-open-packages').classList.remove('hidden');
            document.getElementById('btn-open-packages').classList.add('flex');
            document.getElementById('btn-download-script').classList.remove('hidden');
            document.getElementById('btn-download-script').classList.add('flex');
            
            document.getElementById('btn-finalize').classList.remove('hidden');
            document.getElementById('btn-finalize').classList.add('flex');
            document.getElementById('admin-tools').classList.remove('hidden');
            document.getElementById('btn-add-field').classList.remove('hidden');
            document.getElementById('btn-add-field').classList.add('flex');
            
            document.getElementById('dashboard-view').classList.add('hidden');
            document.getElementById('workspace-view').classList.add('hidden');
            document.getElementById('search-view').classList.add('hidden');
            document.getElementById('welcome-screen').classList.remove('hidden');

            alert("Credenciales aceptadas. Herramientas de digitalización y escritura en BD desbloqueadas.");
            if (state.view === 'workspace') app.renderForm();
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
        
        let fileUrl = 'empaquetar.sh';
        let fileName = 'empaquetar.sh';

        if (isWindows) {
            fileUrl = 'empaquetar.bat';
            fileName = 'empaquetar.bat';
        }

        // Crear un enlace temporal para forzar la descarga
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    toggleCustomType() {
        const sel   = document.getElementById('select-collection-type');
        const input = document.getElementById('input-custom-type');
        if (!sel || !input) return;
        if (sel.value === '__custom__') {
            input.classList.remove('hidden');
            input.focus();
        } else {
            input.classList.add('hidden');
        }
    }
});

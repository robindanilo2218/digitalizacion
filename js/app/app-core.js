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
            
            // Configurar botones de origen de datos en el welcome screen
            this.updateWelcomeScreen();
            
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
            this.toggleAdminMode();
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
            const lblRole = document.getElementById('lbl-role-status');
            if (lblRole) {
                lblRole.innerText = "MODO EDICIÓN (ARCHIVISTA)";
                lblRole.classList.replace('text-gt-sky', 'text-gt-accent');
            }

            this.updateWelcomeScreen();

            document.getElementById('btn-download-script').classList.remove('hidden');
            document.getElementById('btn-download-script').classList.add('flex');
            
            document.getElementById('btn-finalize').classList.remove('hidden');
            document.getElementById('btn-finalize').classList.add('flex');
            
            const adminTools = document.getElementById('admin-tools');
            if (adminTools) {
                adminTools.classList.remove('hidden');
                adminTools.classList.add('flex');
            }

            const btnAddField = document.getElementById('btn-add-field');
            if (btnAddField) {
                btnAddField.classList.remove('hidden');
                btnAddField.classList.add('flex');
            }
            
            if (Object.keys(state.records).length === 0) {
                document.getElementById('dashboard-view').classList.add('hidden');
                document.getElementById('workspace-view').classList.add('hidden');
                document.getElementById('search-view').classList.add('hidden');
                document.getElementById('welcome-screen').classList.remove('hidden');
            }

            alert("Sesión de Archivador iniciada.");
            if (state.view === 'workspace') app.renderForm();
            if (state.view === 'dashboard') app.renderDashboard();
        } else if (pwd !== null) {
            alert("Contraseña incorrecta.");
        }
    },

    toggleAdminMode() {
        if (state.isAdmin) {
            this.lockAdmin();
        } else {
            this.unlockAdmin();
        }
    },

    lockAdmin() {
        state.isAdmin = false;
        const lblRole = document.getElementById('lbl-role-status');
        if (lblRole) {
            lblRole.innerText = "Modo Consulta";
            lblRole.classList.replace('text-gt-accent', 'text-gt-sky');
        }

        document.getElementById('btn-download-script').classList.remove('flex');
        document.getElementById('btn-download-script').classList.add('hidden');
        
        document.getElementById('btn-finalize').classList.remove('flex');
        document.getElementById('btn-finalize').classList.add('hidden');
        
        const adminTools = document.getElementById('admin-tools');
        if (adminTools) {
            adminTools.classList.remove('flex');
            adminTools.classList.add('hidden');
        }
        
        const btnAddField = document.getElementById('btn-add-field');
        if (btnAddField) {
            btnAddField.classList.remove('flex');
            btnAddField.classList.add('hidden');
        }

        // Si la base de datos está vacía, forzar la pantalla de bienvenida
        if (Object.keys(state.records).length === 0) {
            document.getElementById('dashboard-view').classList.add('hidden');
            document.getElementById('workspace-view').classList.add('hidden');
            document.getElementById('search-view').classList.add('hidden');
            document.getElementById('welcome-screen').classList.remove('hidden');
        }

        this.updateWelcomeScreen();

        if (state.view === 'workspace') app.renderForm();
        if (state.view === 'dashboard') app.renderDashboard();
        alert("Sesión de Archivador cerrada.");
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
    },

    updateWelcomeScreen() {
        const btnScan = document.getElementById('btn-scan-local');
        const btnOpen = document.getElementById('btn-open-packages');
        const consultantMsg = document.getElementById('consultant-empty-msg');
        const btnAdminToggle = document.getElementById('btn-admin-toggle');
        
        // Actualizar botón de toggle en el navbar
        if (btnAdminToggle) {
            if (state.isAdmin) {
                btnAdminToggle.innerText = "Salir Archivador";
                btnAdminToggle.className = "text-[10px] bg-red-900/80 text-red-200 hover:bg-red-900 hover:text-white px-2.5 py-0.5 rounded-lg border border-red-700/50 font-bold transition-all shadow-sm";
            } else {
                btnAdminToggle.innerText = "Ingresar Archivador";
                btnAdminToggle.className = "text-[10px] bg-slate-800 text-slate-300 hover:text-white px-2.5 py-0.5 rounded-lg border border-slate-700 font-bold transition-all shadow-sm";
            }
        }

        // Si el usuario es administrador, siempre mostramos todas las herramientas de carga
        const btnSdOpen = document.getElementById('btn-sd-open-packages');
        const pSdHint = document.getElementById('p-sd-no-img-hint');

        if (state.isAdmin) {
            if (btnScan) {
                btnScan.classList.remove('hidden');
                btnScan.classList.add('flex');
                btnScan.innerHTML = '<i data-lucide="camera" class="w-5 h-5 shrink-0 mr-2"></i> Nueva Digitalización (Local)';
            }
            if (btnOpen) {
                btnOpen.classList.remove('hidden');
                btnOpen.classList.add('flex');
            }
            if (consultantMsg) {
                consultantMsg.classList.add('hidden');
            }
            if (btnSdOpen) {
                btnSdOpen.classList.remove('hidden');
                btnSdOpen.classList.add('flex');
            }
            if (pSdHint) {
                pSdHint.innerText = "Por seguridad y rendimiento, la caché de imágenes se limpia al salir. Vuelve a abrir el paquete correspondiente para revincular las imágenes al catálogo.";
            }
            return;
        }

        // Si es Consultor, ocultamos COMPLETAMENTE las herramientas de carga/creación
        if (btnScan) {
            btnScan.classList.remove('flex');
            btnScan.classList.add('hidden');
        }
        if (btnOpen) {
            btnOpen.classList.remove('flex');
            btnOpen.classList.add('hidden');
        }
        if (btnSdOpen) {
            btnSdOpen.classList.remove('flex');
            btnSdOpen.classList.add('hidden');
        }
        if (pSdHint) {
            pSdHint.innerText = "Por seguridad y rendimiento, la caché de imágenes se limpia al salir. Solicite al Archivador abrir el paquete correspondiente para revincular las imágenes.";
        }

        // Mostrar o ocultar el mensaje de catálogo vacío para consultor
        if (consultantMsg) {
            if (Object.keys(state.records).length === 0) {
                consultantMsg.classList.remove('hidden');
            } else {
                consultantMsg.classList.add('hidden');
            }
        }
        lucide.createIcons();
    },

    getRecord(pathKey) {
        if (!pathKey) return null;
        if (state.records[pathKey]) return state.records[pathKey];

        // 1. Tolerancia a extensiones: probar otras comunes
        const dotIdx = pathKey.lastIndexOf('.');
        if (dotIdx !== -1) {
            const base = pathKey.substring(0, dotIdx);
            const exts = ['.jpg', '.jpeg', '.pag', '.png', '.webp', '.JPG', '.PAG'];
            for (let ext of exts) {
                const alt = base + ext;
                if (state.records[alt]) return state.records[alt];
            }
        }

        // 2. Coincidencia por nombre de archivo sin importar la extensión ni la ruta exacta
        const parts = pathKey.split('/');
        const filenameWithExt = parts.pop();
        const dotIdx2 = filenameWithExt.lastIndexOf('.');
        if (dotIdx2 !== -1) {
            const filenameNoExt = filenameWithExt.substring(0, dotIdx2).toLowerCase();
            
            // Buscar en todo state.records una coincidencia aproximada
            for (let key in state.records) {
                const kParts = key.split('/');
                const kFile = kParts.pop();
                const kDot = kFile.lastIndexOf('.');
                if (kDot !== -1) {
                    const kNoExt = kFile.substring(0, kDot).toLowerCase();
                    if (kNoExt === filenameNoExt) {
                        return state.records[key];
                    }
                }
            }
        }
        return null;
    }
});

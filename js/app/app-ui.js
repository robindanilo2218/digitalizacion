window.app = window.app || {};

Object.assign(window.app, {
    selectFolder(folderName) {
        state.activeFolder = folderName;
        state.images = state.folders[folderName] || [];
        state.currentIndex = 0;
        state.subRecordIndex = 0;

        this.switchLeftTab('form');
        this.renderFolders();
        this.loadImage();
    },

    switchView(viewName) {
        state.view = viewName;
        const dbBtn = document.getElementById('btn-nav-dashboard');
        const wsBtn = document.getElementById('btn-nav-workspace');
        const scBtn = document.getElementById('btn-nav-search');
        
        const activeClass = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 bg-gt-sky text-gt-dark shadow-md";
        const inactiveClass = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10";

        if(dbBtn) dbBtn.className = viewName === 'dashboard' ? activeClass : inactiveClass;
        if(wsBtn) wsBtn.className = viewName === 'workspace' ? activeClass : inactiveClass;
        if(scBtn) scBtn.className = viewName === 'search' ? activeClass : inactiveClass;

        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('workspace-view').classList.add('hidden');
        document.getElementById('search-view').classList.add('hidden');

        if (viewName === 'dashboard') {
            document.getElementById('dashboard-view').classList.remove('hidden');
            if (app.renderDashboard) app.renderDashboard();
        } else if (viewName === 'workspace') {
            document.getElementById('workspace-view').classList.remove('hidden');
        } else if (viewName === 'search') {
            document.getElementById('search-view').classList.remove('hidden');
            this.renderSearchTable();
        }
    },

    switchLeftTab(tabName) {
        state.leftTab = tabName;
        const tabFolders = document.getElementById('tab-folders');
        const tabForm = document.getElementById('tab-form');
        const panelFolders = document.getElementById('panel-folders');
        const panelForm = document.getElementById('panel-form');
        const navControls = document.getElementById('nav-controls');
        const fileHeader = document.getElementById('current-file-header');

        if (tabName === 'folders') {
            tabFolders.className = "flex-1 py-3.5 text-sm font-bold flex justify-center items-center gap-2 transition-colors text-gt-blue border-b-4 border-gt-blue bg-gt-light";
            tabForm.className = "flex-1 py-3.5 text-sm font-bold flex justify-center items-center gap-2 transition-colors text-slate-400 hover:bg-slate-50 disabled:opacity-50 border-b-4 border-transparent";
            panelFolders.classList.remove('hidden');
            panelForm.classList.add('hidden');
            navControls.classList.add('hidden');
            fileHeader.classList.add('hidden');
        } else {
            tabForm.className = "flex-1 py-3.5 text-sm font-bold flex justify-center items-center gap-2 transition-colors text-gt-blue border-b-4 border-gt-blue bg-gt-light";
            tabFolders.className = "flex-1 py-3.5 text-sm font-bold flex justify-center items-center gap-2 transition-colors text-slate-400 hover:bg-slate-50 disabled:opacity-50 border-b-4 border-transparent";
            panelForm.classList.remove('hidden');
            panelFolders.classList.add('hidden');
            if (state.images.length > 0) {
                navControls.classList.remove('hidden');
                fileHeader.classList.remove('hidden');
                this.renderForm();
            }
        }
    },

    updateRecord(fieldId, value) {
        if (!state.isAdmin) return;
        let fullPath = state.images[state.currentIndex].fullPath;
        if (state.collectionConfig && state.collectionConfig.mode === 'folder') {
            fullPath = state.activeFolder;
        }

        if (!state.records[fullPath]) state.records[fullPath] = [{}];
        if (!Array.isArray(state.records[fullPath])) {
            state.records[fullPath] = [state.records[fullPath]];
        }

        state.records[fullPath][state.subRecordIndex][fieldId] = value;
        // Guardado directo en IndexedDB para persistencia anti-cierres
        db.put(fullPath, state.records[fullPath]);
        
        // Guardado local (File System Access)
        app.saveLocalMetadata(fullPath);
    },

    applyBatchData() {
        if (!state.isAdmin) return;
        const folderName = state.activeFolder.split('/').pop();

        const confirmLibro = prompt(`Aplicar texto a las ${state.images.length} imágenes del lote:`, folderName);
        if (confirmLibro === null) return;
        
        const confirmUbicacion = prompt(`(Opcional) Ubicación física de este lote (Ej. Estante A):`, "");

        state.images.forEach((item, index) => {
            let fullPath = item.fullPath;
            if (state.collectionConfig && state.collectionConfig.mode === 'folder') {
                fullPath = state.activeFolder;
            }

            if (!state.records[fullPath]) state.records[fullPath] = [{}];
            if (!Array.isArray(state.records[fullPath])) {
                state.records[fullPath] = [state.records[fullPath]];
            }
            state.records[fullPath].forEach((record, subIndex) => {
                record['nombre_libro'] = confirmLibro;
                if (confirmUbicacion) record['ubicacion_fisica'] = confirmUbicacion;
                
                if (!record['codigo_rastreo']) {
                    const serialCode = `${folderName}-${String(index + 1).padStart(4, '0')}${subIndex > 0 ? '.'+subIndex : ''}`;
                    record['codigo_rastreo'] = serialCode;
                }
            });
            app.saveLocalMetadata(fullPath);
        });

        // Sincronizar actualización masiva con IndexedDB
        db.putBulk(state.records);

        this.renderForm();
        alert(`Autocompletado exitoso y trazabilidad añadida.`);
    },

    renderFolders() {
        const container = document.getElementById('folders-container');
        container.innerHTML = '';

        Object.keys(state.folders).forEach(folder => {
            const isActive = state.activeFolder === folder;
            const count = state.folders[folder].length;

            const btn = document.createElement('button');
            btn.onclick = () => this.selectFolder(folder);
            btn.className = `w-full text-left p-4 rounded-xl flex flex-col gap-2 transition-all border ${isActive ? 'bg-gt-dark text-white border-slate-800 shadow-lg transform scale-[1.02]' : 'bg-white text-slate-700 hover:bg-gt-light border-slate-200 shadow-sm hover:border-gt-sky'}`;

            btn.innerHTML = `
    <div class="flex items-center justify-between w-full">
       <span class="font-extrabold text-sm break-all pr-2 flex items-center gap-2">
          <i data-lucide="${isActive ? 'folder-open' : 'folder'}" class="${isActive ? 'text-gt-sky' : 'text-gt-blue'} w-5 h-5 flex-shrink-0"></i>
          ${folder.split('/').pop()}
       </span>
    </div>
    <div class="flex items-center justify-between w-full">
       <span class="text-xs px-2.5 py-1 rounded-md font-bold ${isActive ? 'bg-slate-800 text-gt-sky' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
          ${count} docs
       </span>
       <span class="text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-400'}">Consultar &rarr;</span>
    </div>
  `;
            container.appendChild(btn);
        });
        lucide.createIcons();
    },

    switchSubRecord(index) {
        state.subRecordIndex = index;
        this.renderForm();
    },

    addSubRecord() {
        if (!state.isAdmin) return;
        let fullPath = state.images[state.currentIndex].fullPath;
        if (state.collectionConfig && state.collectionConfig.mode === 'folder') {
            fullPath = state.activeFolder;
        }

        if (!state.records[fullPath]) state.records[fullPath] = [{}];
        if (!Array.isArray(state.records[fullPath])) {
            state.records[fullPath] = [state.records[fullPath]];
        }
        
        if (state.records[fullPath].length >= 4) {
            alert("El límite máximo es 4 registros por documento.");
            return;
        }

        state.records[fullPath].push({});
        state.subRecordIndex = state.records[fullPath].length - 1;
        this.renderForm();
        
        db.put(fullPath, state.records[fullPath]);
        app.saveLocalMetadata(fullPath);
    },

    renderForm() {
        const container = document.getElementById('dynamic-form-container');
        if (!container) return;
        container.innerHTML = '';

        let fullPath = state.images.length > 0 ? state.images[state.currentIndex].fullPath : null;
        if (state.collectionConfig && state.collectionConfig.mode === 'folder' && state.activeFolder) {
            fullPath = state.activeFolder;
        }
        
        if (fullPath) {
            if (state.records[fullPath] && !Array.isArray(state.records[fullPath])) {
                state.records[fullPath] = [state.records[fullPath]];
            }
        }
        
        const recordsArray = fullPath && state.records[fullPath] ? state.records[fullPath] : [{}];
        
        if (state.subRecordIndex >= recordsArray.length) {
            state.subRecordIndex = 0;
        }
        
        const recordData = recordsArray[state.subRecordIndex] || {};

        // Subrecord Tabs
        const tabsDiv = document.createElement('div');
        tabsDiv.className = "flex gap-2 mb-4 overflow-x-auto pb-1";
        
        recordsArray.forEach((_, index) => {
            const btn = document.createElement('button');
            const isActive = state.subRecordIndex === index;
            btn.className = `px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${isActive ? 'bg-gt-blue text-white shadow-sm border-gt-blue' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200'}`;
            btn.innerText = `Registro ${index + 1}`;
            btn.onclick = () => this.switchSubRecord(index);
            tabsDiv.appendChild(btn);
        });

        if (state.isAdmin && recordsArray.length < 4) {
            const addBtn = document.createElement('button');
            addBtn.className = "px-2 py-1.5 text-xs font-bold rounded-lg bg-gt-sky/30 text-gt-dark hover:bg-gt-sky/60 transition-colors flex items-center gap-1 border border-gt-sky/40";
            addBtn.innerHTML = `<i data-lucide="plus" class="w-3 h-3"></i> Añadir`;
            addBtn.onclick = () => this.addSubRecord();
            tabsDiv.appendChild(addBtn);
        }
        
        container.appendChild(tabsDiv);

        state.schema.forEach(field => {
            const div = document.createElement('div');
            div.className = "space-y-1.5";

            const label = document.createElement('label');
            label.className = "text-xs font-extrabold uppercase tracking-wide text-gt-blue block ml-1";
            label.innerText = field.label;
            div.appendChild(label);

            if (field.type === 'textarea') {
                const textarea = document.createElement('textarea');
                textarea.className = `w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gt-sky focus:border-gt-sky transition-all outline-none resize-y min-h-[120px] shadow-sm text-sm font-medium text-slate-800 ${!state.isAdmin ? 'opacity-80 bg-slate-100 cursor-not-allowed' : ''}`;
                textarea.placeholder = state.isAdmin ? `Escribir ${field.label.toLowerCase()}...` : 'Sin datos registrados';
                textarea.value = recordData[field.id] || '';
                if (state.isAdmin) textarea.oninput = (e) => this.updateRecord(field.id, e.target.value);
                else textarea.readOnly = true;
                div.appendChild(textarea);
            } else {
                const input = document.createElement('input');
                input.type = field.type;
                input.className = `w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gt-sky focus:border-gt-sky transition-all outline-none shadow-sm text-sm font-medium text-slate-800 ${!state.isAdmin ? 'opacity-80 bg-slate-100 cursor-not-allowed' : ''}`;
                input.placeholder = state.isAdmin ? `Escribir ${field.label.toLowerCase()}...` : 'Sin datos registrados';
                input.value = recordData[field.id] || '';
                if (state.isAdmin) input.oninput = (e) => this.updateRecord(field.id, e.target.value);
                else input.readOnly = true;
                div.appendChild(input);
            }

            container.appendChild(div);
        });
        lucide.createIcons();
    },

    addField() {
        if (!state.isAdmin) return;
        const fieldName = prompt("Nombre del nuevo campo:");
        if (fieldName) {
            const fieldId = fieldName.toLowerCase().replace(/\s+/g, '_');
            state.schema.push({ id: fieldId, label: fieldName, type: 'text' });
            this.renderForm();
            if (state.view === 'search') this.renderSearchTable();
        }
    },

    renderSearchTable() {
        const term = document.getElementById('search-input').value.toLowerCase();
        const keys = Object.keys(state.records);

        let headerText = `${keys.length} registros gestionados por IndexedDB.`;

        const filtered = keys.filter(pathKey => {
            let dataArr = state.records[pathKey];
            if (!Array.isArray(dataArr)) dataArr = [dataArr];

            if (pathKey.toLowerCase().includes(term)) return true;
            
            return dataArr.some(recordData => 
                Object.values(recordData).some(val => String(val).toLowerCase().includes(term))
            );
        });

        // LÍMITE DE DOM PARA EVITAR CONGELAMIENTO (Carga solo los primeros 100 resultados)
        const MAX_RESULTS = 100;
        const displayResults = filtered.slice(0, MAX_RESULTS);

        if (filtered.length > MAX_RESULTS) {
            headerText += ` (Mostrando los primeros ${MAX_RESULTS} por rendimiento)`;
        }
        document.getElementById('lbl-records-count').innerText = headerText;

        const tbody = document.getElementById('search-table-body');
        const thead = document.getElementById('search-table-head');
        tbody.innerHTML = '';
        thead.innerHTML = '';

        if (displayResults.length === 0) {
            document.getElementById('search-empty').classList.remove('hidden');
            return;
        } else {
            document.getElementById('search-empty').classList.add('hidden');
        }

        let headHtml = '<tr><th class="p-5 border-b border-slate-200 font-extrabold text-gt-dark text-sm tracking-wide bg-gt-light">Referencia Interna (.dig)</th>';
        state.schema.forEach(field => {
            headHtml += `<th class="p-5 border-b border-slate-200 font-extrabold text-gt-dark text-sm tracking-wide bg-gt-light">${field.label}</th>`;
        });
        headHtml += '</tr>';
        thead.innerHTML = headHtml;

        displayResults.forEach(pathKey => {
            let dataArr = state.records[pathKey];
            if (!Array.isArray(dataArr)) dataArr = [dataArr];

            dataArr.forEach((data, index) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gt-light/50 transition-colors group cursor-default";

                let displayPath = pathKey;
                if (dataArr.length > 1) {
                    displayPath += ` <span class="text-xs bg-slate-200 px-1.5 py-0.5 rounded-md text-slate-500 font-bold ml-2 border border-slate-300">Reg ${index + 1}</span>`;
                }
                
                if (state.mode === 'package' && displayPath.endsWith('.dig')) displayPath = displayPath.replace(/\.dig$/i, '<span class="text-xs ml-1 bg-gt-sky text-gt-dark px-1 rounded font-bold">.dig</span>');

                let rowHtml = `<td class="p-4 font-bold text-slate-700 flex items-center gap-3"><i data-lucide="${state.mode === 'package' ? 'package' : 'file-lock-2'}" class="text-gt-blue w-5 h-5 flex-shrink-0"></i><span class="truncate max-w-[250px]" title="${pathKey}">${displayPath}</span></td>`;

                state.schema.forEach(field => {
                    rowHtml += `<td class="p-4 text-slate-700 max-w-[200px] truncate text-sm font-medium">${data[field.id] || '<span class="text-slate-300 italic">-</span>'}</td>`;
                });

                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);
            });
        });
        lucide.createIcons();
    },

    toggleGroupField() {
        const mode = document.getElementById('select-index-mode').value;
        if (mode === 'field') {
            document.getElementById('container-group-field').classList.remove('hidden');
        } else {
            document.getElementById('container-group-field').classList.add('hidden');
        }
    },

    openSecurityModal() {
        if (!state.isAdmin) return;
        document.getElementById('input-consult-pwd').value = (state.collectionPasswords && state.collectionPasswords.consult) ? state.collectionPasswords.consult : '';
        document.getElementById('input-admin-pwd').value = (state.collectionPasswords && state.collectionPasswords.admin) ? state.collectionPasswords.admin : '';
        
        if (state.collectionConfig) {
            document.getElementById('select-index-mode').value = state.collectionConfig.mode || 'standard';
            document.getElementById('input-group-field').value = state.collectionConfig.groupField || '';
        } else {
            document.getElementById('select-index-mode').value = 'standard';
            document.getElementById('input-group-field').value = '';
        }
        app.toggleGroupField();

        document.getElementById('modal-security-config').classList.remove('hidden');
    },

    saveSecurityFromModal() {
        const consultPwd = document.getElementById('input-consult-pwd').value;
        const adminPwd = document.getElementById('input-admin-pwd').value;
        const indexMode = document.getElementById('select-index-mode').value;
        const groupField = document.getElementById('input-group-field').value;
        
        app.saveSecurityConfig(consultPwd, adminPwd, indexMode, groupField);
        document.getElementById('modal-security-config').classList.add('hidden');
    }
});

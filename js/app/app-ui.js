window.app = window.app || {};

Object.assign(window.app, {
    selectFolder(folderName) {
        state.activeFolder = folderName;
        state.images = state.folders[folderName] || [];
        state.currentIndex = 0;

        this.switchLeftTab('form');
        this.renderFolders();
        this.loadImage();
    },

    switchView(viewName) {
        state.view = viewName;
        const wsBtn = document.getElementById('btn-nav-workspace');
        const scBtn = document.getElementById('btn-nav-search');

        if (viewName === 'workspace') {
            wsBtn.className = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 bg-gt-sky text-gt-dark shadow-md";
            scBtn.className = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10";
            document.getElementById('workspace-view').classList.remove('hidden');
            document.getElementById('search-view').classList.add('hidden');
        } else {
            scBtn.className = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 bg-gt-sky text-gt-dark shadow-md";
            wsBtn.className = "px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10";
            document.getElementById('workspace-view').classList.add('hidden');
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
        const fullPath = state.images[state.currentIndex].fullPath;
        if (!state.records[fullPath]) state.records[fullPath] = {};

        state.records[fullPath][fieldId] = value;
        // Guardado directo en IndexedDB para persistencia anti-cierres
        db.put(fullPath, state.records[fullPath]);
    },

    applyBatchData() {
        if (!state.isAdmin) return;
        const folderName = state.activeFolder.split('/').pop();

        const confirmLibro = prompt(`Aplicar texto a las ${state.images.length} imágenes del lote:`, folderName);
        if (confirmLibro === null) return;

        state.images.forEach(item => {
            if (!state.records[item.fullPath]) state.records[item.fullPath] = {};
            state.records[item.fullPath]['nombre_libro'] = confirmLibro;
        });

        // Sincronizar actualización masiva con IndexedDB
        db.putBulk(state.records);

        this.renderForm();
        alert(`Autocompletado exitoso y respaldado en la base de datos local.`);
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

    renderForm() {
        const container = document.getElementById('dynamic-form-container');
        container.innerHTML = '';

        const fullPath = state.images.length > 0 ? state.images[state.currentIndex].fullPath : null;
        const recordData = fullPath && state.records[fullPath] ? state.records[fullPath] : {};

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
            if (pathKey.toLowerCase().includes(term)) return true;
            return Object.values(state.records[pathKey]).some(val => String(val).toLowerCase().includes(term));
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
            const data = state.records[pathKey];
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gt-light/50 transition-colors group cursor-default";

            let displayPath = pathKey;
            if (state.mode === 'package' && displayPath.endsWith('.dig')) displayPath = displayPath.replace(/\.dig$/i, '<span class="text-xs ml-1 bg-gt-sky text-gt-dark px-1 rounded font-bold">.dig</span>');

            let rowHtml = `<td class="p-4 font-bold text-slate-700 flex items-center gap-3"><i data-lucide="${state.mode === 'package' ? 'package' : 'file-lock-2'}" class="text-gt-blue w-5 h-5 flex-shrink-0"></i><span class="truncate max-w-[250px]" title="${pathKey}">${displayPath}</span></td>`;

            state.schema.forEach(field => {
                rowHtml += `<td class="p-4 text-slate-700 max-w-[200px] truncate text-sm font-medium">${data[field.id] || '<span class="text-slate-300 italic">-</span>'}</td>`;
            });

            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    }
});

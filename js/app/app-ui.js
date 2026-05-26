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
        document.getElementById('welcome-screen').classList.add('hidden');

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
        });

        // Guardar metadatos locales una sola vez para toda la carpeta activa
        app.saveLocalMetadata(state.activeFolder);

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

            // Jerarquía de la ruta
            const parts = folder.split('/');
            const trabajoName = parts[parts.length - 1];
            const bookName    = parts.length >= 2 ? parts[parts.length - 2] : '';
            const colName     = parts.length >= 3 ? parts[parts.length - 3] : '';

            // Contar actas únicas en esta carpeta
            const uniqueActas = new Set();
            state.folders[folder].forEach(img => {
                const r = state.records[img.fullPath];
                if (r && r[0] && r[0]._num_acta) uniqueActas.add(r[0]._num_acta);
            });
            const actaCount = uniqueActas.size;

            const btn = document.createElement('button');
            btn.onclick = () => this.selectFolder(folder);
            btn.className = `w-full text-left p-4 rounded-xl flex flex-col gap-1.5 transition-all border ${isActive ? 'bg-gt-dark text-white border-slate-800 shadow-lg transform scale-[1.02]' : 'bg-white text-slate-700 hover:bg-gt-light border-slate-200 shadow-sm hover:border-gt-sky'}`;

            btn.innerHTML = `
    <div class="flex items-start justify-between w-full gap-2">
       <span class="font-extrabold text-sm break-all flex items-center gap-2">
          <i data-lucide="${isActive ? 'folder-open' : 'folder'}" class="${isActive ? 'text-gt-sky' : 'text-gt-blue'} w-5 h-5 flex-shrink-0"></i>
          ${trabajoName}
       </span>
    </div>
    ${bookName ? `<div class="flex items-center gap-1.5 pl-7">
       <i data-lucide="book" class="${isActive ? 'text-slate-400' : 'text-slate-300'} w-3 h-3 flex-shrink-0"></i>
       <span class="text-xs font-semibold truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}">${bookName}</span>
    </div>` : ''}
    ${colName ? `<div class="flex items-center gap-1.5 pl-7">
       <i data-lucide="archive" class="${isActive ? 'text-slate-500' : 'text-slate-300'} w-3 h-3 flex-shrink-0"></i>
       <span class="text-[10px] font-medium truncate ${isActive ? 'text-slate-400' : 'text-slate-400'}">${colName}</span>
    </div>` : ''}
    <div class="flex items-center justify-between w-full mt-0.5">
       <div class="flex items-center gap-1.5">
          <span class="text-xs px-2.5 py-1 rounded-md font-bold ${isActive ? 'bg-slate-800 text-gt-sky' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
             ${count} imágenes
          </span>
          ${actaCount > 0 ? `<span class="text-xs px-2 py-1 rounded-md font-bold ${isActive ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}">&#128204; ${actaCount} actas</span>` : ''}
       </div>
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
        
        let resolvedRecord = fullPath ? app.getRecord(fullPath) : null;
        if (fullPath && resolvedRecord) {
            if (!Array.isArray(resolvedRecord)) {
                resolvedRecord = [resolvedRecord];
                state.records[fullPath] = resolvedRecord;
            }
        }
        
        const recordsArray = fullPath && resolvedRecord ? resolvedRecord : [{}];
        
        if (state.subRecordIndex >= recordsArray.length) {
            state.subRecordIndex = 0;
        }
        
        const recordData = recordsArray[state.subRecordIndex] || {};

        // --- WIDGET DE ACTA (solo modo standard, solo admin) ---
        const isStandardMode = !state.collectionConfig || state.collectionConfig.mode !== 'folder';
        if (isStandardMode && state.images.length > 0 && fullPath) {
            if (!state.actaModeActive) {
                // Modo normal: botón discreto para activar
                if (state.isAdmin) {
                    const actaBtn = document.createElement('div');
                    actaBtn.className = 'mb-3';
                    actaBtn.innerHTML = `
                        <button onclick="app.toggleActaMode()"
                            class="w-full py-2 px-3 text-xs font-bold text-slate-400 border border-dashed border-slate-300 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors flex items-center justify-center gap-2">
                            <i data-lucide="files" class="w-3.5 h-3.5"></i> Trabajar imagen como parte de un Acta Multipágina
                        </button>`;
                    container.appendChild(actaBtn);
                }
            } else {
                // Modo acta activo: panel completo (Solo Admin) o Badge Estático (Consultor)
                const rec0      = (resolvedRecord && resolvedRecord[0]) ? resolvedRecord[0] : {};
                const numActa   = rec0._num_acta   || state.currentActaNum || '';
                const numPagina = rec0._num_pagina || '';
                const isIncluded = !!rec0._num_acta;

                if (state.isAdmin) {
                    let actaImgCount = 0;
                    if (numActa) state.images.forEach(img => { const r = app.getRecord(img.fullPath); if (r && r[0] && r[0]._num_acta === numActa) actaImgCount++; });

                    const actaWidget = document.createElement('div');
                    actaWidget.className = 'bg-indigo-50 border border-indigo-300 rounded-xl p-3 mb-3';
                    actaWidget.innerHTML = `
                        <div class="flex items-center justify-between mb-2.5">
                            <div class="flex items-center gap-1.5">
                                <i data-lucide="files" class="w-3.5 h-3.5 text-indigo-600"></i>
                                <span class="text-xs font-extrabold uppercase tracking-wide text-indigo-700">Modo Acta Activo</span>
                                <span id="lbl-acta-img-count" class="${actaImgCount > 1 ? 'text-xs font-bold bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md' : 'hidden'}">
                                    ${actaImgCount > 1 ? '📄 ' + actaImgCount + ' imágenes' : ''}
                                </span>
                            </div>
                            <button onclick="app.toggleActaMode()" class="text-xs text-indigo-400 hover:text-indigo-700 font-bold flex items-center gap-1">
                                <i data-lucide="x" class="w-3 h-3"></i> Salir
                            </button>
                        </div>
                        <div class="mb-2">
                            <label class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide block mb-1">N° Acta</label>
                            <input id="input-num-acta" type="text" placeholder="Ej: 1, 47, M-001…" value="${numActa}"
                                class="w-full p-2 text-sm bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none font-bold text-slate-800"
                                oninput="app.setCurrentActaNum(this.value)" />
                        </div>
                        <label class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-indigo-100 transition-colors ${isIncluded ? 'mb-2' : ''} bg-white/60 border border-indigo-100">
                            <input type="checkbox" id="chk-imagen-en-acta" ${isIncluded ? 'checked' : ''}
                                onchange="app.includeImageInActa(this.checked)"
                                class="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                            <span class="text-sm font-semibold text-slate-700">Esta imagen es página de este acta</span>
                            ${isIncluded && numPagina ? `<span class="ml-auto text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">Pág. ${numPagina}</span>` : ''}
                        </label>
                        ${isIncluded ? `
                        <div class="flex gap-2 mt-2">
                            <div class="flex items-center gap-2 flex-1">
                                <label class="text-[10px] font-bold text-indigo-500 uppercase tracking-wide whitespace-nowrap">Pág. #</label>
                                <input id="input-num-pagina" type="text" placeholder="1, 2…" value="${numPagina}"
                                    class="w-full p-2 text-sm bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none font-bold text-slate-800"
                                    oninput="app.setNumPagina(this.value)" />
                            </div>
                            <button onclick="app.nextActaPage()" title="Asignar siguiente página del mismo acta a la imagen siguiente y avanzar"
                                class="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i> Siguiente pág.
                            </button>
                        </div>` : ''}
                    `;
                    container.appendChild(actaWidget);
                } else if (isIncluded && numActa) {
                    // Consultor: Mostrar una elegante placa informativa estática
                    const actaWidget = document.createElement('div');
                    actaWidget.className = 'bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 mb-3 flex items-center gap-3.5';
                    actaWidget.innerHTML = `
                        <div class="bg-indigo-100 p-2 rounded-lg text-indigo-600 shrink-0">
                            <i data-lucide="files" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider">Acta Multipágina Registrada</p>
                            <p class="text-sm font-semibold text-slate-700 mt-0.5">Acta N° <span class="font-black text-indigo-700">${numActa}</span> (Pág. ${numPagina || '1'})</p>
                        </div>
                    `;
                    container.appendChild(actaWidget);
                }
            }
        }

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
                if (state.isAdmin) {
                    const textarea = document.createElement('textarea');
                    textarea.className = `w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gt-sky focus:border-gt-sky transition-all outline-none resize-y min-h-[120px] shadow-sm text-sm font-medium text-slate-800`;
                    textarea.placeholder = `Escribir ${field.label.toLowerCase()}...`;
                    textarea.value = recordData[field.id] || '';
                    textarea.oninput = (e) => this.updateRecord(field.id, e.target.value);
                    div.appendChild(textarea);
                } else {
                    const p = document.createElement('p');
                    p.className = "text-sm text-slate-800 font-semibold whitespace-pre-wrap bg-slate-50/50 p-4 rounded-xl border-l-4 border-l-gt-blue border-y border-r border-slate-200 shadow-xs";
                    p.innerText = recordData[field.id] || 'Sin datos registrados';
                    div.appendChild(p);
                }
            } else {
                if (state.isAdmin) {
                    const input = document.createElement('input');
                    input.type = field.type;
                    input.className = `w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gt-sky focus:border-gt-sky transition-all outline-none shadow-sm text-sm font-medium text-slate-800`;
                    input.placeholder = `Escribir ${field.label.toLowerCase()}...`;
                    input.value = recordData[field.id] || '';
                    input.oninput = (e) => this.updateRecord(field.id, e.target.value);
                    div.appendChild(input);
                } else {
                    const p = document.createElement('p');
                    p.className = "text-sm text-slate-800 font-semibold bg-slate-50/50 p-3.5 rounded-xl border-l-4 border-l-gt-sky border-y border-r border-slate-200 shadow-xs";
                    p.innerText = recordData[field.id] || 'Sin datos registrados';
                    div.appendChild(p);
                }
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
            return dataArr.some(d => Object.values(d).some(v => String(v).toLowerCase().includes(term)));
        });

        const MAX_RESULTS = 100;
        const displayResults = filtered.slice(0, MAX_RESULTS);
        if (filtered.length > MAX_RESULTS) headerText += ` (Mostrando los primeros ${MAX_RESULTS})`;
        document.getElementById('lbl-records-count').innerText = headerText;

        const tbody = document.getElementById('search-table-body');
        const thead = document.getElementById('search-table-head');
        tbody.innerHTML = '';
        thead.innerHTML = '';
        state.searchResults = [];

        if (displayResults.length === 0) {
            document.getElementById('search-empty').classList.remove('hidden');
            return;
        }
        document.getElementById('search-empty').classList.add('hidden');

        // Cabecera
        let headHtml = '<tr>';
        headHtml += '<th class="p-4 border-b border-slate-200 font-extrabold text-gt-dark text-sm bg-gt-light">Acta</th>';
        headHtml += '<th class="p-4 border-b border-slate-200 font-extrabold text-gt-dark text-sm bg-gt-light">Referencia</th>';
        state.schema.forEach(f => { headHtml += `<th class="p-4 border-b border-slate-200 font-extrabold text-gt-dark text-sm bg-gt-light">${f.label}</th>`; });
        headHtml += '<th class="p-4 border-b border-slate-200 bg-gt-light"></th>';
        headHtml += '</tr>';
        thead.innerHTML = headHtml;

        // Agrupar por Nº Acta
        const actaGroups = {};
        const ungrouped  = [];
        displayResults.forEach(pathKey => {
            const dataArr = state.records[pathKey];
            if (!Array.isArray(dataArr) || !dataArr.length) return;
            const rec0    = dataArr[0] || {};
            const numActa = rec0._num_acta || '';
            if (numActa) {
                const folder   = pathKey.substring(0, pathKey.lastIndexOf('/'));
                const groupKey = folder + '\x00' + numActa;
                if (!actaGroups[groupKey]) actaGroups[groupKey] = { numActa, pages: [], primaryData: rec0, folder };
                actaGroups[groupKey].pages.push({ pathKey, rec0, pagina: rec0._num_pagina || '' });
            } else {
                ungrouped.push(pathKey);
            }
        });
        Object.values(actaGroups).forEach(g => g.pages.sort((a,b) => (parseInt(a.pagina)||0)-(parseInt(b.pagina)||0)));

        // Renderizar actas agrupadas
        Object.values(actaGroups).forEach(group => {
            const idx  = state.searchResults.length;
            state.searchResults.push({ type: 'acta', numActa: group.numActa, folder: group.folder, pages: group.pages, primaryData: group.primaryData });

            const data      = group.primaryData;
            const pageCount = group.pages.length;
            const pagesDesc = group.pages.map(p => p.pagina ? `p.${p.pagina}` : '').filter(Boolean).join(', ');

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-indigo-50 transition-colors cursor-pointer border-l-4 border-indigo-400 bg-indigo-50/20 group';
            tr.onclick = () => app.openSearchDetail(idx);
            tr.dataset.searchIdx = idx;

            let cells = `<td class="p-4">
                <div class="flex items-center gap-2">
                    <span class="font-extrabold text-indigo-700 text-sm bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200">#${group.numActa}</span>
                    <span class="text-xs font-bold text-indigo-500 bg-white px-2 py-0.5 rounded-md border border-indigo-200">${pageCount} pág${pageCount!==1?'s':''}${pagesDesc?' ('+pagesDesc+')':''}</span>
                </div></td>`;
            cells += `<td class="p-4 text-slate-400 text-xs max-w-[160px] truncate" title="${group.folder}">${group.folder.split('/').slice(-2).join('/')}</td>`;
            state.schema.forEach(f => { cells += `<td class="p-4 text-slate-700 max-w-[160px] truncate text-sm">${data[f.id]||'<span class="text-slate-300">-</span>'}</td>`; });
            cells += `<td class="p-4"><span class="opacity-0 group-hover:opacity-100 text-xs text-indigo-600 font-bold whitespace-nowrap">Ver →</span></td>`;

            tr.innerHTML = cells;
            tbody.appendChild(tr);
        });

        // Renderizar registros sin acta
        ungrouped.forEach(pathKey => {
            let dataArr = state.records[pathKey];
            if (!Array.isArray(dataArr)) dataArr = [dataArr];

            const idx = state.searchResults.length;
            state.searchResults.push({ type: 'single', pathKey, dataArr });

            const data = dataArr[0] || {};
            const tr   = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors cursor-pointer group';
            tr.onclick = () => app.openSearchDetail(idx);
            tr.dataset.searchIdx = idx;

            const subBadge = dataArr.length > 1 ? ` <span class="text-[10px] bg-slate-200 px-1 rounded text-slate-500 font-bold">${dataArr.length} reg.</span>` : '';
            let cells = `<td class="p-4"><span class="text-xs text-slate-300 italic">Sin acta</span></td>`;
            cells += `<td class="p-4">
                <div class="flex items-center gap-2">
                    <i data-lucide="${state.mode==='package'?'package':'file-lock-2'}" class="text-gt-blue w-4 h-4 shrink-0"></i>
                    <span class="truncate max-w-[140px] text-sm font-medium text-slate-700" title="${pathKey}">${pathKey.split('/').pop()}${subBadge}</span>
                </div></td>`;
            state.schema.forEach(f => { cells += `<td class="p-4 text-slate-700 max-w-[160px] truncate text-sm">${data[f.id]||'<span class="text-slate-300">-</span>'}</td>`; });
            cells += `<td class="p-4"><span class="opacity-0 group-hover:opacity-100 text-xs text-gt-blue font-bold whitespace-nowrap">Ver →</span></td>`;

            tr.innerHTML = cells;
            tbody.appendChild(tr);
        });

        lucide.createIcons();
    },

    // --- VISOR DE DETALLE DEL BUSCADOR ---
    openSearchDetail(idx) {
        state.selectedSearchIndex = idx;
        state.currentActaPageIndex = 0;
        // Resaltar fila seleccionada
        document.querySelectorAll('#search-table-body tr').forEach(tr => {
            const isSelected = parseInt(tr.dataset.searchIdx) === idx;
            tr.classList.toggle('ring-2',     isSelected);
            tr.classList.toggle('ring-inset', isSelected);
            tr.classList.toggle('ring-gt-blue', isSelected);
        });
        document.getElementById('modal-search-detail').classList.remove('hidden');
        this._renderSearchDetail();
        lucide.createIcons();
    },

    closeSearchDetail() {
        document.getElementById('modal-search-detail').classList.add('hidden');
        if (state._searchDetailObjectUrl) {
            if (state._searchDetailObjectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(state._searchDetailObjectUrl);
            }
            state._searchDetailObjectUrl = null;
        }
        document.getElementById('sd-img').style.display = 'none';
        document.getElementById('sd-img').src = '';
    },

    navSearchResult(dir) {
        const next = state.selectedSearchIndex + dir;
        if (next < 0 || next >= state.searchResults.length) return;
        state.currentActaPageIndex = 0;
        state.selectedSearchIndex  = next;
        // Actualizar selección visual en tabla
        document.querySelectorAll('#search-table-body tr').forEach(tr => {
            const isSelected = parseInt(tr.dataset.searchIdx) === next;
            tr.classList.toggle('ring-2',      isSelected);
            tr.classList.toggle('ring-inset',  isSelected);
            tr.classList.toggle('ring-gt-blue',isSelected);
            if (isSelected) tr.scrollIntoView({ block: 'nearest' });
        });
        this._renderSearchDetail();
    },

    navActaPage(dir) {
        const result = state.searchResults[state.selectedSearchIndex];
        if (!result || result.type !== 'acta') return;
        const next = state.currentActaPageIndex + dir;
        if (next < 0 || next >= result.pages.length) return;
        state.currentActaPageIndex = next;
        this._renderSearchDetail();
    },

    async _renderSearchDetail() {
        const idx    = state.selectedSearchIndex;
        const result = state.searchResults[idx];
        if (!result) return;

        // Contador de resultados
        document.getElementById('lbl-sd-counter').textContent = `Resultado ${idx+1} de ${state.searchResults.length}`;
        document.getElementById('btn-sd-prev').disabled = idx === 0;
        document.getElementById('btn-sd-next').disabled = idx === state.searchResults.length - 1;

        // Determinar pathKey y data según tipo
        let pathKey, data;
        const actaNav = document.getElementById('sd-acta-nav');

        if (result.type === 'acta') {
            const pageCount = result.pages.length;
            const pageIdx   = Math.min(state.currentActaPageIndex, pageCount - 1);
            state.currentActaPageIndex = pageIdx;
            const page = result.pages[pageIdx];
            pathKey = page.pathKey;
            data    = page.rec0;
            if (pageCount > 1) {
                actaNav.classList.remove('hidden');
                document.getElementById('lbl-sd-page').textContent = `Pág ${pageIdx+1}/${pageCount}`;
                document.getElementById('btn-sd-page-prev').disabled = pageIdx === 0;
                document.getElementById('btn-sd-page-next').disabled = pageIdx === pageCount - 1;
            } else {
                actaNav.classList.add('hidden');
            }
        } else {
            actaNav.classList.add('hidden');
            pathKey = result.pathKey;
            data    = result.dataArr[0] || {};
        }

        // Cargar imagen
        await this._loadSearchImage(pathKey);

        // Renderizar metadatos
        const meta = document.getElementById('sd-meta');
        meta.innerHTML = '';

        if (result.type === 'acta') {
            meta.innerHTML += `<div class="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
                <span class="font-extrabold text-indigo-700 text-lg bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200">#${result.numActa}</span>
                <span class="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">${result.pages.length} página${result.pages.length!==1?'s':''}</span>
            </div>`;
        }

        const fieldsDiv = document.createElement('div');
        fieldsDiv.className = 'space-y-4';
        state.schema.forEach(field => {
            const val = data[field.id] || '';
            fieldsDiv.innerHTML += `<div>
                <label class="text-xs font-extrabold uppercase tracking-wide text-slate-400 block mb-0.5">${field.label}</label>
                <p class="text-sm font-medium ${val ? 'text-slate-800' : 'text-slate-300 italic'}">${val || 'Sin datos'}</p>
            </div>`;
        });
        meta.appendChild(fieldsDiv);

        meta.innerHTML += `<div class="mt-5 pt-4 border-t border-slate-100">
            <p class="text-[10px] font-mono text-slate-400 break-all">${pathKey}</p>
        </div>`;
    },

    async _loadSearchImage(pathKey) {
        const imgEl = document.getElementById('sd-img');
        const noImg = document.getElementById('sd-no-img');
        imgEl.style.display = 'none';
        noImg.style.display = 'block';

        if (state._searchDetailObjectUrl) {
            if (state._searchDetailObjectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(state._searchDetailObjectUrl);
            }
            state._searchDetailObjectUrl = null;
        }

        // 1. Intentar buscar la imagen de forma global en todas las carpetas en memoria (state.folders)
        let item = null;
        for (const folder in state.folders) {
            item = state.folders[folder].find(img => img.fullPath === pathKey);
            if (item) break;
        }

        // 2. Coincidencia con variantes de extensión en todas las carpetas cargadas
        if (!item) {
            const dotIdx = pathKey.lastIndexOf('.');
            if (dotIdx !== -1) {
                const base = pathKey.substring(0, dotIdx);
                const exts = ['.jpg', '.jpeg', '.pag', '.png', '.webp', '.JPG', '.PAG'];
                for (const folder in state.folders) {
                    for (const ext of exts) {
                        const alt = base + ext;
                        item = state.folders[folder].find(img => img.fullPath === alt);
                        if (item) break;
                    }
                    if (item) break;
                }
            }
        }

        // 3. Coincidencia solo por nombre de archivo (ignora carpetas)
        if (!item) {
            const parts = pathKey.split('/');
            const filenameWithExt = parts.pop();
            const dotIdx2 = filenameWithExt.lastIndexOf('.');
            if (dotIdx2 !== -1) {
                const filenameNoExt = filenameWithExt.substring(0, dotIdx2).toLowerCase();
                for (const folder in state.folders) {
                    item = state.folders[folder].find(img => {
                        const kParts = img.fullPath.split('/');
                        const kFile = kParts.pop();
                        const kDot = kFile.lastIndexOf('.');
                        if (kDot !== -1) {
                            return kFile.substring(0, kDot).toLowerCase() === filenameNoExt;
                        }
                        return false;
                    });
                    if (item) break;
                }
            }
        }

        // 4. Si el elemento no existe en memoria (caso del consultor que reabre el catálogo vacío),
        //    intentamos cargar el archivo directamente desde el sistema de archivos local utilizando rutas relativas.
        if (!item) {
            console.log(`[_loadSearchImage] Imagen no encontrada en memoria. Probando fallback de rutas relativas locales para: ${pathKey}`);
            
            const fallbacks = [
                pathKey,
                '../' + pathKey,
                './' + pathKey
            ];

            let attemptIndex = 0;
            const tryNextFallback = () => {
                if (attemptIndex < fallbacks.length) {
                    const src = fallbacks[attemptIndex++];
                    imgEl.onload = () => {
                        console.log(`[_loadSearchImage] Fallback exitoso cargado desde: ${src}`);
                        state._searchDetailObjectUrl = src;
                        imgEl.style.display = 'block';
                        noImg.style.display = 'none';
                    };
                    imgEl.onerror = () => {
                        console.warn(`[_loadSearchImage] Fallback fallido para: ${src}`);
                        tryNextFallback();
                    };
                    imgEl.src = src;
                } else {
                    console.error(`[_loadSearchImage] Todos los fallbacks locales han fallado para: ${pathKey}`);
                    imgEl.style.display = 'none';
                    noImg.style.display = 'block';
                }
            };

            tryNextFallback();
            return;
        }

        // Cargar imagen encontrada desde memoria (Blob o File System Handle de la sesión)
        try {
            let src;
            if (item.blob) {
                src = URL.createObjectURL(item.blob);
            } else if (item.handle) {
                const file = await item.handle.getFile();
                const blob = new Blob([await file.arrayBuffer()], { type: 'image/jpeg' });
                src = URL.createObjectURL(blob);
            } else if (item.zipRef && item.internalPath) {
                // Si la imagen está en un paquete, extraer y desofuscar de ser necesario
                let zipBlob = await item.zipRef.file(item.internalPath).async("blob");
                zipBlob = new Blob([zipBlob], { type: 'image/jpeg' });
                src = URL.createObjectURL(zipBlob);
            }

            if (src) {
                state._searchDetailObjectUrl = src;
                imgEl.onload = () => {
                    imgEl.style.display = 'block';
                    noImg.style.display = 'none';
                };
                imgEl.onerror = () => {
                    imgEl.style.display = 'none';
                    noImg.style.display = 'block';
                };
                imgEl.src = src;
            }
        } catch(e) {
            console.error('Error cargando imagen de memoria en detalle:', e);
            imgEl.style.display = 'none';
            noImg.style.display = 'block';
        }
    },

    printSearchResult() {
        const result = state.searchResults[state.selectedSearchIndex];
        if (!result) return;
        let pathKey, data;
        if (result.type === 'acta') {
            const page = result.pages[state.currentActaPageIndex] || result.pages[0];
            pathKey = page.pathKey;
            data    = page.rec0;
        } else {
            pathKey = result.pathKey;
            data    = result.dataArr[0] || {};
        }
        const imgSrc = document.getElementById('sd-img').src || '';
        const imgTag = imgSrc && !imgSrc.endsWith('sd-img') ? `<img src="${imgSrc}" style="max-width:100%;max-height:380px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;display:block;margin-bottom:16px" />` : '';
        const actaH  = result.type === 'acta' ? `<div style="margin-bottom:12px"><span style="background:#e0e7ff;color:#3730a3;font-weight:bold;padding:4px 14px;border-radius:8px;font-size:14px">#Acta ${result.numActa} — ${result.pages.length} pág.</span></div>` : '';
        const fields = state.schema.map(f => `<tr><td style="font-weight:700;padding:5px 14px;color:#475569;font-size:11px;text-transform:uppercase;white-space:nowrap;vertical-align:top">${f.label}</td><td style="padding:5px 14px;font-size:13px;color:#1e293b">${data[f.id]||'<em style="color:#cbd5e1">-</em>'}</td></tr>`).join('');
        document.getElementById('print-area').innerHTML = `
            <div style="font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:28px">
                <div style="border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
                    <div>
                        <h1 style="font-size:20px;font-weight:900;color:#1e3a8a;margin:0">Archivo Histórico Digital</h1>
                        <p style="font-size:11px;color:#64748b;margin:3px 0 0">${new Date().toLocaleDateString('es-GT',{dateStyle:'long'})}</p>
                    </div>
                    <p style="font-size:10px;color:#94a3b8;font-family:monospace">${pathKey}</p>
                </div>
                ${actaH}${imgTag}
                <table style="width:100%;border-collapse:collapse">${fields}</table>
            </div>`;
        window.print();
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
    },

    // --- MÉTODOS DE AGRUPACIÓN POR ACTA ---
    toggleActaMode() {
        state.actaModeActive = !state.actaModeActive;
        if (state.actaModeActive && !state.currentActaNum) {
            // Sugerir el siguiente número disponible
            let maxNum = 0;
            state.images.forEach(img => {
                const r = state.records[img.fullPath];
                if (r && r[0] && r[0]._num_acta) { const n = parseInt(r[0]._num_acta); if (!isNaN(n) && n > maxNum) maxNum = n; }
            });
            state.currentActaNum = String(maxNum + 1);
        }
        this.renderForm();
    },

    setCurrentActaNum(value) {
        state.currentActaNum = value;
        // Si esta imagen ya está incluida en el acta, actualizar su clave
        if (!state.images.length) return;
        const fp   = state.images[state.currentIndex].fullPath;
        const rec0 = state.records[fp] && state.records[fp][0] ? state.records[fp][0] : null;
        if (rec0 && rec0._num_acta) this.setNumActa(value);
        // Actualizar badge
        let count = 0;
        if (value) state.images.forEach(img => { const r = state.records[img.fullPath]; if (r && r[0] && r[0]._num_acta === value) count++; });
        const badge = document.getElementById('lbl-acta-img-count');
        if (badge) {
            badge.textContent = count > 1 ? '📄 ' + count + ' imágenes' : '';
            badge.className   = count > 1 ? 'text-xs font-bold bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md' : 'hidden';
        }
    },

    includeImageInActa(checked) {
        if (!state.isAdmin || !state.images.length) return;
        const fp = state.images[state.currentIndex].fullPath;
        if (!state.records[fp]) state.records[fp] = [{}];
        if (!Array.isArray(state.records[fp])) state.records[fp] = [state.records[fp]];
        if (checked) {
            const numActa = state.currentActaNum || '';
            let maxPage = 0;
            state.images.forEach(img => {
                const r = state.records[img.fullPath];
                if (r && r[0] && r[0]._num_acta === numActa && r[0]._num_pagina) {
                    const n = parseInt(r[0]._num_pagina);
                    if (!isNaN(n) && n > maxPage) maxPage = n;
                }
            });
            state.records[fp][0]._num_acta   = numActa;
            state.records[fp][0]._num_pagina = String(maxPage + 1);
        } else {
            delete state.records[fp][0]._num_acta;
            delete state.records[fp][0]._num_pagina;
        }
        db.put(fp, state.records[fp]);
        app.saveLocalMetadata(fp);
        this.renderForm();
    },

    nextActaPage() {
        if (!state.isAdmin || state.currentIndex >= state.images.length - 1) return;
        const curPath = state.images[state.currentIndex].fullPath;
        const curRec0 = (state.records[curPath] && state.records[curPath][0]) ? { ...state.records[curPath][0] } : {};
        state.currentIndex++;
        const nextPath = state.images[state.currentIndex].fullPath;
        if (!state.records[nextPath]) state.records[nextPath] = [{}];
        if (!Array.isArray(state.records[nextPath])) state.records[nextPath] = [state.records[nextPath]];
        const nextRec = { ...curRec0 };
        if (curRec0._num_pagina) {
            const n = parseInt(curRec0._num_pagina);
            nextRec._num_pagina = isNaN(n) ? curRec0._num_pagina : String(n + 1);
        } else {
            nextRec._num_acta   = state.currentActaNum;
            nextRec._num_pagina = '1';
        }
        state.records[nextPath][0] = nextRec;
        db.put(nextPath, state.records[nextPath]);
        app.saveLocalMetadata(nextPath);
        this.loadImage();
    },

    setNumActa(value) {
        if (!state.isAdmin || !state.images.length) return;
        const fp = state.images[state.currentIndex].fullPath;
        if (!state.records[fp]) state.records[fp] = [{}];
        if (!Array.isArray(state.records[fp])) state.records[fp] = [state.records[fp]];
        state.records[fp][0]._num_acta = value;
        db.put(fp, state.records[fp]);
        app.saveLocalMetadata(fp);
    },

    setNumPagina(value) {
        if (!state.isAdmin || !state.images.length) return;
        const fp = state.images[state.currentIndex].fullPath;
        if (!state.records[fp]) state.records[fp] = [{}];
        if (!Array.isArray(state.records[fp])) state.records[fp] = [state.records[fp]];
        state.records[fp][0]._num_pagina = value;
        db.put(fp, state.records[fp]);
        app.saveLocalMetadata(fp);
    }
});

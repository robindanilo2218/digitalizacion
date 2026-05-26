window.app = window.app || {};

Object.assign(window.app, {
    toggleNode(nodePath) {
        state.expandedNodes[nodePath] = !state.expandedNodes[nodePath];
        this.renderDashboard();
    },

    renderDashboard() {
        const container = document.getElementById('dashboard-container');
        if (!container) return;

        if (!state.folders || Object.keys(state.folders).length === 0) {
            container.innerHTML = `
            <div class="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto flex flex-col items-center">
                <div class="w-16 h-16 bg-gt-sky/15 text-gt-blue rounded-full flex items-center justify-center mb-4">
                    <i data-lucide="folder-open" class="w-8 h-8 ${state.isAdmin ? 'animate-pulse' : ''} text-gt-blue"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-700">El Catálogo está vacío</h3>
                <p class="text-slate-500 mt-2 text-sm leading-relaxed">
                    ${state.isAdmin 
                        ? 'Utilice las siguientes herramientas para cargar las imágenes de los libros históricos o abrir un paquete digital.' 
                        : 'No hay registros ni imágenes cargadas actualmente en el sistema de consulta histórica.'}
                </p>
                
                ${state.isAdmin ? `
                    <div class="w-full border-t border-slate-100 my-6"></div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <button onclick="app.selectRootFolder()" 
                                class="flex items-center justify-center gap-2 px-5 py-3.5 bg-gt-dark hover:bg-slate-800 text-white rounded-xl transition-all shadow-md font-bold text-sm border border-slate-700 active:scale-[0.98]">
                            <i data-lucide="camera" class="w-4 h-4 shrink-0 text-gt-sky"></i>
                            Nueva Digitalización
                        </button>
                        <button onclick="document.getElementById('open-package-input').click()" 
                                class="flex items-center justify-center gap-2 px-5 py-3.5 bg-gt-blue hover:bg-opacity-95 text-white rounded-xl transition-all shadow-md font-bold text-sm border border-gt-sky active:scale-[0.98]">
                            <i data-lucide="package-open" class="w-4 h-4 shrink-0 text-gt-sky"></i>
                            Abrir Paquetes
                        </button>
                    </div>
                ` : ''}
            </div>`;
            lucide.createIcons();
            return;
        }

        // 1. Construir árbol jerárquico
        const rootNode = {
            name: "Sistema de Archivos",
            isRoot: true,
            children: {},
            imageCount: 0,
            recordCount: 0
        };

        for (let folderPath in state.folders) {
            const parts = folderPath.split('/').filter(p => p);
            if (parts.length === 0) continue;

            let rootName = "Sistema de Archivos";
            let localParts = [...parts];
            if (localParts.length > 1 && (
                localParts[0].toLowerCase().includes("sistema de archivos") ||
                localParts[0].toLowerCase().endsWith(".cll") ||
                localParts[0].toLowerCase().endsWith(".zip") ||
                localParts[0].toLowerCase().endsWith(".xlb")
            )) {
                rootName = localParts[0];
                localParts.shift();
            }

            let collectionName = localParts[0] || "Colección General";
            let bookName = localParts[1] || "Libro General";
            let trabajoName = localParts.slice(2).join(' / ') || "Trabajo General";

            // Asegurar Colección
            if (!rootNode.children[collectionName]) {
                rootNode.children[collectionName] = {
                    name: collectionName,
                    children: {},
                    imageCount: 0,
                    recordCount: 0
                };
            }

            // Asegurar Libro
            const colNode = rootNode.children[collectionName];
            if (!colNode.children[bookName]) {
                colNode.children[bookName] = {
                    name: bookName,
                    children: {},
                    imageCount: 0,
                    recordCount: 0
                };
            }

            // Asegurar Trabajo (Leaf node)
            const bookNode = colNode.children[bookName];
            if (!bookNode.children[trabajoName]) {
                const images = state.folders[folderPath];
                let recordCount = 0;
                images.forEach(img => {
                    if (app.getRecord(img.fullPath)) {
                        recordCount++;
                    }
                });

                bookNode.children[trabajoName] = {
                    name: trabajoName,
                    fullPath: folderPath,
                    images: images,
                    imageCount: images.length,
                    recordCount: recordCount
                };
            }
        }

        // 2. Calcular agregaciones de conteos (Bottom-Up)
        for (let colName in rootNode.children) {
            const colNode = rootNode.children[colName];
            for (let bookName in colNode.children) {
                const bookNode = colNode.children[bookName];
                for (let trabName in bookNode.children) {
                    const trabNode = bookNode.children[trabName];
                    bookNode.imageCount += trabNode.imageCount;
                    bookNode.recordCount += trabNode.recordCount;
                }
                colNode.imageCount += bookNode.imageCount;
                colNode.recordCount += bookNode.recordCount;
            }
            rootNode.imageCount += colNode.imageCount;
            rootNode.recordCount += colNode.recordCount;
        }

        // Inicializar estado de expansión expandidos por defecto si no existen
        const initExpanded = (path) => {
            if (state.expandedNodes[path] === undefined) {
                state.expandedNodes[path] = true; // Por defecto todo expandido
            }
        };

        initExpanded("root");

        // 3. Renderizar el Árbol con clases de Tailwind ultra premium y colores pastel de Guatemala
        let html = '';

        // Función para renderizar badge de estadísticas
        const getStatsBadge = (images, records, isLeaf = false) => {
            if (isLeaf) {
                return `<span class="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 border border-slate-200">
                    ${images} ${images === 1 ? 'imagen' : 'imágenes'}
                </span>`;
            }
            return `<div class="flex items-center gap-1.5 shrink-0">
                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold border border-slate-200">
                    ${images} imág.
                </span>
                <span class="bg-green-50 text-green-700 px-2 py-0.5 rounded-md text-xs font-extrabold border border-green-200/50 flex items-center gap-0.5">
                    <i data-lucide="check" class="w-3 h-3 text-green-600"></i> ${records} index.
                </span>
            </div>`;
        };

        const isRootExpanded = state.expandedNodes["root"];
        const rootChevron = isRootExpanded ? "chevron-down" : "chevron-right";

        html += `<div class="bg-white rounded-2xl shadow-md border border-gt-sky/30 overflow-hidden fade-in max-w-4xl mx-auto">
            <!-- Encabezado del Árbol (Root Node) -->
            <div class="bg-gt-dark p-5 flex items-center justify-between cursor-pointer border-b border-slate-700 select-none"
                 onclick="app.toggleNode('root')">
                <div class="flex items-center gap-3.5">
                    <div class="bg-white/10 p-2.5 rounded-xl text-gt-sky">
                        <i data-lucide="landmark" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-white tracking-wide">Sistema de Archivos</h3>
                        <p class="text-slate-400 text-xs font-semibold mt-0.5 flex items-center gap-2">
                            <span>Archivo General Digitalizado</span>
                            <span class="text-slate-500">•</span>
                            <span>${Object.keys(state.folders).length} carpetas mapeadas</span>
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    ${getStatsBadge(rootNode.imageCount, rootNode.recordCount)}
                    <i data-lucide="${rootChevron}" class="text-slate-400 w-5 h-5 transition-transform duration-200"></i>
                </div>
            </div>`;

        if (isRootExpanded) {
            html += `<div class="p-4 space-y-4 bg-slate-50/50">`;

            // Iterar sobre Colecciones
            for (let colName in rootNode.children) {
                const colNode = rootNode.children[colName];
                const colPath = `col:${colName}`;
                initExpanded(colPath);
                
                const isColExpanded = state.expandedNodes[colPath];
                const colChevron = isColExpanded ? "chevron-down" : "chevron-right";

                html += `<div class="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-200">
                    <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none bg-white transition-colors"
                         onclick="app.toggleNode('${colPath}')">
                        <div class="flex items-center gap-3">
                            <div class="bg-gt-sky/15 p-2 rounded-lg text-gt-blue">
                                <i data-lucide="folder" class="w-5 h-5"></i>
                            </div>
                            <span class="font-extrabold text-slate-800 text-base tracking-tight">${colName}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            ${getStatsBadge(colNode.imageCount, colNode.recordCount)}
                            <i data-lucide="${colChevron}" class="text-slate-400 w-4 h-4 transition-transform duration-200"></i>
                        </div>
                    </div>`;

                if (isColExpanded) {
                    html += `<div class="border-t border-slate-100 p-3 bg-slate-50/30 space-y-3 pl-8">`;

                    // Iterar sobre Libros
                    for (let bookName in colNode.children) {
                        const bookNode = colNode.children[bookName];
                        const bookPath = `book:${colName}:${bookName}`;
                        initExpanded(bookPath);

                        const isBookExpanded = state.expandedNodes[bookPath];
                        const bookChevron = isBookExpanded ? "chevron-down" : "chevron-right";

                        html += `<div class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                            <div class="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none transition-colors"
                                 onclick="app.toggleNode('${bookPath}')">
                                <div class="flex items-center gap-2.5">
                                    <i data-lucide="book-open" class="w-4 h-4 text-gt-blue shrink-0"></i>
                                    <span class="font-bold text-slate-700 text-sm">${bookName}</span>
                                </div>
                                <div class="flex items-center gap-3">
                                    ${getStatsBadge(bookNode.imageCount, bookNode.recordCount)}
                                    <i data-lucide="${bookChevron}" class="text-slate-400 w-4 h-4 transition-transform duration-200"></i>
                                </div>
                            </div>`;

                        if (isBookExpanded) {
                            html += `<div class="border-t border-slate-100 p-2 bg-slate-50/20 pl-6 space-y-1.5">`;

                            // Iterar sobre Trabajos (Leaf nodes)
                            for (let trabName in bookNode.children) {
                                const trabNode = bookNode.children[trabName];
                                
                                html += `<div class="group flex items-center justify-between p-2.5 rounded-lg hover:bg-gt-sky/10 border border-transparent hover:border-gt-sky/20 transition-all duration-150 cursor-pointer select-none"
                                             onclick="app.selectTreeJob('${trabNode.fullPath}')">
                                    <div class="flex items-center gap-2">
                                        <i data-lucide="layers" class="w-4 h-4 text-slate-400 group-hover:text-gt-blue transition-colors"></i>
                                        <span class="text-sm font-semibold text-slate-600 group-hover:text-gt-dark transition-colors">${trabName}</span>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        ${getStatsBadge(trabNode.imageCount, trabNode.recordCount, true)}
                                        <span class="text-xs font-bold text-gt-blue opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                            Abrir <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                                        </span>
                                    </div>
                                </div>`;
                            }

                            html += `</div>`;
                        }

                        html += `</div>`;
                    }

                    html += `</div>`;
                }

                html += `</div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;

        container.innerHTML = html;
        lucide.createIcons();
    },

    selectTreeJob(fullPath) {
        this.selectFolder(fullPath);
        this.switchView('workspace');
    },

    filterSearchByBook(bookName) {
        this.switchView('search');
        document.getElementById('search-input').value = bookName;
        this.renderSearchTable();
    }
});

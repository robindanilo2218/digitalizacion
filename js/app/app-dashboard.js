window.app = window.app || {};

Object.assign(window.app, {
    renderDashboard() {
        const container = document.getElementById('dashboard-container');
        if (!container) return;

        const collections = {}; 
        let totalRecords = 0;

        Object.keys(state.records).forEach(pathKey => {
            let dataArr = state.records[pathKey];
            if (!Array.isArray(dataArr)) dataArr = [dataArr];

            let collectionName = "Catálogo General";
            if (dataArr.length > 0 && dataArr[0]['tipo_doc']) {
                collectionName = dataArr[0]['tipo_doc'];
            } else if (dataArr.length > 0 && dataArr[0]['tipo_coleccion']) {
                collectionName = dataArr[0]['tipo_coleccion'];
            } else {
                let parts = pathKey.split('/');
                if (parts.length >= 3) collectionName = parts[0].replace('.xlb', '');
            }

            let bookName = 'Libro Desconocido';
            if (dataArr.length > 0 && dataArr[0]['nombre_libro']) {
                bookName = dataArr[0]['nombre_libro'];
            } else {
                const xlbMatch = pathKey.match(/([^\/]+)\.xlb\//i);
                if (xlbMatch) {
                    bookName = xlbMatch[1];
                } else {
                    let parts = pathKey.split('/');
                    if (parts.length >= 3) bookName = parts[parts.length - 3];
                    else if (parts.length >= 2) bookName = parts[parts.length - 2];
                }
            }

            if (!collections[collectionName]) collections[collectionName] = { books: {} };
            if (!collections[collectionName].books[bookName]) {
                collections[collectionName].books[bookName] = { count: 0, dates: [], paths: [] };
            }

            dataArr.forEach(rec => {
                // Validación para evitar contar registros completamente vacíos
                if (Object.values(rec).every(val => val === '' || val === undefined)) return;
                
                totalRecords++;
                collections[collectionName].books[bookName].count++;
                
                Object.keys(rec).forEach(k => {
                    const keyLower = k.toLowerCase();
                    if (keyLower.includes('fecha') || keyLower.includes('año') || keyLower.includes('year') || keyLower.includes('date')) {
                        const val = String(rec[k]).trim();
                        if (val && val !== '-') {
                            const yearMatch = val.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
                            if (yearMatch) collections[collectionName].books[bookName].dates.push(parseInt(yearMatch[1]));
                        }
                    }
                });
            });
        });

        if (totalRecords === 0) {
            container.innerHTML = `<div class="text-center p-12 bg-white rounded-2xl border border-slate-200">
                <i data-lucide="folder-open" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i>
                <h3 class="text-xl font-bold text-slate-700">El Catálogo está vacío</h3>
                <p class="text-slate-500 mt-2">No hay registros cargados en la base de datos. Pide al Archivista que importe un paquete.</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        let html = '';

        for (let colName in collections) {
            const col = collections[colName];
            
            let colHtml = `<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="bg-gt-dark p-6 border-b border-slate-700 flex justify-between items-center">
                    <h3 class="text-2xl font-black text-white flex items-center gap-3">
                        <i data-lucide="archive" class="text-gt-sky"></i> ${colName}
                    </h3>
                </div>
                <div class="p-0">`;
            
            for (let bName in col.books) {
                const book = col.books[bName];
                
                if (book.count === 0) continue; // Skip empty books

                let minYear = 'N/A';
                let maxYear = 'N/A';
                if (book.dates.length > 0) {
                    minYear = Math.min(...book.dates);
                    maxYear = Math.max(...book.dates);
                }

                colHtml += `<div class="group flex items-center justify-between p-5 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onclick="app.filterSearchByBook('${bName}')">
                    <div class="flex items-center gap-4">
                        <div class="bg-gt-sky/20 p-3 rounded-xl text-gt-blue group-hover:bg-gt-blue group-hover:text-white transition-colors">
                            <i data-lucide="book" class="w-6 h-6"></i>
                        </div>
                        <div>
                            <h4 class="text-lg font-bold text-slate-800 group-hover:text-gt-blue transition-colors">${bName}</h4>
                            <p class="text-sm text-slate-500 font-medium mt-0.5">
                                <span class="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold mr-2">${book.count} registros</span>
                                <i data-lucide="calendar" class="inline w-3 h-3 mr-1 text-slate-400"></i> Rango temporal: ${minYear === maxYear ? minYear : minYear + ' - ' + maxYear}
                            </p>
                        </div>
                    </div>
                    <div class="text-slate-400 group-hover:text-gt-blue transition-colors flex items-center gap-2 text-sm font-bold">
                        Explorar <i data-lucide="chevron-right"></i>
                    </div>
                </div>`;
            }

            colHtml += `</div></div>`;
            html += colHtml;
        }

        container.innerHTML = html;
        lucide.createIcons();
    },

    filterSearchByBook(bookName) {
        this.switchView('search');
        document.getElementById('search-input').value = bookName;
        this.renderSearchTable();
    }
});

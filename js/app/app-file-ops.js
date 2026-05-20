window.app = window.app || {};

Object.assign(window.app, {
    // 1. MODO CARPETA LOCAL (Solo Admin)
    async selectRootFolder() {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            const groupedFolders = {};
            let totalFiles = 0;

            this.showLoader("Mapeando estructura local...", "Leyendo archivos fotográficos...");

            const scanDirectory = async (handle, currentPath) => {
                for await (const entry of handle.values()) {
                    if (entry.kind === 'file') {
                        if (entry.name.match(/\.(jpg|jpeg|png|webp|dig|pag)$/i)) {
                            const folderName = currentPath || dirHandle.name;
                            if (!groupedFolders[folderName]) groupedFolders[folderName] = [];

                            groupedFolders[folderName].push({
                                name: entry.name,
                                handle: entry,
                                fullPath: `${folderName}/${entry.name}`
                            });
                            totalFiles++;
                        }
                    } else if (entry.kind === 'directory') {
                        await scanDirectory(entry, `${currentPath ? currentPath + '/' : dirHandle.name + '/'}${entry.name}`);
                    }
                }
            };

            await scanDirectory(dirHandle, '');

            Object.keys(groupedFolders).forEach(folder => {
                groupedFolders[folder].sort((a, b) => a.name.localeCompare(b.name));
            });

            state.mode = 'local';
            state.folders = groupedFolders;
            // No reseteamos records porque se mantienen en IndexedDB persistente

            document.getElementById('lbl-mode-title').innerText = "Directorio de Captura Local";
            document.getElementById('lbl-total-mapped').innerText = `${totalFiles} imágenes preparadas para indexar`;

            document.getElementById('welcome-screen').classList.add('hidden');
            document.getElementById('workspace-view').classList.remove('hidden');

            this.renderFolders();
            this.hideLoader();
            lucide.createIcons();

        } catch (error) {
            this.hideLoader();
            if (error.name !== "AbortError") alert("Se requiere permiso para leer la carpeta.");
        }
    },

    // 2. MODO PAQUETE .XLB (RECURSIVO)
    async openPackage(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        this.showLoader("Desofuscando Paquetes...", "Procesando jerarquías y leyendo índices en IndexedDB...");

        state.mode = 'package';
        state.folders = {};
        let totalFiles = 0;

        try {
            const extractZip = async (zipContent, prefixPath = "") => {
                const dbFile = zipContent.file("metadata.dig") || zipContent.file("ofuscado.lib") || zipContent.file("database.json");
                if (dbFile) {
                    const text = await dbFile.async("string");
                    try {
                        const parsed = JSON.parse(text);
                        for (let key in parsed.records) {
                            state.records[prefixPath + key] = parsed.records[key];
                        }
                        // Sincronizar extracciones al IndexedDB
                        await db.putBulk(state.records);

                        if (parsed.schema && parsed.schema.length > state.schema.length) {
                            state.schema = parsed.schema;
                        }
                    } catch (e) { }
                }

                const entries = Object.keys(zipContent.files);
                for (let path of entries) {
                    const entry = zipContent.files[path];
                    if (entry.dir) continue;

                    if (path.match(/\.(zip|xlb|digpkg|cll)$/i)) {
                        const nestedBlob = await entry.async("blob");
                        const nestedZip = await JSZip.loadAsync(nestedBlob);
                        await extractZip(nestedZip, prefixPath + path + "/");
                    }
                    else if (path.match(/\.(jpg|jpeg|png|webp|dig|pag)$/i)) {
                        const name = path.split('/').pop();
                        let folderName = prefixPath + (path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'Raíz_Paquete');
                        folderName = folderName.replace(/\/$/, "");

                        if (!state.folders[folderName]) state.folders[folderName] = [];

                        state.folders[folderName].push({
                            name: name,
                            fullPath: prefixPath + path,
                            internalPath: path,
                            zipRef: zipContent
                        });
                        totalFiles++;
                    }
                }
            };

            for (let i = 0; i < files.length; i++) {
                if (files[i].name.match(/\.dig$/i)) {
                    // Leer JSON suelto directamente
                    const text = await files[i].text();
                    try {
                        const parsed = JSON.parse(text);
                        for (let key in parsed.records) {
                            state.records[key] = parsed.records[key];
                        }
                        await db.putBulk(state.records);
                        if (parsed.schema && parsed.schema.length > state.schema.length) {
                            state.schema = parsed.schema;
                        }
                    } catch (e) {
                        console.error("Error leyendo .dig suelto:", e);
                    }
                } else {
                    // Leer como Zip
                    const mainZip = await JSZip.loadAsync(files[i]);
                    await extractZip(mainZip, files[i].name + "/");
                }
            }

            // Si solo se subieron archivos .dig, mostrar alerta y no recargar UI de imágenes
            if (Object.keys(state.folders).length === 0) {
                alert("Metadatos cargados y actualizados en la base de datos.");
                this.hideLoader();
                return;
            }

            Object.keys(state.folders).forEach(folder => {
                state.folders[folder].sort((a, b) => a.name.localeCompare(b.name));
            });

            document.getElementById('lbl-mode-title').innerHTML = `<i data-lucide="database" class="inline w-4 h-4 mr-1"></i> Base de Datos Unificada`;
            document.getElementById('lbl-total-mapped').innerText = `${totalFiles} registros en los paquetes`;

            document.getElementById('welcome-screen').classList.add('hidden');
            document.getElementById('workspace-view').classList.remove('hidden');

            this.renderFolders();
            lucide.createIcons();

        } catch (e) {
            console.error(e);
            alert("Error crítico leyendo el paquete. Verifique el formato .xlb o .zip");
        } finally {
            this.hideLoader();
            event.target.value = '';
        }
    },

    // 3. ABRIR MODAL PARA EMPAQUETAR A .CLL (Solo Admin)
    packageToDig() {
        if (!state.isAdmin) return;
        if (Object.keys(state.folders).length === 0) return;
        
        if (state.mode !== 'local') {
            alert("La edición masiva y re-empaquetado solo está disponible para nuevos lotes locales en este prototipo.");
            return;
        }

        document.getElementById('modal-package-config').classList.remove('hidden');
    },

    // 4. EJECUTAR EMPAQUETADO (Generar .CLL con .XLB y .DIG)
    async executePackaging() {
        const collectionName = document.getElementById('input-collection-name').value.trim() || 'Coleccion_Sin_Nombre';
        const collectionType = document.getElementById('select-collection-type').value;

        document.getElementById('modal-package-config').classList.add('hidden');
        this.showLoader("Compilando Colección Maestra (.cll)", "Generando libros (.xlb), imágenes (.pag) y metadatos (.dig)...");

        try {
            const masterZip = new JSZip();
            const masterRecords = {};

            // Agrupar por nombre de libro
            const books = {};
            for (let folder in state.folders) {
                let pathParts = folder.split('/');
                // Si la ruta tiene al menos 2 niveles, asumimos que el penúltimo es el libro y el último es la carpeta de trabajo
                let bookName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : pathParts[pathParts.length - 1];
                
                if (!books[bookName]) books[bookName] = [];
                books[bookName] = books[bookName].concat(state.folders[folder]);
            }

            // Iterar sobre cada libro agrupado
            for (let bookName in books) {
                const bookZip = new JSZip();
                const bookRecords = {};

                // Añadir imágenes al libro
                for (let item of books[bookName]) {
                    const file = await item.handle.getFile();
                    
                    // Extraer nombre original sin extensión
                    let originalName = item.name.replace(/\.(jpg|jpeg|png|webp)$/i, '');
                    
                    // Añadir el prefijo del libro si no lo tiene
                    if (!originalName.startsWith(bookName + '_')) {
                        originalName = `${bookName}_${originalName}`;
                    }
                    const newFileName = `${originalName}.pag`;

                    // Mantener la estructura de carpetas de trabajo relativa al libro
                    // Si item.fullPath es "Coleccion/Libro001/trabajo2026/img.jpg"
                    let relativeDir = "";
                    const bookIndex = item.fullPath.indexOf(bookName + '/');
                    if (bookIndex !== -1) {
                        let afterBook = item.fullPath.substring(bookIndex + bookName.length + 1);
                        relativeDir = afterBook.substring(0, afterBook.lastIndexOf('/') + 1); // incluye slash final si hay
                    }
                    
                    const newPath = `${relativeDir}${newFileName}`;
                    
                    bookZip.file(newPath, file, { compression: "STORE" });

                    // Guardar registro si existe
                    if (state.records[item.fullPath]) {
                        bookRecords[newPath] = state.records[item.fullPath];
                        masterRecords[`${bookName}.xlb/${newPath}`] = state.records[item.fullPath];
                    }
                }

                // Generar metadata.dig para este libro
                const bookPayload = {
                    version: "7.0-Coleccion",
                    timestamp: new Date().toISOString(),
                    bookName: bookName,
                    type: collectionType,
                    schema: state.schema,
                    records: bookRecords
                };
                bookZip.file("metadata.dig", JSON.stringify(bookPayload, null, 2));

                // Compilar el .xlb del libro y añadirlo al .cll maestro
                const bookBlob = await bookZip.generateAsync({ type: "blob", compression: "STORE" });
                masterZip.file(`${bookName}.xlb`, bookBlob, { compression: "STORE" });
            }

            // Generar metadata.dig para la colección completa
            const masterPayload = {
                version: "7.0-Coleccion",
                timestamp: new Date().toISOString(),
                collectionName: collectionName,
                type: collectionType,
                schema: state.schema,
                records: masterRecords
            };
            masterZip.file("metadata.dig", JSON.stringify(masterPayload, null, 2));

            const finalBlob = await masterZip.generateAsync({ type: "blob", compression: "STORE" });

            const safeName = collectionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(finalBlob);
            a.download = `${safeName}.cll`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            alert(`¡Colección ${collectionName}.cll generada exitosamente!`);
        } catch (e) {
            console.error(e);
            alert("Hubo un error al generar la colección.");
        } finally {
            this.hideLoader();
        }
    },

    // 5. EXPORTAR SOLO METADATOS .DIG
    exportDig() {
        if (!state.records || Object.keys(state.records).length === 0) {
            alert("No hay registros para exportar.");
            return;
        }
        
        const payload = {
            version: "7.1-Exportacion-Manual",
            timestamp: new Date().toISOString(),
            schema: state.schema,
            records: state.records
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Copia_Seguridad_${new Date().getTime()}.dig`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
});

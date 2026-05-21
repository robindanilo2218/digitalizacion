window.app = window.app || {};

Object.assign(window.app, {
    // 1. MODO CARPETA LOCAL (Solo Admin)
    async selectRootFolder() {
        try {
            let dirHandle;
            try {
                dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                state.canWriteLocal = true;
            } catch (e) {
                if (e.name !== "AbortError") {
                    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
                    state.canWriteLocal = false;
                } else throw e;
            }
            state.rootDirHandle = dirHandle;
            
            try {
                const securityHandle = await dirHandle.getFileHandle('temas_ui.dat');
                const file = await securityHandle.getFile();
                const text = await file.text();
                const config = this._parseObfuscatedFile(text);
                
                if (config.consult_pwd) {
                    const pwd = prompt("Colección Protegida\nIngrese la contraseña de consulta para acceder:");
                    if (pwd !== config.consult_pwd) {
                        alert("Contraseña incorrecta.");
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
                db.put('__system_config__', [config]);
            } catch (e) {
                state.collectionPasswords = null;
                state.collectionConfig = { mode: 'standard', groupField: '' };
                db.put('__system_config__', [{}]);
            }

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
                        } else if (entry.name.match(/\.(lib|dig)$/i)) {
                            try {
                                const file = await entry.getFile();
                                const text = await file.text();
                                const parsed = JSON.parse(text);
                                for (let key in parsed.records) {
                                    state.records[key] = parsed.records[key];
                                }
                                await db.putBulk(parsed.records);
                                if (parsed.schema && parsed.schema.length > state.schema.length) {
                                    state.schema = parsed.schema;
                                }
                            } catch (e) { console.error("Error leyendo archivo de metadatos", entry.name, e); }
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
                const libFiles = zipContent.file(/\.(dig|lib|json)$/i);
                if (libFiles && libFiles.length > 0) {
                    for (const dbFile of libFiles) {
                        const text = await dbFile.async("string");
                        try {
                            const parsed = JSON.parse(text);
                            for (let key in parsed.records) {
                                let finalKey = key;
                                if (!key.includes(prefixPath) && prefixPath !== "") {
                                    finalKey = prefixPath + key;
                                }
                                state.records[finalKey] = parsed.records[key];
                            }
                            // Sincronizar extracciones al IndexedDB
                            await db.putBulk(state.records);

                            if (parsed.schema && parsed.schema.length > state.schema.length) {
                                state.schema = parsed.schema;
                            }
                        } catch (e) { }
                    }
                }

                const entries = Object.keys(zipContent.files);
                for (let path of entries) {
                    const entry = zipContent.files[path];
                    if (entry.dir) continue;

                    if (path.match(/\.(zip|xlb|digpkg|cll|jor)$/i)) {
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
                    
                    const securityFile = mainZip.file("temas_ui.dat");
                    if (securityFile) {
                        const text = await securityFile.async("string");
                        try {
                            const config = this._parseObfuscatedFile(text);
                            if (config.consult_pwd) {
                                const pwd = prompt(`El paquete ${files[i].name} está protegido.\nIngrese la contraseña de consulta:`);
                                if (pwd !== config.consult_pwd) {
                                    alert("Contraseña incorrecta.");
                                    this.hideLoader();
                                    return;
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
                            await db.put('__system_config__', [config]);
                        } catch (e) { console.error(e); }
                    } else if (!state.collectionPasswords) {
                        state.collectionPasswords = null;
                        state.collectionConfig = { mode: 'standard', groupField: '' };
                        await db.put('__system_config__', [{}]);
                    }

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

    async saveLocalMetadata(fullPath) {
        if (!state.canWriteLocal || !state.rootDirHandle) return;
        try {
            const parts = fullPath.split('/');
            parts.pop(); // Remove image name
            parts.shift(); // Remove root handle name
            
            let currentHandle = state.rootDirHandle;
            for (const part of parts) {
                currentHandle = await currentHandle.getDirectoryHandle(part, { create: false });
            }
            
            const fileHandle = await currentHandle.getFileHandle('metadatos.lib', { create: true });
            const writable = await fileHandle.createWritable();
            
            const folderPrefix = fullPath.substring(0, fullPath.lastIndexOf('/')) + '/';
            const folderRecords = {};
            for (let pathKey in state.records) {
                if (pathKey.startsWith(folderPrefix)) {
                    folderRecords[pathKey] = state.records[pathKey];
                }
            }
            
            const payload = {
                version: "8.0-Local",
                timestamp: new Date().toISOString(),
                schema: state.schema,
                records: folderRecords
            };
            
            await writable.write(JSON.stringify(payload, null, 2));
            await writable.close();
        } catch (e) {
            console.error("Error guardando metadatos.lib local:", e);
        }
    },

    async saveSecurityConfig(consultPwd, adminPwd, indexMode = 'standard', groupField = '') {
        const text = this._generateObfuscatedFile(consultPwd, adminPwd, indexMode, groupField);
        
        state.collectionPasswords = { consult: consultPwd, admin: adminPwd };
        state.collectionConfig = { mode: indexMode, groupField: groupField };
        
        const configToSave = { consult_pwd: consultPwd, archivista_pwd: adminPwd, mode: indexMode, groupField: groupField };
        await db.put('__system_config__', [configToSave]);

        if (state.mode === 'local' && state.canWriteLocal && state.rootDirHandle) {
            try {
                const fileHandle = await state.rootDirHandle.getFileHandle('temas_ui.dat', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(text);
                await writable.close();
                alert("Configuración guardada exitosamente en la carpeta.");
            } catch (e) {
                alert("Error guardando temas_ui.dat: " + e.message);
            }
        } else {
            // Package mode or no write permissions
            const blob = new Blob([text], { type: "text/plain" });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `temas_ui.dat`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            alert("Se descargó 'temas_ui.dat'. Deberá incluir este archivo en la raíz de su paquete manualmente para aplicar los cambios.");
        }
    },

    _generateObfuscatedFile(consultPwd, adminPwd, indexMode, groupField) {
        const lines = [];
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        for (let i = 0; i < 50; i++) {
            let line = '';
            for (let j = 0; j < 120; j++) {
                line += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            lines.push(line);
        }
        
        const cLen = consultPwd.length.toString(16).padStart(2, '0');
        const cPayload = cLen + consultPwd;
        lines[17] = lines[17].substring(0, 25) + cPayload + lines[17].substring(25 + cPayload.length);
        
        const aLen = adminPwd.length.toString(16).padStart(2, '0');
        const aPayload = aLen + adminPwd;
        lines[32] = lines[32].substring(0, 45) + aPayload + lines[32].substring(45 + aPayload.length);
        
        const configPayload = JSON.stringify({ mode: indexMode, groupField: groupField });
        const configB64 = btoa(unescape(encodeURIComponent(configPayload)));
        const configLen = configB64.length.toString(16).padStart(4, '0');
        const cData = configLen + configB64;
        lines[44] = lines[44].substring(0, 10) + cData + lines[44].substring(10 + cData.length);
        
        return lines.join('\n');
    },

    _parseObfuscatedFile(text) {
        try {
            const lines = text.split('\n');
            if (lines.length < 40) return {}; // Formato inválido
            
            const cLine = lines[17];
            const cLenHex = cLine.substring(25, 27);
            const cLen = parseInt(cLenHex, 16);
            const consult_pwd = isNaN(cLen) ? '' : cLine.substring(27, 27 + cLen);
            
            const aLine = lines[32];
            const aLenHex = aLine.substring(45, 47);
            const aLen = parseInt(aLenHex, 16);
            const admin_pwd = isNaN(aLen) ? '' : aLine.substring(47, 47 + aLen);
            
            let mode = 'standard';
            let groupField = '';
            if (lines.length > 44) {
                const confLine = lines[44];
                const confLenHex = confLine.substring(10, 14);
                const confLen = parseInt(confLenHex, 16);
                if (!isNaN(confLen) && confLen > 0) {
                    const confB64 = confLine.substring(14, 14 + confLen);
                    try {
                        const parsed = JSON.parse(decodeURIComponent(escape(atob(confB64))));
                        mode = parsed.mode || 'standard';
                        groupField = parsed.groupField || '';
                    } catch (e) {}
                }
            }
            
            return { consult_pwd, archivista_pwd: admin_pwd, mode, groupField };
        } catch (e) {
            return {};
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

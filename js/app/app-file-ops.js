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
                        if (entry.name.match(/\.(jpg|jpeg|png|webp|dig)$/i)) {
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
                const dbFile = zipContent.file("ofuscado.lib") || zipContent.file("database.json");
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

                    if (path.match(/\.(zip|xlb|digpkg)$/i)) {
                        const nestedBlob = await entry.async("blob");
                        const nestedZip = await JSZip.loadAsync(nestedBlob);
                        await extractZip(nestedZip, prefixPath + path + "/");
                    }
                    else if (path.match(/\.(jpg|jpeg|png|webp|dig)$/i)) {
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
                const mainZip = await JSZip.loadAsync(files[i]);
                await extractZip(mainZip, files[i].name + "/");
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

    // 3. FINALIZAR Y EMPAQUETAR A .XLB (Solo Admin)
    async packageToDig() {
        if (!state.isAdmin) return;
        if (Object.keys(state.folders).length === 0) return;

        this.showLoader("Compilando Paquete Oficial (.xlb)", "Ofuscando imágenes a .dig y guardando base de datos...");

        try {
            const zip = new JSZip();
            const compiledRecords = {};

            if (state.mode === 'local') {
                for (let folder in state.folders) {
                    for (let item of state.folders[folder]) {
                        const file = await item.handle.getFile();
                        const newPath = item.fullPath.replace(/\.(jpg|jpeg|png|webp)$/i, '.dig');
                        zip.file(newPath, file, { compression: "STORE" });

                        if (state.records[item.fullPath]) {
                            compiledRecords[newPath] = state.records[item.fullPath];
                        }
                    }
                }
            } else {
                alert("La edición masiva y re-empaquetado solo está disponible para nuevos lotes locales en este prototipo.");
                this.hideLoader();
                return;
            }

            const dbPayload = {
                version: "6.0-IndexedDB-Institucional",
                timestamp: new Date().toISOString(),
                schema: state.schema,
                records: compiledRecords
            };
            zip.file("ofuscado.lib", JSON.stringify(dbPayload, null, 2));

            const contentBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });

            const a = document.createElement('a');
            a.href = URL.createObjectURL(contentBlob);
            a.download = `Lote_Institucional_${new Date().getTime()}.xlb`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            alert("¡Paquete .xlb compilado y ofuscado exitosamente!");
        } catch (e) {
            console.error(e);
            alert("Hubo un error al generar el paquete.");
        } finally {
            this.hideLoader();
        }
    }
});

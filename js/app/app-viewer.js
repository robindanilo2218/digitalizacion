window.app = window.app || {};

Object.assign(window.app, {
    async loadImage() {
        if (state.images.length === 0) return;

        document.getElementById('viewer-empty').classList.add('hidden');
        document.getElementById('viewer-container').classList.remove('hidden');

        document.getElementById('img-loader').classList.remove('hidden');
        document.getElementById('img-wrapper').classList.add('hidden');

        const currentItem = state.images[state.currentIndex];

        // Mostrar jerarquía completa: Colección › Libro › Trabajo
        const folderParts = state.activeFolder.split('/');
        // Omitir el nombre del directorio raíz (primer elemento) y mostrar el resto como ruta de contexto
        const contextParts = folderParts.length > 1 ? folderParts.slice(1) : folderParts;
        const folderDisplayName = contextParts.join(' › ');
        document.getElementById('lbl-active-folder').innerText = folderDisplayName;
        document.getElementById('lbl-active-folder').title = state.activeFolder;
        
        if (state.collectionConfig && state.collectionConfig.mode === 'folder') {
            document.getElementById('lbl-file-name').innerText = `Página ${state.currentIndex + 1} de ${state.images.length}`;
            document.getElementById('lbl-counter').innerText = 'Acta Multipaginada';
            document.getElementById('lbl-next-btn').innerText = state.currentIndex === state.images.length - 1 ? 'Finalizar Acta' : 'Siguiente Pág.';
        } else {
            document.getElementById('lbl-file-name').innerText = currentItem.name;
            document.getElementById('lbl-counter').innerText = `${state.currentIndex + 1} de ${state.images.length}`;
            document.getElementById('lbl-next-btn').innerText = state.currentIndex === state.images.length - 1 ? 'Finalizar Libro' : 'Siguiente';
        }
        
        document.getElementById('btn-prev').disabled = state.currentIndex === 0;

        try {
            if (state.currentObjectUrl) URL.revokeObjectURL(state.currentObjectUrl);

            let blob;
            if (state.mode === 'package') {
                document.getElementById('img-loader-text').innerText = 'Desofuscando paquete...';
                blob = await currentItem.zipRef.file(currentItem.internalPath).async("blob");
                // Forzar el tipo a jpeg por si es .pag
                blob = new Blob([blob], { type: 'image/jpeg' });
            } else {
                document.getElementById('img-loader-text').innerText = 'Cargando imagen local...';
                const file = await currentItem.handle.getFile();
                blob = new Blob([file], { type: 'image/jpeg' });
            }

            state.currentObjectUrl = URL.createObjectURL(blob);

            const imgEl = document.getElementById('main-image');
            imgEl.onload = () => {
                document.getElementById('img-loader').classList.add('hidden');
                document.getElementById('img-wrapper').classList.remove('hidden');
            };
            imgEl.onerror = () => {
                document.getElementById('img-loader-text').innerText = 'Error al cargar la imagen.';
            };
            imgEl.src = state.currentObjectUrl;

            state.zoom = 1; state.rotation = 0;
            this.updateViewerTransform();
            this.renderForm();
        } catch (e) {
            document.getElementById('img-loader-text').innerText = 'Error de lectura cifrada.';
            console.error(e);
        }
    },

    setZoom(delta) {
        state.zoom = Math.max(0.5, Math.min(5, state.zoom + delta));
        this.updateViewerTransform();
    },
    setRotation() {
        state.rotation += 90;
        this.updateViewerTransform();
    },
    updateViewerTransform() {
        document.getElementById('img-wrapper').style.transform = `scale(${state.zoom}) rotate(${state.rotation}deg)`;
        document.getElementById('lbl-zoom').innerText = `${Math.round(state.zoom * 100)}%`;
    },

    async printDocument() {
        if (state.images.length === 0) return;

        const originalBtnText = document.getElementById('img-loader-text').innerText;
        document.getElementById('img-loader-text').innerText = 'Preparando impresión...';
        document.getElementById('img-loader').classList.remove('hidden');
        document.getElementById('img-wrapper').classList.add('hidden');

        try {
            const printWin = window.open('', '_blank');
            if (!printWin) {
                alert("Por favor habilita las ventanas emergentes (pop-ups) en tu navegador para imprimir.");
                return;
            }

            let html = `<html><head><title>Impresión de Documento</title>
                <style>
                    @page { size: auto; margin: 0; }
                    body { margin: 0; padding: 0; background: white; text-align: center; }
                    img { max-width: 100vw; max-height: 100vh; page-break-after: always; display: block; margin: 0 auto; object-fit: contain; }
                </style>
                </head><body>`;

            let imagesToPrint = [];
            if (state.collectionConfig && state.collectionConfig.mode === 'folder') {
                imagesToPrint = state.images;
            } else {
                imagesToPrint = [state.images[state.currentIndex]];
            }

            for (let i = 0; i < imagesToPrint.length; i++) {
                const item = imagesToPrint[i];
                let blob;
                if (state.mode === 'package') {
                    blob = await item.zipRef.file(item.internalPath).async("blob");
                    blob = new Blob([blob], { type: 'image/jpeg' });
                } else {
                    const file = await item.handle.getFile();
                    blob = new Blob([file], { type: 'image/jpeg' });
                }
                
                const base64Url = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });

                html += `<img src="${base64Url}" />`;
            }

            html += `
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
                </body></html>`;

            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();

        } catch (e) {
            console.error("Error al imprimir:", e);
            alert("Ocurrió un error al generar la impresión.");
        } finally {
            document.getElementById('img-loader').classList.add('hidden');
            document.getElementById('img-wrapper').classList.remove('hidden');
            document.getElementById('img-loader-text').innerText = originalBtnText;
        }
    },

    nextImage() {
        if (state.currentIndex < state.images.length - 1) {
            state.currentIndex++;
            this.loadImage();
        } else {
            alert("✓ Has recorrido todo el lote. Puedes regresar a la pestaña de libros para seleccionar otro.");
            this.switchLeftTab('folders');
        }
    },
    prevImage() {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            this.loadImage();
        }
    }
});

window.app = window.app || {};

Object.assign(window.app, {
    async loadImage() {
        if (state.images.length === 0) return;

        document.getElementById('viewer-empty').classList.add('hidden');
        document.getElementById('viewer-container').classList.remove('hidden');

        document.getElementById('img-loader').classList.remove('hidden');
        document.getElementById('img-wrapper').classList.add('hidden');

        const currentItem = state.images[state.currentIndex];

        const folderDisplayName = state.activeFolder.split('/').pop();
        document.getElementById('lbl-active-folder').innerText = folderDisplayName;
        document.getElementById('lbl-file-name').innerText = currentItem.name;
        document.getElementById('lbl-counter').innerText = `${state.currentIndex + 1} de ${state.images.length}`;
        document.getElementById('btn-prev').disabled = state.currentIndex === 0;
        document.getElementById('lbl-next-btn').innerText = state.currentIndex === state.images.length - 1 ? 'Finalizar Libro' : 'Siguiente';

        try {
            if (state.currentObjectUrl) URL.revokeObjectURL(state.currentObjectUrl);

            let blob;
            if (state.mode === 'package') {
                const zipFileContent = await currentItem.zipRef.file(currentItem.internalPath).async("blob");
                blob = new Blob([zipFileContent], { type: 'image/jpeg' });
            } else {
                const file = await currentItem.handle.getFile();
                blob = new Blob([file], { type: 'image/jpeg' });
            }

            state.currentObjectUrl = URL.createObjectURL(blob);

            const imgEl = document.getElementById('main-image');
            imgEl.onload = () => {
                document.getElementById('img-loader').classList.add('hidden');
                document.getElementById('img-wrapper').classList.remove('hidden');
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

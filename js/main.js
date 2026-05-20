document.addEventListener('DOMContentLoaded', () => {
    if (window.app && typeof window.app.init === 'function') {
        window.app.init();
    }
});

// Registro del Service Worker (PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito:', reg.scope))
            .catch(err => console.log('Fallo al registrar Service Worker:', err));
    });
}

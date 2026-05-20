const CACHE_NAME = 'archivo-historico-v1';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/config/tailwind.js',
    './js/core/db.js',
    './js/core/state.js',
    './js/app/app-core.js',
    './js/app/app-file-ops.js',
    './js/app/app-viewer.js',
    './js/app/app-ui.js',
    './js/main.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request)
            .then(response => {
                return response || fetch(e.request);
            })
    );
});

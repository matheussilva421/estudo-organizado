const APP_VERSION = '7.6';
const CACHE_NAME = `estudo-organizado-v${APP_VERSION}`;

const ASSET_PATHS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/cloud-sync.js',
    './js/components.js',
    './js/drive-sync.js',
    './js/lesson-mapper.js',
    './js/logic.js',
    './js/main.js',
    './js/notifications.js',
    './js/planejamento-wizard.js',
    './js/registro-sessao.js',
    './js/relevance.js',
    './js/store.js',
    './js/utils.js',
    './js/views.js'
];

// Append version query string to cacheable assets (skip root path)
const ASSETS = ASSET_PATHS.map(p =>
    p.includes('.') && p !== './' ? `${p}?v=${APP_VERSION}` : p
);

// Install Event
self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Caching App Shell');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event (Delete old caches)
self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        Promise.all([
            caches.keys().then((keys) => {
                return Promise.all(keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Fetch Event (Network First strategy)
self.addEventListener('fetch', (evt) => {
    if (evt.request.method !== 'GET') return;

    const url = new URL(evt.request.url);
    if (!url.pathname.startsWith('/src/') && url.origin !== location.origin) {
        return;
    }

    evt.respondWith(
        fetch(evt.request).then(fetchRes => {
            // Se a requisição web teve sucesso, salva no cache a nova cópia e retorna
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(evt.request.url, fetchRes.clone());
                return fetchRes;
            });
        }).catch(() => {
            // Se estiver offline, pega do cache
            return caches.match(evt.request).then(cacheRes => {
                if (cacheRes) return cacheRes;
                if (evt.request.url.indexOf('.html') > -1) {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

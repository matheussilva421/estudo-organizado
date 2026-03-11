const CACHE_NAME = 'estudo-organizado-v6';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css?v=6.0',
    './js/app.js?v=6.0',
    './js/cloud-sync.js?v=6.0',
    './js/components.js?v=6.0',
    './js/drive-sync.js?v=6.0',
    './js/lesson-mapper.js?v=6.0',
    './js/logic.js?v=6.0',
    './js/main.js?v=6.0',
    './js/notifications.js?v=6.0',
    './js/planejamento-wizard.js?v=6.0',
    './js/registro-sessao.js?v=6.0',
    './js/relevance.js?v=6.0',
    './js/store.js?v=6.0',
    './js/utils.js?v=6.0',
    './js/views.js?v=6.0'
];

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

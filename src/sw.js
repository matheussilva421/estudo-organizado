const CACHE_NAME = 'estudo-organizado-v1';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/cloud-sync.js',
    './js/components.js',
    './js/drive-sync.js',
    './js/logic.js',
    './js/main.js',
    './js/planejamento-wizard.js',
    './js/registro-sessao.js',
    './js/store.js',
    './js/utils.js',
    './js/views.js',
    'favicon.ico'
];

// Install Event
self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Caching App Shell');
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event (Delete old caches)
self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event (Cache First strategy)
self.addEventListener('fetch', (evt) => {
    // Ignore non-GET requests (POST to Cloudflare or Google APIs)
    if (evt.request.method !== 'GET') return;

    // Ignore external API endpoints
    const url = new URL(evt.request.url);
    if (!url.pathname.startsWith('/src/') && url.origin !== location.origin) {
        return;
    }

    evt.respondWith(
        caches.match(evt.request).then(cacheRes => {
            // Return cached version or fetch from network 
            return cacheRes || fetch(evt.request).then(fetchRes => {
                // Dynamically cache new assets
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(evt.request.url, fetchRes.clone());
                    return fetchRes;
                });
            });
        }).catch(() => {
            // If offline and page not cached, show index fallback
            if (evt.request.url.indexOf('.html') > -1) {
                return caches.match('./index.html');
            }
        })
    );
});

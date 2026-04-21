const APP_VERSION = '8.13';
const CACHE_NAME = `estudo-organizado-v${APP_VERSION}`;

const ASSET_PATHS = [
    './',
    './index.html',
    './css/styles.css',
    './css/tokens.css',
    './css/base.css',
    './css/components.css',
    './css/views.css',
    './js/app.js',
    './js/cloud-sync.js',
    './js/components.js',
    './js/credentials.js',
    './js/drive-sync.js',
    './js/lesson-mapper.js',
    './js/logic.js',
    './js/main.js',
    './js/notifications.js',
    './js/planejamento-wizard.js',
    './js/registro-sessao.js',
    './js/relevance.js',
    './js/sw-register.js',
    './js/store.js',
    './js/utils.js',
    './js/views.js',
    './js/ui/actions/index.js',
    './js/ui/dialog.js',
    './js/ui/dom.js',
    './js/views/home-view.js',
    './js/views/editais-view.js',
    './js/views/banca-view.js',
    './js/views/dashboard-view.js',
    './js/views/calendar-view.js',
    './js/views/habitos-view.js',
    './js/views/ciclo-view.js',
    './vendor/chart.umd.min.js',
    './assets/icons/icon-192.svg',
    './assets/icons/icon-512.svg',
    './assets/icons/icon-maskable-512.svg',
    './manifest.json'
];

// Append version query string to cacheable assets (skip root path)
const ASSETS = ASSET_PATHS.map((p) =>
    p.includes('.') && p !== './' ? `${p}?v=${APP_VERSION}` : p
);

function isShellAssetRequest(url) {
    return (
        url.origin === location.origin &&
        (
            url.pathname === '/' ||
            url.pathname.endsWith('/') ||
            url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css')
        )
    );
}

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
                return Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Allow the page to promote a waiting SW immediately.
// Validates origin to prevent malicious activation
self.addEventListener('message', (evt) => {
    // Validar origem da mensagem
    if (evt.origin !== self.origin) {
        console.warn('[SW] Mensagem rejeitada de origem não confiável:', evt.origin);
        return;
    }

    if (evt?.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Cache strategies by destination type
function networkFirst(request) {
    return fetch(request)
        .then((res) => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
        })
        .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
    return caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((res) => {
                if (res.ok) cache.put(request, res.clone());
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
}

function cacheFirst(request) {
    return caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
            if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
        });
    });
}

// Fetch Event — route by asset type
self.addEventListener('fetch', (evt) => {
    if (evt.request.method !== 'GET') return;

    const url = new URL(evt.request.url);
    if (url.origin !== location.origin) return;

    const dest = evt.request.destination;

    // Documents: network-first for fresh content
    if (dest === 'document' || evt.request.mode === 'navigate') {
        const request = isShellAssetRequest(url)
            ? new Request(evt.request, { cache: 'no-store' })
            : evt.request;

        evt.respondWith(
            networkFirst(request).catch(() =>
                caches.match(`./index.html?v=${APP_VERSION}`)
                    .then((v) => v || caches.match('./index.html'))
                    .then((v) => v || caches.match('./'))
            )
        );
        return;
    }

    // Scripts and styles: stale-while-revalidate for speed
    if (dest === 'script' || dest === 'style') {
        const request = isShellAssetRequest(url)
            ? new Request(evt.request, { cache: 'no-store' })
            : evt.request;
        evt.respondWith(staleWhileRevalidate(request));
        return;
    }

    // Images and other assets: cache-first
    evt.respondWith(cacheFirst(evt.request));
});

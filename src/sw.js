const APP_VERSION = '8.3';
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
self.addEventListener('message', (evt) => {
    if (evt?.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch Event (Network First strategy)
self.addEventListener('fetch', (evt) => {
    if (evt.request.method !== 'GET') return;

    const url = new URL(evt.request.url);
    if (url.origin !== location.origin) {
        return;
    }

    const requestForNetwork = isShellAssetRequest(url)
        ? new Request(evt.request, { cache: 'no-store' })
        : evt.request;

    evt.respondWith(
        fetch(requestForNetwork)
            .then((fetchRes) => {
                // If online request succeeded, refresh cached copy.
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(evt.request, fetchRes.clone());
                    return fetchRes;
                });
            })
            .catch(() => {
                // If offline, fallback to cached assets.
                return caches.match(evt.request).then((cacheRes) => {
                    if (cacheRes) return cacheRes;
                    if (evt.request.mode === 'navigate' || evt.request.destination === 'document') {
                        return caches
                            .match(`./index.html?v=${APP_VERSION}`)
                            .then((versionedHtml) => versionedHtml || caches.match('./index.html'))
                            .then((fallbackHtml) => fallbackHtml || caches.match('./'));
                    }
                    return undefined;
                });
            })
    );
});

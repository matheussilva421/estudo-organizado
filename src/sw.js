const APP_VERSION = '9.21';
const CACHE_NAME = `estudo-organizado-v${APP_VERSION}`;

const ASSET_PATHS = [
  './',
  './index.html',
  './css/styles.css',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/base/accessibility.css',
  './css/base/themes.css',
  './css/base/layout.css',
  './css/components/buttons.css',
  './css/components/sidebar.css',
  './css/components/cards.css',
  './css/components/status-feedback.css',
  './css/components/search.css',
  './css/components/modals-shared.css',
  './css/components/tabs.css',
  './css/components/toggle-drag.css',
  './css/components/timer.css',
  './css/components/misc-ui.css',
  './css/components/filter-row.css',
  './css/components/loading.css',
  './css/components/skeleton.css',
  './css/views/habitos.css',
  './css/views/revisoes.css',
  './css/views/editais-tree.css',
  './css/base/mobile.css',
  './css/base/utilities.css',
  './css/base/forms.css',
  './css/base/animations.css',
  './css/views.css',
  './css/views/dashboard.css',
  './css/views/calendar.css',
  './css/views/ciclo.css',
  './css/views/reta-final.css',
  './css/views/config/config-view.css',
  './css/views/wizard.css',
  './css/views/sessions.css',
  './css/views/modals.css',
  './css/views/banca.css',
  './css/views/cronometro.css',
  './css/views/subject-manager.css',
  './js/app.js',
  './js/app/themes.js',
  './js/app/modals.js',
  './js/app/navigation.js',
  './js/app/toast.js',
  './js/app/save-status.js',
  './js/cloud-sync.js',
  './js/components.js',
  './js/credentials.js',
  './js/debug.js',
  './js/drive-sync.js',
  './js/edital-filter.js',
  './js/backup-restore.js',
  './js/firebase/firebase-client.js',
  './js/firebase/firebase-config-default.js',
  './js/firebase/firebase-runtime-config.js',
  './js/lesson-mapper.js',
  './js/logic.js',
  './js/logic/cycle.js',
  './js/logic/reta-final-core.js',
  './js/logic/reta-final.js',
  './js/logic/disc.js',
  './js/logic/revisions.js',
  './js/logic/timer.js',
  './js/logic/progress.js',
  './js/main.js',
  './js/notifications.js',
  './js/planejamento/step-renderers.js',
  './js/planejamento/validation.js',
  './js/planejamento-wizard.js',
  './js/registro-sessao.js',
  './js/registro-sessao/modal-renderer.js',
  './js/registro-sessao/session-save.js',
  './js/registro-sessao/session-topics.js',
  './js/relevance.js',
  './js/sw-register.js',
  './js/store.js',
  './js/store/migrations.js',
  './js/store/indexeddb.js',
  './js/store/export-state.js',
  './js/store/normalize-state.js',
  './js/state/chart-state.js',
  './js/state/dashboard-context.js',
  './js/sync/firestore-outbox.js',
  './js/sync/firestore-repository.js',
  './js/sync/firestore-schema.js',
  './js/sync/firestore-sync-engine.js',
  './js/sync/sync-health.js',
  './js/sync/sync-coordinator.js',
  './js/sync/sync-center.js',
  './js/sync/manual-sync.js',
  './js/sync/sync-diagnostic.js',
  './js/utils.js',
  './js/views.js',
  './js/ui/actions/config.js',
  './js/ui/actions/dispatcher.js',
  './js/ui/actions/editais.js',
  './js/ui/actions/eventos.js',
  './js/ui/actions/habitos.js',
  './js/ui/actions/index.js',
  './js/ui/actions/modais.js',
  './js/ui/actions/navegacao.js',
  './js/ui/actions/planejamento.js',
  './js/ui/actions/reta-final.js',
  './js/ui/actions/revisoes.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/event-modals.js',
  './js/ui/search.js',
  './js/views/home-view.js',
  './js/views/med-view.js',
  './js/views/historico-view.js',
  './js/views/editais-crud.js',
  './js/views/editais/shared-state.js',
  './js/views/editais/delete-operations.js',
  './js/views/editais/disc-crud.js',
  './js/views/editais/disc-manager.js',
  './js/views/editais/inline-editing.js',
  './js/views/editais/aula-operations.js',
  './js/views/editais-view.js',
  './js/views/editais-anteriores-view.js',
  './js/views/banca-view.js',
  './js/views/dashboard-view.js',
  './js/views/calendar-view.js',
  './js/views/calendar/calendar-state.js',
  './js/views/calendar/calendar-events.js',
  './js/views/calendar/calendar-day-panel.js',
  './js/views/config-view.js',
  './js/views/config/backup-settings.js',
  './js/views/config/data-management.js',
  './js/views/config/theme-settings.js',
  './js/views/config/sync-center.js',
  './js/views/config/sync-dialogs.js',
  './js/views/habitos-view.js',
  './js/views/ciclo-view.js',
  './js/views/reta-final-associar.js',
  './js/views/reta-final-import.js',
  './js/views/reta-final-view.js',
  './js/views/revisao-view.js',
  './js/views/skeleton-view.js',
  './js/views/state/disc-manager-state.js',
  './vendor/chart.umd.min.js',
  './vendor/firebase-client.bundle.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './assets/icons/icon-maskable-512.svg',
  './manifest.json',
];

// Append version query string to cacheable assets (skip root path)
const ASSETS = ASSET_PATHS.map((p) =>
  p.includes('.') && p !== './' ? `${p}?v=${APP_VERSION}` : p
);

function isShellAssetRequest(url) {
  return (
    url.origin === location.origin &&
    (url.pathname === '/' ||
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css'))
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
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      }),
      self.clients.claim(),
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
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, clone))
          .catch(() => {});
      }
      return res;
    })
    .catch(() => caches.match(request));
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
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
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, clone))
          .catch(() => {});
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
        caches
          .match(`./index.html?v=${APP_VERSION}`)
          .then((v) => v || caches.match('./index.html'))
          .then((v) => v || caches.match('./'))
          .then((v) => v || fetch('./index.html'))
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

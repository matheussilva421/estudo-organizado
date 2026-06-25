if ('serviceWorker' in navigator) {
  const serviceWorkerScriptUrl = document.currentScript?.src || window.location.href;
  // How often to ask the SW to look for a new version while the tab is open.
  // Without this, reg.update() would only run on window.load — leaving tabs
  // that stay open for hours stuck on stale code until manual refresh.
  const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

  function showUpdateBanner(onAccept) {
    if (document.getElementById('sw-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'right:16px',
      'z-index:99999',
      'background:#1f2937',
      'color:#f9fafb',
      'padding:12px 16px',
      'border-radius:var(--radius-sm)',
      'box-shadow:0 4px 14px rgba(0,0,0,0.3)',
      'border:1px solid rgba(255,255,255,0.08)',
      'font:14px system-ui,sans-serif',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'max-width:360px',
    ].join(';');
    banner.innerHTML = `
      <span>🔄 Nova versão disponível</span>
      <button type="button" id="sw-update-now" style="background:#3b82f6;color:#fff;border:none;padding:6px 12px;border-radius:var(--radius-tight);cursor:pointer;font:inherit;">Recarregar</button>
      <button type="button" id="sw-update-later" aria-label="Dispensar" style="background:transparent;color:#9ca3af;border:none;cursor:pointer;font:18px system-ui;line-height:1;padding:0 4px;">×</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('sw-update-now').addEventListener('click', () => {
      banner.remove();
      onAccept();
    });
    document.getElementById('sw-update-later').addEventListener('click', () => {
      banner.remove();
    });
  }

  window.addEventListener('load', async () => {
    try {
      const assetVersion = new URL(serviceWorkerScriptUrl).searchParams.get('v');
      const currentCacheName = assetVersion ? `estudo-organizado-v${assetVersion}` : null;

      // Limpar caches antigos sem apagar o precache da versao atual.
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('estudo-organizado') && cacheName !== currentCacheName) {
          await caches.delete(cacheName);
        }
      }

      let refreshing = false;
      const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadServiceWorkerController) return;
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      if (!reg) return;
      console.log('SW Registrado com escopo:', reg.scope);

      const promoteWaitingWorker = () => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      // If a new SW is detected while the user has the tab open, show a small
      // banner so they know what's happening when the page reloads. The banner
      // also gives a manual fallback if the auto-reload (controllerchange) is
      // blocked for any reason (e.g., page used during a long-running task).
      const handleWaitingWorkerReady = () => {
        if (!hadServiceWorkerController) {
          // First-time install — no need to interrupt the user with a banner.
          return;
        }
        showUpdateBanner(() => promoteWaitingWorker());
        // Also auto-promote after a short delay so users who don't click the
        // banner still get the new version without manual action.
        setTimeout(() => promoteWaitingWorker(), 5000);
      };

      // Check current state at registration time.
      if (reg.waiting) handleWaitingWorkerReady();

      // Stubs de registro (ex.: servidor mock local) podem não implementar
      // addEventListener/update — degrade sem quebrar o boot.
      if (typeof reg.addEventListener === 'function') {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleWaitingWorkerReady();
            }
          });
        });
      }

      const checkForUpdate = () => {
        if (typeof reg.update === 'function') reg.update().catch(() => {});
      };

      // Run an immediate update check.
      checkForUpdate();

      // Periodic update check while the tab is visible. Stops while hidden
      // to avoid wasting bandwidth on background tabs.
      let updateInterval = null;
      function startPeriodicUpdates() {
        if (updateInterval) return;
        updateInterval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      }
      function stopPeriodicUpdates() {
        if (!updateInterval) return;
        clearInterval(updateInterval);
        updateInterval = null;
      }
      if (document.visibilityState === 'visible') startPeriodicUpdates();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          startPeriodicUpdates();
          // Re-check immediately on tab focus — picks up newly deployed
          // versions even if the periodic interval hasn't ticked yet.
          checkForUpdate();
        } else {
          stopPeriodicUpdates();
        }
      });
    } catch (err) {
      console.error('Erro no registro do SW:', err);
    }
  });
}

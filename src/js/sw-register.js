if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Limpar todos os caches antigos primeiro
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('estudo-organizado')) {
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
      console.log('SW Registrado com escopo:', reg.scope);

      const promoteWaitingWorker = () => {
        if (reg.waiting) {
          // Validar origem antes de enviar mensagem
          reg.waiting.postMessage({ type: 'SKIP_WAITING' }, window.location.origin);
        }
      };

      promoteWaitingWorker();

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            promoteWaitingWorker();
          }
        });
      });

      await reg.update();
    } catch (err) {
      console.error('Erro no registro do SW:', err);
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      console.log('SW Registrado com escopo:', reg.scope);

      const promoteWaitingWorker = () => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
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

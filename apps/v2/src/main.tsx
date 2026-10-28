import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './presentation/App';
import { registerV2ServiceWorker } from './platform/sw-update';
import './presentation/tokens.css';
import './presentation/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

async function bootstrap(): Promise<void> {
  // The harness must exist before the first render so every E2E that waits for
  // `data-db-ready` can immediately use `window.__v2E2E`.
  if (__V2_E2E__) {
    const { installE2EHarness } = await import('./platform/e2e-harness');
    installE2EHarness();
  }

  createRoot(root as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void registerV2ServiceWorker();
  });
}

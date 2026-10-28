import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './presentation/App';
import { registerV2ServiceWorker } from './platform/sw-update';
import './presentation/tokens.css';
import './presentation/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

if (__V2_E2E__) {
  void import('./platform/e2e-harness').then(({ installE2EHarness }) => {
    installE2EHarness();
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void registerV2ServiceWorker();
  });
}

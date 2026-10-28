import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './presentation/App';
import { registerV2ServiceWorker } from './platform/sw-update';
import { installE2EHarness } from './platform/e2e-harness';
import './presentation/tokens.css';
import './presentation/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

installE2EHarness();

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

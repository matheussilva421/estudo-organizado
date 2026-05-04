import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read mock-firebase-stub.js content from disk.
 * @returns {string} The raw JavaScript content of the Firebase stub.
 */
export function getFirebaseStubContent() {
  const stubPath = join(__dirname, 'mock-firebase-stub.js');
  return readFileSync(stubPath, 'utf-8');
}

/**
 * Inject mock scripts into HTML string.
 *
 * @param {string} html - The raw HTML content (e.g. from src/index.html).
 * @param {'preserve'|'reset'|'clean'} mode - Mock data mode.
 * @param {object|null} mockData - Seed data for 'reset' mode.
 * @returns {string} Modified HTML with mock scripts injected.
 */
export function injectMockScripts(html, mode, mockData) {
  // 1. Replace firebase-runtime-config.js with mock stub
  const hadFirebaseTag = /<script\s+src="js\/firebase\/firebase-runtime-config\.js"[^>]*>/i.test(html);
  html = html.replace(
    /<script\s+src="js\/firebase\/firebase-runtime-config\.js"[^>]*><\/script>/gi,
    '<script src="/mock-firebase-stub.js"></script>'
  );

  // 2. Build the mock initialization script
  const shouldClear = mode === 'reset' || mode === 'clean';
  const shouldSeed = mode === 'reset';

  const mockScript = `<script>
(function() {
  'use strict';

  // --- Mock mode flags ---
  window.__MOCK_MODE__ = true;
  window.__MOCK_MODE_ACTION__ = '${mode}';

  // --- Block Service Worker registration ---
  if ('serviceWorker' in navigator) {
    const _origRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      return Promise.resolve({
        unregister: function() { return Promise.resolve(); },
        update: function() { return Promise.resolve(); },
        scope: '/',
        installing: null,
        waiting: null,
        active: null
      });
    };

    if (typeof navigator.serviceWorker.getRegistrations === 'function') {
      const _origGetRegistrations = navigator.serviceWorker.getRegistrations;
      navigator.serviceWorker.getRegistrations = function() {
        return Promise.resolve([]);
      };
    }
  }

  // --- Prevent SW controllerchange from reloading the page ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function(e) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }

  // --- IndexedDB cleanup ---
  function clearIndexedDB() {
    if (typeof indexedDB === 'undefined') return;
    var dbs = ['EstudoOrganizadoDB', 'EstudoCredenciaisDB'];
    dbs.forEach(function(dbName) {
      try {
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function() {};
        req.onerror = function() {};
      } catch(e) {}
    });
  }

  // --- localStorage cleanup ---
  function clearLocalStorage() {
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf('estudo_') === 0) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
    } catch(e) {}
  }

  // --- Apply mode-specific logic ---
  if (${shouldClear}) {
    clearIndexedDB();
    clearLocalStorage();
  }

  if (${shouldSeed}) {
    try {
      var seedData = ${JSON.stringify(mockData || {})};
      localStorage.setItem('estudo_state', JSON.stringify(seedData));
    } catch(e) {}
  }
})();
</script>`;

  // 3. Insert mock script as FIRST child of <head>
  html = html.replace(/<head([^>]*)>/i, `<head$1>${mockScript}`);

  // 4. If the original firebase tag was not in the HTML, inject the stub reference
  //    into <head> so the mock server can serve it
  if (!hadFirebaseTag) {
    html = html.replace(/<head([^>]*)>/i, '<head$1><script src=\'/mock-firebase-stub.js\'></script>');
  }

  return html;
}

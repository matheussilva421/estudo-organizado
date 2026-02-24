// ES Module Entry Point
// Imports all modules and exposes functions to window for onclick handlers

import * as store from './store.js';
import * as app from './app.js';
import * as logic from './logic.js';
import * as components from './components.js';
import * as views from './views.js';
import * as drive_sync from './drive-sync.js';

// Expose all exports to window (temporary bridge for inline onclick handlers)
const modules = [store, app, logic, components, views, drive_sync];
for (const mod of modules) {
  for (const [key, value] of Object.entries(mod)) {
    window[key] = value;
  }
}

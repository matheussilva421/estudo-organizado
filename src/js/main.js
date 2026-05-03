// ES Module Entry Point
// Imports all modules and exposes functions via window.EstudoApp namespace

import * as store from './store.js?v=8.37';
import * as app from './app.js?v=8.37';
import * as logic from './logic.js?v=8.37';
import * as components from './components.js?v=8.37';
import * as views from './views.js?v=8.37';
import * as calendar_view from './views/calendar-view.js?v=8.37';
import * as drive_sync from './drive-sync.js?v=8.37';
import * as cloud_sync from './cloud-sync.js?v=8.37';
import * as registro from './registro-sessao.js?v=8.37';
import * as utils from './utils.js?v=8.37';
import * as wizard from './planejamento-wizard.js?v=8.37';

import * as relevance from './relevance.js?v=8.37';
import * as lesson_mapper from './lesson-mapper.js?v=8.37';
import * as firestore_sync from './sync/firestore-sync-engine.js?v=8.37';
import * as sync_coordinator from './sync/sync-coordinator.js?v=8.37';
import { initSyncStatusUI } from './sync/sync-status-ui.js?v=8.37';

// Import UI helpers and action dispatcher
import { setupActionDispatcher } from './ui/actions/index.js?v=8.37';
import { qs, qsa } from './ui/dom.js?v=8.37';
import { initModals, announce } from './ui/dialog.js?v=8.37';
import { addCleanupListener } from './utils.js?v=8.37';

// Expose UI helpers to window for gradual migration
window.qs = qs;
window.qsa = qsa;
window.announce = announce;

// Create namespace for all exports (prevents global pollution)
window.EstudoApp = {};
const exposedModules = [
  store,
  app,
  logic,
  components,
  views,
  calendar_view,
  drive_sync,
  cloud_sync,
  registro,
  utils,
  wizard,
  relevance,
  lesson_mapper,
  firestore_sync,
  sync_coordinator,
];

for (const mod of exposedModules) {
  for (const key of Object.keys(mod)) {
    // Skip internal/private exports (starting with _)
    if (key.startsWith('_')) continue;

    // Warn on duplicates
    if (key in window.EstudoApp) {
      console.warn(`[EstudoApp] Duplicate export: ${key}`);
    }

    Object.defineProperty(window.EstudoApp, key, {
      configurable: true,
      enumerable: true,
      get: () => mod[key],
    });
  }
}

// Log loaded modules for debugging
console.log(`[EstudoApp] ${Object.keys(window.EstudoApp).length} módulos carregados`);

// Legacy bridge for backward compatibility (to be removed in v9.0)
// Gradually migrated to direct imports in each module
const legacyBridgeKeys = [
  'state',
  'setState',
  'scheduleSave',
  'navigate',
  'renderCurrentView',
  'showToast',
  'openModal',
  'closeModal',
  'saveStateToDB',
];
legacyBridgeKeys.forEach((key) => {
  if (key in window.EstudoApp) {
    window[key] = window.EstudoApp[key];
  }
});

// Legacy bridge for registro-sessao functions
const registroBridgeKeys = [
  'openRegistroSessao',
  'discardTimerUI',
  'voltarPastSessionUI',
  'deleteCompletedSession',
];
registroBridgeKeys.forEach((key) => {
  if (key in window.EstudoApp) {
    window[key] = window.EstudoApp[key];
  }
});

// Legacy bridge for planejamento wizard functions
const wizardBridgeKeys = [
  'pwUpdateHours',
  'pwSelectTipo',
  'pwToggleDisc',
  'pwToggleDay',
  'pwUpdateRelevancia',
  'pwUpdateDayHour',
  'pwClearDisc',
  'pwSearchDisc',
  'pwSelectAllDisc',
];
wizardBridgeKeys.forEach((key) => {
  if (key in window.EstudoApp) {
    window[key] = window.EstudoApp[key];
  }
});

// ============================================================
// INITIALIZE APPLICATION
// ============================================================
// Setup DOM event handlers that need to be attached BEFORE init
app.setupConfirmHandlers();

// Initialize centralized action dispatcher (replaces inline handlers)
setupActionDispatcher();

// Initialize modals with ARIA attributes and accessibility features
initModals();

// Initialize local save status indicator
app.initSaveStatusIndicator();

// Call init - modules are deferred, so DOM is ready
app.init();

// Initialize sync status UI component (decoupled from renderCurrentView)
initSyncStatusUI();

// ============================================================
// DOMAIN EVENT LISTENERS (Etapa 2 - Quebrando ciclos)
// ============================================================
// Usar addCleanupListener para prevenir memory leaks
// NOTE: Sync status is now handled by sync-status-ui.js (imported above).
// No longer trigger full re-renders on sync status changes.

addCleanupListener(document, 'app:renderCurrentView', () => {
  components.renderCurrentView();
});
addCleanupListener(document, 'app:updateBadges', () => {
  components.updateBadges();
});
addCleanupListener(document, 'app:showToast', (e) => {
  app.showToast(e.detail.msg, e.detail.type);
});
addCleanupListener(document, 'app:showConfirm', (e) => {
  app.showConfirm(e.detail.msg, e.detail.onYes, e.detail.opts);
});
addCleanupListener(document, 'app:invalidateCaches', () => {
  logic.invalidateDiscCache();
  logic.invalidateRevCache();
  logic.invalidatePendingRevCache();
  utils.invalidateTodayCache();
  logic.invalidateStreakCache();
  logic.invalidateDashCaches();
});

// Force cache invalidation if user returns to app next day
addCleanupListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    utils.invalidateTodayCache();
    logic.invalidatePendingRevCache();
    components.renderCurrentView();
  }
});

// Domain events fired from logic.js to update specific views
addCleanupListener(document, 'app:refreshEventCard', (e) => {
  views.refreshEventCard(e.detail.eventId);
});
addCleanupListener(document, 'app:refreshMEDSections', () => {
  views.refreshMEDSections();
});
addCleanupListener(document, 'app:eventoDeleted', (e) => {
  if (app.currentView === 'med') {
    views.removeDOMCard(e.detail.eventId);
  } else {
    components.renderCurrentView();
  }
});

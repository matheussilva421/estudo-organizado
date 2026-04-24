// ES Module Entry Point
// Imports all modules and exposes functions via window.EstudoApp namespace

import * as store from './store.js?v=8.15';
import * as app from './app.js?v=8.15';
import * as logic from './logic.js?v=8.15';
import * as components from './components.js?v=8.15';
import * as views from './views.js?v=8.15';
import * as calendar_view from './views/calendar-view.js?v=8.15';
import * as drive_sync from './drive-sync.js?v=8.15';
import * as cloud_sync from './cloud-sync.js?v=8.15';
import * as registro from './registro-sessao.js?v=8.15';
import * as utils from './utils.js?v=8.15';
import * as wizard from './planejamento-wizard.js?v=8.15';

import * as relevance from './relevance.js?v=8.15';
import * as lesson_mapper from './lesson-mapper.js?v=8.15';

// Import UI helpers and action dispatcher
import { setupActionDispatcher } from './ui/actions/index.js?v=8.15';
import { qs, qsa } from './ui/dom.js?v=8.15';
import { initModals, announce } from './ui/dialog.js?v=8.15';
import { addCleanupListener } from './utils.js?v=8.15';

// Expose UI helpers to window for gradual migration
window.qs = qs;
window.qsa = qsa;
window.announce = announce;

// Create namespace for all exports (prevents global pollution)
window.EstudoApp = {};
const exposedModules = [store, app, logic, components, views, calendar_view, drive_sync, cloud_sync, registro, utils, wizard, relevance, lesson_mapper];

for (const mod of exposedModules) {
  for (const [key, value] of Object.entries(mod)) {
    // Skip internal/private exports (starting with _)
    if (key.startsWith('_')) continue;

    // Warn on duplicates
    if (key in window.EstudoApp) {
      console.warn(`[EstudoApp] Duplicate export: ${key}`);
    }

    window.EstudoApp[key] = value;
  }
}

// Log loaded modules for debugging
console.log(`[EstudoApp] ${Object.keys(window.EstudoApp).length} módulos carregados`);

// Legacy bridge for backward compatibility (to be removed in v9.0)
// Gradually migrated to direct imports in each module
const legacyBridgeKeys = ['state', 'setState', 'scheduleSave', 'navigate', 'renderCurrentView', 'showToast', 'openModal', 'closeModal', 'saveStateToDB'];
legacyBridgeKeys.forEach(key => {
  if (key in window.EstudoApp) {
    window[key] = window.EstudoApp[key];
  }
});

// Legacy bridge for registro-sessao functions
const registroBridgeKeys = ['openRegistroSessao', 'discardTimerUI', 'voltarPastSessionUI', 'deleteCompletedSession'];
registroBridgeKeys.forEach(key => {
  if (key in window.EstudoApp) {
    window[key] = window.EstudoApp[key];
  }
});

// Legacy bridge for planejamento wizard functions
const wizardBridgeKeys = ['pwUpdateHours', 'pwSelectTipo', 'pwToggleDisc', 'pwToggleDay', 'pwUpdateRelevancia', 'pwUpdateDayHour', 'pwClearDisc', 'pwSearchDisc', 'pwSelectAllDisc'];
wizardBridgeKeys.forEach(key => {
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

// Call init - modules are deferred, so DOM is ready
app.init();

// ============================================================
// DOMAIN EVENT LISTENERS (Etapa 2 - Quebrando ciclos)
// ============================================================
// Usar addCleanupListener para prevenir memory leaks
addCleanupListener(document, 'app:renderCurrentView', () => {
  if (typeof window.EstudoApp?.renderCurrentView === 'function') window.EstudoApp.renderCurrentView();
});
addCleanupListener(document, 'app:updateBadges', () => {
  if (typeof window.EstudoApp?.updateBadges === 'function') window.EstudoApp.updateBadges();
});
addCleanupListener(document, 'app:showToast', (e) => {
  if (typeof window.EstudoApp?.showToast === 'function') window.EstudoApp.showToast(e.detail.msg, e.detail.type);
});
addCleanupListener(document, 'app:showConfirm', (e) => {
  if (typeof window.EstudoApp?.showConfirm === 'function') window.EstudoApp.showConfirm(e.detail.msg, e.detail.onYes, e.detail.opts);
});
addCleanupListener(document, 'app:invalidateCaches', () => {
  if (typeof window.EstudoApp?.invalidateDiscCache === 'function') window.EstudoApp.invalidateDiscCache();
  if (typeof window.EstudoApp?.invalidateRevCache === 'function') window.EstudoApp.invalidateRevCache();
  if (typeof window.EstudoApp?.invalidatePendingRevCache === 'function') window.EstudoApp.invalidatePendingRevCache();
  if (typeof window.EstudoApp?.invalidateTodayCache === 'function') window.EstudoApp.invalidateTodayCache();
  if (typeof window.EstudoApp?.invalidateStreakCache === 'function') window.EstudoApp.invalidateStreakCache();
  if (typeof window.EstudoApp?.invalidateDashCaches === 'function') window.EstudoApp.invalidateDashCaches();
});

// Force cache invalidation if user returns to app next day
addCleanupListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (typeof window.EstudoApp?.invalidateTodayCache === 'function') window.EstudoApp.invalidateTodayCache();
    if (typeof window.EstudoApp?.invalidatePendingRevCache === 'function') window.EstudoApp.invalidatePendingRevCache();
    if (typeof window.EstudoApp?.renderCurrentView === 'function') window.EstudoApp.renderCurrentView();
  }
});

// Domain events fired from logic.js to update specific views
addCleanupListener(document, 'app:refreshEventCard', (e) => {
  if (typeof window.EstudoApp?.refreshEventCard === 'function') window.EstudoApp.refreshEventCard(e.detail.eventId);
});
addCleanupListener(document, 'app:refreshMEDSections', () => {
  if (typeof window.EstudoApp?.refreshMEDSections === 'function') window.EstudoApp.refreshMEDSections();
});
addCleanupListener(document, 'app:eventoDeleted', (e) => {
  if (window.EstudoApp?.currentView === 'med' && typeof window.EstudoApp?.removeDOMCard === 'function') {
    window.EstudoApp.removeDOMCard(e.detail.eventId);
  } else if (typeof window.EstudoApp?.renderCurrentView === 'function') {
    window.EstudoApp.renderCurrentView();
  }
});

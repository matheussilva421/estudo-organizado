// ES Module Entry Point
// Imports all modules and exposes functions to window for onclick handlers

import * as store from './store.js?v=8.3';
import * as app from './app.js?v=8.3';
import * as logic from './logic.js?v=8.3';
import * as components from './components.js?v=8.3';
import * as views from './views.js?v=8.3';
import * as calendar_view from './views/calendar-view.js?v=8.3';
import * as drive_sync from './drive-sync.js?v=8.3';
import * as cloud_sync from './cloud-sync.js?v=8.3';
import * as registro from './registro-sessao.js?v=8.3';
import * as utils from './utils.js?v=8.3';
import * as wizard from './planejamento-wizard.js?v=8.3';

import * as relevance from './relevance.js?v=8.3';
import * as lesson_mapper from './lesson-mapper.js?v=8.3';

// Import UI helpers and action dispatcher
import { setupActionDispatcher } from './ui/actions.js?v=8.3';
import { qs, qsa } from './ui/dom.js?v=8.3';
import { initModals, announce } from './ui/dialog.js?v=8.3';

// Expose UI helpers to window for gradual migration
window.qs = qs;
window.qsa = qsa;
window.announce = announce;

// Expose all exports to window (temporary bridge for inline onclick handlers)
const modules = [store, app, logic, components, views, calendar_view, drive_sync, cloud_sync, registro, utils, wizard, relevance, lesson_mapper];

for (const mod of modules) {
  for (const [key, value] of Object.entries(mod)) {
    window[key] = value;
  }
}


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
document.addEventListener('app:renderCurrentView', () => {
  if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
});
document.addEventListener('app:updateBadges', () => {
  if (typeof window.updateBadges === 'function') window.updateBadges();
});
document.addEventListener('app:showToast', (e) => {
  if (typeof window.showToast === 'function') window.showToast(e.detail.msg, e.detail.type);
});
document.addEventListener('app:showConfirm', (e) => {
  if (typeof window.showConfirm === 'function') window.showConfirm(e.detail.msg, e.detail.onYes, e.detail.opts);
});
document.addEventListener('app:invalidateCaches', () => {
  if (typeof window.invalidateDiscCache === 'function') window.invalidateDiscCache();
  if (typeof window.invalidateRevCache === 'function') window.invalidateRevCache();
  if (typeof window.invalidatePendingRevCache === 'function') window.invalidatePendingRevCache();
  if (typeof window.invalidateTodayCache === 'function') window.invalidateTodayCache();
  if (typeof window.invalidateStreakCache === 'function') window.invalidateStreakCache();
  if (typeof window.invalidateDashCaches === 'function') window.invalidateDashCaches();
});

// Force cache invalidation if user returns to app next day
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (typeof window.invalidateTodayCache === 'function') window.invalidateTodayCache();
    if (typeof window.invalidatePendingRevCache === 'function') window.invalidatePendingRevCache();
    if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
  }
});

// Domain events fired from logic.js to update specific views
document.addEventListener('app:refreshEventCard', (e) => {
  if (typeof window.refreshEventCard === 'function') window.refreshEventCard(e.detail.eventId);
});
document.addEventListener('app:refreshMEDSections', () => {
  if (typeof window.refreshMEDSections === 'function') window.refreshMEDSections();
});
document.addEventListener('app:eventoDeleted', (e) => {
  if (window.currentView === 'med' && typeof window.removeDOMCard === 'function') {
    window.removeDOMCard(e.detail.eventId);
  } else if (typeof window.renderCurrentView === 'function') {
    window.renderCurrentView();
  }
});

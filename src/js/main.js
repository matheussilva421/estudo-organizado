// ES Module Entry Point
// Imports all modules and exposes functions to window for onclick handlers

import * as store from './store.js';
import * as app from './app.js';
import * as logic from './logic.js';
import * as components from './components.js';
import * as views from './views.js';
import * as drive_sync from './drive-sync.js';
import * as registro from './registro-sessao.js';
import * as utils from './utils.js';
import * as wizard from './planejamento-wizard.js';

// Expose all exports to window (temporary bridge for inline onclick handlers)
const modules = [store, app, logic, components, views, drive_sync, registro, utils, wizard];
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
document.addEventListener('app:removeDOMCard', (e) => {
  if (typeof window.removeDOMCard === 'function') window.removeDOMCard(e.detail.eventId);
});
document.addEventListener('app:eventoDeleted', (e) => {
  if (window.currentView === 'med' && typeof window.removeDOMCard === 'function') {
    window.removeDOMCard(e.detail.eventId);
  } else if (typeof window.renderCurrentView === 'function') {
    window.renderCurrentView();
  }
});

// ============================================================
// CENTRAL EVENT DELEGATION (Etapa 2 - JS Quality)
// ============================================================
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;

  switch (action) {
    // Navigation
    case 'navigate':
      window.navigate(el.dataset.view);
      break;

    // Sidebar
    case 'close-sidebar':
      window.closeSidebar();
      break;
    case 'toggle-sidebar':
      window.toggleSidebar();
      break;

    // Theme
    case 'toggle-theme':
      window.applyTheme(true);
      window.renderCurrentView();
      break;

    // Timer
    case 'toggle-timer-mode':
      window.toggleTimerMode();
      break;

    // Modals
    case 'close-modal':
      window.closeModal(el.dataset.modal);
      break;
    case 'open-drive-modal':
      window.openDriveModal();
      break;

    // Save actions
    case 'save-disc':
      window.saveDisc();
      break;
    case 'save-subjects':
      window.saveSubjects();
      break;
    case 'save-habit':
      window.saveHabit();
      break;
    case 'drive-action':
      window.driveAction();
      break;

    // Dashboard Interactions
    case 'prompt-prova':
      window.promptDataProva();
      break;
    case 'prompt-metas':
      window.promptMetas();
      break;

    // Ciclo de Estudos
    case 'remover-planejamento':
      if (typeof window.deletePlanejamento === 'function') window.deletePlanejamento();
      break;
    case 'remover-ciclo':
      window.removerCiclo();
      break;
    case 'toggle-ciclo-fin':
      window.toggleCicloFin(el.checked);
      break;

    default:
      console.warn('Unknown data-action:', action);
  }
});

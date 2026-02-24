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


// ============================================================
// INITIALIZE APPLICATION
// ============================================================
// Setup DOM event handlers that need to be attached BEFORE init
app.setupConfirmHandlers();

// Call init - modules are deferred, so DOM is ready
app.init();

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

    default:
      console.warn('Unknown data-action:', action);
  }
});

// =============================================
// NAVIGATION & SIDEBAR
// =============================================
import { renderCurrentView } from '../components.js?v=8.37';
import { clearActiveDashboardDiscCtx } from '../state/dashboard-context.js?v=8.37';
import { closeModal } from './modals.js';

/**
 * View atual sendo renderizada
 * @type {string}
 */
export let currentView = 'home';

/**
 * Navega para uma view específica
 * @param {string} view - Nome da view
 */
export function navigate(view) {
  // Keep navigation responsive even if a modal is currently open.
  // This prevents stale overlays from trapping pointer events after view switches.
  document.querySelectorAll('.modal-overlay.open').forEach((modal) => {
    closeModal(modal.id);
  });

  if (window.innerWidth <= 768) closeSidebar();

  if (view === 'editais') {
    clearActiveDashboardDiscCtx();
  }

  currentView = view;
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  renderCurrentView();
}

// Sidebars

/**
 * Toggle sidebar (abre/fecha no mobile)
 */
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  // On mobile we always open the full sidebar drawer.
  if (window.innerWidth <= 768 && sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
  }
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

/**
 * Fecha sidebar e overlay
 */
export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

/**
 * Toggle collapse da sidebar (desktop apenas)
 */
export function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  // On mobile, collapsing the sidebar is confusing and causes layout overlap.
  // Treat this action as "close drawer".
  if (window.innerWidth <= 768) {
    closeSidebar();
    return;
  }
  sidebar.classList.toggle('collapsed');
  // Salvar preferencia
  if (sidebar.classList.contains('collapsed')) {
    localStorage.setItem('estudo_sidebar_collapsed', 'true');
  } else {
    localStorage.removeItem('estudo_sidebar_collapsed');
  }
}

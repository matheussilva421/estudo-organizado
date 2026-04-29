/**
 * Ações de Navegação e UI
 * Handlers para navegação entre views, sidebar e theme toggle
 */

import { registerAction } from './dispatcher.js';
import { debouncedOnSearch, onSearchFocus, clearSearch } from '../../views.js?v=8.25';
import { setCalViewMode, calNavigate } from '../../views/calendar-view.js?v=8.25';

// Registrar ações
registerAction('navigate', navigate);
registerAction('search-input', (el) => debouncedOnSearch(el.value));
registerAction('search-focus', onSearchFocus);
registerAction('clear-search', clearSearch);
registerAction('set-cal-view-mode', (el) => setCalViewMode(el.dataset.mode));
registerAction('cal-navigate', (el) => calNavigate(parseInt(el.dataset.dir, 10)));
registerAction('cal-today', () => calNavigate(0));
registerAction('set-dash-period', (el) => setDashPeriod(el));

/**
 * Navega para uma view específica
 * @param {HTMLElement} el - Elemento acionador
 */
export function navigate(el) {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp.navigate(view);
  }
}

/**
 * Navega preservando contexto
 * @param {HTMLElement} el - Elemento acionador
 */
export function navigateWithCtx(el) {
  const view = el.dataset.view;
  const ctx = el.dataset.ctx;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    if (ctx) {
      window.activeDashboardDiscCtx = JSON.parse(decodeURIComponent(ctx));
    }
    window.EstudoApp?.navigate(view);
  }
}

/**
 * Navega e limpa search
 * @param {HTMLElement} el - Elemento acionador
 */
export function navigateClearSearch(el) {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp?.navigate(view);
    window.EstudoApp?.clearSearch();
  }
}

/**
 * Fecha sidebar
 */
export function closeSidebar() {
  if (typeof window.EstudoApp?.closeSidebar === 'function') {
    window.EstudoApp?.closeSidebar();
  }
}

/**
 * Abre/sidebar toggle
 */
export function toggleSidebar() {
  if (typeof window.EstudoApp?.toggleSidebar === 'function') {
    window.EstudoApp?.toggleSidebar();
  }
}

/**
 * Toggle collapse da sidebar (desktop)
 */
export function toggleSidebarCollapse() {
  if (typeof window.EstudoApp?.toggleSidebarCollapse === 'function') {
    window.EstudoApp?.toggleSidebarCollapse();
  }
}

/**
 * Troca o tema visual
 */
export function toggleTheme() {
  if (typeof window.EstudoApp?.applyTheme === 'function') {
    window.EstudoApp?.applyTheme(true);
    window.EstudoApp?.renderCurrentView();
  }
}

/**
 * Abre modal de definição de data da prova
 */
export function promptProva() {
  if (typeof window.EstudoApp?.promptDataProva === 'function') {
    window.EstudoApp?.promptDataProva();
  }
}

/**
 * Abre modal de definição de metas
 */
export function promptMetas() {
  if (typeof window.EstudoApp?.promptMetas === 'function') {
    window.EstudoApp?.promptMetas();
  }
}

/**
 * Fecha modal de dashboard de disciplina
 */
export function closeDiscDashboard() {
  if (typeof window.EstudoApp?.closeDiscDashboard === 'function') {
    window.EstudoApp?.closeDiscDashboard();
  }
}

/**
 * Alterna filtro de concluídos no Ciclo
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleCicloFin(el) {
  if (typeof window.EstudoApp?.toggleCicloFin === 'function') {
    window.EstudoApp?.toggleCicloFin(el.checked);
  }
}

/**
 * Atualiza o período do dashboard
 * @param {HTMLElement} el - Elemento acionador
 */
export function setDashPeriod(el) {
  const raw = el.dataset.period;
  const period = raw === 'null' ? null : parseInt(raw, 10);
  if (typeof window.EstudoApp?.setDashPeriod === 'function') {
    window.EstudoApp.setDashPeriod(period);
  }
}

/**
 * Navega para cronômetro do evento
 * @param {HTMLElement} el - Elemento acionador
 */
export function switchToEventTimer(el) {
  const eventId = el.dataset.eventId;
  const view = el.dataset.view || 'cronometro';
  if (typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp?.navigate(view);
    setTimeout(() => {
      if (typeof window.EstudoApp?.toggleTimer === 'function') {
        window.EstudoApp?.toggleTimer(eventId);
      }
    }, 100);
  }
}

// Registrar ações restantes
registerAction('navigate-with-ctx', navigateWithCtx);
registerAction('navigate-clear-search', navigateClearSearch);
registerAction('close-sidebar', closeSidebar);
registerAction('toggle-sidebar', toggleSidebar);
registerAction('toggle-sidebar-collapse', toggleSidebarCollapse);
registerAction('toggle-theme', toggleTheme);
registerAction('prompt-prova', promptProva);
registerAction('prompt-metas', promptMetas);
registerAction('close-disc-dashboard', closeDiscDashboard);
registerAction('toggle-ciclo-fin', toggleCicloFin);
// Nota: switch-to-event-timer está em eventos.js

/**
 * Ações de Navegação e UI
 * Handlers para navegação entre views, sidebar e theme toggle
 */

/**
 * Navega para uma view específica
 * @param {HTMLElement} el - Elemento acionador
 */
export function navigate(el) {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp?.navigate(view);
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
 * Alterna tema claro/escuro
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

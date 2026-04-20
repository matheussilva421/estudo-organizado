/**
 * Ações de Modais
 * Handlers para abrir/fechar modais e controles de UI
 */

/**
 * Fecha modal
 * @param {HTMLElement} el - Elemento acionador
 */
export function closeModal(el) {
  const modal = el.dataset.modal;
  if (modal && typeof window.EstudoApp?.closeModal === 'function') {
    window.EstudoApp?.closeModal(modal);
  }
}

/**
 * Abre modal de novo evento
 */
export function openAddEvent() {
  if (typeof window.EstudoApp?.openAddEventModal === 'function') {
    window.EstudoApp?.openAddEventModal();
  }
}

/**
 * Abre detalhes do evento
 * @param {HTMLElement} el - Elemento acionador
 */
export function openEventDetail(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.openEventDetail === 'function') {
    window.EstudoApp?.openEventDetail(eventId);
  }
}

/**
 * Abre modal de evento por data
 * @param {HTMLElement} el - Elemento acionador
 */
export function openEventModalDate(el) {
  const date = el.dataset.date;
  if (date && typeof window.EstudoApp?.openAddEventModalDate === 'function') {
    window.EstudoApp?.openAddEventModalDate(date);
  }
}

/**
 * Abre modal de planejamento
 */
export function openPlanejamentoWizard() {
  if (typeof window.EstudoApp?.openPlanejamentoWizard === 'function') {
    window.EstudoApp?.openPlanejamentoWizard();
  }
}

/**
 * Abre modal de registro de sessão
 * @param {HTMLElement} el - Elemento acionador
 */
export function openRegistroSessao(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.openRegistroSessao === 'function') {
    window.EstudoApp?.openRegistroSessao(discId);
  }
}

/**
 * Abre modal de sessão passada
 * @param {HTMLElement} el - Elemento acionador
 */
export function openAddPastSession(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.openAddPastSessionModal === 'function') {
    window.EstudoApp?.openAddPastSessionModal(discId);
  }
}

/**
 * Abre modal de ciclo history
 * @param {HTMLElement} el - Elemento acionador
 */
export function openCicloHistory(el) {
  const seqId = el.dataset.seqId;
  if (seqId && typeof window.EstudoApp?.openCicloHistory === 'function') {
    window.EstudoApp?.openCicloHistory(seqId);
  }
}

/**
 * Navegação interna: para de propagar evento
 */
export function stopPropagation() {
  // Dispatcher já stopa propagação; esta ação define áreas inertes
}

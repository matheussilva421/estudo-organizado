/**
 * Ações de Modais
 * Handlers para abrir/fechar modais e controles de UI
 */

import { registerAction } from './dispatcher.js';
import {
  onDisciplinaChange,
  onAulaChange,
  toggleStudyType,
  toggleMaterial,
  addNovoTopico,
  validateQuestoes,
  saveRegistroSessao,
  saveAndStartNew,
  setPaginaMode
} from '../../registro-sessao.js?v=8.13';

// Registrar ações
registerAction('close-modal', (el) => closeModal(el));
registerAction('open-planejamento-wizard', () => openPlanejamentoWizard());
registerAction('open-registro-sessao', (el) => openRegistroSessao(el));
registerAction('open-add-past-session', (el) => openAddPastSession(el));
registerAction('on-disciplina-change', onDisciplinaChange);
registerAction('on-aula-change', onAulaChange);
registerAction('toggle-study-type', (el) => toggleStudyType(el.dataset.tipo));
registerAction('toggle-material', (el) => toggleMaterial(el.dataset.mat));
registerAction('add-novo-topico', addNovoTopico);
registerAction('validate-questoes', validateQuestoes);
registerAction('save-registro-sessao', saveRegistroSessao);
registerAction('save-and-start-new', saveAndStartNew);
registerAction('set-pagina-mode', (el) => setPaginaMode(el.dataset.mode));
// Nota: open-add-event, open-event-detail, open-event-from-calo estão em eventos.js

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

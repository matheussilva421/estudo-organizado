/**
 * Ações de Eventos e Cronômetro
 * Handlers para timer, CRUD de eventos e operações relacionadas
 */

import { registerAction } from './dispatcher.js';

// Registrar ações
registerAction('toggle-timer', (el) => toggleTimer(el));
registerAction('discard-timer', (el) => discardTimer(el));
registerAction('mark-studied', (el) => markStudied(el));
registerAction('toggle-timer-mode', () => toggleTimerMode());
registerAction('edit-event', (el) => editEvent(el));
registerAction('delete-event', (el, event) => deleteEvent(el, event));
registerAction('delete-event-from-modal', (el) => deleteEventFromModal(el));
registerAction('open-add-event', () => openAddEvent());
registerAction('open-event-modal-date', (el) => openEventModalDate(el));
registerAction('open-event-from-calo', (el) => openEventModalDate(el));
registerAction('open-event-detail', (el) => openEventDetail(el));
registerAction('switch-to-event-timer', (el) => switchToEventTimer(el));
registerAction('add-minutes', (el) => addMinutes(el));
registerAction('save-event', () => saveEvent());
registerAction('save-past-event', (el) => savePastEvent(el));
registerAction('update-day-load', (el) => updateDayLoad(el));
registerAction('load-assuntos', () => loadAssuntos());
registerAction('cancel-registro', () => callApp('cancelRegistro'));
registerAction('discard-timer-ui', (el) => callApp('discardTimerUI', el.dataset.eventId));
registerAction('voltar-past-session-ui', (el) => callApp('voltarPastSessionUI', el.dataset.eventId, el.dataset.discId));
registerAction('delete-completed-session', (el) => callApp('deleteCompletedSession', el.dataset.sessionId));
registerAction('set-crono-livre-disc', (el) => callApp('setCronoLivreDisc', el.value));
registerAction('set-crono-livre-ass', (el) => callApp('setCronoLivreAss', el.value));
registerAction('set-crono-livre-goal', (el) => setCronoLivreGoal(el));
registerAction('open-search-event', (el) => openSearchEvent(el));
registerAction('edit-session-record', (el) => openSessionRecord(el));
registerAction('delete-session-record', (el) => callApp('deleteCompletedSession', el.dataset.sessionId));

function callApp(fnName, ...args) {
  const fn = window.EstudoApp?.[fnName];
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

function setCronoLivreGoal(el) {
  const raw = el.dataset.value || el.value;
  const current = Number(window.EstudoApp?.state?.cronoLivre?.duracaoMinutos || 0);
  const minutes = String(raw).startsWith('+') || String(raw).startsWith('-')
    ? Math.max(0, current + parseInt(raw, 10))
    : Math.max(0, parseInt(raw, 10) || 0);
  callApp('setCronoLivreGoal', minutes);
}

function openSearchEvent(el) {
  const eventId = el.dataset.eventId;
  if (!eventId) return;
  if (typeof window.EstudoApp?.clearSearch === 'function') {
    window.EstudoApp.clearSearch();
  }
  if (typeof window.EstudoApp?.openEventDetail === 'function') {
    window.EstudoApp.openEventDetail(eventId);
  } else {
    callApp('openRegistroSessao', eventId);
  }
}

function openSessionRecord(el) {
  const sessionId = el.dataset.sessionId;
  if (sessionId) callApp('openRegistroSessao', sessionId);
}

/**
 * Toggle start/stop do timer
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleTimer(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.toggleTimer === 'function') {
    window.EstudoApp?.toggleTimer(eventId);
  }
}

/**
 * Descarta timer sem salvar
 * @param {HTMLElement} el - Elemento acionador
 */
export function discardTimer(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.discardTimer === 'function') {
    window.EstudoApp?.discardTimer(eventId);
  }
}

/**
 * Marca evento como estudado
 * @param {HTMLElement} el - Elemento acionador
 */
export function markStudied(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.marcarEstudei === 'function') {
    window.EstudoApp?.marcarEstudei(eventId);
  }
}

/**
 * Alterna modo Pomodoro/Contínuo
 */
export function toggleTimerMode() {
  if (typeof window.EstudoApp?.toggleTimerMode === 'function') {
    window.EstudoApp?.toggleTimerMode();
  }
}

/**
 * Edita evento existente
 * @param {HTMLElement} el - Elemento acionador
 */
export function editEvent(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.openAddEventModal === 'function') {
    window.EstudoApp?.openAddEventModal(eventId);
  }
}

/**
 * Exclui evento com confirmação
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function deleteEvent(el, event) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.showConfirm === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este evento?', () => {
      if (typeof window.EstudoApp?.deleteEvento === 'function') {
        window.EstudoApp?.deleteEvento(eventId);
      }
    });
  }
}

/**
 * Exclui evento a partir do modal
 * @param {HTMLElement} el - Elemento acionador
 */
export function deleteEventFromModal(el) {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.showConfirm === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este evento?', () => {
      if (typeof window.EstudoApp?.deleteEvento === 'function') {
        window.EstudoApp?.deleteEvento(eventId);
      }
      if (typeof window.EstudoApp?.closeModal === 'function') {
        window.EstudoApp?.closeModal('modal-event-detail');
      }
    });
  }
}

/**
 * Abre modal de novo/editar evento
 */
export function openAddEvent() {
  if (typeof window.EstudoApp?.openAddEventModal === 'function') {
    window.EstudoApp?.openAddEventModal();
  }
}

/**
 * Abre modal de evento para uma data específica
 * @param {HTMLElement} el - Elemento acionador
 */
export function openEventModalDate(el) {
  const date = el.dataset.date;
  if (date && typeof window.EstudoApp?.openAddEventModalDate === 'function') {
    window.EstudoApp?.openAddEventModalDate(date);
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
 * Navega para cronômetro e inicia timer do evento
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

/**
 * Adiciona minutos ao timer
 * @param {HTMLElement} el - Elemento acionador
 */
export function addMinutes(el) {
  const eventId = el.dataset.eventId;
  const minutes = parseInt(el.dataset.minutes, 10);
  if (eventId && typeof window.EstudoApp?.addTimerMinutes === 'function') {
    window.EstudoApp?.addTimerMinutes(eventId, minutes);
  }
}

/**
 * Salva evento (create/update)
 */
export function saveEvent() {
  if (typeof window.EstudoApp?.saveEvent === 'function') {
    window.EstudoApp?.saveEvent();
  }
}

/**
 * Salva evento passado (registro manual)
 * @param {HTMLElement} el - Elemento acionador
 */
export function savePastEvent(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.savePastEvent === 'function') {
    window.EstudoApp?.savePastEvent(discId);
  }
}

/**
 * Atualiza carga horária do dia
 * @param {HTMLElement} el - Elemento acionador
 */
export function updateDayLoad(el) {
  if (typeof window.EstudoApp?.updateDayLoad === 'function') {
    window.EstudoApp?.updateDayLoad(el.value);
  }
}

/**
 * Carrega assuntos na UI
 */
export function loadAssuntos() {
  if (typeof window.EstudoApp?.loadAssuntos === 'function') {
    window.EstudoApp?.loadAssuntos();
  }
}

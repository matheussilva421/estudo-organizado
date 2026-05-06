/**
 * Ações de Eventos e Cronômetro
 * Handlers para timer, CRUD de eventos e operações relacionadas
 */

import { registerAction } from './dispatcher.js';
import {
  toggleTimer,
  discardTimer,
  toggleTimerMode,
  addTimerMinutes,
  setCronoLivreGoal,
  setCronoLivreDisc,
  setCronoLivreAss,
  removeEvento,
} from '../../logic.js?v=8.37';
import {
  openAddEventModal,
  updateDayLoad,
  loadAssuntos,
  saveEvent,
  savePastEvent,
  openEventDetail,
} from '../../ui/event-modals.js?v=8.37';
import { showConfirm, closeModal } from '../../app.js?v=8.37';
import { marcarEstudei } from '../../logic.js?v=8.37';
import { clearSearch } from '../../views.js?v=8.37';
import {
  openRegistroSessao,
  cancelRegistro,
  discardTimerUI,
  voltarPastSessionUI,
  deleteCompletedSession,
} from '../../registro-sessao.js?v=8.37';
import { state } from '../../store.js?v=8.37';

// Registrar ações
registerAction('toggle-timer', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) toggleTimer(eventId);
});
registerAction('discard-timer', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) discardTimer(eventId);
});
registerAction('mark-studied', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) marcarEstudei(eventId);
});
registerAction('toggle-timer-mode', toggleTimerMode);
registerAction('edit-event', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) openAddEventModal(eventId);
});
registerAction('delete-event', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) {
    showConfirm('Tem certeza que deseja excluir este evento?', () => {
      removeEvento(eventId);
    });
  }
});
registerAction('delete-event-from-modal', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) {
    showConfirm('Tem certeza que deseja excluir este evento?', () => {
      removeEvento(eventId);
      closeModal('modal-event-detail');
    });
  }
});
registerAction('open-add-event', () => openAddEventModal());
registerAction('open-event-modal-date', (el) => {
  const date = el.dataset.date;
  if (date) openAddEventModal(date);
});
registerAction('open-event-from-calo', (el) => {
  const date = el.dataset.date;
  if (date) openAddEventModal(date);
});
registerAction('open-event-detail', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) openEventDetail(eventId);
});
registerAction('switch-to-event-timer', (el) => {
  const eventId = el.dataset.eventId;
  const view = el.dataset.view || 'cronometro';
  import('../../app.js?v=8.37').then(({ navigate }) => {
    navigate(view);
    setTimeout(() => {
      if (eventId) toggleTimer(eventId);
    }, 100);
  });
});
registerAction('add-minutes', (el) => {
  const eventId = el.dataset.eventId;
  const minutes = parseInt(el.dataset.minutes, 10);
  if (eventId) addTimerMinutes(eventId, minutes);
});
registerAction('save-event', saveEvent);
registerAction('save-past-event', (el) => {
  const discId = el.dataset.discId;
  if (discId) savePastEvent(discId);
});
registerAction('update-day-load', (el) => updateDayLoad(el.value));
registerAction('load-assuntos', loadAssuntos);
registerAction('cancel-registro', cancelRegistro);
registerAction('discard-timer-ui', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) discardTimerUI(eventId);
});
registerAction('voltar-past-session-ui', (el) => {
  const eventId = el.dataset.eventId;
  const discId = el.dataset.discId;
  if (eventId) voltarPastSessionUI(eventId, discId);
});
registerAction('delete-completed-session', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId) deleteCompletedSession(sessionId);
});
registerAction('set-crono-livre-disc', (el) => setCronoLivreDisc(el.value));
registerAction('set-crono-livre-ass', (el) => setCronoLivreAss(el.value));
registerAction('set-crono-livre-goal', (el) => {
  const raw = el.dataset.value || el.value;
  const current = Number(state?.cronoLivre?.duracaoMinutos || 0);
  const minutes =
    String(raw).startsWith('+') || String(raw).startsWith('-')
      ? Math.max(0, current + parseInt(raw, 10))
      : Math.max(0, parseInt(raw, 10) || 0);
  setCronoLivreGoal(minutes);
});
registerAction('open-search-event', (el) => {
  const eventId = el.dataset.eventId;
  if (!eventId) return;
  clearSearch();
  openEventDetail(eventId);
});
registerAction('edit-session-record', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId) openRegistroSessao(sessionId);
});
registerAction('delete-session-record', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId) deleteCompletedSession(sessionId);
});

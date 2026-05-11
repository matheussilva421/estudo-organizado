/**
 * Ações de Revisões
 * Handlers para marcação, adiamento e navegação de revisões
 */

import { registerAction } from './dispatcher.js';
import {
  switchRevTab,
  marcarRevisao,
  adiarRevisao,
  deletarRevisao,
  updateRevisionFrequency,
  clearVisibleRevisions,
} from '../../views/revisao-view.js';

// Registrar ações
registerAction('switch-revision-tab', (el) => {
  const tab = el.dataset.tab;
  switchRevTab(tab, el);
});

registerAction('mark-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId) marcarRevisao(assuntoId);
});

registerAction('postpone-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId) adiarRevisao(assuntoId);
});

registerAction('delete-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  if (!assuntoId) return;
  deletarRevisao(assuntoId);
});

registerAction('delete-upcoming-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  const revisionDate = el.dataset.revisionDate;
  if (assuntoId && revisionDate) deletarRevisao(assuntoId, revisionDate);
});

registerAction('update-revision-frequency', () => {
  updateRevisionFrequency(document.getElementById('rev-frequency-input')?.value || '');
});

registerAction('clear-visible-revisions', (el) => {
  clearVisibleRevisions(el.dataset.scope || 'pending');
});

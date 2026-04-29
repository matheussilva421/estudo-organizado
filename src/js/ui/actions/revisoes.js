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
  if (assuntoId) deletarRevisao(assuntoId);
});

/**
 * Ações de Modais
 * Handlers para abrir/fechar modais e controles de UI
 */

import { registerAction } from './dispatcher.js';
import { closeModal } from '../../app.js?v=8.37';
import {
  onDisciplinaChange,
  onAulaChange,
  onAssuntoChange,
  addTopicoSessao,
  removeTopicoSessao,
  updateTopicoField,
  toggleStudyType,
  toggleMaterial,
  addNovoTopico,
  validateQuestoes,
  saveRegistroSessao,
  saveAndStartNew,
  setPaginaMode,
  openRegistroSessao,
} from '../../registro-sessao.js?v=8.37';
import { openAddPastSessionModal } from '../../ui/event-modals.js?v=8.37';
import { openPlanejamentoWizard } from '../../planejamento-wizard.js?v=8.37';

// Registrar ações
registerAction('close-modal', (el) => {
  const modal = el.dataset.modal;
  if (modal) closeModal(modal);
});
registerAction('open-planejamento-wizard', openPlanejamentoWizard);
registerAction('open-registro-sessao', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) openRegistroSessao(eventId);
});
registerAction('open-add-past-session', (el) => {
  const discId = el.dataset.discId;
  if (discId) openAddPastSessionModal(discId);
});
registerAction('on-disciplina-change', onDisciplinaChange);
registerAction('on-aula-change', onAulaChange);
registerAction('on-assunto-change', onAssuntoChange);
registerAction('add-topico-sessao', addTopicoSessao);
registerAction('remove-topico-sessao', (el) =>
  removeTopicoSessao(parseInt(el.dataset.topicoIdx, 10))
);
registerAction('update-topico-field', (el) =>
  updateTopicoField(parseInt(el.dataset.topicoIdx, 10), el.dataset.field, el.value)
);
registerAction('toggle-study-type', (el) => toggleStudyType(el.dataset.tipo));
registerAction('toggle-material', (el) => toggleMaterial(el.dataset.mat));
registerAction('add-novo-topico', addNovoTopico);
registerAction('validate-questoes', validateQuestoes);
registerAction('save-registro-sessao', saveRegistroSessao);
registerAction('save-and-start-new', saveAndStartNew);
registerAction('set-pagina-mode', (el) => setPaginaMode(el.dataset.mode));
registerAction('stop-propagation', () => {});

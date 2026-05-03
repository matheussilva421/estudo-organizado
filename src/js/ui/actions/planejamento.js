/**
 * Ações de Planejamento (Wizard)
 * Handlers para o wizard de planejamento de estudos
 */

import { registerAction } from './dispatcher.js';
import {
  pwSelectTipo,
  pwToggleDisc,
  pwSearchDisc,
  pwSelectAllDisc,
  pwClearDisc,
  pwUpdateRel,
  pwUpdateHours,
  pwToggleDay,
  pwUpdateDayHour,
} from '../../planejamento-wizard.js?v=8.33';
import {
  recomecarCiclo,
  zerarCiclosCounter,
  calculateCyclePredictions,
  toggleEditSeq,
  saveEditSeq,
  cancelEditSeq,
  updateSeqItem,
  dupSeqItem,
  remSeqItem,
  moveSeqItem,
  addSeqItem,
  openCicloHistory,
} from '../../views.js?v=8.33';
import { desfazerEtapa, iniciarEtapaPlanejamento } from '../../logic.js?v=8.33';
import { showConfirm, showToast } from '../../app.js?v=8.33';
import { scheduleSave, state } from '../../store.js?v=8.33';
import { renderCurrentView } from '../../components.js?v=8.33';
import { openEventDetail } from '../../ui/event-modals.js?v=8.33';

// Registrar ações do wizard
registerAction('pw-select-tipo', (el) => pwSelectTipo(el.dataset.tipo));
registerAction('pw-toggle-disc', (el) => pwToggleDisc(el.dataset.discId));
registerAction('pw-search-disc', (el) => pwSearchDisc(el.value));
registerAction('pw-select-all-disc', pwSelectAllDisc);
registerAction('pw-clear-disc', pwClearDisc);
registerAction('pw-update-relevancia', (el) => {
  const discId = el.dataset.discId;
  const type = el.dataset.type;
  const val = el.value;
  pwUpdateRel(discId, type, val);
});
registerAction('pw-update-hours', (el) => {
  const field = el.dataset.field;
  const val = el.value;
  pwUpdateHours(field, val);
});
registerAction('pw-toggle-day', (el) => {
  const idx = parseInt(el.dataset.dayIndex, 10);
  pwToggleDay(idx);
});
registerAction('pw-update-day-hour', (el) => {
  const idx = parseInt(el.dataset.dayIndex, 10);
  const val = el.value;
  pwUpdateDayHour(idx, val);
});

registerAction('iniciar-etapa-planejamento', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId) iniciarEtapaPlanejamento(seqId);
});
registerAction('move-ciclo-seq', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (Number.isFinite(idx) && Number.isFinite(dir)) {
    import('../../views/ciclo-view.js').then(({ moveCicloSeq }) => moveCicloSeq(idx, dir));
  }
});
registerAction('edit-ciclo-seq-hours', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  if (Number.isFinite(idx)) {
    import('../../views/ciclo-view.js').then(({ editCicloSeqHours }) => editCicloSeqHours(idx));
  }
});
registerAction('desfazer-etapa', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId) desfazerEtapa(seqId);
});
registerAction('open-event-from-ciclo-history', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId) openEventDetail(eventId);
});
registerAction('toggle-edit-seq', toggleEditSeq);
registerAction('save-edit-seq', saveEditSeq);
registerAction('cancel-edit-seq', cancelEditSeq);
registerAction('update-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  if (!Number.isFinite(idx)) return;
  updateSeqItem(idx, el.dataset.field, el.value);
});
registerAction('dup-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  dupSeqItem(idx);
});
registerAction('rem-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  remSeqItem(idx);
});
registerAction('move-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  const dir = parseInt(el.dataset.dir, 10);
  moveSeqItem(idx, dir);
});
registerAction('add-seq-item', addSeqItem);
registerAction('recomecar-ciclo', recomecarCiclo);
registerAction('zerar-ciclos-counter', zerarCiclosCounter);
registerAction('calculate-cycle-predictions', calculateCyclePredictions);
registerAction('open-ciclo-history', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId) openCicloHistory(seqId);
});
registerAction('remover-planejamento', () => {
  const remove = () => {
    if (!state) return;
    state.planejamento = {
      ativo: false,
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {},
      sequencia: [],
    };
    scheduleSave();
    renderCurrentView();
    showToast('Planejamento removido.', 'info');
  };
  showConfirm('Remover o planejamento atual?', remove, {
    danger: true,
    label: 'Remover',
    title: 'Remover planejamento',
  });
});

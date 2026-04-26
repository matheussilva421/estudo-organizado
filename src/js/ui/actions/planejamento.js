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
  pwUpdateDayHour
} from '../../planejamento-wizard.js?v=8.21';

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

registerAction('iniciar-etapa-planejamento', (el) => iniciarEtapaPlanejamento(el));
registerAction('move-ciclo-seq', (el) => moveCicloSeq(el));
registerAction('edit-ciclo-seq-hours', (el) => editCicloSeqHours(el));
registerAction('desfazer-etapa', (el) => desfazerEtapa(el));
registerAction('open-event-from-ciclo-history', (el) => openEventFromCicloHistory(el));
registerAction('toggle-edit-seq', () => callApp('toggleEditSeq'));
registerAction('save-edit-seq', () => callApp('saveEditSeq'));
registerAction('cancel-edit-seq', () => callApp('cancelEditSeq'));
registerAction('update-seq-item', (el) => updateSeqItem(el));
registerAction('dup-seq-item', (el) => callApp('dupSeqItem', parseInt(el.dataset.index, 10)));
registerAction('rem-seq-item', (el) => callApp('remSeqItem', parseInt(el.dataset.index, 10)));
registerAction('move-seq-item', (el) => callApp('moveSeqItem', parseInt(el.dataset.index, 10), parseInt(el.dataset.dir, 10)));
registerAction('add-seq-item', () => callApp('addSeqItem'));
registerAction('recomecar-ciclo', () => callApp('recomecarCiclo'));
registerAction('zerar-ciclos-counter', () => callApp('zerarCiclosCounter'));
registerAction('calculate-cycle-predictions', () => callApp('calculateCyclePredictions'));
registerAction('remover-planejamento', () => removerPlanejamento());

function callApp(fnName, ...args) {
  const fn = window.EstudoApp?.[fnName];
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

function iniciarEtapaPlanejamento(el) {
  const seqId = el.dataset.seqId;
  if (seqId) callApp('iniciarEtapaPlanejamento', seqId);
}

function moveCicloSeq(el) {
  const idx = parseInt(el.dataset.index, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (Number.isFinite(idx) && Number.isFinite(dir)) {
    callApp('moveCicloSeq', idx, dir);
  }
}

function editCicloSeqHours(el) {
  const idx = parseInt(el.dataset.index, 10);
  if (Number.isFinite(idx)) {
    callApp('editCicloSeqHours', idx);
  }
}

function desfazerEtapa(el) {
  const seqId = el.dataset.seqId;
  if (seqId) callApp('desfazerEtapa', seqId);
}

function openEventFromCicloHistory(el) {
  const eventId = el.dataset.eventId;
  if (eventId) callApp('openRegistroSessao', eventId);
}

function updateSeqItem(el) {
  const idx = parseInt(el.dataset.index, 10);
  if (!Number.isFinite(idx)) return;
  callApp('updateSeqItem', idx, el.dataset.field, el.value);
}

function removerPlanejamento() {
  const confirm = window.EstudoApp?.showConfirm;
  const remove = () => {
    if (!window.EstudoApp?.state) return;
    window.EstudoApp.state.planejamento = { ativo: false, tipo: null, disciplinas: [], relevancia: {}, horarios: {}, sequencia: [] };
    window.EstudoApp.scheduleSave?.();
    window.EstudoApp.renderCurrentView?.();
    window.EstudoApp.showToast?.('Planejamento removido.', 'info');
  };

  if (typeof confirm === 'function') {
    confirm('Remover o planejamento atual?', remove, { danger: true, label: 'Remover', title: 'Remover planejamento' });
  } else {
    remove();
  }
}

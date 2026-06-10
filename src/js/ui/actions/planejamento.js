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
  pwSelectEditalDisc,
  pwClearEditalDisc,
  pwUpdateRel,
  pwUpdateHours,
  pwToggleDay,
  pwUpdateDayHour,
} from '../../planejamento-wizard.js?v=8.37';
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
} from '../../views.js?v=8.37';
import {
  desfazerEtapa,
  iniciarEtapaPlanejamento,
  resetCicloAndWipeEvents,
} from '../../logic.js?v=8.37';
import { showConfirm, showToast } from '../../app.js?v=8.37';
import { state } from '../../store.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { openEventDetail } from '../../ui/event-modals.js?v=8.37';

// Registrar ações do wizard
registerAction('pw-select-tipo', (el) => pwSelectTipo(el.dataset.tipo));
registerAction('pw-toggle-disc', (el) => pwToggleDisc(el.dataset.discId));
registerAction('pw-search-disc', (el) => pwSearchDisc(el.value));
registerAction('pw-select-all-disc', pwSelectAllDisc);
registerAction('pw-clear-disc', pwClearDisc);
registerAction('pw-select-edital-disc', (el) => pwSelectEditalDisc(el.dataset.editalId));
registerAction('pw-clear-edital-disc', (el) => pwClearEditalDisc(el.dataset.editalId));
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
    import('../../views/ciclo-view.js?v=8.37').then(({ moveCicloSeq }) => moveCicloSeq(idx, dir));
  }
});
registerAction('edit-ciclo-seq-hours', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  if (Number.isFinite(idx)) {
    import('../../views/ciclo-view.js?v=8.37').then(({ editCicloSeqHours }) =>
      editCicloSeqHours(idx)
    );
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
  if (!Number.isFinite(idx)) return;
  dupSeqItem(idx);
});
registerAction('rem-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  if (!Number.isFinite(idx)) return;
  remSeqItem(idx);
});
registerAction('move-seq-item', (el) => {
  const idx = parseInt(el.dataset.index, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (!Number.isFinite(idx) || !Number.isFinite(dir)) return;
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
    resetCicloAndWipeEvents();
    renderCurrentView();
    showToast('Planejamento removido.', 'info');
  };
  showConfirm('Remover o planejamento atual?', remove, {
    danger: true,
    label: 'Remover',
    title: 'Remover planejamento',
  });
});

// Ciclo kebab popover — toggles secondary actions (recomeçar, remover)
registerAction('ciclo-toggle-kebab', (el) => {
  const wrap = el.closest('.ciclo-kebab-wrap');
  if (!wrap) return;
  const menu = wrap.querySelector('.ciclo-kebab-menu');
  if (!menu) return;
  const willOpen = menu.hidden;
  menu.hidden = !willOpen;
  el.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  if (willOpen) {
    setTimeout(() => {
      const off = (e) => {
        if (!wrap.contains(e.target)) {
          menu.hidden = true;
          el.setAttribute('aria-expanded', 'false');
          document.removeEventListener('click', off, true);
        }
      };
      document.addEventListener('click', off, true);
    }, 0);
  }
});

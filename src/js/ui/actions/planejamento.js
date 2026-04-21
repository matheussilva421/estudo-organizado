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
} from '../../planejamento-wizard.js?v=8.6';

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

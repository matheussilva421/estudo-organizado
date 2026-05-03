/**
 * Ações de Hábitos de Estudo
 * Handlers para registro e gerenciamento de hábitos
 */

import { registerAction } from './dispatcher.js';
import {
  openHabitModal,
  saveHabit,
  deleteHabito,
  selectHabitType,
  setHabitPage,
  calcSimuladoPerc,
} from '../../views/habitos-view.js?v=8.34';

// Registrar ações
registerAction('open-habit-modal', (el) => {
  const habitKey = el.dataset.habitKey;
  if (habitKey) openHabitModal(habitKey);
});
registerAction('save-habit', saveHabit);
registerAction('edit-habit', (el) => {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && habitType)
    import('../../views/habitos-view.js?v=8.34').then(({ editHabit }) =>
      editHabit(habitId, habitType)
    );
});
registerAction('delete-habit', (el) => {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && habitType) deleteHabito(habitType, habitId);
});
registerAction('select-habit-type', (el) => {
  const habitKey = el.dataset.tipo;
  if (habitKey) selectHabitType(habitKey, el);
});
registerAction('set-habit-page', (el) => {
  const page = parseInt(el.dataset.page, 10);
  setHabitPage(page);
});
registerAction('calc-simulado-perc', calcSimuladoPerc);

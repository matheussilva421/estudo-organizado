/**
 * Ações de Hábitos de Estudo
 * Handlers para registro e gerenciamento de hábitos
 */

import { registerAction } from './dispatcher.js';

// Registrar ações
registerAction('open-habit-modal', (el) => openHabitModal(el));
registerAction('save-habit', () => saveHabit());
registerAction('edit-habit', (el) => editHabit(el));
registerAction('delete-habit', (el) => deleteHabito(el));
registerAction('select-habit-type', (el) => selectHabitType(el));
registerAction('set-habit-page', (el) => setHabitPage(el));
registerAction('calc-simulado-perc', () => calcSimuladoPerc());

/**
 * Abre modal de novo/editar hábito
 * @param {HTMLElement} el - Elemento acionador
 */
export function openHabitModal(el) {
  const habitKey = el.dataset.habitKey;
  if (habitKey && typeof window.EstudoApp?.openHabitModal === 'function') {
    window.EstudoApp?.openHabitModal(habitKey);
  }
}

/**
 * Salva hábito (create/update)
 */
export function saveHabit() {
  if (typeof window.EstudoApp?.saveHabit === 'function') {
    window.EstudoApp?.saveHabit();
  }
}

/**
 * Edita hábito existente
 * @param {HTMLElement} el - Elemento acionador
 */
export function editHabit(el) {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && habitType && typeof window.EstudoApp?.editHabit === 'function') {
    window.EstudoApp?.editHabit(habitId, habitType);
  }
}

/**
 * Exclui hábito
 * @param {HTMLElement} el - Elemento acionador
 */
export function deleteHabito(el) {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && typeof window.EstudoApp?.deleteHabito === 'function') {
    window.EstudoApp?.deleteHabito(habitType, habitId);
  }
}

/**
 * Seleciona tipo de hábito
 * @param {HTMLElement} el - Elemento acionador
 */
export function selectHabitType(el) {
  const habitKey = el.dataset.tipo;
  if (habitKey && typeof window.EstudoApp?.selectHabitType === 'function') {
    window.EstudoApp?.selectHabitType(habitKey, el);
  }
}

/**
 * Navega página de hábitos
 * @param {HTMLElement} el - Elemento acionador
 */
export function setHabitPage(el) {
  const page = parseInt(el.dataset.page, 10);
  if (typeof window.EstudoApp?.setHabitPage === 'function') {
    window.EstudoApp?.setHabitPage(page);
  }
}

/**
 * Calcula percentual de simulado
 */
export function calcSimuladoPerc() {
  if (typeof window.EstudoApp?.calcSimuladoPerc === 'function') {
    window.EstudoApp?.calcSimuladoPerc();
  }
}

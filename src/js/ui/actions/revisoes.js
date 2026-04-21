/**
 * Ações de Revisões
 * Handlers para marcação, adiamento e navegação de revisões
 */

import { registerAction } from './dispatcher.js';

// Registrar ações
registerAction('switch-revision-tab', (el) => switchRevTab(el));
registerAction('mark-revision', (el) => marcarRevisao(el));
registerAction('postpone-revision', (el) => adiarRevisao(el));
registerAction('mark-revision-done', (el) => marcarRevisaoFeita(el));
registerAction('delete-revision', (el) => deletarRevisao(el));

/**
 * Alterna aba de revisões (pendentes/concluídas)
 * @param {HTMLElement} el - Elemento acionador
 */
export function switchRevTab(el) {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchRevTab === 'function') {
    window.EstudoApp?.switchRevTab(tab, el);
  }
}

/**
 * Marca revisão como feita
 * @param {HTMLElement} el - Elemento acionador
 */
export function marcarRevisao(el) {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId && typeof window.EstudoApp?.marcarRevisao === 'function') {
    window.EstudoApp?.marcarRevisao(assuntoId);
  }
}

/**
 * Adia revisão
 * @param {HTMLElement} el - Elemento acionador
 */
export function adiarRevisao(el) {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId && typeof window.EstudoApp?.adiarRevisao === 'function') {
    window.EstudoApp?.adiarRevisao(assuntoId);
  }
}

/**
 * Marca revisão pendente como feita (modal)
 * @param {HTMLElement} el - Elemento acionador
 */
export function marcarRevisaoFeita(el) {
  const revisaoId = el.dataset.revisaoId;
  if (revisaoId && typeof window.EstudoApp?.marcarRevisaoFeita === 'function') {
    window.EstudoApp?.marcarRevisaoFeita(revisaoId);
  }
}

/**
 * Deleta/exclui uma revisão (remove o agendamento)
 * @param {HTMLElement} el - Elemento acionador
 */
export function deletarRevisao(el) {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId && typeof window.EstudoApp?.deletarRevisao === 'function') {
    window.EstudoApp?.deletarRevisao(assuntoId);
  }
}

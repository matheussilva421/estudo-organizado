/**
 * Ações de Revisões
 * Handlers para marcação, adiamento e navegação de revisões
 */

/**
 * Alterna aba de revisões (pendentes/concluídas)
 * @param {HTMLElement} el - Elemento acionador
 */
export function switchRevTab(el) {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchRevTab === 'function') {
    window.EstudoApp?.switchRevTab(tab);
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

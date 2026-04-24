/**
 * Ações de Editais e Disciplinas
 * Handlers para CRUD de editais, disciplinas, assuntos e aulas
 */

/**
 * Abre modal de novo/editar edital
 * @param {HTMLElement} el - Elemento acionador
 */
export function openEditalModal(el) {
  const editalId = el.dataset.editalId;
  if (typeof window.EstudoApp?.openEditaModal === 'function') {
    window.EstudoApp?.openEditaModal(editalId || null);
  }
}

/**
 * Salva edital (create/update)
 * @param {HTMLElement} el - Elemento acionador
 */
export function saveEdital(el) {
  const editalId = el.dataset.editalId;
  if (typeof window.EstudoApp?.saveEdital === 'function') {
    window.EstudoApp?.saveEdital(editalId);
  }
}

/**
 * Exclui edital com confirmação
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function deleteEdital(el, event) {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.deleteEdital === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este edital?', () => {
      window.EstudoApp?.deleteEdital(editalId);
    });
  }
}

/**
 * Abre modal de nova disciplina
 * @param {HTMLElement} el - Elemento acionador
 */
export function openDiscModal(el) {
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.openDiscModal === 'function') {
    window.EstudoApp?.openDiscModal(editalId);
  }
}

/**
 * Salva disciplina
 */
export function saveDisc() {
  if (typeof window.EstudoApp?.saveDisc === 'function') {
    window.EstudoApp?.saveDisc();
  }
}

/**
 * Exclui disciplina com confirmação
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function deleteDisc(el, event) {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.deleteDisc === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir esta disciplina?', () => {
      window.EstudoApp?.deleteDisc(editalId, discId);
    });
  }
}

/**
 * Abre gerenciador de disciplina
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function openDiscManager(el, event) {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.openDiscManager === 'function') {
    window.EstudoApp?.openDiscManager(editalId, discId);
  }
}

/**
 * Salva alterações do gerenciador de disciplina
 * @param {HTMLElement} el - Elemento acionador
 */
export function saveDiscManager(el) {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.saveDiscManager === 'function') {
    window.EstudoApp?.saveDiscManager(editalId, discId);
  }
}

/**
 * Adiciona novo assunto
 * @param {HTMLElement} el - Elemento acionador
 */
export function addAssunto(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.addAssunto === 'function') {
    window.EstudoApp?.addAssunto(discId);
  }
}

/**
 * Exclui assunto com confirmação
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function deleteAssunto(el, event) {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.deleteAssunto === 'function') {
    window.EstudoApp?.deleteAssunto(discId, assuntoId);
  }
}

/**
 * Edita assunto inline
 * @param {HTMLElement} el - Elemento acionador
 */
export function editSubjectInline(el) {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.editSubjectInline === 'function') {
    window.EstudoApp?.editSubjectInline(discId, assuntoId, el);
  }
}

/**
 * Move assunto (cima/baixo)
 * @param {HTMLElement} el - Elemento acionador
 */
export function moveSubject(el) {
  const discId = el.dataset.discId;
  const idx = parseInt(el.dataset.idx, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (discId && typeof window.EstudoApp?.moveSubject === 'function') {
    window.EstudoApp?.moveSubject(discId, idx, dir);
  }
}

/**
 * Adiciona aulas em bulk
 * @param {HTMLElement} el - Elemento acionador
 */
export function addBulkAulas(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.addBulkAulas === 'function') {
    window.EstudoApp?.addBulkAulas(discId);
  }
}

/**
 * Exclui aula
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function deleteAula(el, event) {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.deleteAula === 'function') {
    window.EstudoApp?.deleteAula(discId, aulaId);
  }
}

/**
 * Toggle aula como estudada
 * @param {HTMLElement} el - Elemento acionador
 * @param {Event} event - Evento DOM
 */
export function toggleAulaEstudada(el, event) {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.toggleAulaEstudada === 'function') {
    window.EstudoApp?.toggleAulaEstudada(discId, aulaId);
  }
}

/**
 * Edita aula inline
 * @param {HTMLElement} el - Elemento acionador
 */
export function editLessonInline(el) {
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.editLessonInline === 'function') {
    window.EstudoApp?.editLessonInline(discId, aulaId, el);
  }
}

/**
 * Seleciona cor do edital
 * @param {HTMLElement} el - Elemento acionador
 */
export function selectColor(el) {
  const color = el.dataset.color;
  const container = el.dataset.container;
  if (color && container && typeof window.EstudoApp?.selectColor === 'function') {
    window.EstudoApp?.selectColor(color, container);
  }
}

/**
 * Seleciona ícone do edital
 * @param {HTMLElement} el - Elemento acionador
 */
export function selectIcon(el) {
  const icon = el.dataset.icon;
  if (icon && typeof window.EstudoApp?.selectIcon === 'function') {
    window.EstudoApp?.selectIcon(icon, el);
  }
}

/**
 * Seleciona cor da disciplina
 * @param {HTMLElement} el - Elemento acionador
 */
export function selectDiscColor(el) {
  const color = el.dataset.color;
  if (color && typeof window.EstudoApp?.selectDiscColor === 'function') {
    window.EstudoApp?.selectDiscColor(color);
  }
}

/**
 * Alterna visibilidade do edital
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleEdital(el) {
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.toggleEdital === 'function') {
    window.EstudoApp?.toggleEdital(editalId);
  }
}

/**
 * Alterna visibilidade da disciplina no vertical
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleVertDisc(el) {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.toggleVertDisc === 'function') {
    window.EstudoApp?.toggleVertDisc(discId);
  }
}

/**
 * Alterna visibilidade do assunto
 * @param {HTMLElement} el - Elemento acionador
 */
export function toggleAssunto(el) {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.toggleAssunto === 'function') {
    window.EstudoApp?.toggleAssunto(discId, assuntoId);
  }
}

/**
 * Executa lesson mapper
 * @param {HTMLElement} el - Elemento acionador
 */
export function runLessonMapper(el) {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.runLessonMapperUI === 'function') {
    window.EstudoApp?.runLessonMapperUI(editalId, discId);
  }
}

/**
 * Alterna aba do gerenciador
 * @param {HTMLElement} el - Elemento acionador
 */
export function switchManagerTab(el) {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchManagerTab === 'function') {
    window.EstudoApp?.switchManagerTab(tab);
  }
}

// Register all action handlers
import { registerAction } from './dispatcher.js';
import { parseBancaText, applyBancaRanking, filtrarViewPorDisciplina, mudarEditalAnalisador, carregarAnaliseBanca } from '../../views/banca-view.js?v=8.15';

registerAction('navigate', (el) => {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp.navigate(view);
  }
});

registerAction('open-edital-modal', (el) => openEditalModal(el));
registerAction('save-edital', (el) => saveEdital(el));
registerAction('delete-edital', (el, event) => deleteEdital(el, event));

registerAction('open-disc-modal', (el) => openDiscModal(el));
registerAction('save-disc', () => saveDisc());
registerAction('delete-disc', (el, event) => deleteDisc(el, event));

// openDiscDashboard defined below

registerAction('open-disc-manager', (el, event) => openDiscManager(el, event));
registerAction('save-disc-manager', (el) => saveDiscManager(el));
registerAction('add-assunto', (el) => addAssunto(el));
registerAction('delete-assunto', (el, event) => deleteAssunto(el, event));
registerAction('edit-subject-inline', (el) => editSubjectInline(el));
registerAction('move-subject', (el) => moveSubject(el));
registerAction('add-bulk-aulas', (el) => addBulkAulas(el));
registerAction('delete-aula', (el, event) => deleteAula(el, event));
registerAction('toggle-aula-estudada', (el, event) => toggleAulaEstudada(el, event));
registerAction('edit-lesson-inline', (el) => editLessonInline(el));

registerAction('select-color', (el) => selectColor(el));
registerAction('select-icon', (el) => selectIcon(el));
registerAction('select-disc-color', (el) => selectDiscColor(el));

registerAction('toggle-edital', (el) => toggleEdital(el));
registerAction('toggle-vert-disc', (el) => toggleVertDisc(el));
registerAction('toggle-assunto', (el) => toggleAssunto(el));

registerAction('run-lesson-mapper', (el) => runLessonMapper(el));
registerAction('switch-manager-tab', (el) => switchManagerTab(el));
registerAction('sync-color-to-picker', (el) => syncColorToPicker(el));
registerAction('add-evento-para-assunto', (el) => addEventoParaAssunto(el));
registerAction('toggle-aula-dashboard', (el) => toggleAulaDashboard(el));
registerAction('switch-dashboard-tab', (el) => switchDashboardTab(el));
registerAction('vert-search', (el) => updateVerticalSearch(el));
registerAction('set-vert-filter-edital', (el) => updateVerticalEditalFilter(el));
registerAction('set-vert-filter-status', (el) => updateVerticalStatusFilter(el));
registerAction('add-novo-topico-vertical', (el) => openDiscManager(el));
registerAction('filtrar-dropdown-banca', (el) => callApp('filtrarDropdownBanca', el.value));

// Banca Analyzer actions
registerAction('parse-banca-text', parseBancaText);
registerAction('apply-banca-ranking', applyBancaRanking);
registerAction('filtrar-view-por-disciplina', filtrarViewPorDisciplina);
registerAction('mudar-edital-analisador', mudarEditalAnalisador);
registerAction('carregar-analise-banca', carregarAnaliseBanca);
registerAction('excluir-analise-banca', (el) => excluirAnaliseBanca(el));
registerAction('open-match-corrector', (el) => openMatchCorrectorAction(el));
registerAction('save-match-correction', (el) => saveMatchCorrectionAction(el));

/**
 * Abre dashboard da disciplina
 * @param {HTMLElement} el - Elemento acionador
 */
export function openDiscDashboard(el) {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.openDiscDashboard === 'function') {
    window.EstudoApp.openDiscDashboard(editalId, discId);
  }
}

// Register open-disc-dashboard after function is defined
registerAction('open-disc-dashboard', (el) => openDiscDashboard(el));

function callApp(fnName, ...args) {
  const fn = window.EstudoApp?.[fnName];
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

function syncColorToPicker(el) {
  const picker = document.getElementById('dm-cor-picker');
  if (picker) picker.value = el.value;
}

function addEventoParaAssunto(el) {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (editalId && discId && assuntoId) {
    callApp('addEventoParaAssunto', editalId, discId, assuntoId);
  }
}

function toggleAulaDashboard(el) {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (editalId && discId && aulaId) {
    callApp('toggleAulaDashboard', editalId, discId, aulaId);
  }
}

function switchDashboardTab(el) {
  const tab = el.dataset.tab;
  if (tab) callApp('switchDashboardTab', tab);
}

function renderVerticalListOnly() {
  const container = document.getElementById('vert-list-container');
  if (container && typeof window.EstudoApp?.renderVerticalList === 'function') {
    window.EstudoApp.renderVerticalList(container);
  } else {
    window.EstudoApp?.renderCurrentView?.();
  }
}

function updateVerticalSearch(el) {
  if (typeof window.EstudoApp?.setVertSearch === 'function') {
    window.EstudoApp.setVertSearch(el.value);
  }
  renderVerticalListOnly();
}

function updateVerticalEditalFilter(el) {
  if (typeof window.EstudoApp?.setVertFilterEdital === 'function') {
    window.EstudoApp.setVertFilterEdital(el.value);
  }
  renderVerticalListOnly();
}

function updateVerticalStatusFilter(el) {
  const status = el.dataset.status || 'todos';
  if (typeof window.EstudoApp?.setVertFilterStatus === 'function') {
    window.EstudoApp.setVertFilterStatus(status);
  }
  window.EstudoApp?.renderCurrentView?.();
}

function excluirAnaliseBanca(el) {
  const discId = el.dataset.discId;
  if (discId) callApp('excluirAnaliseBanca', discId);
}

function openMatchCorrectorAction(el) {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome) callApp('openMatchCorrector', assuntoNome);
}

function saveMatchCorrectionAction(el) {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome) callApp('saveMatchCorrection', assuntoNome);
}

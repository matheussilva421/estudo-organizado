/**
 * Ações de Editais e Disciplinas
 * Handlers para CRUD de editais, disciplinas, assuntos e aulas
 */

import { registerAction } from './dispatcher.js';
import { showConfirm, showToast } from '../../app.js?v=8.36';
import { renderCurrentView } from '../../components.js?v=8.36';
import { archiveDiscipline, unarchiveDiscipline } from '../../logic.js?v=8.36';
import { scheduleSave } from '../../store.js?v=8.36';
import {
  openEditaModal,
  saveEdital,
  deleteEdital,
  openDiscModal,
  saveDisc,
  deleteDisc,
  openDiscManager,
  addAssunto,
  deleteAssunto,
  editSubjectInline,
  addBulkAulas,
  deleteAula,
  toggleAulaEstudada,
  editLessonInline,
  selectColor,
  selectIcon,
  selectDiscColor,
  toggleEdital,
  toggleVertDisc,
  toggleAssunto,
  runLessonMapperUI,
  switchManagerTab,
  setDiscFilterStatus,
  openDiscDashboard,
  addEventoParaAssunto,
  toggleAulaDashboard,
  switchDashboardTab,
  setVertSearch,
  setVertFilterEdital,
  setVertFilterStatus,
  renderVerticalList,
  filtrarDropdownBanca,
} from '../../views.js?v=8.36';
import {
  parseBancaText,
  applyBancaRanking,
  filtrarViewPorDisciplina,
  mudarEditalAnalisador,
  carregarAnaliseBanca,
  excluirAnaliseBanca,
  openMatchCorrector,
  saveMatchCorrection,
} from '../../views/banca-view.js?v=8.36';

// Registrar ações
registerAction('navigate', (el) => {
  const view = el.dataset.view;
  if (view) import('../../app.js?v=8.36').then(({ navigate }) => navigate(view));
});

registerAction('open-edital-modal', (el) => {
  const editalId = el.dataset.editalId;
  openEditaModal(editalId || null);
});
registerAction('save-edital', (el) => {
  const editalId = el.dataset.editalId;
  saveEdital(editalId);
});
registerAction('delete-edital', (el) => {
  const editalId = el.dataset.editalId;
  if (editalId) {
    showConfirm('Tem certeza que deseja excluir este edital?', () => {
      deleteEdital(editalId);
    });
  }
});

registerAction('open-disc-modal', (el) => {
  const editalId = el.dataset.editalId;
  if (editalId) openDiscModal(editalId);
});
registerAction('save-disc', saveDisc);
registerAction('delete-disc', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) {
    showConfirm('Tem certeza que deseja excluir esta disciplina?', () => {
      deleteDisc(editalId, discId);
    });
  }
});
registerAction('archive-disc', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) {
    showConfirm(
      'Arquivar esta disciplina?\nEla será ocultada da lista principal, mas seus dados e progresso serão mantidos.',
      () => {
        archiveDiscipline(editalId, discId);
        scheduleSave();
        renderCurrentView();
        showToast('Disciplina arquivada.', 'info');
      },
      { label: 'Arquivar disciplina' }
    );
  }
});
registerAction('unarchive-disc', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) {
    unarchiveDiscipline(editalId, discId);
    scheduleSave();
    renderCurrentView();
    showToast('Disciplina desarquivada.', 'success');
  }
});
registerAction('set-disc-filter', (el) => {
  const filter = el.dataset.filter || 'ativas';
  setDiscFilterStatus(filter);
  renderCurrentView();
});

registerAction('open-disc-dashboard', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) openDiscDashboard(editalId, discId);
});

registerAction('open-disc-manager', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) openDiscManager(editalId, discId);
});
registerAction('save-disc-manager', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) {
    import('../../views.js?v=8.36').then(({ saveDiscManager }) =>
      saveDiscManager(editalId, discId)
    );
  }
});
registerAction('add-assunto', (el) => {
  const discId = el.dataset.discId;
  if (discId) addAssunto(discId);
});
registerAction('delete-assunto', (el) => {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId) deleteAssunto(discId, assuntoId);
});
registerAction('edit-subject-inline', (el) => {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId) editSubjectInline(discId, assuntoId, el);
});
registerAction('move-subject', (el) => {
  const discId = el.dataset.discId;
  const idx = parseInt(el.dataset.idx, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (discId)
    import('../../views.js?v=8.36').then(({ moveSubject }) => moveSubject(discId, idx, dir));
});
registerAction('add-bulk-aulas', (el) => {
  const discId = el.dataset.discId;
  if (discId) addBulkAulas(discId);
});
registerAction('delete-aula', (el) => {
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId) deleteAula(discId, aulaId);
});
registerAction('toggle-aula-estudada', (el) => {
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId) toggleAulaEstudada(discId, aulaId);
});
registerAction('edit-lesson-inline', (el) => {
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId) editLessonInline(discId, aulaId, el);
});

registerAction('select-color', (el) => {
  const color = el.dataset.color;
  const container = el.dataset.container;
  if (color && container) selectColor(color, container);
});
registerAction('select-icon', (el) => {
  const icon = el.dataset.icon;
  if (icon) selectIcon(icon, el);
});
registerAction('select-disc-color', (el) => {
  const color = el.dataset.color;
  if (color) selectDiscColor(color);
});

registerAction('toggle-edital', (el) => {
  const editalId = el.dataset.editalId;
  if (editalId) toggleEdital(editalId);
});
registerAction('toggle-vert-disc', (el) => {
  const discId = el.dataset.discId;
  if (discId) toggleVertDisc(discId);
});
registerAction('toggle-assunto', (el) => {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId) toggleAssunto(discId, assuntoId);
});

registerAction('run-lesson-mapper', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) runLessonMapperUI(editalId, discId);
});
registerAction('switch-manager-tab', (el) => {
  const tab = el.dataset.tab;
  if (tab) switchManagerTab(tab);
});
registerAction('sync-color-to-picker', (el) => {
  const picker = document.getElementById('dm-cor-picker');
  if (picker) picker.value = el.value;
});
registerAction('add-evento-para-assunto', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (editalId && discId && assuntoId) addEventoParaAssunto(editalId, discId, assuntoId);
});
registerAction('toggle-aula-dashboard', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (editalId && discId && aulaId) toggleAulaDashboard(editalId, discId, aulaId);
});
registerAction('switch-dashboard-tab', (el) => {
  const tab = el.dataset.tab;
  if (tab) switchDashboardTab(tab);
});
registerAction('vert-search', (el) => {
  setVertSearch(el.value);
  renderVerticalListOnly();
});
registerAction('set-vert-filter-edital', (el) => {
  setVertFilterEdital(el.value);
  renderVerticalListOnly();
});
registerAction('set-vert-filter-status', (el) => {
  const status = el.dataset.status || 'todos';
  setVertFilterStatus(status);
  renderCurrentView();
});
registerAction('add-novo-topico-vertical', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId) openDiscManager(editalId, discId);
});
registerAction('filtrar-dropdown-banca', (el) => filtrarDropdownBanca(el.value));

// Banca Analyzer actions
registerAction('parse-banca-text', parseBancaText);
registerAction('apply-banca-ranking', applyBancaRanking);
registerAction('filtrar-view-por-disciplina', filtrarViewPorDisciplina);
registerAction('mudar-edital-analisador', mudarEditalAnalisador);
registerAction('carregar-analise-banca', carregarAnaliseBanca);
registerAction('excluir-analise-banca', (el) => {
  const discId = el.dataset.discId;
  if (discId) excluirAnaliseBanca(discId);
});
registerAction('open-match-corrector', (el) => {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome) openMatchCorrector(assuntoNome);
});
registerAction('save-match-correction', (el) => {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome) saveMatchCorrection(assuntoNome);
});

function renderVerticalListOnly() {
  const container = document.getElementById('vert-list-container');
  if (container) {
    renderVerticalList(container);
  } else {
    renderCurrentView();
  }
}

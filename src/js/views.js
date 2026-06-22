import { showToast, openModal } from './app.js?v=8.37';
import {
  esc,
  formatDate,
  formatTime,
  todayStr,
  uid,
  addCleanupListener,
} from './utils.js?v=8.37';
import { scheduleSave, state } from './store.js?v=8.37';
import {
  getDisc,
  syncCicloToEventos,
  touchPlanejamento,
} from './logic.js?v=8.37';
import { renderCurrentView } from './components.js?v=8.37';
import { openAddEventModal, loadAssuntos } from './ui/event-modals.js?v=8.37';
import { getEditingSubjectCtx, openDiscManager } from './views/editais-crud.js';
import {
  getActiveDiscManagerTab,
  setActiveDiscManagerTab,
  getTempSequencia,
  setTempSequencia,
  getIsEditingSequence,
  setIsEditingSequence,
} from './views/state/disc-manager-state.js';

// Re-export from extracted view modules
export {
  getActiveDiscManagerTab,
  setActiveDiscManagerTab,
  getTempSequencia,
  setTempSequencia,
  getIsEditingSequence,
  setIsEditingSequence,
} from './views/state/disc-manager-state.js';
export { renderHome } from './views/home-view.js?v=8.37';
export {
  renderCiclo,
  recomecarCiclo,
  zerarCiclosCounter,
  calculateCyclePredictions,
} from './views/ciclo-view.js?v=8.37';
export {
  renderHabitos,
  renderHabitHistPage,
  setHabitPage,
  openHabitModal,
  selectHabitType,
  saveHabit,
  calcSimuladoPerc,
  deleteHabito,
  HABIT_HIST_PAGE_SIZE,
  habitHistPage,
} from './views/habitos-view.js?v=8.37';
export {
  renderVertical,
  renderVerticalList,
  renderEditais,
  renderEditalTree,
  toggleVertDisc,
  getVertSearch,
  setVertSearch,
  getVertFilterStatus,
  setVertFilterStatus,
  getVertFilterEdital,
  setVertFilterEdital,
  getDiscFilterStatus,
  setDiscFilterStatus,
} from './views/editais-view.js';
export {
  renderEditaisAnteriores,
  setAnteriorTab,
} from './views/editais-anteriores-view.js';
export {
  renderDisciplinaDashboard,
  dashPeriod,
  _chartDaily,
  _chartDisc,
  destroyDashboardCharts,
  renderDashboard,
  setDashPeriod,
  renderDailyChart,
  renderDiscChart,
  renderHabitSummary,
  renderDiscProgress,
} from './views/dashboard-view.js';
export {
  renderRevisoes,
  switchRevTab,
  marcarRevisao,
  adiarRevisao,
  deletarRevisao,
  getUpcomingRevisoes,
} from './views/revisao-view.js';
export {
  renderBancaAnalyzerModule,
  renderBancaAnalyzerContent,
  mudarEditalAnalisador,
  filtrarViewPorDisciplina,
  carregarAnaliseBanca,
  excluirAnaliseBanca,
  parseBancaText,
  renderBancaMatches,
  applyBancaRanking,
  openMatchCorrector,
  saveMatchCorrection,
  getAnalyzerCtx,
  setAnalyzerCtx,
} from './views/banca-view.js?v=8.37';
export {
  renderConfig,
  setTheme,
  updateConfig,
  toggleConfig,
  toggleCfSync,
  updateFrequencia,
  openDriveModal,
  driveDisconnect,
  archiveOldEvents,
  exportData,
  importData,
  restoreBackupFromSelectedSource,
  clearAllData,
} from './views/config-view.js?v=8.37';
export {
  searchBlurTimeout,
  debouncedOnSearch,
  onSearch,
  onSearchFocus,
  onSearchBlur,
  clearSearch,
} from './ui/search.js';
export {
  openAddEventModal,
  updateDayLoad,
  loadAssuntos,
  saveEvent,
  openAddPastSessionModal,
  savePastEvent,
  openEventDetail,
  refreshEventCard,
  removeDOMCard,
} from './ui/event-modals.js?v=8.37';
export {
  getCalDate,
  getCalViewMode,
  setCalDate,
  setCalViewMode,
  updateCalendarHeader,
  renderCalendar,
  resetCalDate,
  calNavigate,
  renderCalendarMonth,
  renderCalendarGrid,
  renderCalendarWeek,
  renderCalendarMobileMonth,
  renderCalendarMobileWeek,
} from './views/calendar-view.js?v=8.37';
export {
  renderSkeletonLoader,
  renderSkeletonList,
  renderSkeletonTable,
} from './views/skeleton-view.js';
export {
  renderMED,
  refreshMEDSections,
} from './views/med-view.js';
export {
  renderHistoricoSessoes,
} from './views/historico-view.js?v=8.37';

export {
  toggleEdital, toggleAssunto, toggleAulaDashboard,
  openDiscDashboard, closeDiscDashboard, switchDashboardTab,
  deleteAssunto, deleteDisc, deleteEdital,
  openEditaModal, selectColor, saveEdital, moveEdital,
  openEditalSuccessorModal, reconcilePrincipalEdital,
  openDiscModal, selectIcon, selectDiscColor, saveDisc,
  saveDiscManager, moveSubject, openDiscManager, switchManagerTab,
  editSubjectInline, editLessonInline, toggleAulaEstudada,
  addBulkAulas, addAssunto, deleteAula, runLessonMapperUI,
} from './views/editais-crud.js';

// =============================================
// NOVO HOME VIEW (DASHBOARD REDESIGN)
// =============================================
// renderHome exported to home-view.js

// =============================================
// MED VIEW
// =============================================
// Re-exported from med-view.js

// Surgical DOM updates moved to ui/event-modals.js
// Re-exported below

// Calendar functions moved to views/calendar-view.js
// Re-exported below

// Event modal functions moved to ui/event-modals.js
// Re-exported below

export function openAddEventModalDate(dateStr) {
  openAddEventModal(dateStr);
}

// Event modal functions moved to ui/event-modals.js
// Re-exported below

// Event detail modal moved to ui/event-modals.js
// Re-exported below

// =============================================
// DASHBOARD VIEW
// =============================================
// Re-exported from dashboard-view.js

// =============================================
// HABITOS VIEW
// =============================================
// Re-exported from historico-view.js

// =============================================
// EDITAIS VIEW
// =============================================

// Filtros/busca do Ed. Verticalizado vivem em editais-view.js (cópia legada
// removida daqui — ignorava edital global, disciplinas arquivadas e busca
// normalizada; nenhum call site usava esta versão).

// verResumoSimulado removida — funcionalidade descontinuada

export function toggleEditSeq() {
  setIsEditingSequence(!getIsEditingSequence());
  if (getIsEditingSequence()) {
    setTempSequencia(JSON.parse(JSON.stringify(state.planejamento.sequencia)));
  } else {
    setTempSequencia(null);
  }
  renderCurrentView();
}

export function saveEditSeq() {
  const ts = getTempSequencia();
  if (!ts || ts.length === 0) {
    showToast('A sequência de estudos não pode ficar vazia.', 'error');
    return;
  }
  for (const s of ts) {
    if (!s.discId) {
      showToast(
        'Por favor, selecione uma disciplina para todas as etapas antes de salvar.',
        'error'
      );
      return;
    }
  }

  state.planejamento.sequencia = ts;
  touchPlanejamento();
  syncCicloToEventos();
  scheduleSave();

  setIsEditingSequence(false);
  setTempSequencia(null);
  renderCurrentView();
}

export function cancelEditSeq() {
  setIsEditingSequence(false);
  setTempSequencia(null);
  renderCurrentView();
}

export function updateSeqItem(i, field, val) {
  i = parseInt(i, 10);
  if (field === 'minutosAlvo') val = Math.max(1, parseInt(val) || 0);
  const ts = getTempSequencia();
  ts[i][field] = val;
  setTempSequencia(ts);
}

export function dupSeqItem(i) {
  i = parseInt(i, 10);
  const ts = getTempSequencia();
  const obj = JSON.parse(JSON.stringify(ts[i]));
  obj.id = 'seq_' + uid();
  ts.splice(i + 1, 0, obj);
  setTempSequencia(ts);
  renderCurrentView();
}

export function remSeqItem(i) {
  i = parseInt(i, 10);
  const ts = getTempSequencia();
  ts.splice(i, 1);
  setTempSequencia(ts);
  renderCurrentView();
}

export function moveSeqItem(i, dir) {
  i = parseInt(i, 10);
  const ts = getTempSequencia();
  if (i + dir < 0 || i + dir >= ts.length) return;
  const temp = ts[i];
  ts[i] = ts[i + dir];
  ts[i + dir] = temp;
  setTempSequencia(ts);
  renderCurrentView();
}

export function addSeqItem() {
  const ts = getTempSequencia();
  ts.push({
    id: 'seq_' + uid(),
    discId: '',
    minutosAlvo: 60,
  });
  setTempSequencia(ts);
  renderCurrentView();
}

export function addEventoParaAssunto(editaId, discId, assId) {
  const d = getDisc(discId);
  const ass = d?.disc?.assuntos?.find((a) => a.id === assId);
  if (!ass || !d) return;
  // Pre-select discipline and subject then open modal
  openAddEventModal(todayStr());
  // After modal renders, pre-fill
  setTimeout(() => {
    const discSel = document.getElementById('event-disc');
    if (discSel) {
      discSel.value = discId;
      loadAssuntos();
      setTimeout(() => {
        const assSel = document.getElementById('event-assunto');
        if (assSel) {
          assSel.value = assId;
          const ti = document.getElementById('event-titulo');
          if (ti) {
            ti.value = ass.nome;
            ti.dataset.autoFilled = 'true';
          }
        }
      }, 50);
    }
  }, 50);
}

// Event modal functions moved to ui/event-modals.js
// =============================================
export let _dndSrcDiscId = null;
export let _dndSrcIdx = null;

export function dndStart(event, discId, idx) {
  _dndSrcDiscId = discId;
  _dndSrcIdx = idx;
  event.currentTarget.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(idx));
}
export function dndOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}
export function dndLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}
export function dndDrop(event, discId, targetIdx) {
  event.preventDefault();
  event.stopPropagation();
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  const srcIdx = _dndSrcIdx;
  if (srcIdx === null || srcIdx === targetIdx || _dndSrcDiscId !== discId) return;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find((d) => d.id === discId);
    if (disc) {
      const moved = disc.assuntos.splice(srcIdx, 1)[0];
      disc.assuntos.splice(targetIdx, 0, moved);
      scheduleSave();
      // Re-render then re-open that disc's assuntos if available
      renderCurrentView();
      const subjCtx = getEditingSubjectCtx();
      if (subjCtx && subjCtx.discId === discId) {
        openDiscManager(subjCtx.editaId, discId);
      }
      showToast('Assunto reordenado!', 'success');
      _dndSrcDiscId = null;
      _dndSrcIdx = null;
      return;
    }
  }
}
addCleanupListener(document, 'dragend', () => {
  document.querySelectorAll('.dragging').forEach((el) => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
});

addCleanupListener(document, 'dragstart', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  const discId = target.dataset.dndDisc;
  const idx = parseInt(target.dataset.dndIdx, 10);
  dndStart(e, discId, idx);
});

addCleanupListener(document, 'dragover', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  dndOver(e);
});

addCleanupListener(document, 'dragleave', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  dndLeave(e);
});

addCleanupListener(document, 'drop', (e) => {
  const target = e.target.closest('[data-dnd-subject]');
  if (!target) return;
  const discId = target.dataset.dndDisc;
  const idx = parseInt(target.dataset.dndIdx, 10);
  dndDrop(e, discId, idx);
});

// Search functions moved to ui/search.js
// Re-exported below

export function openCicloHistory(seqId) {
  const plan = state.planejamento;
  if (!plan || !plan.sequencia) return;
  const seqItem = plan.sequencia.find((s) => s.id === seqId);
  if (!seqItem) return;

  const discInfo = getDisc(seqItem.discId);
  if (!discInfo) return;

  const titleEl = document.getElementById('modal-ciclo-history-title');
  if (titleEl)
    titleEl.innerHTML = `🕒 Histórico: ${discInfo.disc.icone || '📚'} ${esc(discInfo.disc.nome)}`;

  const bodyEl = document.getElementById('modal-ciclo-history-body');

  const formatCycleDuration = (minutes) => {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    return `${mins}min`;
  };
  const getSeqStatus = (seq) => {
    if (seq?.status) return seq.status;
    return seq?.concluido ? 'concluida' : 'pendente';
  };
  const eventosSeq = state.eventos.filter(
    (e) => e.seqId === seqId && e.status === 'estudei' && e.tempoAcumulado > 0
  );
  const studiedMinutes = eventosSeq.reduce(
    (total, ev) => total + Math.round((Number(ev.tempoAcumulado) || 0) / 60),
    0
  );
  const targetMinutes = Math.max(0, Math.round(Number(seqItem.minutosAlvo) || 0));
  const remainingMinutes = Math.max(targetMinutes - studiedMinutes, 0);
  const progressSummary = `
    <div class="card ciclo-history-progress-card">
      <div class="ciclo-history-session-title">Progresso da etapa</div>
      <div class="ciclo-history-session-time">${formatCycleDuration(studiedMinutes)} de ${formatCycleDuration(targetMinutes)}</div>
      <div class="ciclo-history-session-location">${formatCycleDuration(remainingMinutes)} restantes</div>
      <div class="ciclo-history-session-location">Status: ${esc(getSeqStatus(seqItem))}</div>
    </div>
  `;

  // Filtrar histórico de estudos da disciplina
  const eventosDisc = state.eventos
    .filter((e) => e.discId === seqItem.discId && e.status === 'estudei' && e.tempoAcumulado > 0)
    .sort((a, b) =>
      (b.data + 'T' + (b.hora || '00:00:00')).localeCompare(a.data + 'T' + (a.hora || '00:00:00'))
    );

  let btnDesfazer = '';
  if (seqItem.concluido) {
    btnDesfazer = `
      <div class="ciclo-history-actions">
        <button class="btn btn-ghost ciclo-history-undo-btn" data-action="desfazer-etapa" data-seq-id="${seqId}">
          <i class="fa fa-undo"></i> Desfazer 'Etapa Concluída' desta matéria
        </button>
      </div>
    `;
  }

  const htmlHistorico =
    eventosDisc.length === 0
      ? '<div class="ciclo-history-empty">Nenhuma sessão de estudo registrada ainda.</div>'
      : `
      <div class="flex flex-col gap-sm">
        ${eventosDisc
          .map(
            (ev) => `
            <div class="card ciclo-history-session-card">
              <div>
                <div class="ciclo-history-session-title">
                  ${formatDate(ev.data)} ${ev.hora ? `às ${ev.hora}` : ''}
                </div>
                <div class="ciclo-history-session-location">
                  📍 ${esc(ev.titulo)}
                </div>
                <div class="ciclo-history-session-time">
                   ⏱️ ${formatTime(ev.tempoAcumulado)} estudados
                </div>
              </div>
              <div>
                <button class="btn btn-ghost btn-sm" data-action="open-event-from-ciclo-history" data-event-id="${ev.id}"><i class="fa fa-edit"></i> Editar</button>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    `;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="modal-body-padded">
        ${progressSummary}
        ${btnDesfazer}
        <h4 class="ciclo-history-sessions-title">Sessões Recentes (${eventosDisc.length})</h4>
        ${htmlHistorico}
      </div>
    `;
  }

  openModal('modal-ciclo-history');
}

export function filtrarDropdownBanca(termo) {
  termo = termo.toLowerCase().trim();
  const select = document.getElementById('banca-disc-select');
  if (!select) return;
  Array.from(select.options).forEach((opt) => {
    if (opt.value === '') return;
    const visible = opt.text.toLowerCase().includes(termo);
    opt.style.display = visible ? '' : 'none';
  });
}

// Event modal functions moved to ui/event-modals.js

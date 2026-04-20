/**
 * Central Action Dispatcher - Registry Setup
 * Registra todas as ações no registry central usando módulos de domínio
 * @deprecated Em v9.0, importar diretamente de ./actions/index.js
 */

import { registerAction } from './actions/dispatcher.js?v=8.3';
import { state } from '../store.js?v=8.3';

// ============================================
// TIMER E CRONÔMETRO
// ============================================

registerAction('toggle-timer', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.toggleTimer === 'function') {
    window.EstudoApp?.toggleTimer(eventId);
  }
});

registerAction('discard-timer', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.discardTimer === 'function') {
    window.EstudoApp?.discardTimer(eventId);
  }
});

registerAction('mark-studied', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.marcarEstudei === 'function') {
    window.EstudoApp?.marcarEstudei(eventId);
  }
});

registerAction('toggle-timer-mode', () => {
  if (typeof window.EstudoApp?.toggleTimerMode === 'function') {
    window.EstudoApp?.toggleTimerMode();
  }
});

// ============================================
// CRUD DE EVENTOS
// ============================================

registerAction('edit-event', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.openAddEventModal === 'function') {
    window.EstudoApp?.openAddEventModal(eventId);
  }
});

registerAction('delete-event', (el, event) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.showConfirm === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este evento?', () => {
      if (typeof window.EstudoApp?.deleteEvento === 'function') {
        window.EstudoApp?.deleteEvento(eventId);
      }
    });
  }
});

registerAction('delete-event-from-modal', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.showConfirm === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este evento?', () => {
      if (typeof window.EstudoApp?.deleteEvento === 'function') {
        window.EstudoApp?.deleteEvento(eventId);
      }
      if (typeof window.EstudoApp?.closeModal === 'function') {
        window.EstudoApp?.closeModal('modal-event-detail');
      }
    });
  }
});

// ============================================
// REVISÕES
// ============================================

registerAction('toggle-revision-tab', (el) => {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchRevTab === 'function') {
    window.EstudoApp?.switchRevTab(tab, el);
  }
});

registerAction('mark-revision-done', (el) => {
  const revisaoId = el.dataset.revisaoId;
  if (revisaoId && typeof window.EstudoApp?.marcarRevisaoFeita === 'function') {
    window.EstudoApp?.marcarRevisaoFeita(revisaoId);
  }
});

// ============================================
// DISCIPLINAS E ASSUNTOS
// ============================================

registerAction('edit-disciplina', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.openEditaModal === 'function') {
    window.EstudoApp?.openEditaModal(discId);
  }
});

registerAction('delete-disciplina', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.showConfirm === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza? Esta ação excluirá todos os assuntos e aulas vinculados.', () => {
      if (typeof window.EstudoApp?.deleteDisciplina === 'function') {
        window.EstudoApp?.deleteDisciplina(discId);
      }
    });
  }
});

// ============================================
// CRONÔMETRO LIVRE
// ============================================

registerAction('set-crono-livre-disc', (el) => {
  const discId = el.value;
  if (typeof window.EstudoApp?.setCronoLivreDisc === 'function') {
    window.EstudoApp?.setCronoLivreDisc(discId);
  }
});

registerAction('set-crono-livre-ass', (el) => {
  const assId = el.value;
  if (typeof window.EstudoApp?.setCronoLivreAss === 'function') {
    window.EstudoApp?.setCronoLivreAss(assId);
  }
});

registerAction('set-crono-livre-goal', (el) => {
  let value;
  if (el.tagName === 'INPUT') {
    value = parseInt(el.value, 10);
  } else if (el.tagName === 'BUTTON') {
    const delta = el.dataset.value;
    const current = state.cronoLivre?.duracaoMinutos || 0;
    if (delta.startsWith('+')) {
      value = current + parseInt(delta.slice(1), 10);
    } else if (delta.startsWith('-')) {
      value = Math.max(0, current - parseInt(delta.slice(1), 10));
    }
  }
  if (typeof window.EstudoApp?.setCronoLivreGoal === 'function') {
    window.EstudoApp?.setCronoLivreGoal(value);
  }
});

registerAction('add-minutes', (el) => {
  const eventId = el.dataset.eventId;
  const minutes = parseInt(el.dataset.minutes, 10);
  if (eventId && typeof window.EstudoApp?.addTimerMinutes === 'function') {
    window.EstudoApp?.addTimerMinutes(eventId, minutes);
  }
});

// ============================================
// HÁBITOS
// ============================================

registerAction('delete-habit', (el) => {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && typeof window.EstudoApp?.deleteHabito === 'function') {
    window.EstudoApp?.deleteHabito(habitType, habitId);
  }
});

registerAction('set-habit-page', (el) => {
  const page = parseInt(el.dataset.page, 10);
  if (typeof window.EstudoApp?.setHabitPage === 'function') {
    window.EstudoApp?.setHabitPage(page);
  }
});

registerAction('select-habit-type', (el) => {
  const habitKey = el.dataset.tipo;
  if (habitKey && typeof window.EstudoApp?.selectHabitType === 'function') {
    window.EstudoApp?.selectHabitType(habitKey, el);
  }
});

registerAction('calc-simulado-perc', () => {
  if (typeof window.EstudoApp?.calcSimuladoPerc === 'function') {
    window.EstudoApp?.calcSimuladoPerc();
  }
});

registerAction('edit-habit', (el) => {
  const habitId = el.dataset.habitId;
  const habitType = el.dataset.type;
  if (habitId && typeof window.EstudoApp?.editHabit === 'function') {
    window.EstudoApp?.editHabit(habitId, habitType);
  }
});

// ============================================
// BUSCA GLOBAL
// ============================================

registerAction('search-input', (el) => {
  if (typeof window.EstudoApp?.debouncedOnSearch === 'function') {
    window.EstudoApp?.debouncedOnSearch(el.value);
  }
});

registerAction('search-focus', () => {
  if (typeof window.EstudoApp?.onSearchFocus === 'function') {
    window.EstudoApp?.onSearchFocus();
  }
});

registerAction('search-blur', () => {
  if (typeof window.EstudoApp?.onSearchBlur === 'function') {
    window.EstudoApp?.onSearchBlur();
  }
});

// ============================================
// NAVEGAÇÃO E MODAIS
// ============================================

registerAction('navigate', (el) => {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp?.navigate(view);
  }
});

registerAction('close-sidebar', () => {
  if (typeof window.EstudoApp?.closeSidebar === 'function') {
    window.EstudoApp?.closeSidebar();
  }
});

registerAction('toggle-sidebar', () => {
  if (typeof window.EstudoApp?.toggleSidebar === 'function') {
    window.EstudoApp?.toggleSidebar();
  }
});

registerAction('toggle-sidebar-collapse', () => {
  if (typeof window.EstudoApp?.toggleSidebarCollapse === 'function') {
    window.EstudoApp?.toggleSidebarCollapse();
  }
});

registerAction('toggle-theme', () => {
  if (typeof window.EstudoApp?.applyTheme === 'function') {
    window.EstudoApp.applyTheme(true);
    window.EstudoApp.renderCurrentView();
  }
});

registerAction('switch-to-event-timer', (el) => {
  const eventId = el.dataset.eventId;
  const view = el.dataset.view || 'cronometro';
  if (typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp?.navigate(view);
    setTimeout(() => {
      if (typeof window.EstudoApp?.toggleTimer === 'function') {
        window.EstudoApp?.toggleTimer(eventId);
      }
    }, 100);
  }
});

registerAction('open-event-detail', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.openEventDetail === 'function') {
    window.EstudoApp?.openEventDetail(eventId);
  }
});

registerAction('close-modal', (el) => {
  const modal = el.dataset.modal;
  if (modal && typeof window.EstudoApp?.closeModal === 'function') {
    window.EstudoApp?.closeModal(modal);
  }
});

registerAction('open-add-event', () => {
  if (typeof window.EstudoApp?.openAddEventModal === 'function') {
    window.EstudoApp?.openAddEventModal();
  }
});

registerAction('open-event-modal-date', (el) => {
  const date = el.dataset.date;
  if (date && typeof window.EstudoApp?.openAddEventModalDate === 'function') {
    window.EstudoApp?.openAddEventModalDate(date);
  }
});

// ============================================
// CALENDÁRIO
// ============================================

registerAction('cal-navigate', (el) => {
  const dir = parseInt(el.dataset.dir, 10);
  if (typeof window.EstudoApp?.calNavigate === 'function') {
    window.EstudoApp?.calNavigate(dir);
  }
});

registerAction('cal-today', () => {
  if (typeof window.EstudoApp?.resetCalDate === 'function') {
    window.EstudoApp?.resetCalDate();
  }
});

registerAction('set-cal-view-mode', (el) => {
  const mode = el.dataset.mode;
  if (mode && typeof window.EstudoApp?.setCalViewMode === 'function') {
    window.EstudoApp?.setCalViewMode(mode);
  }
});

// ============================================
// DASHBOARD
// ============================================

registerAction('set-dash-period', (el) => {
  const period = parseInt(el.dataset.period, 10);
  if (typeof window.EstudoApp?.setDashPeriod === 'function') {
    window.EstudoApp?.setDashPeriod(period);
  }
});

// ============================================
// REVISÕES (ABAS E AÇÕES)
// ============================================

registerAction('switch-revision-tab', (el) => {
  const tab = el.dataset.tab;
  const target = el.dataset.target;
  if (tab && typeof window.EstudoApp?.switchRevTab === 'function') {
    window.EstudoApp?.switchRevTab(tab, target);
  }
});

registerAction('mark-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId && typeof window.EstudoApp?.marcarRevisao === 'function') {
    window.EstudoApp?.marcarRevisao(assuntoId);
  }
});

registerAction('postpone-revision', (el) => {
  const assuntoId = el.dataset.assuntoId;
  if (assuntoId && typeof window.EstudoApp?.adiarRevisao === 'function') {
    window.EstudoApp?.adiarRevisao(assuntoId);
  }
});

// ============================================
// DASHBOARD / EDITAIS
// ============================================

registerAction('close-disc-dashboard', () => {
  if (typeof window.EstudoApp?.closeDiscDashboard === 'function') {
    window.EstudoApp?.closeDiscDashboard();
  }
});

registerAction('open-edital-modal', (el) => {
  if (typeof window.EstudoApp?.openEditaModal === 'function') {
    window.EstudoApp?.openEditaModal(el.dataset.editalId || null);
  }
});

registerAction('open-planejamento-wizard', () => {
  if (typeof window.EstudoApp?.openPlanejamentoWizard === 'function') {
    window.EstudoApp?.openPlanejamentoWizard();
  }
});

registerAction('open-habit-modal', (el) => {
  const habitKey = el.dataset.habitKey;
  if (habitKey && typeof window.EstudoApp?.openHabitModal === 'function') {
    window.EstudoApp?.openHabitModal(habitKey);
  }
});

registerAction('save-disc', () => {
  if (typeof window.EstudoApp?.saveDisc === 'function') {
    window.EstudoApp?.saveDisc();
  }
});

registerAction('save-habit', () => {
  if (typeof window.EstudoApp?.saveHabit === 'function') {
    window.EstudoApp?.saveHabit();
  }
});

registerAction('drive-action', () => {
  if (typeof window.EstudoApp?.driveAction === 'function') {
    window.EstudoApp?.driveAction();
  }
});

registerAction('disconnect-drive', () => {
  if (typeof window.EstudoApp?.disconnectDrive === 'function') {
    window.EstudoApp?.disconnectDrive();
  }
});

registerAction('prompt-prova', () => {
  if (typeof window.EstudoApp?.promptDataProva === 'function') {
    window.EstudoApp?.promptDataProva();
  }
});

registerAction('prompt-metas', () => {
  if (typeof window.EstudoApp?.promptMetas === 'function') {
    window.EstudoApp?.promptMetas();
  }
});

registerAction('remover-planejamento', () => {
  if (typeof window.EstudoApp?.deletePlanejamento === 'function') {
    window.EstudoApp?.deletePlanejamento();
  }
});

registerAction('toggle-ciclo-fin', (el) => {
  if (typeof window.EstudoApp?.toggleCicloFin === 'function') {
    window.EstudoApp?.toggleCicloFin(el.checked);
  }
});

registerAction('edit-session-record', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId && typeof window.EstudoApp?.openRegistroSessao === 'function') {
    window.EstudoApp?.openRegistroSessao(sessionId);
  }
});

registerAction('delete-session-record', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId && typeof window.EstudoApp?.deleteCompletedSession === 'function') {
    window.EstudoApp?.deleteCompletedSession(sessionId);
  }
});

// ============================================
// REGISTRO DE SESSÃO
// ============================================

registerAction('toggle-study-type', (el) => {
  const typeId = el.dataset.typeId || el.dataset.tipo;
  if (typeId && typeof window.EstudoApp?.toggleStudyType === 'function') {
    window.EstudoApp?.toggleStudyType(typeId);
  }
});

registerAction('toggle-material', (el) => {
  const materialId = el.dataset.materialId || el.dataset.mat;
  if (materialId && typeof window.EstudoApp?.toggleMaterial === 'function') {
    window.EstudoApp?.toggleMaterial(materialId);
  }
});

registerAction('on-disciplina-change', () => {
  if (typeof window.EstudoApp?.onDisciplinaChange === 'function') {
    window.EstudoApp?.onDisciplinaChange();
  }
});

registerAction('on-aula-change', () => {
  if (typeof window.EstudoApp?.onAulaChange === 'function') {
    window.EstudoApp?.onAulaChange();
  }
});

registerAction('add-novo-topico', () => {
  if (typeof window.EstudoApp?.addNovoTopico === 'function') {
    window.EstudoApp?.addNovoTopico();
  }
});

registerAction('validate-questoes', (el) => {
  if (typeof window.EstudoApp?.validateQuestoes === 'function') {
    window.EstudoApp?.validateQuestoes();
  }
});

registerAction('set-pagina-mode', (el) => {
  const mode = el.dataset.mode;
  if (mode && typeof window.EstudoApp?.setPaginaMode === 'function') {
    window.EstudoApp?.setPaginaMode(mode);
  }
});

registerAction('delete-completed-session', (el) => {
  const sessionId = el.dataset.sessionId;
  if (sessionId && typeof window.EstudoApp?.deleteCompletedSession === 'function') {
    window.EstudoApp?.deleteCompletedSession(sessionId);
  }
});

registerAction('voltar-past-session-ui', (el) => {
  const eventId = el.dataset.eventId;
  const discId = el.dataset.discId;
  if (typeof window.EstudoApp?.voltarPastSessionUI === 'function') {
    window.EstudoApp?.voltarPastSessionUI(eventId, discId);
  }
});

registerAction('discard-timer-ui', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.discardTimerUI === 'function') {
    window.EstudoApp?.discardTimerUI(eventId);
  }
});

registerAction('cancel-registro', () => {
  if (typeof window.EstudoApp?.cancelRegistro === 'function') {
    window.EstudoApp?.cancelRegistro();
  }
});

registerAction('save-and-start-new', () => {
  if (typeof window.EstudoApp?.saveAndStartNew === 'function') {
    window.EstudoApp?.saveAndStartNew();
  }
});

registerAction('save-registro-sessao', () => {
  if (typeof window.EstudoApp?.saveRegistroSessao === 'function') {
    window.EstudoApp?.saveRegistroSessao();
  }
});

// ============================================
// PLANEJAMENTO WIZARD
// ============================================

registerAction('pw-select-tipo', (el) => {
  const tipo = el.dataset.tipo;
  if (tipo && typeof window.EstudoApp?.pwSelectTipo === 'function') {
    window.EstudoApp?.pwSelectTipo(tipo);
  }
});

registerAction('pw-select-all-disc', () => {
  if (typeof window.EstudoApp?.pwSelectAllDisc === 'function') {
    window.EstudoApp?.pwSelectAllDisc();
  }
});

registerAction('pw-clear-disc', () => {
  if (typeof window.EstudoApp?.pwClearDisc === 'function') {
    window.EstudoApp?.pwClearDisc();
  }
});

registerAction('pw-toggle-disc', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.pwToggleDisc === 'function') {
    window.EstudoApp?.pwToggleDisc(discId);
  }
});

registerAction('pw-update-relevancia', (el) => {
  const discId = el.dataset.discId;
  const type = el.dataset.type;
  const value = el.value;
  if (discId && type && typeof window.EstudoApp?.pwUpdateRel === 'function') {
    window.EstudoApp?.pwUpdateRel(discId, type, value);
  }
});

registerAction('pw-update-hours', (el) => {
  const field = el.dataset.field;
  const value = el.value;
  if (field && typeof window.EstudoApp?.pwUpdateHours === 'function') {
    window.EstudoApp?.pwUpdateHours(field, value);
  }
});

registerAction('pw-toggle-day', (el) => {
  const dayIndex = el.dataset.dayIndex;
  if (dayIndex && typeof window.EstudoApp?.pwToggleDay === 'function') {
    window.EstudoApp?.pwToggleDay(parseInt(dayIndex, 10));
  }
});

registerAction('pw-update-day-hour', (el) => {
  const dayIndex = el.dataset.dayIndex;
  const value = el.value;
  if (dayIndex && typeof window.EstudoApp?.pwUpdateDayHour === 'function') {
    window.EstudoApp?.pwUpdateDayHour(parseInt(dayIndex, 10), value);
  }
});

// ============================================
// VERTICAL / EDITAL DASHBOARD
// ============================================

registerAction('vert-search', (el) => {
  if (typeof window.EstudoApp?.onVertSearch === 'function') {
    window.EstudoApp?.onVertSearch(el.value);
  }
});

registerAction('set-vert-filter-edital', (el) => {
  const editalId = el.value;
  if (typeof window.EstudoApp?.setVertFilterEdital === 'function') {
    window.EstudoApp?.setVertFilterEdital(editalId);
  }
});

registerAction('set-vert-filter-status', (el) => {
  const status = el.dataset.status;
  if (status && typeof window.EstudoApp?.setVertFilterStatus === 'function') {
    window.EstudoApp?.setVertFilterStatus(status);
  }
});

registerAction('toggle-vert-disc', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.toggleVertDisc === 'function') {
    window.EstudoApp?.toggleVertDisc(discId);
  }
});

registerAction('add-novo-topico-vertical', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.addNovoTopicoVertical === 'function') {
    window.EstudoApp?.addNovoTopicoVertical(editalId, discId);
  }
});

registerAction('open-disc-manager', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.openDiscManager === 'function') {
    window.EstudoApp?.openDiscManager(editalId, discId);
  }
});

registerAction('toggle-assunto', (el) => {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.toggleAssunto === 'function') {
    window.EstudoApp?.toggleAssunto(discId, assuntoId);
  }
});

registerAction('toggle-edital', (el) => {
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.toggleEdital === 'function') {
    window.EstudoApp?.toggleEdital(editalId);
  }
});

registerAction('navigate-with-ctx', (el) => {
  const view = el.dataset.view;
  const ctx = el.dataset.ctx;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    if (ctx) {
      window.activeDashboardDiscCtx = JSON.parse(decodeURIComponent(ctx));
    }
    window.EstudoApp?.navigate(view);
  }
});

registerAction('delete-edital', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.deleteEdital === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir este edital?', () => {
      window.EstudoApp?.deleteEdital(editalId);
    });
  }
});

registerAction('open-disc-modal', (el) => {
  const editalId = el.dataset.editalId;
  if (editalId && typeof window.EstudoApp?.openDiscModal === 'function') {
    window.EstudoApp?.openDiscModal(editalId);
  }
});

registerAction('open-disc-dashboard', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.openDiscDashboard === 'function') {
    window.EstudoApp?.openDiscDashboard(editalId, discId);
  }
});

registerAction('delete-disc', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.deleteDisc === 'function') {
    window.EstudoApp?.showConfirm('Tem certeza que deseja excluir esta disciplina?', () => {
      window.EstudoApp?.deleteDisc(editalId, discId);
    });
  }
});

registerAction('switch-dashboard-tab', (el) => {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchDashboardTab === 'function') {
    window.EstudoApp?.switchDashboardTab(tab);
  }
});

registerAction('open-registro-sessao', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.openRegistroSessao === 'function') {
    window.EstudoApp?.openRegistroSessao(discId);
  }
});

registerAction('open-add-past-session', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.openAddPastSessionModal === 'function') {
    window.EstudoApp?.openAddPastSessionModal(discId);
  }
});

registerAction('add-evento-para-assunto', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (editalId && discId && assuntoId && typeof window.EstudoApp?.addEventoParaAssunto === 'function') {
    window.EstudoApp?.addEventoParaAssunto(editalId, discId, assuntoId);
  }
});

registerAction('toggle-aula-dashboard', (el, event) => {
  if (event) event.stopPropagation();
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (editalId && discId && aulaId && typeof window.EstudoApp?.toggleAulaDashboard === 'function') {
    window.EstudoApp?.toggleAulaDashboard(editalId, discId, aulaId);
  }
});

registerAction('select-color', (el) => {
  const color = el.dataset.color;
  const container = el.dataset.container;
  if (color && container && typeof window.EstudoApp?.selectColor === 'function') {
    window.EstudoApp?.selectColor(color, container);
  }
});

registerAction('save-edital', (el) => {
  const editalId = el.dataset.editalId;
  if (typeof window.EstudoApp?.saveEdital === 'function') {
    window.EstudoApp?.saveEdital(editalId);
  }
});

registerAction('select-icon', (el) => {
  const icon = el.dataset.icon;
  if (icon && typeof window.EstudoApp?.selectIcon === 'function') {
    window.EstudoApp?.selectIcon(icon, el);
  }
});

registerAction('select-disc-color', (el) => {
  const color = el.dataset.color;
  if (color && typeof window.EstudoApp?.selectDiscColor === 'function') {
    window.EstudoApp?.selectDiscColor(color);
  }
});

registerAction('edit-subject-inline', (el) => {
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.editSubjectInline === 'function') {
    window.EstudoApp?.editSubjectInline(discId, assuntoId, el);
  }
});

registerAction('move-subject', (el) => {
  const discId = el.dataset.discId;
  const idx = parseInt(el.dataset.idx, 10);
  const dir = parseInt(el.dataset.dir, 10);
  if (discId && typeof window.EstudoApp?.moveSubject === 'function') {
    window.EstudoApp?.moveSubject(discId, idx, dir);
  }
});

registerAction('delete-assunto', (el, event) => {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const assuntoId = el.dataset.assuntoId;
  if (discId && assuntoId && typeof window.EstudoApp?.deleteAssunto === 'function') {
    window.EstudoApp?.deleteAssunto(discId, assuntoId);
  }
});

registerAction('edit-lesson-inline', (el) => {
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.editLessonInline === 'function') {
    window.EstudoApp?.editLessonInline(discId, aulaId, el);
  }
});

registerAction('toggle-aula-estudada', (el, event) => {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.toggleAulaEstudada === 'function') {
    window.EstudoApp?.toggleAulaEstudada(discId, aulaId);
  }
});

registerAction('delete-aula', (el, event) => {
  if (event) event.stopPropagation();
  const discId = el.dataset.discId;
  const aulaId = el.dataset.aulaId;
  if (discId && aulaId && typeof window.EstudoApp?.deleteAula === 'function') {
    window.EstudoApp?.deleteAula(discId, aulaId);
  }
});

registerAction('add-assunto', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.addAssunto === 'function') {
    window.EstudoApp?.addAssunto(discId);
  }
});

registerAction('add-bulk-aulas', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.addBulkAulas === 'function') {
    window.EstudoApp?.addBulkAulas(discId);
  }
});

registerAction('run-lesson-mapper', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.runLessonMapperUI === 'function') {
    window.EstudoApp?.runLessonMapperUI(editalId, discId);
  }
});

registerAction('save-disc-manager', (el) => {
  const editalId = el.dataset.editalId;
  const discId = el.dataset.discId;
  if (editalId && discId && typeof window.EstudoApp?.saveDiscManager === 'function') {
    window.EstudoApp?.saveDiscManager(editalId, discId);
  }
});

registerAction('switch-manager-tab', (el) => {
  const tab = el.dataset.tab;
  if (tab && typeof window.EstudoApp?.switchManagerTab === 'function') {
    window.EstudoApp?.switchManagerTab(tab);
  }
});

registerAction('carregar-analise-banca', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.carregarAnaliseBanca === 'function') {
    window.EstudoApp?.carregarAnaliseBanca(discId);
  }
});

registerAction('excluir-analise-banca', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.excluirAnaliseBanca === 'function') {
    window.EstudoApp?.excluirAnaliseBanca(discId);
  }
});

registerAction('sync-color-to-picker', (el) => {
  const picker = document.getElementById('dm-cor-picker');
  if (picker) {
    picker.value = el.value;
  }
});

registerAction('mudar-edital-analisador', (el) => {
  const editalId = el.value;
  if (editalId && typeof window.EstudoApp?.mudarEditalAnalisador === 'function') {
    window.EstudoApp?.mudarEditalAnalisador(editalId);
  }
});

registerAction('filtrar-dropdown-banca', (el) => {
  const value = el.value;
  if (typeof window.EstudoApp?.filtrarDropdownBanca === 'function') {
    window.EstudoApp?.filtrarDropdownBanca(value);
  }
});

registerAction('filtrar-view-por-disciplina', (el) => {
  const discId = el.value;
  if (discId && typeof window.EstudoApp?.filtrarViewPorDisciplina === 'function') {
    window.EstudoApp?.filtrarViewPorDisciplina(discId);
  }
});

registerAction('parse-banca-text', () => {
  if (typeof window.EstudoApp?.parseBancaText === 'function') {
    window.EstudoApp?.parseBancaText();
  }
});

registerAction('apply-banca-ranking', () => {
  if (typeof window.EstudoApp?.applyBancaRanking === 'function') {
    window.EstudoApp?.applyBancaRanking();
  }
});

registerAction('load-assuntos', () => {
  if (typeof window.EstudoApp?.loadAssuntos === 'function') {
    window.EstudoApp?.loadAssuntos();
  }
});

registerAction('update-day-load', (el) => {
  if (typeof window.EstudoApp?.updateDayLoad === 'function') {
    window.EstudoApp?.updateDayLoad(el.value);
  }
});

registerAction('save-event', () => {
  if (typeof window.EstudoApp?.saveEvent === 'function') {
    window.EstudoApp?.saveEvent();
  }
});

registerAction('save-past-event', (el) => {
  const discId = el.dataset.discId;
  if (discId && typeof window.EstudoApp?.savePastEvent === 'function') {
    window.EstudoApp?.savePastEvent(discId);
  }
});

registerAction('open-match-corrector', (el) => {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome && typeof window.EstudoApp?.openMatchCorrector === 'function') {
    window.EstudoApp?.openMatchCorrector(assuntoNome);
  }
});

registerAction('save-match-correction', (el) => {
  const assuntoNome = el.dataset.assuntoNome;
  if (assuntoNome && typeof window.EstudoApp?.saveMatchCorrection === 'function') {
    window.EstudoApp?.saveMatchCorrection(assuntoNome);
  }
});

registerAction('save-bulk-subjects', () => {
  if (typeof window.EstudoApp?.saveBulkSubjects === 'function') {
    window.EstudoApp?.saveBulkSubjects();
  }
});

registerAction('stop-propagation', () => {
  // Dispatcher já stopa propagação; esta ação define áreas inertes
});

registerAction('pw-search-disc', (el) => {
  if (typeof window.EstudoApp?.pwSearchDisc === 'function') {
    window.EstudoApp?.pwSearchDisc(el.value);
  }
});

registerAction('set-theme', (el) => {
  if (typeof window.EstudoApp?.setTheme === 'function') {
    window.EstudoApp?.setTheme(el.value);
  }
});

registerAction('update-config', (el) => {
  const key = el.dataset.configKey;
  if (!key || typeof window.EstudoApp?.updateConfig !== 'function') return;

  let value = el.value;
  if (el.dataset.valueType === 'number') {
    value = parseInt(value, 10);
  } else if (el.dataset.valueTransform === 'trim-url') {
    value = value.trim().replace(/\/$/, '');
  } else if (el.dataset.valueTransform === 'trim') {
    value = value.trim();
  }

  window.EstudoApp?.updateConfig(key, value);
});

registerAction('toggle-config', (el) => {
  const key = el.dataset.configKey;
  if (!key || typeof window.EstudoApp?.toggleConfig !== 'function') return;

  window.EstudoApp?.toggleConfig(key, el);
  el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
});

registerAction('update-frequencia', (el) => {
  if (typeof window.EstudoApp?.updateFrequencia === 'function') {
    window.EstudoApp?.updateFrequencia(el.value);
  }
});

registerAction('toggle-password-visibility', (el) => {
  const input = document.getElementById(el.dataset.targetId);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
});

registerAction('toggle-cf-sync', (el) => {
  if (typeof window.EstudoApp?.toggleCfSync === 'function') {
    window.EstudoApp?.toggleCfSync(el.checked);
  }
});

registerAction('force-cloudflare-sync', () => {
  if (typeof window.EstudoApp?.forceCloudflareSync === 'function') {
    window.EstudoApp?.forceCloudflareSync();
  }
});

registerAction('cloud-conflict-export-local', () => {
  if (typeof window.EstudoApp?.exportData === 'function') {
    window.EstudoApp?.exportData();
  }
});

registerAction('cloud-conflict-pull-remote', () => {
  if (typeof window.EstudoApp?.showConfirm !== 'function' || typeof window.EstudoApp?.pullFromCloudflare !== 'function') return;
  window.EstudoApp?.showConfirm(
    'Baixar os dados remotos agora? Isso substituirá os dados locais. Exporte um backup local antes se tiver dúvida.',
    () => window.EstudoApp?.pullFromCloudflare(true),
    { label: 'Baixar remoto', title: 'Resolver conflito de sync' }
  );
});

registerAction('cloud-conflict-force-push', () => {
  if (typeof window.EstudoApp?.showConfirm !== 'function' || typeof window.EstudoApp?.pushToCloudflare !== 'function') return;
  window.EstudoApp?.showConfirm(
    'Forçar envio local para a nuvem? Isso sobrescreverá a versão remota mais recente.',
    () => window.EstudoApp?.pushToCloudflare(true),
    { label: 'Forçar envio', title: 'Sobrescrever remoto', danger: true }
  );
});

registerAction('drive-sync-now', () => {
  if (typeof window.EstudoApp?.syncWithDrive === 'function') {
    window.EstudoApp?.syncWithDrive()
      .then(() => window.EstudoApp?.showToast('Sincronizado!', 'success'))
      .catch(() => window.EstudoApp?.showToast('Erro ao sincronizar', 'error'));
  }
});

registerAction('pull-from-drive', () => {
  if (typeof window.EstudoApp?.pullFromDrive === 'function') {
    window.EstudoApp?.pullFromDrive();
  }
});

registerAction('drive-disconnect', () => {
  if (typeof window.EstudoApp?.driveDisconnect === 'function') {
    window.EstudoApp?.driveDisconnect();
  }
});

registerAction('open-drive-modal', () => {
  if (typeof window.EstudoApp?.openDriveModal === 'function') {
    window.EstudoApp?.openDriveModal();
  }
});

registerAction('request-notification-permission', () => {
  if (!('Notification' in window)) return;
  Notification.requestPermission()
    .then(permission => {
      if (permission === 'granted') {
        window.EstudoApp?.showToast('Notificações ativadas!', 'success');
      }
      window.EstudoApp?.renderCurrentView();
    })
    .catch(error => console.warn(error));
});

registerAction('test-notification', () => {
  if ('Notification' in window) {
    new Notification('Estudo Organizado', { body: 'Notificações funcionando!', icon: '📚' });
    window.EstudoApp?.showToast('Lembretes enviados!', 'success');
  }
});

registerAction('export-data', () => {
  if (typeof window.EstudoApp?.exportData === 'function') {
    window.EstudoApp?.exportData();
  }
});

registerAction('restore-backup', () => {
  if (typeof window.EstudoApp?.restoreBackupFromSelectedSource === 'function') {
    window.EstudoApp?.restoreBackupFromSelectedSource();
  }
});

registerAction('archive-old-events', (el) => {
  const days = parseInt(el.dataset.days || '90', 10);
  if (typeof window.EstudoApp?.archiveOldEvents === 'function') {
    window.EstudoApp?.archiveOldEvents(days);
  }
});

registerAction('clear-all-data', () => {
  if (typeof window.EstudoApp?.clearAllData === 'function') {
    window.EstudoApp?.clearAllData();
  }
});

registerAction('open-search-event', (el) => {
  const eventId = el.dataset.eventId;
  if (eventId && typeof window.EstudoApp?.openEventDetail === 'function') {
    window.EstudoApp.openEventDetail(eventId);
    window.EstudoApp?.clearSearch();
  }
});

registerAction('navigate-clear-search', (el) => {
  const view = el.dataset.view;
  if (view && typeof window.EstudoApp?.navigate === 'function') {
    window.EstudoApp.navigate(view);
    window.EstudoApp?.clearSearch();
  }
});

registerAction('update-seq-item', (el) => {
  const index = el.dataset.index;
  const field = el.dataset.field;
  if (index !== undefined && field && typeof window.EstudoApp?.updateSeqItem === 'function') {
    window.EstudoApp?.updateSeqItem(index, field, el.value);
  }
});

registerAction('dup-seq-item', (el) => {
  if (typeof window.EstudoApp?.dupSeqItem === 'function') {
    window.EstudoApp?.dupSeqItem(el.dataset.index);
  }
});

registerAction('rem-seq-item', (el) => {
  if (typeof window.EstudoApp?.remSeqItem === 'function') {
    window.EstudoApp?.remSeqItem(el.dataset.index);
  }
});

registerAction('move-seq-item', (el) => {
  if (typeof window.EstudoApp?.moveSeqItem === 'function') {
    window.EstudoApp?.moveSeqItem(el.dataset.index, parseInt(el.dataset.dir, 10));
  }
});

registerAction('open-ciclo-history', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId && typeof window.EstudoApp?.openCicloHistory === 'function') {
    window.EstudoApp?.openCicloHistory(seqId);
  }
});

registerAction('iniciar-etapa-planejamento', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId && typeof window.EstudoApp?.iniciarEtapaPlanejamento === 'function') {
    window.EstudoApp?.iniciarEtapaPlanejamento(seqId);
  }
});

registerAction('add-seq-item', () => {
  if (typeof window.EstudoApp?.addSeqItem === 'function') {
    window.EstudoApp?.addSeqItem();
  }
});

registerAction('cancel-edit-seq', () => {
  if (typeof window.EstudoApp?.cancelEditSeq === 'function') {
    window.EstudoApp?.cancelEditSeq();
  }
});

registerAction('save-edit-seq', () => {
  if (typeof window.EstudoApp?.saveEditSeq === 'function') {
    window.EstudoApp?.saveEditSeq();
  }
});

registerAction('recomecar-ciclo', () => {
  if (typeof window.EstudoApp?.recomecarCiclo === 'function') {
    window.EstudoApp?.recomecarCiclo();
  }
});

registerAction('toggle-edit-seq', () => {
  if (typeof window.EstudoApp?.toggleEditSeq === 'function') {
    window.EstudoApp?.toggleEditSeq();
  }
});

registerAction('zerar-ciclos-counter', () => {
  if (typeof window.EstudoApp?.zerarCiclosCounter === 'function') {
    window.EstudoApp?.zerarCiclosCounter();
  }
});

registerAction('calculate-cycle-predictions', () => {
  if (typeof window.EstudoApp?.calculateCyclePredictions === 'function') {
    window.EstudoApp?.calculateCyclePredictions();
  }
});

registerAction('move-ciclo-seq', (el) => {
  if (typeof window.EstudoApp?.moveCicloSeq === 'function') {
    window.EstudoApp?.moveCicloSeq(parseInt(el.dataset.index, 10), parseInt(el.dataset.dir, 10));
  }
});

registerAction('edit-ciclo-seq-hours', (el) => {
  if (typeof window.EstudoApp?.editCicloSeqHours === 'function') {
    window.EstudoApp?.editCicloSeqHours(parseInt(el.dataset.index, 10));
  }
});

registerAction('desfazer-etapa', (el) => {
  const seqId = el.dataset.seqId;
  if (seqId && typeof window.EstudoApp?.desfazerEtapa === 'function') {
    window.EstudoApp?.desfazerEtapa(seqId);
  }
});

registerAction('open-event-from-ciclo-history', (el) => {
  const eventId = el.dataset.eventId;
  if (typeof window.EstudoApp?.closeModal === 'function') {
    window.EstudoApp?.closeModal('modal-ciclo-history');
  }
  if (eventId && typeof window.EstudoApp?.openEventDetail === 'function') {
    window.EstudoApp?.openEventDetail(eventId);
  }
});

// Export para compatibilidade (apenas registry, não usar diretamente)
export default actions;

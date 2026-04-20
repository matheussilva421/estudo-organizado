/**
 * Central Action Dispatcher
 * Substitui inline handlers (onclick, onchange, etc.) por data-action contracts
 */

import { state } from '../store.js?v=8.3';

/**
 * Registry de ações disponíveis
 * Cada ação recebe o elemento e o evento
 */
const actions = {
  // ============================================
  // TIMER E CRONÔMETRO
  // ============================================

  'toggle-timer': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.toggleTimer === 'function') {
      window.toggleTimer(eventId);
    }
  },

  'discard-timer': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.discardTimer === 'function') {
      window.discardTimer(eventId);
    }
  },

  'mark-studied': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.marcarEstudei === 'function') {
      window.marcarEstudei(eventId);
    }
  },

  'toggle-timer-mode': () => {
    if (typeof window.toggleTimerMode === 'function') {
      window.toggleTimerMode();
    }
  },

  // ============================================
  // CRUD DE EVENTOS
  // ============================================

  'edit-event': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.openAddEventModal === 'function') {
      window.openAddEventModal(eventId);
    }
  },

  'delete-event': (el, event) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.showConfirm === 'function') {
      window.showConfirm('Tem certeza que deseja excluir este evento?', () => {
        if (typeof window.deleteEvento === 'function') {
          window.deleteEvento(eventId);
        }
      });
    }
  },

  'delete-event-from-modal': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.showConfirm === 'function') {
      window.showConfirm('Tem certeza que deseja excluir este evento?', () => {
        if (typeof window.deleteEvento === 'function') {
          window.deleteEvento(eventId);
        }
        if (typeof window.closeModal === 'function') {
          window.closeModal('modal-event-detail');
        }
      });
    }
  },

  // ============================================
  // REVISÕES
  // ============================================

  'toggle-revision-tab': (el) => {
    const tab = el.dataset.tab;
    if (tab && typeof window.switchRevTab === 'function') {
      window.switchRevTab(tab, el);
    }
  },

  'mark-revision-done': (el) => {
    const revisaoId = el.dataset.revisaoId;
    if (revisaoId && typeof window.marcarRevisaoFeita === 'function') {
      window.marcarRevisaoFeita(revisaoId);
    }
  },

  // ============================================
  // DISCIPLINAS E ASSUNTOS
  // ============================================

  'edit-disciplina': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.openEditaModal === 'function') {
      window.openEditaModal(discId);
    }
  },

  'delete-disciplina': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.showConfirm === 'function') {
      window.showConfirm('Tem certeza? Esta ação excluirá todos os assuntos e aulas vinculados.', () => {
        if (typeof window.deleteDisciplina === 'function') {
          window.deleteDisciplina(discId);
        }
      });
    }
  },

  // ============================================
  // CRONÔMETRO LIVRE
  // ============================================

  'set-crono-livre-disc': (el) => {
    const discId = el.value;
    if (typeof window.setCronoLivreDisc === 'function') {
      window.setCronoLivreDisc(discId);
    }
  },

  'set-crono-livre-ass': (el) => {
    const assId = el.value;
    if (typeof window.setCronoLivreAss === 'function') {
      window.setCronoLivreAss(assId);
    }
  },

  'set-crono-livre-goal': (el) => {
    // Handle button clicks with data-value (+/-) and input changes
    let value;
    if (el.tagName === 'INPUT') {
      value = parseInt(el.value, 10);
    } else if (el.tagName === 'BUTTON') {
      // Button with data-value like "+5" or "-5"
      const delta = el.dataset.value;
      const current = state.cronoLivre?.duracaoMinutos || 0;
      if (delta.startsWith('+')) {
        value = current + parseInt(delta.slice(1), 10);
      } else if (delta.startsWith('-')) {
        value = Math.max(0, current - parseInt(delta.slice(1), 10));
      }
    }
    if (typeof window.setCronoLivreGoal === 'function') {
      window.setCronoLivreGoal(value);
    }
  },

  'add-minutes': (el) => {
    const eventId = el.dataset.eventId;
    const minutes = parseInt(el.dataset.minutes, 10);
    if (eventId && typeof window.addTimerMinutes === 'function') {
      window.addTimerMinutes(eventId, minutes);
    }
  },

  // ============================================
  // HABITOS
  // ============================================

  'delete-habit': (el) => {
    const habitId = el.dataset.habitId;
    const habitType = el.dataset.type;
    if (habitId && typeof window.deleteHabito === 'function') {
      window.deleteHabito(habitType, habitId);
    }
  },

  'set-habit-page': (el) => {
    const page = parseInt(el.dataset.page, 10);
    if (typeof window.setHabitPage === 'function') {
      window.setHabitPage(page);
    }
  },

  'select-habit-type': (el) => {
    const habitKey = el.dataset.tipo;
    if (habitKey && typeof window.selectHabitType === 'function') {
      window.selectHabitType(habitKey, el);
    }
  },

  'calc-simulado-perc': () => {
    if (typeof window.calcSimuladoPerc === 'function') {
      window.calcSimuladoPerc();
    }
  },

  'edit-habit': (el) => {
    const habitId = el.dataset.habitId;
    const habitType = el.dataset.type;
    if (habitId && typeof window.editHabit === 'function') {
      window.editHabit(habitId, habitType);
    }
  },

  // ============================================
  // BUSCA GLOBAL (migrated from inline handlers)
  // ============================================

  'search-input': (el) => {
    if (typeof window.debouncedOnSearch === 'function') {
      window.debouncedOnSearch(el.value);
    }
  },

  'search-focus': () => {
    if (typeof window.onSearchFocus === 'function') {
      window.onSearchFocus();
    }
  },

  'search-blur': () => {
    if (typeof window.onSearchBlur === 'function') {
      window.onSearchBlur();
    }
  },

  // ============================================
  // NAVEGAÇÃO E MODALS
  // ============================================

  'navigate': (el) => {
    const view = el.dataset.view;
    if (view && typeof window.navigate === 'function') {
      window.navigate(view);
    }
  },

  'close-sidebar': () => {
    if (typeof window.closeSidebar === 'function') {
      window.closeSidebar();
    }
  },

  'toggle-sidebar': () => {
    if (typeof window.toggleSidebar === 'function') {
      window.toggleSidebar();
    }
  },

  'toggle-sidebar-collapse': () => {
    if (typeof window.toggleSidebarCollapse === 'function') {
      window.toggleSidebarCollapse();
    }
  },

  'toggle-theme': () => {
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(true);
      window.renderCurrentView?.();
    }
  },

  'switch-to-event-timer': (el) => {
    const eventId = el.dataset.eventId;
    const view = el.dataset.view || 'cronometro';
    if (typeof window.navigate === 'function') {
      window.navigate(view);
      setTimeout(() => {
        if (typeof window.toggleTimer === 'function') {
          window.toggleTimer(eventId);
        }
      }, 100);
    }
  },

  'open-event-detail': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.openEventDetail === 'function') {
      window.openEventDetail(eventId);
    }
  },

  'close-modal': (el) => {
    const modal = el.dataset.modal;
    if (modal && typeof window.closeModal === 'function') {
      window.closeModal(modal);
    }
  },

  'open-add-event': () => {
    if (typeof window.openAddEventModal === 'function') {
      window.openAddEventModal();
    }
  },

  'open-event-modal-date': (el) => {
    const date = el.dataset.date;
    if (date && typeof window.openAddEventModalDate === 'function') {
      window.openAddEventModalDate(date);
    }
  },

  // ============================================
  // CALENDÁRIO
  // ============================================

  'cal-navigate': (el) => {
    const dir = parseInt(el.dataset.dir, 10);
    if (typeof window.calNavigate === 'function') {
      window.calNavigate(dir);
    }
  },

  'cal-today': () => {
    if (typeof window.resetCalDate === 'function') {
      window.resetCalDate();
    }
  },

  'set-cal-view-mode': (el) => {
    const mode = el.dataset.mode;
    if (mode && typeof window.setCalViewMode === 'function') {
      window.setCalViewMode(mode);
    }
  },

  // ============================================
  // DASHBOARD
  // ============================================

  'set-dash-period': (el) => {
    const period = parseInt(el.dataset.period, 10);
    if (typeof window.setDashPeriod === 'function') {
      window.setDashPeriod(period);
    }
  },

  // ============================================
  // REVISÕES
  // ============================================

  'switch-revision-tab': (el) => {
    const tab = el.dataset.tab;
    const target = el.dataset.target;
    if (tab && typeof window.switchRevTab === 'function') {
      window.switchRevTab(tab, target);
    }
  },

  'mark-revision': (el) => {
    const assuntoId = el.dataset.assuntoId;
    if (assuntoId && typeof window.marcarRevisao === 'function') {
      window.marcarRevisao(assuntoId);
    }
  },

  'postpone-revision': (el) => {
    const assuntoId = el.dataset.assuntoId;
    if (assuntoId && typeof window.adiarRevisao === 'function') {
      window.adiarRevisao(assuntoId);
    }
  },

  // ============================================
  // DISCIPLINAS / EDITAIS
  // ============================================

  'close-disc-dashboard': () => {
    if (typeof window.closeDiscDashboard === 'function') {
      window.closeDiscDashboard();
    }
  },

  'open-edital-modal': (el) => {
    if (typeof window.openEditaModal === 'function') {
      window.openEditaModal(el.dataset.editalId || null);
    }
  },

  'open-planejamento-wizard': () => {
    if (typeof window.openPlanejamentoWizard === 'function') {
      window.openPlanejamentoWizard();
    }
  },

  'open-habit-modal': (el) => {
    const habitKey = el.dataset.habitKey;
    if (habitKey && typeof window.openHabitModal === 'function') {
      window.openHabitModal(habitKey);
    }
  },

  'save-disc': () => {
    if (typeof window.saveDisc === 'function') {
      window.saveDisc();
    }
  },

  'save-habit': () => {
    if (typeof window.saveHabit === 'function') {
      window.saveHabit();
    }
  },

  'drive-action': () => {
    if (typeof window.driveAction === 'function') {
      window.driveAction();
    }
  },

  'disconnect-drive': () => {
    if (typeof window.disconnectDrive === 'function') {
      window.disconnectDrive();
    }
  },

  'prompt-prova': () => {
    if (typeof window.promptDataProva === 'function') {
      window.promptDataProva();
    }
  },

  'prompt-metas': () => {
    if (typeof window.promptMetas === 'function') {
      window.promptMetas();
    }
  },

  'remover-planejamento': () => {
    if (typeof window.deletePlanejamento === 'function') {
      window.deletePlanejamento();
    }
  },

  'toggle-ciclo-fin': (el) => {
    if (typeof window.toggleCicloFin === 'function') {
      window.toggleCicloFin(el.checked);
    }
  },

  'edit-session-record': (el) => {
    const sessionId = el.dataset.sessionId;
    if (sessionId && typeof window.openRegistroSessao === 'function') {
      window.openRegistroSessao(sessionId);
    }
  },

  'delete-session-record': (el) => {
    const sessionId = el.dataset.sessionId;
    if (sessionId && typeof window.deleteCompletedSession === 'function') {
      window.deleteCompletedSession(sessionId);
    }
  },

  // ============================================
  // REGISTRO DE SESSÃO
  // ============================================

  'toggle-study-type': (el) => {
    const typeId = el.dataset.typeId || el.dataset.tipo;
    if (typeId && typeof window.toggleStudyType === 'function') {
      window.toggleStudyType(typeId);
    }
  },

  'toggle-material': (el) => {
    const materialId = el.dataset.materialId || el.dataset.mat;
    if (materialId && typeof window.toggleMaterial === 'function') {
      window.toggleMaterial(materialId);
    }
  },

  'on-disciplina-change': () => {
    if (typeof window.onDisciplinaChange === 'function') {
      window.onDisciplinaChange();
    }
  },

  'on-aula-change': () => {
    if (typeof window.onAulaChange === 'function') {
      window.onAulaChange();
    }
  },

  'add-novo-topico': () => {
    if (typeof window.addNovoTopico === 'function') {
      window.addNovoTopico();
    }
  },

  'validate-questoes': (el) => {
    if (typeof window.validateQuestoes === 'function') {
      window.validateQuestoes();
    }
  },

  'set-pagina-mode': (el) => {
    const mode = el.dataset.mode;
    if (mode && typeof window.setPaginaMode === 'function') {
      window.setPaginaMode(mode);
    }
  },

  'delete-completed-session': (el) => {
    const sessionId = el.dataset.sessionId;
    if (sessionId && typeof window.deleteCompletedSession === 'function') {
      window.deleteCompletedSession(sessionId);
    }
  },

  'voltar-past-session-ui': (el) => {
    const eventId = el.dataset.eventId;
    const discId = el.dataset.discId;
    if (typeof window.voltarPastSessionUI === 'function') {
      window.voltarPastSessionUI(eventId, discId);
    }
  },

  'discard-timer-ui': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.discardTimerUI === 'function') {
      window.discardTimerUI(eventId);
    }
  },

  'cancel-registro': () => {
    if (typeof window.cancelRegistro === 'function') {
      window.cancelRegistro();
    }
  },

  'save-and-start-new': () => {
    if (typeof window.saveAndStartNew === 'function') {
      window.saveAndStartNew();
    }
  },

  'save-registro-sessao': () => {
    if (typeof window.saveRegistroSessao === 'function') {
      window.saveRegistroSessao();
    }
  },

  // ============================================
  // PLANEJAMENTO WIZARD
  // ============================================

  'pw-select-tipo': (el) => {
    const tipo = el.dataset.tipo;
    if (tipo && typeof window.pwSelectTipo === 'function') {
      window.pwSelectTipo(tipo);
    }
  },

  'pw-select-all-disc': () => {
    if (typeof window.pwSelectAllDisc === 'function') {
      window.pwSelectAllDisc();
    }
  },

  'pw-clear-disc': () => {
    if (typeof window.pwClearDisc === 'function') {
      window.pwClearDisc();
    }
  },

  'pw-toggle-disc': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.pwToggleDisc === 'function') {
      window.pwToggleDisc(discId);
    }
  },

  'pw-update-relevancia': (el) => {
    const discId = el.dataset.discId;
    const type = el.dataset.type;
    const value = el.value;
    if (discId && type && typeof window.pwUpdateRel === 'function') {
      window.pwUpdateRel(discId, type, value);
    }
  },

  'pw-update-hours': (el) => {
    const field = el.dataset.field;
    const value = el.value;
    if (field && typeof window.pwUpdateHours === 'function') {
      window.pwUpdateHours(field, value);
    }
  },

  'pw-toggle-day': (el) => {
    const dayIndex = el.dataset.dayIndex;
    if (dayIndex && typeof window.pwToggleDay === 'function') {
      window.pwToggleDay(parseInt(dayIndex, 10));
    }
  },

  'pw-update-day-hour': (el) => {
    const dayIndex = el.dataset.dayIndex;
    const value = el.value;
    if (dayIndex && typeof window.pwUpdateDayHour === 'function') {
      window.pwUpdateDayHour(parseInt(dayIndex, 10), value);
    }
  },

  // ============================================
  // VERTICAL / EDITAL DASHBOARD
  // ============================================

  'vert-search': (el) => {
    if (typeof window.onVertSearch === 'function') {
      window.onVertSearch(el.value);
    }
  },

  'set-vert-filter-edital': (el) => {
    const editalId = el.value;
    if (typeof window.setVertFilterEdital === 'function') {
      window.setVertFilterEdital(editalId);
    }
  },

  'set-vert-filter-status': (el) => {
    const status = el.dataset.status;
    if (status && typeof window.setVertFilterStatus === 'function') {
      window.setVertFilterStatus(status);
    }
  },

  'toggle-vert-disc': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.toggleVertDisc === 'function') {
      window.toggleVertDisc(discId);
    }
  },

  'add-novo-topico-vertical': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.addNovoTopicoVertical === 'function') {
      window.addNovoTopicoVertical(editalId, discId);
    }
  },

  'open-disc-manager': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.openDiscManager === 'function') {
      window.openDiscManager(editalId, discId);
    }
  },

  'toggle-assunto': (el) => {
    const discId = el.dataset.discId;
    const assuntoId = el.dataset.assuntoId;
    if (discId && assuntoId && typeof window.toggleAssunto === 'function') {
      window.toggleAssunto(discId, assuntoId);
    }
  },

  'toggle-edital': (el) => {
    const editalId = el.dataset.editalId;
    if (editalId && typeof window.toggleEdital === 'function') {
      window.toggleEdital(editalId);
    }
  },

  'navigate-with-ctx': (el) => {
    const view = el.dataset.view;
    const ctx = el.dataset.ctx;
    if (view && typeof window.navigate === 'function') {
      if (ctx) {
        window.activeDashboardDiscCtx = JSON.parse(decodeURIComponent(ctx));
      }
      window.navigate(view);
    }
  },

  'delete-edital': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    if (editalId && typeof window.deleteEdital === 'function') {
      window.showConfirm('Tem certeza que deseja excluir este edital?', () => {
        window.deleteEdital(editalId);
      });
    }
  },

  'open-disc-modal': (el) => {
    const editalId = el.dataset.editalId;
    if (editalId && typeof window.openDiscModal === 'function') {
      window.openDiscModal(editalId);
    }
  },

  'open-disc-dashboard': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.openDiscDashboard === 'function') {
      window.openDiscDashboard(editalId, discId);
    }
  },

  'delete-disc': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.deleteDisc === 'function') {
      window.showConfirm('Tem certeza que deseja excluir esta disciplina?', () => {
        window.deleteDisc(editalId, discId);
      });
    }
  },

  'switch-dashboard-tab': (el) => {
    const tab = el.dataset.tab;
    if (tab && typeof window.switchDashboardTab === 'function') {
      window.switchDashboardTab(tab);
    }
  },

  'open-registro-sessao': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.openRegistroSessao === 'function') {
      window.openRegistroSessao(discId);
    }
  },

  'open-add-past-session': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.openAddPastSessionModal === 'function') {
      window.openAddPastSessionModal(discId);
    }
  },

  'add-evento-para-assunto': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    const assuntoId = el.dataset.assuntoId;
    if (editalId && discId && assuntoId && typeof window.addEventoParaAssunto === 'function') {
      window.addEventoParaAssunto(editalId, discId, assuntoId);
    }
  },

  'toggle-aula-dashboard': (el, event) => {
    if (event) event.stopPropagation();
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    const aulaId = el.dataset.aulaId;
    if (editalId && discId && aulaId && typeof window.toggleAulaDashboard === 'function') {
      window.toggleAulaDashboard(editalId, discId, aulaId);
    }
  },

  'select-color': (el) => {
    const color = el.dataset.color;
    const container = el.dataset.container;
    if (color && container && typeof window.selectColor === 'function') {
      window.selectColor(color, container);
    }
  },

  'save-edital': (el) => {
    const editalId = el.dataset.editalId;
    if (typeof window.saveEdital === 'function') {
      window.saveEdital(editalId);
    }
  },

  'select-icon': (el) => {
    const icon = el.dataset.icon;
    if (icon && typeof window.selectIcon === 'function') {
      window.selectIcon(icon, el);
    }
  },

  'select-disc-color': (el) => {
    const color = el.dataset.color;
    if (color && typeof window.selectDiscColor === 'function') {
      window.selectDiscColor(color);
    }
  },

  'edit-subject-inline': (el) => {
    const discId = el.dataset.discId;
    const assuntoId = el.dataset.assuntoId;
    if (discId && assuntoId && typeof window.editSubjectInline === 'function') {
      window.editSubjectInline(discId, assuntoId, el);
    }
  },

  'move-subject': (el) => {
    const discId = el.dataset.discId;
    const idx = parseInt(el.dataset.idx, 10);
    const dir = parseInt(el.dataset.dir, 10);
    if (discId && typeof window.moveSubject === 'function') {
      window.moveSubject(discId, idx, dir);
    }
  },

  'delete-assunto': (el, event) => {
    if (event) event.stopPropagation();
    const discId = el.dataset.discId;
    const assuntoId = el.dataset.assuntoId;
    if (discId && assuntoId && typeof window.deleteAssunto === 'function') {
      window.deleteAssunto(discId, assuntoId);
    }
  },

  'edit-lesson-inline': (el) => {
    const discId = el.dataset.discId;
    const aulaId = el.dataset.aulaId;
    if (discId && aulaId && typeof window.editLessonInline === 'function') {
      window.editLessonInline(discId, aulaId, el);
    }
  },

  'toggle-aula-estudada': (el, event) => {
    if (event) event.stopPropagation();
    const discId = el.dataset.discId;
    const aulaId = el.dataset.aulaId;
    if (discId && aulaId && typeof window.toggleAulaEstudada === 'function') {
      window.toggleAulaEstudada(discId, aulaId);
    }
  },

  'delete-aula': (el, event) => {
    if (event) event.stopPropagation();
    const discId = el.dataset.discId;
    const aulaId = el.dataset.aulaId;
    if (discId && aulaId && typeof window.deleteAula === 'function') {
      window.deleteAula(discId, aulaId);
    }
  },

  'add-assunto': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.addAssunto === 'function') {
      window.addAssunto(discId);
    }
  },

  'add-bulk-aulas': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.addBulkAulas === 'function') {
      window.addBulkAulas(discId);
    }
  },

  'run-lesson-mapper': (el) => {
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.runLessonMapperUI === 'function') {
      window.runLessonMapperUI(editalId, discId);
    }
  },

  'save-disc-manager': (el) => {
    const editalId = el.dataset.editalId;
    const discId = el.dataset.discId;
    if (editalId && discId && typeof window.saveDiscManager === 'function') {
      window.saveDiscManager(editalId, discId);
    }
  },

  'switch-manager-tab': (el) => {
    const tab = el.dataset.tab;
    if (tab && typeof window.switchManagerTab === 'function') {
      window.switchManagerTab(tab);
    }
  },

  'carregar-analise-banca': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.carregarAnaliseBanca === 'function') {
      window.carregarAnaliseBanca(discId);
    }
  },

  'excluir-analise-banca': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.excluirAnaliseBanca === 'function') {
      window.excluirAnaliseBanca(discId);
    }
  },

  'sync-color-to-picker': (el) => {
    // Sync select color change to color picker input
    const picker = document.getElementById('dm-cor-picker');
    if (picker) {
      picker.value = el.value;
    }
  },

  'mudar-edital-analisador': (el) => {
    const editalId = el.value;
    if (editalId && typeof window.mudarEditalAnalisador === 'function') {
      window.mudarEditalAnalisador(editalId);
    }
  },

  'filtrar-dropdown-banca': (el) => {
    const value = el.value;
    if (typeof window.filtrarDropdownBanca === 'function') {
      window.filtrarDropdownBanca(value);
    }
  },

  'filtrar-view-por-disciplina': (el) => {
    const discId = el.value;
    if (discId && typeof window.filtrarViewPorDisciplina === 'function') {
      window.filtrarViewPorDisciplina(discId);
    }
  },

  'parse-banca-text': () => {
    if (typeof window.parseBancaText === 'function') {
      window.parseBancaText();
    }
  },

  'apply-banca-ranking': () => {
    if (typeof window.applyBancaRanking === 'function') {
      window.applyBancaRanking();
    }
  },

  'load-assuntos': () => {
    if (typeof window.loadAssuntos === 'function') {
      window.loadAssuntos();
    }
  },

  'update-day-load': (el) => {
    if (typeof window.updateDayLoad === 'function') {
      window.updateDayLoad(el.value);
    }
  },

  'save-event': () => {
    if (typeof window.saveEvent === 'function') {
      window.saveEvent();
    }
  },

  'save-past-event': (el) => {
    const discId = el.dataset.discId;
    if (discId && typeof window.savePastEvent === 'function') {
      window.savePastEvent(discId);
    }
  },

  'open-match-corrector': (el) => {
    const assuntoNome = el.dataset.assuntoNome;
    if (assuntoNome && typeof window.openMatchCorrector === 'function') {
      window.openMatchCorrector(assuntoNome);
    }
  },

  'save-match-correction': (el) => {
    const assuntoNome = el.dataset.assuntoNome;
    if (assuntoNome && typeof window.saveMatchCorrection === 'function') {
      window.saveMatchCorrection(assuntoNome);
    }
  },

  'save-bulk-subjects': () => {
    if (typeof window.saveBulkSubjects === 'function') {
      window.saveBulkSubjects();
    }
  },

  'stop-propagation': () => {
    // The dispatcher already stops propagation; this action is used for inert action areas.
  },

  'pw-search-disc': (el) => {
    if (typeof window.pwSearchDisc === 'function') {
      window.pwSearchDisc(el.value);
    }
  },

  'set-theme': (el) => {
    if (typeof window.setTheme === 'function') {
      window.setTheme(el.value);
    }
  },

  'update-config': (el) => {
    const key = el.dataset.configKey;
    if (!key || typeof window.updateConfig !== 'function') return;

    let value = el.value;
    if (el.dataset.valueType === 'number') {
      value = parseInt(value, 10);
    } else if (el.dataset.valueTransform === 'trim-url') {
      value = value.trim().replace(/\/$/, '');
    } else if (el.dataset.valueTransform === 'trim') {
      value = value.trim();
    }

    window.updateConfig(key, value);
  },

  'toggle-config': (el) => {
    const key = el.dataset.configKey;
    if (!key || typeof window.toggleConfig !== 'function') return;

    window.toggleConfig(key, el);
    el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
  },

  'update-frequencia': (el) => {
    if (typeof window.updateFrequencia === 'function') {
      window.updateFrequencia(el.value);
    }
  },

  'toggle-password-visibility': (el) => {
    const input = document.getElementById(el.dataset.targetId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  },

  'toggle-cf-sync': (el) => {
    if (typeof window.toggleCfSync === 'function') {
      window.toggleCfSync(el.checked);
    }
  },

  'force-cloudflare-sync': () => {
    if (typeof window.forceCloudflareSync === 'function') {
      window.forceCloudflareSync();
    }
  },

  'cloud-conflict-export-local': () => {
    if (typeof window.exportData === 'function') {
      window.exportData();
    }
  },

  'cloud-conflict-pull-remote': () => {
    if (typeof window.showConfirm !== 'function' || typeof window.pullFromCloudflare !== 'function') return;
    window.showConfirm(
      'Baixar os dados remotos agora? Isso substituirá os dados locais. Exporte um backup local antes se tiver dúvida.',
      () => window.pullFromCloudflare(true),
      { label: 'Baixar remoto', title: 'Resolver conflito de sync' }
    );
  },

  'cloud-conflict-force-push': () => {
    if (typeof window.showConfirm !== 'function' || typeof window.pushToCloudflare !== 'function') return;
    window.showConfirm(
      'Forçar envio local para a nuvem? Isso sobrescreverá a versão remota mais recente.',
      () => window.pushToCloudflare(true),
      { label: 'Forçar envio', title: 'Sobrescrever remoto', danger: true }
    );
  },

  'drive-sync-now': () => {
    if (typeof window.syncWithDrive === 'function') {
      window.syncWithDrive()
        .then(() => window.showToast?.('Sincronizado!', 'success'))
        .catch(() => window.showToast?.('Erro ao sincronizar', 'error'));
    }
  },

  'pull-from-drive': () => {
    if (typeof window.pullFromDrive === 'function') {
      window.pullFromDrive();
    }
  },

  'drive-disconnect': () => {
    if (typeof window.driveDisconnect === 'function') {
      window.driveDisconnect();
    }
  },

  'open-drive-modal': () => {
    if (typeof window.openDriveModal === 'function') {
      window.openDriveModal();
    }
  },

  'request-notification-permission': () => {
    if (!('Notification' in window)) return;
    Notification.requestPermission()
      .then(permission => {
        if (permission === 'granted') {
          window.showToast?.('Notificações ativadas!', 'success');
        }
        window.renderCurrentView?.();
      })
      .catch(error => console.warn(error));
  },

  'test-notification': () => {
    if ('Notification' in window) {
      new Notification('Estudo Organizado', { body: 'Notificações funcionando!', icon: '📚' });
      window.showToast?.('Lembretes enviados!', 'success');
    }
  },

  'export-data': () => {
    if (typeof window.exportData === 'function') {
      window.exportData();
    }
  },

  'restore-backup': () => {
    if (typeof window.restoreBackupFromSelectedSource === 'function') {
      window.restoreBackupFromSelectedSource();
    }
  },

  'archive-old-events': (el) => {
    const days = parseInt(el.dataset.days || '90', 10);
    if (typeof window.archiveOldEvents === 'function') {
      window.archiveOldEvents(days);
    }
  },

  'clear-all-data': () => {
    if (typeof window.clearAllData === 'function') {
      window.clearAllData();
    }
  },

  'open-search-event': (el) => {
    const eventId = el.dataset.eventId;
    if (eventId && typeof window.openEventDetail === 'function') {
      window.openEventDetail(eventId);
      window.clearSearch?.();
    }
  },

  'navigate-clear-search': (el) => {
    const view = el.dataset.view;
    if (view && typeof window.navigate === 'function') {
      window.navigate(view);
      window.clearSearch?.();
    }
  },

  'update-seq-item': (el) => {
    const index = el.dataset.index;
    const field = el.dataset.field;
    if (index !== undefined && field && typeof window.updateSeqItem === 'function') {
      window.updateSeqItem(index, field, el.value);
    }
  },

  'dup-seq-item': (el) => {
    if (typeof window.dupSeqItem === 'function') {
      window.dupSeqItem(el.dataset.index);
    }
  },

  'rem-seq-item': (el) => {
    if (typeof window.remSeqItem === 'function') {
      window.remSeqItem(el.dataset.index);
    }
  },

  'move-seq-item': (el) => {
    if (typeof window.moveSeqItem === 'function') {
      window.moveSeqItem(el.dataset.index, parseInt(el.dataset.dir, 10));
    }
  },

  'open-ciclo-history': (el) => {
    const seqId = el.dataset.seqId;
    if (seqId && typeof window.openCicloHistory === 'function') {
      window.openCicloHistory(seqId);
    }
  },

  'iniciar-etapa-planejamento': (el) => {
    const seqId = el.dataset.seqId;
    if (seqId && typeof window.iniciarEtapaPlanejamento === 'function') {
      window.iniciarEtapaPlanejamento(seqId);
    }
  },

  'add-seq-item': () => {
    if (typeof window.addSeqItem === 'function') {
      window.addSeqItem();
    }
  },

  'cancel-edit-seq': () => {
    if (typeof window.cancelEditSeq === 'function') {
      window.cancelEditSeq();
    }
  },

  'save-edit-seq': () => {
    if (typeof window.saveEditSeq === 'function') {
      window.saveEditSeq();
    }
  },

  'recomecar-ciclo': () => {
    if (typeof window.recomecarCiclo === 'function') {
      window.recomecarCiclo();
    }
  },

  'toggle-edit-seq': () => {
    if (typeof window.toggleEditSeq === 'function') {
      window.toggleEditSeq();
    }
  },

  'zerar-ciclos-counter': () => {
    if (typeof window.zerarCiclosCounter === 'function') {
      window.zerarCiclosCounter();
    }
  },

  'calculate-cycle-predictions': () => {
    if (typeof window.calculateCyclePredictions === 'function') {
      window.calculateCyclePredictions();
    }
  },

  'move-ciclo-seq': (el) => {
    if (typeof window.moveCicloSeq === 'function') {
      window.moveCicloSeq(parseInt(el.dataset.index, 10), parseInt(el.dataset.dir, 10));
    }
  },

  'edit-ciclo-seq-hours': (el) => {
    if (typeof window.editCicloSeqHours === 'function') {
      window.editCicloSeqHours(parseInt(el.dataset.index, 10));
    }
  },

  'desfazer-etapa': (el) => {
    const seqId = el.dataset.seqId;
    if (seqId && typeof window.desfazerEtapa === 'function') {
      window.desfazerEtapa(seqId);
    }
  },

  'open-event-from-ciclo-history': (el) => {
    const eventId = el.dataset.eventId;
    if (typeof window.closeModal === 'function') {
      window.closeModal('modal-ciclo-history');
    }
    if (eventId && typeof window.openEventDetail === 'function') {
      window.openEventDetail(eventId);
    }
  }
};

/**
 * Setup global click/event delegation
 * Deve ser chamado uma vez na inicialização do app
 */
export function setupActionDispatcher() {
  // Click handler principal
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(target, event);
    } else {
      console.warn(`[actions.js] Action "${actionName}" not found`);
    }
  });

  // Change handler para selects e inputs
  document.addEventListener('change', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      event.preventDefault();
      event.stopPropagation();
      handler(target, event);
    }
  });

  // Input handler para search
  document.addEventListener('input', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const actionName = target.dataset.action;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  // Focus/blur handlers
  document.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-focus-action]');
    if (!target) return;

    const actionName = target.dataset.focusAction;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  document.addEventListener('focusout', (event) => {
    const target = event.target.closest('[data-blur-action]');
    if (!target) return;

    const actionName = target.dataset.blurAction;
    const handler = actions[actionName];

    if (handler) {
      handler(target, event);
    }
  });

  console.log('[actions.js] Dispatcher initialized');
}

/**
 * Register a new action handler
 * @param {string} name - Action name (matches data-action attribute)
 * @param {Function} handler - Handler function receiving (element, event)
 */
export function registerAction(name, handler) {
  actions[name] = handler;
}

export default actions;

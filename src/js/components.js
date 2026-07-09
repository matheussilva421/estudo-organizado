import { currentView } from './app.js?v=8.37';
import {
  formatDate,
  formatTime,
  getEventStatus,
  todayStr,
  esc,
  getHabitType,
} from './utils.js?v=8.37';
import {
  renderConfig,
  renderDashboard,
  renderEditais,
  renderEditaisAnteriores,
  renderHabitos,
  renderHistoricoSessoes,
  renderHome,
  renderMED,
  renderRevisoes,
  renderVertical,
  renderCiclo,
  renderBancaAnalyzerModule,
  renderPontosFracos,
  destroyDashboardCharts,
  renderSkeletonLoader,
} from './views.js?v=8.37';
import { renderCalendar } from './views/calendar-view.js?v=8.37';
import { state } from './store.js?v=8.37';
import {
  getDisc,
  getElapsedSeconds,
  getPendingRevisoes,
  isTimerActive,
  _pomodoroMode,
} from './logic.js?v=8.37';
import { getActiveDashboardDiscCtx } from './state/dashboard-context.js?v=8.37';
import {
  filterEventsBySelectedEdital,
  getFilteredActiveDisciplinas,
} from './edital-filter.js?v=8.37';
import {
  getDiscChartInstance,
  setDiscChartInstance,
  getPlanjChartInstance,
  setPlanjChartInstance,
} from './state/chart-state.js?v=8.37';

export { getDiscChartInstance, setDiscChartInstance, getPlanjChartInstance, setPlanjChartInstance };

// Module-level state
let _cronoInterval = null;
export function getCronoInterval() {
  return _cronoInterval;
}
export function setCronoInterval(val) {
  _cronoInterval = val;
}

// =============================================
// DOM COMPONENTS AND RENDERERS
// =============================================

/**
 * Renderiza tela de cronômetro com timer em tempo real
 * @param {HTMLElement} el - Container da view
 */
export function renderCronometro(el) {
  let allTimerEvents = filterEventsBySelectedEdital(state.eventos || [], {
    allowAll: false,
    includeUndisciplinedActive: true,
  }).filter(
    (e) =>
      e._timerStart || (!e._timerStart && (e.tempoAcumulado || 0) > 0 && e.status !== 'estudei')
  );

  const isLivreActiveOrPaused =
    state.cronoLivre && (state.cronoLivre._timerStart || state.cronoLivre.tempoAcumulado > 0);

  if (allTimerEvents.length === 0 || isLivreActiveOrPaused) {
    const cronoLivreMock = {
      id: 'crono_livre',
      titulo: 'Sessão Livre',
      discId: state.cronoLivre?.discId || null,
      assId: state.cronoLivre?.assId || null,
      duracaoMinutos: state.cronoLivre?.duracaoMinutos || 0,
      tempoAcumulado: state.cronoLivre?.tempoAcumulado || 0,
      _timerStart: state.cronoLivre?._timerStart || null,
    };
    // Criar novo array ao invés de mutar com unshift/push
    if (isLivreActiveOrPaused) allTimerEvents = [cronoLivreMock, ...allTimerEvents];
    else if (allTimerEvents.length === 0) allTimerEvents = [cronoLivreMock];
  }

  const focusEvent = allTimerEvents.find((e) => e._timerStart) || allTimerEvents[0];
  const discEntry = focusEvent?.discId ? getDisc(focusEvent.discId) : null;
  const discName = discEntry
    ? discEntry.disc.nome
    : focusEvent.id === 'crono_livre'
      ? 'Nenhuma'
      : 'Sem disciplina';
  let assName = focusEvent.titulo;
  if (discEntry && focusEvent.assId) {
    const achado = discEntry.disc.assuntos.find((a) => a.id === focusEvent.assId);
    if (achado) assName = achado.nome;
  }

  const elapsed = getElapsedSeconds(focusEvent);
  const isActive = !!focusEvent._timerStart;

  // Calculate progress (if event has planned time, default 1h30 (5400s) if not free session)
  const plannedSecs =
    focusEvent.duracaoMinutos || focusEvent.duracao
      ? (focusEvent.duracaoMinutos || focusEvent.duracao) * 60
      : focusEvent.id === 'crono_livre'
        ? 0
        : 5400;
  const progress = plannedSecs > 0 ? Math.min((elapsed / plannedSecs) * 100, 100) : 0;
  const truncateOptionLabel = (text, max = 64) => {
    const normalized = String(text || '').trim();
    return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
  };

  const otherEvents = allTimerEvents.filter((e) => e.id !== focusEvent.id);

  el.innerHTML = `
    <div class="crono-fullscreen">
      <!-- Subtle grid pattern -->
      <div class="crono-grid-overlay"></div>

      <!-- Header: studying indicator -->
      <div style="text-align:center;padding:clamp(8px,2.5vh,32px) 24px 0;position:relative;z-index:1;">
        <div class="crono-pill">
          Você está estudando:
        </div>
        ${
          focusEvent.id === 'crono_livre'
            ? `
        <div style="display:flex; flex-direction:column; align-items:center; gap:clamp(4px,1vh,8px); margin-top:clamp(4px,1.5vh,16px);">
          <select class="crono-select" data-action="set-crono-livre-disc" value="${state.cronoLivre?.discId || ''}">
            <option value="">(Opcional) Escolha a Disciplina...</option>
          ${getFilteredActiveDisciplinas({ allowAll: false })
              .map((d) => {
                const discLabel = `${d.disc.icone || '📖'} ${truncateOptionLabel(d.disc.nome, 42)}`;
                return `<option value="${d.disc.id}" title="${esc(d.disc.nome)}" ${state.cronoLivre?.discId === d.disc.id ? 'selected' : ''}>${esc(discLabel)}</option>`;
              })
              .join('')}
          </select>
          ${
            state.cronoLivre?.discId
              ? `
            <select class="crono-select" data-action="set-crono-livre-ass" value="${state.cronoLivre?.assId || ''}">
              <option value="">(Opcional) Tópico...</option>
              ${(() => {
                const d = getDisc(state.cronoLivre.discId);
                return d
                  ? d.disc.assuntos
                      .filter((a) => !a.concluido)
                      .map((a) => {
                        const assuntoLabel = truncateOptionLabel(a.nome, 72);
                        return `<option value="${a.id}" title="${esc(a.nome)}" ${state.cronoLivre?.assId === a.id ? 'selected' : ''}>${esc(assuntoLabel)}</option>`;
                      })
                      .join('')
                  : '';
              })()}
            </select>
          `
              : ''
          }
        </div>
        `
            : `
        <div style="color:var(--text-primary);font-size:20px;margin-top:clamp(4px,1.5vh,16px);font-weight:700;">
           ${discName}
        </div>
        <div style="
          color:var(--text-secondary);font-size:16px;margin-top:4px;
          max-width:600px;margin-left:auto;margin-right:auto;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">
          ${assName}
        </div>
        `
        }
      </div>

      <!-- "Hoje" chip — total time studied today -->
      ${(() => {
        const today = todayStr();
        const todaySecs = state.eventos
          .filter((e) => (e.dataEstudo || e.data) === today && e.status === 'estudei')
          .reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
        return todaySecs > 0
          ? `<div class="crono-today-chip" title="Tempo total estudado hoje">Hoje: ${formatTime(todaySecs)}</div>`
          : '';
      })()}

      <!-- TIMER DISPLAY w/ progress ring -->
      <div style="
        flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:clamp(4px,2vh,40px) 24px;position:relative;z-index:1;
      ">
        <div class="crono-ring-wrap">
          <svg class="crono-ring" viewBox="0 0 220 220" aria-hidden="true">
            <circle class="crono-ring-track" cx="110" cy="110" r="100"></circle>
            <circle id="crono-ring-progress" class="crono-ring-progress ${plannedSecs === 0 ? 'crono-ring-progress--idle' : ''}"
                    cx="110" cy="110" r="100"
                    stroke-dasharray="${(2 * Math.PI * 100).toFixed(2)}"
                    stroke-dashoffset="${((1 - progress / 100) * 2 * Math.PI * 100).toFixed(2)}"></circle>
          </svg>
          <div class="crono-ring-content">
            <div id="crono-main-timer" class="crono-timer-display ${isActive ? 'active' : ''}">
              ${formatTime(elapsed)}
            </div>
            ${
              plannedSecs > 0
                ? `<div id="crono-ring-meta" class="crono-ring-meta">/ ${formatTime(plannedSecs)}</div>`
                : ''
            }
          </div>
        </div>
        <!-- Hidden legacy progress bar element (id retained for compatibility) -->
        <div id="crono-progress-bar" style="display:none;width:${progress}%;"></div>

        <!-- Controls -->
        <div style="display:flex;gap:24px;margin-top:clamp(8px,2.5vh,40px);align-items:center;">
          <button data-action="toggle-timer" data-event-id="${focusEvent.id}"
                  class="crono-btn-main ${isActive ? 'pause' : 'play'}"
                  title="${isActive ? 'Pausar' : 'Retomar'}">
            ${isActive ? '⏸' : '▶'}
          </button>

          <button data-action="mark-studied" data-event-id="${focusEvent.id}"
                  class="crono-btn-circle success"
                  title="Finalizar e Salvar">
            <i class="fa fa-check"></i>
          </button>

          <button id="btn-discard-timer"
                  data-action="discard-timer" data-event-id="${focusEvent.id}"
                   class="crono-btn-circle danger"
                   style="display:${elapsed > 0 ? 'flex' : 'none'};"
                   title="Descartar Sessão">
            <i class="fa fa-trash"></i>
          </button>
        </div>

        <!-- Add time buttons / Goal Input -->
        <div style="margin-top:clamp(8px,2.5vh,40px);text-align:center;">
          ${
            focusEvent.id === 'crono_livre'
              ? `
          <div style="color:var(--text-secondary);font-size:12px;margin-bottom:clamp(2px,1vh,12px);letter-spacing:1px;">
            Definir Meta de Tempo (minutos):
          </div>
          <div style="display:flex;gap:12px;justify-content:center;align-items:center;">
            <button data-action="set-crono-livre-goal" data-value="-5" aria-label="Diminuir 5 minutos" class="btn-outline" style="min-width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">-</button>
            <input type="number"
                   data-action="set-crono-livre-goal"
                   value="${state.cronoLivre?.duracaoMinutos || 0}"
                   aria-label="Meta de tempo em minutos"
                   class="crono-select"
                   style="width:80px;">
            <button data-action="set-crono-livre-goal" data-value="+5" aria-label="Aumentar 5 minutos" class="btn-outline" style="min-width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">+</button>
          </div>
          `
              : `
          <div style="color:var(--text-secondary);font-size:12px;margin-bottom:clamp(2px,1vh,12px);letter-spacing:1px;">
            Adicione mais tempo se quiser continuar estudando:
          </div>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button data-action="add-minutes" data-event-id="${focusEvent.id}" data-minutes="1" class="btn btn-primary">+ 1min</button>
            <button data-action="add-minutes" data-event-id="${focusEvent.id}" data-minutes="5" class="btn btn-primary">+ 5min</button>
            <button data-action="add-minutes" data-event-id="${focusEvent.id}" data-minutes="15" class="btn btn-primary">+ 15min</button>
          </div>
          `
          }
        </div>
      </div>

      <!-- Mode toggle (Cronômetro / Timer) -->
      <div style="
        display:flex;justify-content:center;gap:4px;padding:0 0 clamp(6px,2vh,24px);position:relative;z-index:1;
      ">
        <button id="crono-mode-btn" data-action="toggle-timer-mode" style="
          padding:8px 20px;border-radius:var(--radius-loose);border:none;cursor:pointer;
          font-size:13px;font-weight:500;transition:background-color 0.3s, color 0.3s, border-color 0.3s;
          ${
            _pomodoroMode
              ? 'background:var(--accent-light);color:var(--accent-dark);'
              : 'background:var(--bg);color:var(--text-secondary);border:1px solid var(--border);'
          }
        ">
          ${_pomodoroMode ? `🍅 Pomodoro (${state?.config?.pomodoroFoco || 25}/${state?.config?.pomodoroPausa || 5})` : '⏱ Modo Contínuo'}
        </button>
      </div>

      ${
        otherEvents.length > 0
          ? `
        <!-- Other timers -->
        <div style="padding:0 32px clamp(6px,2vh,24px);position:relative;z-index:1;">
          <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px;">Outros cronômetros:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${otherEvents
              .map((ev) => {
                const evActive = !!ev._timerStart;
                const evDisc = getDisc(ev.discId);
                return `
                <button data-action="switch-to-event-timer" data-event-id="${ev.id}" data-view="cronometro" class="btn ${evActive ? 'btn-primary' : 'btn-ghost'}" style="
                   font-size:13px;font-weight:600;
                ">${evDisc ? evDisc.disc.nome : 'Evento'} ${evActive ? '⏱️' : '⏸️'}</button>
              `;
              })
              .join('')}
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Live update every second
  if (getCronoInterval()) clearInterval(getCronoInterval());
  setCronoInterval(
    setInterval(() => {
      const ev =
        focusEvent.id === 'crono_livre'
          ? state.cronoLivre
          : state.eventos.find((e) => e.id === focusEvent.id);
      if (!ev) {
        clearInterval(getCronoInterval());
        return;
      }
      const elapsed = getElapsedSeconds(ev);
      const timerEl = document.getElementById('crono-main-timer');
      if (timerEl) timerEl.textContent = formatTime(elapsed);
      const pct = plannedSecs > 0 ? Math.min((elapsed / plannedSecs) * 100, 100) : 0;
      const progressBar = document.getElementById('crono-progress-bar');
      if (progressBar) progressBar.style.width = pct + '%';
      const ring = document.getElementById('crono-ring-progress');
      if (ring) {
        const C = 2 * Math.PI * 100;
        ring.setAttribute('stroke-dashoffset', String(((1 - pct / 100) * C).toFixed(2)));
      }
      const btnDiscard = document.getElementById('btn-discard-timer');
      if (btnDiscard) {
        btnDiscard.style.display = elapsed > 0 ? 'flex' : 'none';
      }
    }, 1000)
  );
}

/**
 * Renderiza a view atual e faz cleanup de timers/charts
 */
export function renderCurrentView() {
  // Bug 7: clean up cronometro interval when switching views
  if (currentView !== 'cronometro' && getCronoInterval()) {
    clearInterval(getCronoInterval());
    setCronoInterval(null);
  }

  // Clean up disc dashboard chart when leaving editais OR when leaving disc context
  if ((currentView !== 'editais' || !getActiveDashboardDiscCtx()) && getDiscChartInstance()) {
    getDiscChartInstance().destroy();
    setDiscChartInstance(null);
  }

  // Clean up ciclo doughnut chart when leaving ciclo view
  if (currentView !== 'ciclo' && getPlanjChartInstance()) {
    getPlanjChartInstance().destroy();
    setPlanjChartInstance(null);
  }

  // Clean up analytics dashboard charts when leaving dashboard
  if (currentView !== 'dashboard') {
    destroyDashboardCharts();
  }

  const el = document.getElementById('main-content');
  if (!el) return;

  // Keep a consistent vertical spacing rhythm between top-level blocks per view.
  el.classList.toggle('main-content-stack', currentView !== 'cronometro');
  const titles = {
    home: 'Página Inicial',
    med: 'Study Organizer',
    calendar: 'Calendário',
    revisoes: 'Revisões Pendentes',
    habitos: 'Hábitos de Estudo',
    editais: 'Editais',
    'editais-anteriores': 'Editais Anteriores',
    vertical: 'Edital Verticalizado',
    config: 'Configurações',
    cronometro: 'Cronômetro',
    ciclo: 'Ciclo de Estudos',
    'banca-analyzer': 'Inteligência de Banca',
    'historico-sessoes': 'Histórico de Sessões',
    'pontos-fracos': 'Pontos Fracos',
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[currentView] || 'Estudo Organizado';

  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    dateEl.innerHTML =
      currentView === 'home'
        ? `<i class="fa fa-calendar-alt"></i> ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`
        : '';
  }

  // Render topbar actions
  const actions = document.getElementById('topbar-actions');
  if (actions) {
    actions.innerHTML = '';
    // Sem seletor de edital: o app foca sempre no edital principal. As barras de
    // ação só trazem os botões de cada tela.
    if (currentView === 'cronometro') {
      actions.innerHTML =
        '<button class="btn btn-ghost btn-sm" data-action="navigate" data-view="med"><i class="fa fa-arrow-left"></i> Voltar</button>';
    } else if (currentView === 'med' || currentView === 'calendar' || currentView === 'home') {
      actions.innerHTML =
        '<button class="btn btn-primary btn-sm" data-action="open-add-event"><i class="fa fa-plus"></i> Iniciar Estudo</button>';
    } else if (currentView === 'editais') {
      if (getActiveDashboardDiscCtx()) {
        actions.innerHTML =
          '<button class="btn btn-ghost btn-sm" data-action="close-disc-dashboard"><i class="fa fa-arrow-left"></i> Voltar</button>';
      } else {
        actions.innerHTML =
          '<button class="btn btn-primary btn-sm" data-action="open-edital-modal"><i class="fa fa-plus"></i> Novo Edital</button>';
      }
    } else if (currentView === 'ciclo') {
      actions.innerHTML =
        '<button class="btn btn-primary btn-sm" data-action="open-planejamento-wizard"><i class="fa fa-cog"></i> Planejamento</button>';
    }
  }

  updateBadges();

  // Show skeleton loader for heavy views, then render actual content
  const heavyViews = ['home', 'dashboard', 'editais', 'vertical', 'ciclo'];

  if (heavyViews.includes(currentView)) {
    // Show skeleton first for perceived performance
    el.innerHTML = renderSkeletonLoader();

    // Micro-delay to allow skeleton to render before heavy computation
    setTimeout(() => {
      if (currentView === 'home') renderHome(el);
      else if (currentView === 'dashboard') renderDashboard(el);
      else if (currentView === 'editais') {
        if (getActiveDashboardDiscCtx()) {
          const ctx = getActiveDashboardDiscCtx();
          import('./views.js?v=8.37').then(({ openDiscDashboard }) =>
            openDiscDashboard(ctx.editaId, ctx.discId)
          );
        } else {
          renderEditais(el);
        }
      } else if (currentView === 'vertical') renderVertical(el);
      else if (currentView === 'ciclo') renderCiclo(el);
    }, 50);
  } else {
    // Light views render immediately
    if (currentView === 'med') return renderMED(el);
    if (currentView === 'calendar') return renderCalendar(el);
    if (currentView === 'revisoes') return renderRevisoes(el);
    if (currentView === 'historico-sessoes') return renderHistoricoSessoes(el);
    if (currentView === 'editais-anteriores') return renderEditaisAnteriores(el);
    if (currentView === 'habitos') return renderHabitos(el);
    if (currentView === 'config') return renderConfig(el);
    if (currentView === 'cronometro') return renderCronometro(el);
    if (currentView === 'banca-analyzer') return renderBancaAnalyzerModule(el);
    if (currentView === 'pontos-fracos') return renderPontosFracos(el);
  }
}

/**
 * Atualiza badges do sidebar com contadores de timers e revisões
 */
export function updateBadges() {
  // Update cronometro badge
  const activeTimers = state.eventos.filter((e) => e._timerStart);
  const cronoBadge = document.getElementById('badge-crono');
  if (cronoBadge) {
    cronoBadge.style.display = activeTimers.length > 0 ? 'inline-block' : 'none';
    cronoBadge.textContent = activeTimers.length;
  }

  const med = document.getElementById('badge-med');
  const rev = document.getElementById('badge-rev');
  if (!med || !rev) return;
  const pendingMed = filterEventsBySelectedEdital(state.eventos || [], { allowAll: false }).filter(
    (e) => e.data === todayStr() && e.status !== 'estudei'
  ).length;
  med.style.display = pendingMed > 0 ? 'inline-block' : 'none';
  med.textContent = pendingMed;
  const pendingRev = getPendingRevisoes().length;
  rev.style.display = pendingRev > 0 ? 'inline-block' : 'none';
  rev.textContent = pendingRev;
}

// =============================================
// EVENT CARD RENDERER
// =============================================

/**
 * Renderiza card de evento para exibição
 * @param {Object} evento - Dados do evento
 * @returns {string} HTML do card
 */
export function renderEventCard(evento) {
  const status = getEventStatus(evento);
  const discInfo = evento.discId ? getDisc(evento.discId) : null;
  const disc = discInfo ? discInfo.disc : null;
  const iconBg = disc
    ? disc.cor || 'var(--accent)'
    : getHabitType(evento.habito)?.color || '#64748b';
  const icon = disc ? disc.icone || '📖' : getHabitType(evento.habito)?.icon || '📚';
  const timerActive = isTimerActive(evento.id);
  const elapsed = getElapsedSeconds(evento);
  const tempo = formatTime(elapsed);

  return `
    <div class="event-card" data-event-id="${evento.id}" data-action="open-event-detail" role="button" tabindex="0" aria-label="Abrir detalhes de ${esc(evento.titulo || 'Evento')}">
      <div class="event-stripe ${status}"></div>
      <div class="event-disc-icon" style="background:${iconBg}20;color:${iconBg};">${icon}</div>
      <div class="event-info">
        <div class="event-title">${esc(evento.titulo || 'Evento')}</div>
        <div class="event-sub">${evento.data ? formatDate(evento.data) : 'Sem data'}${disc ? ' • ' + esc(disc.nome) : ''}</div>
        <div class="event-meta">
          <span class="event-tag ${status}">${status === 'estudei' ? 'Estudei' : status === 'atrasado' ? 'Atrasado' : 'Agendado'}</span>
          ${elapsed > 0 ? `<span style="font-size:11px;color:var(--text-muted);font-family:'DM Mono',monospace;" data-timer="${evento.id}">${tempo}</span>` : ''}
          ${timerActive ? '<span style="font-size:11px;color:var(--accent);font-weight:600;animation:pulse 1s infinite;">● Cronômetro ativo</span>' : ''}
        </div>
      </div>
      <div class="event-actions" data-action="stop-propagation">
        ${status !== 'estudei' ? `<button class="icon-btn ${timerActive ? 'active' : ''}" data-action="toggle-timer" data-event-id="${evento.id}" title="${timerActive ? 'Pausar' : 'Iniciar'} cronômetro" aria-label="${timerActive ? 'Pausar' : 'Iniciar'} cronômetro">${timerActive ? '⏸' : '▶'}</button>` : ''}
        ${status !== 'estudei' ? `<button class="icon-btn" data-action="mark-studied" data-event-id="${evento.id}" title="Marcar como Estudei" aria-label="Marcar como Estudei">✅</button>` : ''}
        <button class="icon-btn" data-action="delete-event" data-event-id="${evento.id}" title="Excluir" aria-label="Excluir evento">🗑</button>
      </div>
    </div>
    `;
}

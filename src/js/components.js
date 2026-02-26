import { currentView } from './app.js';
import { formatDate, formatTime, getEventStatus, todayStr, esc, HABIT_TYPES, getHabitType } from './utils.js';
import { openAddEventModal, openEditaModal, renderCalendar, renderConfig, renderDashboard, renderEditais, renderHabitos, renderHome, renderMED, renderRevisoes, renderVertical, renderCiclo } from './views.js';
import { state } from './store.js';
import { deleteEvento, getAllDisciplinas, getDisc, getElapsedSeconds, getPendingRevisoes, isTimerActive, marcarEstudei, toggleTimer, discardTimer, toggleTimerMode, _pomodoroMode } from './logic.js';

// =============================================
// DOM COMPONENTS AND RENDERERS
// =============================================


export function renderCronometro(el) {
  let allTimerEvents = [
    ...state.eventos.filter(e => e._timerStart),
    ...state.eventos.filter(e => !e._timerStart && (e.tempoAcumulado || 0) > 0 && e.status !== 'estudei')
  ];

  const isLivreActiveOrPaused = state.cronoLivre && (state.cronoLivre._timerStart || state.cronoLivre.tempoAcumulado > 0);

  if (allTimerEvents.length === 0 || isLivreActiveOrPaused) {
    const cronoLivreMock = {
      id: 'crono_livre',
      titulo: 'Sessão Livre',
      discId: state.cronoLivre?.discId || null,
      assId: state.cronoLivre?.assId || null,
      duracaoMinutos: state.cronoLivre?.duracaoMinutos || 0,
      tempoAcumulado: state.cronoLivre?.tempoAcumulado || 0,
      _timerStart: state.cronoLivre?._timerStart || null
    };
    if (isLivreActiveOrPaused) allTimerEvents.unshift(cronoLivreMock);
    else if (allTimerEvents.length === 0) allTimerEvents.push(cronoLivreMock);
  }

  const focusEvent = allTimerEvents.find(e => e._timerStart) || allTimerEvents[0];
  const discEntry = focusEvent?.discId ? getDisc(focusEvent.discId) : null;
  const discName = discEntry ? discEntry.disc.nome : (focusEvent.id === 'crono_livre' ? 'Nenhuma' : 'Sem disciplina');
  let assName = focusEvent.titulo;
  if (discEntry && focusEvent.assId) {
    const achado = discEntry.disc.assuntos.find(a => a.id === focusEvent.assId);
    if (achado) assName = achado.nome;
  }

  const elapsed = getElapsedSeconds(focusEvent);
  const isActive = !!focusEvent._timerStart;

  // Calculate progress (if event has planned time, default 1h30 (5400s) if not free session)
  const plannedSecs = (focusEvent.duracaoMinutos || focusEvent.duracao) ? (focusEvent.duracaoMinutos || focusEvent.duracao) * 60 : (focusEvent.id === 'crono_livre' ? 0 : 5400);
  const progress = plannedSecs > 0 ? Math.min((elapsed / plannedSecs) * 100, 100) : 0;

  const otherEvents = allTimerEvents.filter(e => e.id !== focusEvent.id);

  el.innerHTML = `
    <div class="crono-fullscreen" style="
      min-height:calc(100vh - 80px);
      background:linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%);
      border-radius:16px;margin:-24px;padding:0;
      display:flex;flex-direction:column;
      position:relative;overflow:hidden;
    ">
      <!-- Subtle grid pattern -->
      <div style="
        position:absolute;inset:0;
        background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
        background-size:24px 24px;pointer-events:none;
      "></div>

      <!-- Header: studying indicator -->
      <div style="text-align:center;padding:32px 24px 0;position:relative;z-index:1;">
        <div style="
          display:inline-block;padding:8px 24px;border-radius:24px;
          background:rgba(255,255,255,0.06);backdrop-filter:blur(8px);
          color:#8b949e;font-size:13px;letter-spacing:1px;
        ">
          Você está estudando:
        </div>
        ${focusEvent.id === 'crono_livre' ? `
        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; margin-top:16px;">
          <select style="max-width:300px; background:rgba(255,255,255,0.05); color:#e6edf3; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px; font-size:16px; width:100%; text-align:center; appearance:none; cursor:pointer;" onchange="setCronoLivreDisc(this.value)">
            <option value="">(Opcional) Escolha a Disciplina...</option>
            ${getAllDisciplinas().map(d => `<option value="${d.disc.id}" ${state.cronoLivre?.discId === d.disc.id ? 'selected' : ''}>${d.disc.icone || '📖'} ${esc(d.disc.nome)}</option>`).join('')}
          </select>
        </div>
        ` : `
        <div style="color:#e6edf3;font-size:20px;margin-top:16px;font-weight:700;">
           ${discName}
        </div>
        <div style="
          color:#8b949e;font-size:16px;margin-top:4px;
          max-width:600px;margin-left:auto;margin-right:auto;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">
          ${assName}
        </div>
        `}
      </div>

      <!-- Progress bar -->
      <div style="padding:24px 48px 0;position:relative;z-index:1; ${plannedSecs === 0 ? 'opacity:0;' : ''}">
        <div style="
          display:flex;justify-content:space-between;
          color:#8b949e;font-size:12px;margin-bottom:6px;
        ">
          <span>${formatTime(elapsed)}</span>
          <span>${formatTime(plannedSecs)}</span>
        </div>
        <div style="
          height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;
        ">
          <div id="crono-progress-bar" style="
            height:100%;border-radius:4px;transition:width 1s linear;
            width:${progress}%;
            background:linear-gradient(90deg, #238636, #39d353, #56d364);
          "></div>
        </div>
      </div>

      <!-- TIMER DISPLAY -->
      <div style="
        flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:40px 24px;position:relative;z-index:1;
      ">
        <div id="crono-main-timer" style="
          font-family:'DM Mono','JetBrains Mono',monospace;
          font-size:min(12vw, 96px);font-weight:500;letter-spacing:4px;
          color:${isActive ? '#e6edf3' : '#8b949e'};
          text-shadow:${isActive ? '0 0 40px rgba(57,211,83,0.3)' : 'none'};
          transition:color 0.3s, text-shadow 0.3s;
        ">${formatTime(elapsed)}</div>

        <!-- Controls -->
        <div style="display:flex;gap:24px;margin-top:40px;align-items:center;">
          <button onclick="toggleTimer('${focusEvent.id}')" style="
            width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;
            background:${isActive ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#238636,#2ea043)'};
            color:#fff;font-size:24px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:${isActive ? 'none' : '0 4px 20px rgba(46,160,67,0.4)'};
            transition:all 0.3s;
          " title="${isActive ? 'Pausar' : 'Retomar'}">
            ${isActive ? '⏸' : '▶'}
          </button>
          
          <button onclick="marcarEstudei('${focusEvent.id}')" style="
            width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
            background:${elapsed > 0 || focusEvent.id === 'crono_livre' ? 'rgba(57, 211, 83, 0.2)' : 'rgba(255,255,255,0.06)'};
            color:${elapsed > 0 || focusEvent.id === 'crono_livre' ? '#39d353' : '#8b949e'};
            font-size:20px;
            display:flex;align-items:center;justify-content:center;
            transition:all 0.3s;
          " title="Finalizar e Salvar">
            <i class="fa fa-check"></i>
          </button>

          <button onclick="discardTimer('${focusEvent.id}')" style="
            width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
            background:rgba(248, 81, 73, 0.15);color:#f85149;font-size:20px;
            display:${elapsed > 0 ? 'flex' : 'none'};align-items:center;justify-content:center;
            transition:all 0.3s;
          " title="Descartar Sessão">
            <i class="fa fa-trash"></i>
          </button>
        </div>

        <!-- Add time buttons / Goal Input -->
        <div style="margin-top:40px;text-align:center;">
          ${focusEvent.id === 'crono_livre' ? `
          <div style="color:#8b949e;font-size:12px;margin-bottom:12px;letter-spacing:1px;">
            Definir Meta de Tempo (minutos):
          </div>
          <div style="display:flex;gap:12px;justify-content:center;align-items:center;">
            <button onclick="setCronoLivreGoal(Math.max(0, (state.cronoLivre.duracaoMinutos||0) - 5))" class="btn-outline" style="min-width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">-</button>
            <input type="number" 
                   value="${state.cronoLivre?.duracaoMinutos || 0}" 
                   onchange="setCronoLivreGoal(this.value)" 
                   style="width:80px;height:40px;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:8px;text-align:center;font-size:18px;font-family:'DM Mono',monospace;">
            <button onclick="setCronoLivreGoal((state.cronoLivre.duracaoMinutos||0) + 5)" class="btn-outline" style="min-width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">+</button>
          </div>
          ` : `
          <div style="color:#8b949e;font-size:12px;margin-bottom:12px;letter-spacing:1px;">
            Adicione mais tempo se quiser continuar estudando:
          </div>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button onclick="addTimerMinutes('${focusEvent.id}',1)" style="
              padding:10px 20px;border-radius:24px;border:none;cursor:pointer;
              background:linear-gradient(135deg,#6e40c9,#8957e5);color:#fff;
              font-size:14px;font-weight:600;letter-spacing:0.5px;
              box-shadow:0 2px 12px rgba(139,92,246,0.3);transition:transform 0.2s;
            ">+ 1min</button>
            <button onclick="addTimerMinutes('${focusEvent.id}',5)" style="
              padding:10px 20px;border-radius:24px;border:none;cursor:pointer;
              background:linear-gradient(135deg,#6e40c9,#8957e5);color:#fff;
              font-size:14px;font-weight:600;letter-spacing:0.5px;
              box-shadow:0 2px 12px rgba(139,92,246,0.3);transition:transform 0.2s;
            ">+ 5min</button>
            <button onclick="addTimerMinutes('${focusEvent.id}',15)" style="
              padding:10px 20px;border-radius:24px;border:none;cursor:pointer;
              background:linear-gradient(135deg,#6e40c9,#8957e5);color:#fff;
              font-size:14px;font-weight:600;letter-spacing:0.5px;
              box-shadow:0 2px 12px rgba(139,92,246,0.3);transition:transform 0.2s;
            ">+ 15min</button>
          </div>
          `}
        </div>
      </div>

      <!-- Mode toggle (Cronômetro / Timer) -->
      <div style="
        display:flex;justify-content:center;gap:4px;padding:0 0 24px;position:relative;z-index:1;
      ">
        <button id="crono-mode-btn" onclick="toggleTimerMode()" style="
          padding:8px 20px;border-radius:20px;border:none;cursor:pointer;
          font-size:13px;font-weight:500;transition:all 0.3s;
          ${_pomodoroMode
      ? 'background:rgba(139,92,246,0.15);color:#a371f7;'
      : 'background:rgba(255,255,255,0.06);color:#8b949e;'}
        ">
          ${_pomodoroMode ? `🍅 Pomodoro (${state?.config?.pomodoroFoco || 25}/${state?.config?.pomodoroPausa || 5})` : '⏱ Modo Contínuo'}
        </button>
      </div>

      ${otherEvents.length > 0 ? `
        <!-- Other timers -->
        <div style="padding:0 32px 24px;position:relative;z-index:1;">
          <div style="color:#8b949e;font-size:12px;margin-bottom:8px;">Outros cronômetros:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${otherEvents.map(ev => {
        const evActive = !!ev._timerStart;
        const evDisc = getDisc(ev.discId);
        return `
                <button onclick="navigate('cronometro');toggleTimer('${ev.id}')" style="
                  padding:8px 16px;border-radius:8px;border:none;cursor:pointer;
                  background:${evActive ? 'var(--accent)' : 'var(--bg-secondary)'};
                  color:${evActive ? '#fff' : 'var(--text-primary)'};
                  font-size:13px;font-weight:600;
                ">${evDisc ? evDisc.disc.nome : 'Evento'} ${evActive ? '⏱️' : '⏸️'}</button>
              `;
      }).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <style>
      .crono-fullscreen button:hover { transform: scale(1.05); }
      .crono-fullscreen button:active { transform: scale(0.98); }
    </style>
  `;

  // Live update every second
  if (window._cronoInterval) clearInterval(window._cronoInterval);
  window._cronoInterval = setInterval(() => {
    const ev = state.eventos.find(e => e.id === focusEvent.id);
    if (!ev) { clearInterval(window._cronoInterval); return; }
    const elapsed = getElapsedSeconds(ev);
    const timerEl = document.getElementById('crono-main-timer');
    if (timerEl) timerEl.textContent = fmtTime(elapsed);
    const progressBar = document.getElementById('crono-progress-bar');
    if (progressBar) {
      const pct = Math.min((elapsed / plannedSecs) * 100, 100);
      progressBar.style.width = pct + '%';
    }
  }, 1000);
}


export function renderCurrentView() {
  // Bug 7: clean up cronometro interval when switching views
  if (window._cronoInterval) { clearInterval(window._cronoInterval); window._cronoInterval = null; }

  const el = document.getElementById('content');
  if (!el) return;
  const titles = {
    home: 'Página Inicial', med: 'Study Organizer', calendar: 'Calendário',
    revisoes: 'Revisões Pendentes', habitos: 'Hábitos de Estudo',
    editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações', cronometro: 'Cronômetro', ciclo: 'Ciclo de Estudos'
  };
  document.getElementById('topbar-title').textContent = titles[currentView] || 'Estudo Organizado';

  document.getElementById('topbar-date').innerHTML = currentView === 'home'
    ? `<i class="fa fa-calendar-alt"></i> ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : '';

  // Render topbar actions
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';
  if (currentView === 'cronometro') {
    actions.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="navigate('med')"><i class="fa fa-arrow-left"></i> Voltar</button>`;
  } else if (currentView === 'med' || currentView === 'calendar' || currentView === 'home') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Iniciar Estudo</button>`;
  } else if (currentView === 'editais') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openEditaModal()"><i class="fa fa-plus"></i> Novo Edital</button>`;
  } else if (currentView === 'ciclo') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="window.openPlanejamentoWizard()"><i class="fa fa-cog"></i> Planejamento</button>`;
  }

  updateBadges();

  if (currentView === 'home') return renderHome(el);
  if (currentView === 'med') return renderMED(el);
  if (currentView === 'calendar') return renderCalendar(el);
  if (currentView === 'dashboard') return renderDashboard(el);
  if (currentView === 'revisoes') return renderRevisoes(el);
  if (currentView === 'habitos') return renderHabitos(el);
  if (currentView === 'editais') return renderEditais(el);
  if (currentView === 'vertical') return renderVertical(el);
  if (currentView === 'config') return renderConfig(el);
  if (currentView === 'cronometro') return renderCronometro(el);
  if (currentView === 'ciclo') return renderCiclo(el);
}

// Ensure badges up to date
export function updateBadges() {
  // Update cronometro badge
  const activeTimers = state.eventos.filter(e => e._timerStart);
  const cronoBadge = document.getElementById('badge-crono');
  if (cronoBadge) {
    cronoBadge.style.display = activeTimers.length > 0 ? 'inline-block' : 'none';
    cronoBadge.textContent = activeTimers.length;
  }

  const med = document.getElementById('badge-med');
  const rev = document.getElementById('badge-rev');
  if (!med || !rev) return;
  const pendingMed = state.eventos.filter(e => e.data === todayStr() && e.status !== 'estudei').length;
  med.style.display = pendingMed > 0 ? 'inline-block' : 'none';
  med.textContent = pendingMed;
  const pendingRev = getPendingRevisoes().length;
  rev.style.display = pendingRev > 0 ? 'inline-block' : 'none';
  rev.textContent = pendingRev;
}

// =============================================
// EVENT CARD RENDERER
// =============================================
export function renderEventCard(evento) {
  const status = getEventStatus(evento);
  const discInfo = evento.discId ? getDisc(evento.discId) : null;
  const disc = discInfo ? discInfo.disc : null;
  const iconBg = disc ? (disc.cor || 'var(--accent)') : (getHabitType(evento.habito)?.color || '#64748b');
  const icon = disc ? (disc.icone || '📖') : (getHabitType(evento.habito)?.icon || '📚');
  const timerActive = isTimerActive(evento.id);
  const elapsed = getElapsedSeconds(evento);
  const tempo = formatTime(elapsed);

  return `
    <div class="event-card" data-event-id="${evento.id}" onclick="openEventDetail('${evento.id}')">
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
      <div class="event-actions" onclick="event.stopPropagation()">
        ${status !== 'estudei' ? `<button class="icon-btn ${timerActive ? 'active' : ''}" title="${timerActive ? 'Pausar' : 'Iniciar'} cronômetro" onclick="toggleTimer('${evento.id}')">${timerActive ? '⏸' : '▶'}</button>` : ''}
        ${status !== 'estudei' ? `<button class="icon-btn" title="Marcar como Estudei" onclick="marcarEstudei('${evento.id}')">✅</button>` : ''}
        <button class="icon-btn" title="Excluir" onclick="deleteEvento('${evento.id}')">🗑</button>
      </div>
    </div>
  `;
}

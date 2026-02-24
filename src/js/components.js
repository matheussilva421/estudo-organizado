import { HABIT_TYPES, currentView, formatDate, formatTime, getEventStatus, todayStr } from './app.js';
import { openAddEventModal, openEditaModal, renderCalendar, renderConfig, renderDashboard, renderEditais, renderHabitos, renderHome, renderMED, renderRevisoes, renderVertical, renderCiclo } from './views.js';
import { state } from './store.js';
import { deleteEvento, getDisc, getElapsedSeconds, getPendingRevisoes, isTimerActive, marcarEstudei, toggleTimer, toggleTimerMode, _pomodoroMode } from './logic.js';

// =============================================
// DOM COMPONENTS AND RENDERERS
// =============================================


export function renderCronometro(el) {
  const activeEvents = state.eventos.filter(e => e._timerStart);
  const pausedEvents = state.eventos.filter(e => !e._timerStart && (e.tempoAcumulado || 0) > 0 && e.status !== 'estudei');
  const allTimerEvents = [...activeEvents, ...pausedEvents];

  const fmtTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (allTimerEvents.length === 0) {
    el.innerHTML = `
      <div style="
        min-height:calc(100vh - 80px);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%);
        border-radius:16px;margin:-24px;padding:48px 24px;
      ">
        <div style="font-size:80px;margin-bottom:24px;opacity:0.3;">⏱️</div>
        <h2 style="color:#e6edf3;margin-bottom:12px;font-size:24px;">Nenhum cronômetro ativo</h2>
        <p style="color:#8b949e;font-size:15px;margin-bottom:32px;text-align:center;">
          Inicie um cronômetro em qualquer evento<br>de estudo para vê-lo aqui.
        </p>
        <button class="btn" style="
          background:linear-gradient(135deg,#238636,#2ea043);color:#fff;
          padding:14px 32px;font-size:15px;border-radius:12px;border:none;cursor:pointer;
          box-shadow:0 4px 16px rgba(46,160,67,0.3);
        " onclick="navigate('med')">
          <i class="fa fa-book"></i> Ir para Meu Estudo Diário
        </button>
      </div>`;
    return;
  }

  // Use first active event as the "focus" event
  const focusEvent = activeEvents[0] || allTimerEvents[0];
  const disc = getDisc(focusEvent.disciplinaId);
  const discName = disc ? disc.nome : 'Sem disciplina';
  const elapsed = getElapsedSeconds(focusEvent);
  const isActive = !!focusEvent._timerStart;

  // Calculate progress (if event has planned time, default 1h30)
  const plannedSecs = focusEvent.duracaoMinutos ? focusEvent.duracaoMinutos * 60 : 5400;
  const progress = Math.min((elapsed / plannedSecs) * 100, 100);

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
        <h2 style="
          color:#e6edf3;font-size:22px;margin-top:16px;font-weight:600;
          max-width:600px;margin-left:auto;margin-right:auto;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">
          ${focusEvent.titulo}
          <span style="color:#39d353;font-size:14px;margin-left:8px;">${discName}</span>
        </h2>
      </div>

      <!-- Progress bar -->
      <div style="padding:24px 48px 0;position:relative;z-index:1;">
        <div style="
          display:flex;justify-content:space-between;
          color:#8b949e;font-size:12px;margin-bottom:6px;
        ">
          <span>${fmtTime(elapsed)}</span>
          <span>${fmtTime(plannedSecs)}</span>
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
        ">${fmtTime(elapsed)}</div>

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
            background:rgba(255,255,255,0.06);color:#8b949e;font-size:20px;
            display:flex;align-items:center;justify-content:center;
            transition:all 0.3s;
          " title="Finalizar sessão">
            ⏹
          </button>
        </div>

        <!-- Add time buttons -->
        <div style="margin-top:40px;text-align:center;">
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
        </div>
      </div>

      <!-- Mode toggle (Cronômetro / Timer) -->
      <div style="
        display:flex;justify-content:center;gap:4px;padding:0 0 24px;position:relative;z-index:1;
      ">
        <button id="timer-mode-btn" onclick="toggleTimerMode()" style="
          padding:8px 20px;border-radius:20px;border:none;cursor:pointer;
          font-size:13px;font-weight:500;transition:all 0.3s;
          ${_pomodoroMode
      ? 'background:rgba(139,92,246,0.15);color:#a371f7;'
      : 'background:rgba(255,255,255,0.06);color:#8b949e;'}
        ">
          ${_pomodoroMode ? '🍅 Pomodoro (25/5)' : '⏱ Modo Contínuo'}
        </button>
      </div>

      ${otherEvents.length > 0 ? `
        <!-- Other timers -->
        <div style="padding:0 32px 24px;position:relative;z-index:1;">
          <div style="color:#8b949e;font-size:12px;margin-bottom:8px;">Outros cronômetros:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${otherEvents.map(ev => {
        const evActive = !!ev._timerStart;
        const evDisc = getDisc(ev.disciplinaId);
        return `
                <button onclick="navigate('cronometro');toggleTimer('${ev.id}')" style="
                  padding:8px 16px;border-radius:8px;border:none;cursor:pointer;
                  background:rgba(255,255,255,0.04);color:#c9d1d9;font-size:13px;
                  display:flex;align-items:center;gap:8px;
                ">
                  <span style="
                    width:8px;height:8px;border-radius:50%;
                    background:${evActive ? '#39d353' : '#8b949e'};
                  "></span>
                  ${ev.titulo}
                  <span style="color:#8b949e;font-family:monospace;">${fmtTime(getElapsedSeconds(ev))}</span>
                </button>
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
  const el = document.getElementById('content');
  if (!el) return;
  document.getElementById('topbar-title').textContent = {
    home: 'Página Inicial', med: 'Meu Estudo Diário', calendar: 'Calendário',
    dashboard: 'Dashboard', revisoes: 'Revisões', habitos: 'Hábitos',
    editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações', cronometro: 'Cronômetro'
  }[currentView] || 'Estudo Organizado';

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
    actions.innerHTML = `<button class="btn btn-primary btn-sm" data-action="replanejar-ciclo"><i class="fa fa-cog"></i> Configurar Ciclo</button>`;
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
        <div class="event-title">${evento.titulo || 'Evento'}</div>
        <div class="event-sub">${evento.data ? formatDate(evento.data) : 'Sem data'}${disc ? ' • ' + disc.nome : ''}</div>
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

export function getHabitType(key) {
  return HABIT_TYPES.find(h => h.key === key);
}

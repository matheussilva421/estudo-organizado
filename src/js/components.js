import { HABIT_TYPES, currentView, formatDate, formatTime, getEventStatus, todayStr } from './app.js';
import { openAddEventModal, openEditaModal, renderCalendar, renderConfig, renderDashboard, renderEditais, renderHabitos, renderHome, renderMED, renderRevisoes, renderVertical } from './views.js';
import { state } from './store.js';
import { deleteEvento, getDisc, getElapsedSeconds, getPendingRevisoes, isTimerActive, marcarEstudei, toggleTimer, toggleTimerMode, _pomodoroMode } from './logic.js';

// =============================================
// DOM COMPONENTS AND RENDERERS
// =============================================


export function renderCronometro(el) {
  const activeEvents = state.eventos.filter(e => e._timerStart);
  const allTimerEvents = state.eventos.filter(e => (e._timerStart || e.tempoAcumulado > 0) && e.status !== 'estudei');

  const fmtTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  if (allTimerEvents.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:80px 20px;">
        <div style="font-size:64px;margin-bottom:16px;">⏱️</div>
        <h2 style="margin-bottom:8px;color:var(--text);">Nenhum cronômetro ativo</h2>
        <p style="color:var(--text-muted);">Inicie um cronômetro em um evento de estudo para vê-lo aqui.</p>
        <button class="btn btn-primary" style="margin-top:24px;" onclick="navigate('med')">
          <i class="fa fa-book"></i> Ir para Meu Estudo Diário
        </button>
      </div>`;
    return;
  }

  const cardsHtml = allTimerEvents.map(ev => {
    const active = !!ev._timerStart;
    const elapsed = getElapsedSeconds(ev);
    const disc = getDisc(ev.disciplinaId);
    const discName = disc ? disc.nome : 'Sem disciplina';
    const discColor = disc ? disc.cor : 'var(--accent)';

    return `
      <div class="cronometro-card ${active ? 'active' : 'paused'}" id="crono-${ev.id}" style="
        background: var(--surface);
        border-radius: 16px;
        padding: 32px;
        margin-bottom: 24px;
        border-left: 5px solid ${active ? 'var(--green)' : 'var(--text-muted)'};
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        transition: all 0.3s ease;
        ${active ? 'animation: pulse-glow 2s ease-in-out infinite;' : ''}
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <span style="
            width:12px;height:12px;border-radius:50%;
            background:${active ? 'var(--green)' : 'var(--text-muted)'};
            ${active ? 'animation: pulse-dot 1.5s ease-in-out infinite;' : ''}
          "></span>
          <span style="font-size:14px;color:var(--text-muted);font-weight:500;">
            ${active ? '● Cronômetro ativo' : '⏸ Pausado'}
          </span>
          <span style="
            margin-left:auto;
            background:${discColor}22;
            color:${discColor};
            padding:4px 12px;
            border-radius:20px;
            font-size:12px;
            font-weight:600;
          ">${discName}</span>
        </div>

        <h3 style="font-size:18px;color:var(--text);margin-bottom:8px;">${ev.titulo}</h3>

        <div style="text-align:center;padding:32px 0;">
          <div class="crono-time" style="
            font-size:72px;
            font-weight:700;
            font-family:'JetBrains Mono',monospace;
            color:${active ? 'var(--accent)' : 'var(--text)'};
            letter-spacing:4px;
            text-shadow: ${active ? '0 0 20px var(--accent-light)' : 'none'};
          ">${fmtTime(elapsed)}</div>
          ${_pomodoroMode ? `<div style="font-size:13px;color:var(--text-muted);margin-top:8px;">🍅 Modo Pomodoro (25/5)</div>` : ''}
        </div>

        <div style="display:flex;justify-content:center;gap:16px;">
          <button class="btn ${active ? 'btn-danger' : 'btn-primary'}" style="
            padding:12px 32px;
            font-size:16px;
            border-radius:12px;
            min-width:160px;
          " onclick="toggleTimer('${ev.id}')">
            ${active ? '⏸ Pausar' : '▶ Continuar'}
          </button>
          ${!active && elapsed > 0 ? `
            <button class="btn btn-ghost" style="padding:12px 24px;font-size:16px;border-radius:12px;" onclick="marcarEstudei('${ev.id}')">
              ✅ Concluir
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;">
        <div>
          <h2 style="color:var(--text);margin:0;">⏱️ Cronômetro</h2>
          <p style="color:var(--text-muted);font-size:14px;margin-top:4px;">
            ${activeEvents.length} ativo(s) · ${allTimerEvents.length} evento(s) com tempo
          </p>
        </div>
        <button id="timer-mode-btn" class="btn btn-ghost btn-sm" style="
          ${_pomodoroMode ? 'background:var(--red);color:#fff;' : ''}
        " onclick="toggleTimerMode()">
          ${_pomodoroMode ? '🍅 Pomodoro (25/5)' : '⏱ Contínuo'}
        </button>
      </div>
      ${cardsHtml}
    </div>

    <style>
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        50% { box-shadow: 0 4px 24px rgba(16,185,129,0.15); }
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    </style>
  `;

  // Live update timer display every second
  if (window._cronoInterval) clearInterval(window._cronoInterval);
  if (activeEvents.length > 0) {
    window._cronoInterval = setInterval(() => {
      allTimerEvents.forEach(ev => {
        const timeEl = document.querySelector(`#crono-${ev.id} .crono-time`);
        if (timeEl) {
          timeEl.textContent = fmtTime(getElapsedSeconds(ev));
        }
      });
    }, 1000);
  }
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
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Novo Evento</button>`;
  } else if (currentView === 'editais') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openEditaModal()"><i class="fa fa-plus"></i> Novo Edital</button>`;
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
}

// Ensure badges up to date
export function updateBadges() {
  // Show/hide cronometro nav item based on active timers
  const activeTimers = state.eventos.filter(e => e._timerStart);
  const cronoNav = document.getElementById('nav-cronometro');
  const cronoBadge = document.getElementById('badge-crono');
  if (cronoNav) {
    cronoNav.style.display = activeTimers.length > 0 ? '' : 'none';
  }
  if (cronoBadge) {
    cronoBadge.textContent = activeTimers.length > 0 ? activeTimers.length : '';
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

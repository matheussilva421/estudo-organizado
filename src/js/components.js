import { HABIT_TYPES, currentView, formatDate, formatTime, getEventStatus, todayStr } from './app.js';
import { openAddEventModal, openEditaModal, renderCalendar, renderConfig, renderDashboard, renderEditais, renderHabitos, renderHome, renderMED, renderRevisoes, renderVertical } from './views.js';
import { state } from './store.js';
import { deleteEvento, getDisc, getElapsedSeconds, getPendingRevisoes, isTimerActive, marcarEstudei, toggleTimer } from './logic.js';

// =============================================
// DOM COMPONENTS AND RENDERERS
// =============================================

export function renderCurrentView() {
  const el = document.getElementById('content');
  if (!el) return;
  document.getElementById('topbar-title').textContent = {
    home: 'Página Inicial', med: 'Meu Estudo Diário', calendar: 'Calendário',
    dashboard: 'Dashboard', revisoes: 'Revisões', habitos: 'Hábitos',
    editais: 'Editais', vertical: 'Edital Verticalizado', config: 'Configurações'
  }[currentView] || 'Estudo Organizado';

  document.getElementById('topbar-date').innerHTML = currentView === 'home'
    ? `<i class="fa fa-calendar-alt"></i> ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`
    : '';

  // Render topbar actions
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';
  if (currentView === 'med' || currentView === 'calendar' || currentView === 'home') {
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
}

// Ensure badges up to date
export function updateBadges() {
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

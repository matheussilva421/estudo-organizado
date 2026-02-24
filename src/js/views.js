import { HABIT_TYPES, applyTheme, closeModal, currentView, cutoffDateStr, esc, formatDate, formatTime, getEventStatus, invalidateTodayCache, navigate, showConfirm, showToast, todayStr, uid, openModal } from './app.js';
import { scheduleSave, state, setState } from './store.js';
import { calcRevisionDates, getAllDisciplinas, getDisc, getPendingRevisoes, invalidateDiscCache, invalidateRevCache, reattachTimers } from './logic.js';
import { getHabitType, renderCurrentView, renderEventCard, updateBadges } from './components.js';
import { updateDriveUI } from './drive-sync.js';

let _confirmCallback = null;
let calDate = new Date();
let calViewMode = 'mes';
let currentHabitType = null;
let editingSubjectCtx = null;

let editingDiscCtx = null;

let editingEventId = null;

// =============================================
// CONSTANTS
// =============================================
export const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
  '#eab308', '#d946ef', '#64748b'
];

export const DISC_ICONS = [
  '📚', '📖', '📝', '📋', '📊', '📈', '🔬', '🧪', '🧮', '💻',
  '🌍', '🏛️', '⚖️', '🧠', '💡', '📐', '🔢', '🗂️', '📜', '🎯',
  '🩺', '🔧', '🎨', '🎵', '🏃', '🌱', '💰', '📡', '🔐', '📦'
];

// =============================================
// HOME VIEW
// =============================================
export function renderHome(el) {
  const today = todayStr();
  const agendadoHoje = state.eventos.filter(e => e.data === today && e.status !== 'estudei');
  const estudadoHoje = state.eventos.filter(e => e.data === today && e.status === 'estudei');
  const atrasados = state.eventos.filter(e => e.status !== 'estudei' && e.data && e.data < today);
  const pendRevs = getPendingRevisoes();
  const hojeSeconds = estudadoHoje.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  let disc = getAllDisciplinas();
  const totalDiscs = disc.length;
  const totalAssuntos = disc.reduce((s, d) => s + d.disc.assuntos.length, 0);
  const totalConcluidos = disc.reduce((s, d) => s + d.disc.assuntos.filter(a => a.concluído).length, 0);

  el.innerHTML = `
    <!-- GREETING BANNER -->
    <div style="background:linear-gradient(135deg,var(--sidebar-bg),#1e3a5f);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:4px;">${getGreeting()}</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;">Vamos estudar hoje? 🎯</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.65);font-style:italic;">"${getDailyQuote()}"</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:2px;">PROGRESSO GERAL</div>
        <div style="font-size:28px;font-weight:900;color:#fff;">${totalAssuntos > 0 ? Math.round(totalConcluidos / totalAssuntos * 100) : 0}<span style="font-size:16px;font-weight:600;opacity:0.7;">%</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);">${totalConcluidos} de ${totalAssuntos} assuntos</div>
      </div>
    </div>

    ${state.editais.length === 0 ? `
    <div class="card" style="margin-bottom:20px;border:2px dashed var(--accent);background:var(--accent-light);">
      <!-- (Original Onboarding content here) -->
      <div class="card-body" style="padding:20px 24px;">
        <div style="font-size:15px;font-weight:800;color:var(--accent-dark);margin-bottom:4px;">👋 Bem-vindo ao Estudo Organizado!</div>
        <div style="font-size:13px;color:var(--accent-dark);margin-bottom:16px;opacity:0.85;">Siga os passos abaixo para configur seu planejamento de estudos:</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div onclick="navigate('editais')" style="cursor:pointer;flex:1;min-width:180px;background:var(--card);border-radius:10px;padding:14px 16px;border:1px solid var(--border); transition:box-shadow 0.15s;" onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
              <div style="font-size:20px;margin-bottom:6px;">📋</div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px;">1. Crie um Edital</div>
              <div style="font-size:12px;color:var(--text-secondary);">Adicione o edital do seu concurso e organize as disciplinas por grupos.</div>
            </div>
            <!-- More onboarding steps could be re-added here -->
        </div>
      </div>
    </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card green">
        <div class="stat-label">Estudado Hoje</div>
        <div class="stat-value">${formatTime(hojeSeconds)}</div>
        <div class="stat-sub">${estudadoHoje.length} evento(s) concluído(s)</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Agendado Hoje</div>
        <div class="stat-value">${agendadoHoje.length}</div>
        <div class="stat-sub">evento(s) pendente(s)</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Atrasados</div>
        <div class="stat-value">${atrasados.length}</div>
        <div class="stat-sub">evento(s) não realizados</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Revisões Pendentes</div>
        <div class="stat-value">${pendRevs.length}</div>
        <div class="stat-sub">assuntos a revisar</div>
      </div>
    </div>

    <div class="grid-2" style="gap:16px;margin-bottom:16px;">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <h3>📌 Agendado para Hoje</h3>
            <button class="btn btn-primary btn-sm" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Evento</button>
          </div>
          <div class="card-body" style="padding:12px;">
            ${agendadoHoje.length === 0 ? '<div class="empty-state"><div class="icon">✅</div><h4>Nada pendente!</h4><p>Adicione eventos ou aproveite o dia livre.</p></div>' : agendadoHoje.map(e => renderEventCard(e)).join('')}
          </div>
        </div>

        ${atrasados.length > 0 ? `
        <div class="card">
          <div class="card-header"><h3>⏰ Eventos Atrasados</h3></div>
          <div class="card-body" style="padding:12px;">
            ${atrasados.slice(0, 5).map(e => renderEventCard(e)).join('')}
            ${atrasados.length > 5 ? `<div class="cal-more" style="padding:8px;text-align:center;">+${atrasados.length - 5} mais</div>` : ''}
          </div>
        </div>` : ''}
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>✅ Estudado Hoje</h3></div>
          <div class="card-body" style="padding:12px;">
            ${estudadoHoje.length === 0 ? '<div class="empty-state"><div class="icon">📚</div><h4>Nenhum evento concluído</h4><p>Comece seus estudos!</p></div>' : estudadoHoje.map(e => renderEventCard(e)).join('')}
          </div>
        </div>

        ${pendRevs.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <h3>🔄 Revisões Sugeridas para Hoje</h3>
            <button class="btn btn-ghost btn-sm" onclick="navigate('revisoes')">Ver todas</button>
          </div>
          <div class="card-body" style="padding:12px;">
            ${pendRevs.slice(0, 3).map(r => `
              <div class="rev-item">
                <div class="rev-days today">
                  <div class="num">Rev</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
                  <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} • ${r.edital.nome}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="marcarRevisao('${r.assunto.id}')">Feita</button>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="card" style="margin-top:16px;">
          <div class="card-header"><h3>📊 Progresso do Edital</h3></div>
          <div class="card-body">
            ${state.editais.length === 0 ? '<div class="empty-state"><div class="icon">📋</div><h4>Nenhum edital</h4><p>Crie seu edital para acompanhar o progresso.</p></div>' :
      state.editais.map(edital => {
        const discs = (edital.disciplinas || []);
        const total = discs.reduce((s, d) => s + d.assuntos.length, 0);
        const done = discs.reduce((s, d) => s + d.assuntos.filter(a => a.concluído).length, 0);
        const pct = total > 0 ? Math.round(done / total * 100) : 0;
        return `
                  <div style="margin-bottom:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                      <div style="font-size:13px;font-weight:600;">${esc(edital.nome)}</div>
                      <div style="font-size:12px;color:var(--text-secondary);">${done}/${total} (${pct}%)</div>
                    </div>
                    <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${edital.cor || 'var(--accent)'};"></div></div>
                  </div>
                `;
      }).join('')
    }
          </div>
        </div>
      </div>
    </div>
  `;
}

export const FRASES_MOTIVACIONAIS = [
  "A consistência supera o talento todos os dias.",
  "Cada página lida é um passo à frente na aprovação.",
  "O concurso é ganho na rotina, não na véspera.",
  "Foque no processo. O resultado é consequência.",
  "Você já está à frente de quem ainda não começou.",
  "Estudo diário transforma ignorância em aprovação.",
  "A aprovação não é sorte — é a soma dos seus dias.",
  "Cada assunto concluído é uma vitória real.",
  "Disciplina é liberdade. Continue.",
  "Pequenas doses diárias constroem grandes conhecimentos.",
];

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return '☀️ Bom dia';
  if (h < 18) return '🌤️ Boa tarde';
  return '🌙 Boa noite';
}

export function getDailyQuote() {
  const _d = new Date();
  const day = _d.getDate() + _d.getMonth() * 31;
  return FRASES_MOTIVACIONAIS[day % FRASES_MOTIVACIONAIS.length];
}

// =============================================
// MED VIEW
// =============================================
export function renderMED(el) {
  const today = todayStr();
  const todayEvents = state.eventos.filter(e => e.data === today);
  const agendados = todayEvents.filter(e => e.status !== 'estudei');
  const estudados = todayEvents.filter(e => e.status === 'estudei');
  const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  el.innerHTML = `
        <div id="med-stats-row" style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tempo Total Hoje</div>
        <div style="font-size:32px;font-weight:800;font-family:'DM Mono',monospace;color:var(--text-primary);" id="total-time">${formatTime(totalSeconds)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluído(s)</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes</div>
        <div style="font-size:32px;font-weight:800;color:var(--blue);">${agendados.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">evento(s) para hoje</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Maior Foco</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:8px;">
          ${estudados.length > 0 ? (() => {
      const best = estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a);
      return esc(best.titulo || 'N/A');
    })() : '—'}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length > 0 ? formatTime(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).tempoAcumulado || 0) : ''}</div>
      </div>
    </div>

        ${agendados.length === 0 && estudados.length === 0 ? `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p style="margin-bottom:16px;">Adicione eventos de estudo para começar a registrar seu tempo.</p>
        <button class="btn btn-primary" onclick="openAddEventModal()"><i class="fa fa-plus"></i> Adicionar Evento</button>
      </div>
    ` : `
      <div id="med-section-agendado">
        ${agendados.length > 0 ? `
          <div class="section-header"><h2>📌 Agendado para Hoje</h2></div>
          ${agendados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
      <div id="med-section-estudado">
        ${estudados.length > 0 ? `
          <div class="section-header" style="margin-top:24px;"><h2>✅ Estudado Hoje</h2></div>
          ${estudados.map(e => renderEventCard(e)).join('')}
        ` : ''}
      </div>
    `}
    `;
}

// SURGICAL DOM UPDATES ---------------------------------------
export function refreshEventCard(eventId) {
  const el = document.querySelector(`[data-event-id="${eventId}"]`);
  if (!el) { renderCurrentView(); return; }
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) { el.remove(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = renderEventCard(ev);
  el.replaceWith(tmp.firstElementChild);
  reattachTimers();
}

export function refreshMEDSections() {
  if (currentView !== 'med') { renderCurrentView(); return; }
  const today = todayStr();
  const todayEvents = state.eventos.filter(e => e.data === today);
  const agendados = todayEvents.filter(e => e.status !== 'estudei');
  const estudados = todayEvents.filter(e => e.status === 'estudei');
  const totalSecs = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  const statsRow = document.getElementById('med-stats-row');
  if (statsRow) {
    statsRow.innerHTML = `
        <div class="card" style = "flex:1;min-width:200px;padding:20px;text-align:center;" >
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tempo Total Hoje</div>
        <div style="font-size:32px;font-weight:800;font-family:'DM Mono',monospace;color:var(--text-primary);" id="total-time">${formatTime(totalSecs)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluído(s)</div>
      </div >
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes</div>
        <div style="font-size:32px;font-weight:800;color:var(--blue);">${agendados.length}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">evento(s) para hoje</div>
      </div>
      <div class="card" style="flex:1;min-width:200px;padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Maior Foco</div>
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-top:8px;">
          ${estudados.length > 0 ? esc(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).titulo || 'N/A') : '—'}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
          ${estudados.length > 0 ? formatTime(estudados.reduce((a, b) => (b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a).tempoAcumulado || 0) : ''}
        </div>
      </div>`;
  }

  const secAgendado = document.getElementById('med-section-agendado');
  if (secAgendado) {
    secAgendado.innerHTML = agendados.length > 0
      ? `<div class="section-header" > <h2>📌 Agendado para Hoje</h2></div > ${agendados.map(e => renderEventCard(e)).join('')} `
      : '';
  }

  const secEstudado = document.getElementById('med-section-estudado');
  if (secEstudado) {
    secEstudado.innerHTML = estudados.length > 0
      ? `<div class="section-header" style = "margin-top:24px;" > <h2>✅ Estudado Hoje</h2></div > ${estudados.map(e => renderEventCard(e)).join('')} `
      : '';
  }

  reattachTimers();
  //updateBadges();
}

export function removeDOMCard(eventId) {
  const el = document.querySelector(`[data - event - id= "${eventId}"]`);
  if (el) {
    el.remove();
  } else {
    renderCurrentView();
    return;
  }
  refreshMEDSections();
}

// =============================================
export function renderCalendar(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="cal-header">
          <div class="cal-nav">
            <button onclick="calNavigate(-1)"><i class="fa fa-chevron-left"></i></button>
            <button onclick="calNavigate(1)"><i class="fa fa-chevron-right"></i></button>
          </div>
          <div class="cal-title">${calDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}</div>
          <button class="btn btn-ghost btn-sm" onclick="calDate=new Date();renderCurrentView()">Hoje</button>
          <div style="margin-left:auto;" class="cal-view-tabs">
            <div class="cal-view-tab ${calViewMode === 'mes' ? 'active' : ''}" onclick="calViewMode='mes';renderCurrentView()">Mês</div>
            <div class="cal-view-tab ${calViewMode === 'semana' ? 'active' : ''}" onclick="calViewMode='semana';renderCurrentView()">Semana</div>
          </div>
        </div>
        ${calViewMode === 'mes' ? renderCalendarMonth() : renderCalendarWeek()}
      </div>
    </div>
  `;
}

export function calNavigate(dir) {
  if (calViewMode === 'mes') {
    calDate.setMonth(calDate.getMonth() + dir);
  } else {
    calDate.setDate(calDate.getDate() + dir * 7);
  }
  renderCurrentView();
}

export function renderCalendarMonth() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = todayStr();
  const startDow = (firstDay.getDay() - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana || 1;
  const dowOrder = Array.from({ length: 7 }, (_, i) => dows[(startDow0 + i) % 7]);

  let cells = [];
  // Previous month fill
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - startDow + i);
    cells.push({ date: d, other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), other: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), other: true });
  }

  const getDateStr = d => d.toISOString().split('T')[0];

  return `
    <div class="cal-grid">
      ${dowOrder.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.map(cell => {
    const ds = getDateStr(cell.date);
    const isToday = ds === today;
    const dayEvents = state.eventos.filter(e => e.data === ds);
    const show = dayEvents.slice(0, 3);
    const more = dayEvents.length - 3;
    return `
          <div class="cal-cell ${cell.other ? 'other-month' : ''} ${isToday ? 'today' : ''}" onclick="calClickDay('${ds}')">
            <div class="cal-date">${cell.date.getDate()}</div>
            ${show.map(e => {
      const st = getEventStatus(e);
      return `<div class="cal-event-chip ${st}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
            ${more > 0 ? `<div class="cal-more">+${more} mais</div>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;
}

export function renderCalendarWeek() {
  const today = todayStr();
  const dow = calDate.getDay();
  const startOffset = (dow - (state.config.primeirodiaSemana || 1) + 7) % 7;
  const weekStart = new Date(calDate);
  weekStart.setDate(calDate.getDate() - startOffset);
  const dows = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const startDow0 = state.config.primeirodiaSemana || 1;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const getDateStr = d => d.toISOString().split('T')[0];

  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;">
      ${days.map(d => {
    const ds = getDateStr(d);
    const isToday = ds === today;
    const dayEvents = state.eventos.filter(e => e.data === ds);
    return `
          <div style="min-height:200px;border-radius:8px;border:1px solid var(--border);overflow:hidden;">
            <div style="padding:8px;background:${isToday ? 'var(--accent-light)' : 'var(--bg)'};text-align:center;border-bottom:1px solid var(--border);">
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);">${dows[d.getDay()]}</div>
              <div style="font-size:16px;font-weight:700;${isToday ? 'color:var(--blue);' : ''}">${d.getDate()}</div>
            </div>
            <div style="padding:6px;">
              ${dayEvents.map(e => {
      const st = getEventStatus(e);
      return `<div class="cal-event-chip ${st}" style="margin-bottom:3px;cursor:pointer;" onclick="openEventDetail('${e.id}')" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
    }).join('')}
              <div style="text-align:center;margin-top:4px;">
                <button class="icon-btn" style="width:24px;height:24px;" onclick="openAddEventModalDate('${ds}')">+</button>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

export function calClickDay(dateStr) {
  openAddEventModalDate(dateStr);
}

export function openAddEventModalDate(dateStr) {
  openAddEventModal(dateStr);
}

// =============================================
// DASHBOARD VIEW
// =============================================
// =============================================
// UX 4 — DASHBOARD WITH PERIOD FILTER
// =============================================
export let dashPeriod = 7; // default: last 7 days
export let _chartDaily = null, _chartDisc = null;

export function renderDashboard(el) {
  const periodDays = dashPeriod; // null = all time
  const periodLabel = { 7: '7 dias', 30: '30 dias', 90: '3 meses', null: 'Total' }[periodDays];

  // Fix 2: compute cutoff once, reuse across all filters in this render
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  const filteredEvts = cutoffStr
    ? state.eventos.filter(e => e.status === 'estudei' && e.data && e.data >= cutoffStr)
    : state.eventos.filter(e => e.status === 'estudei');

  const totalSecs = filteredEvts.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const questTot = cutoffStr
    ? (state.habitos.questoes || []).filter(r => r.data >= cutoffStr).reduce((s, q) => s + (q.quantidade || 1), 0)
    : (state.habitos.questoes || []).reduce((s, q) => s + (q.quantidade || 1), 0);
  const simTot = cutoffStr
    ? (state.habitos.simulado || []).filter(r => r.data >= cutoffStr).length
    : (state.habitos.simulado || []).length;

  el.innerHTML = `
    <!-- Period selector -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text-secondary);">Exibindo dados: <strong style="color:var(--text-primary);">${periodLabel}</strong></div>
      <div class="cal-view-tabs">
        ${[7, 30, 90, null].map(p => `
          <div class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" onclick="setDashPeriod(${p})">
            ${{ 7: '7d', 30: '30d', 90: '3m', null: 'Total' }[p]}
          </div>`).join('')}
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card green">
        <div class="stat-label">Tempo Estudado</div>
        <div class="stat-value">${formatTime(totalSecs)}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Sessões Realizadas</div>
        <div class="stat-value">${filteredEvts.length}</div>
        <div class="stat-sub">eventos concluídos</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Questões</div>
        <div class="stat-value">${questTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Simulados</div>
        <div class="stat-value">${simTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-header">
          <h3>📊 Horas por Dia</h3>
          <span style="font-size:11px;color:var(--text-muted);">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-daily"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>📚 Tempo por Disciplina</h3>
          <span style="font-size:11px;color:var(--text-muted);">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-disc"></canvas></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>⚡ Hábitos (${periodLabel})</h3></div>
        <div class="card-body">${renderHabitSummary(periodDays)}</div>
      </div>
      <div class="card">
        <div class="card-header"><h3>📏 Progresso por Disciplina</h3></div>
        <div class="card-body">${renderDiscProgress()}</div>
      </div>
    </div>
  `;

  renderDailyChart(periodDays);
  renderDiscChart(periodDays);
}

export function setDashPeriod(p) {
  dashPeriod = p;
  renderCurrentView();
}

export function renderDailyChart(periodDays) {
  const ctx = document.getElementById('chart-daily');
  if (!ctx) return;
  if (_chartDaily) { _chartDaily.destroy(); _chartDaily = null; }
  const numDays = periodDays ? Math.min(periodDays, 90) : 30;
  const days = [], data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    days.push(numDays > 30 ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const secs = state.eventos.filter(e => e.data === ds && e.status === 'estudei').reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
    data.push(Math.round(secs / 60));
  }
  _chartDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{ label: 'Minutos', data, backgroundColor: '#10b98166', borderColor: '#10b981', borderWidth: 2, borderRadius: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: numDays > 20 ? 9 : 11 }, maxRotation: numDays > 20 ? 45 : 0, maxTicksLimit: 20 } }
      }
    }
  });
}

export function renderDiscChart(periodDays) {
  const ctx = document.getElementById('chart-disc');
  if (!ctx) return;
  if (_chartDisc) { _chartDisc.destroy(); _chartDisc = null; }
  const discTime = {};
  const cutoffStr2 = periodDays ? cutoffDateStr(periodDays) : null;
  const evts = cutoffStr2
    ? state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado && e.data >= cutoffStr2)
    : state.eventos.filter(e => e.status === 'estudei' && e.discId && e.tempoAcumulado);
  evts.forEach(e => { discTime[e.discId] = (discTime[e.discId] || 0) + e.tempoAcumulado; });
  const labels = [], data = [], colors = [];
  Object.entries(discTime).forEach(([id, secs]) => {
    const d = getDisc(id);
    labels.push(d ? d.disc.nome : id);
    data.push(Math.round(secs / 60));
    colors.push(d ? (d.disc.cor || '#10b981') : '#94a3b8');
  });
  if (data.length === 0) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="icon">📈</div><p>Sem dados no período selecionado</p></div>'; return; }
  _chartDisc = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } }
    }
  });
}

export function renderHabitSummary(periodDays) {
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  return HABIT_TYPES.map(h => {
    const recent = cutoffStr
      ? (state.habitos[h.key] || []).filter(r => r.data >= cutoffStr)
      : (state.habitos[h.key] || []);
    const count = h.key === 'questoes' ? recent.reduce((s, q) => s + (q.quantidade || 1), 0) : recent.length;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:18px;">${h.icon}</div>
        <div style="flex:1;font-size:13px;font-weight:500;">${h.label}</div>
        <div style="font-size:16px;font-weight:700;color:${h.color};">${count}</div>
      </div>
    `;
  }).join('');
}

export function renderDiscProgress() {
  const discs = getAllDisciplinas();
  if (discs.length === 0) return '<div class="empty-state"><div class="icon">📋</div><p>Nenhuma disciplina cadastrada</p></div>';
  return discs.slice(0, 8).map(({ disc, edital }) => {
    const total = disc.assuntos.length;
    const done = disc.assuntos.filter(a => a.concluído).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
            <span>${disc.icone || '📚'}</span> ${esc(disc.nome)}
          </div>
          <div style="font-size:11px;color:var(--text-muted);">${done}/${total}</div>
        </div>
        <div class="progress">
          <div class="progress-bar" style="width:${pct}%;background:${disc.cor || 'var(--accent)'};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// REVISOES VIEW
// =============================================
// Fix 4: Get upcoming revisions for next N days
export function getUpcomingRevisoes(days = 30) {
  const today = todayStr();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split('T')[0];
  const upcoming = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
        for (const ass of disc.assuntos) {
          if (!ass.concluído || !ass.dataConclusao) continue;
          const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || []);
          for (const rd of revDates) {
            if (rd > today && rd <= futureStr) {
              upcoming.push({ assunto: ass, disc, edital, data: rd, revNum: (ass.revisoesFetas || []).length + 1 });
              break; // only the next scheduled one
            }
          }
        }
      }
  }
  return upcoming.sort((a, b) => a.data.localeCompare(b.data));
}

export function renderRevisoes(el) {
  const pending = getPendingRevisoes();
  const upcoming = getUpcomingRevisoes(30);
  const today = todayStr();

  el.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Pendentes Hoje</div>
        <div style="font-size:28px;font-weight:800;color:var(--red);">${pending.filter(r => r.data <= today).length}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Próx. 30 dias</div>
        <div style="font-size:28px;font-weight:800;color:var(--blue);">${upcoming.length}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Assuntos Concluídos</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${getAllDisciplinas().reduce((s, { disc }) => s + disc.assuntos.filter(a => a.concluído).length, 0)}</div>
      </div>
      <div class="card" style="flex:1;min-width:140px;padding:16px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Frequência</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-top:8px;">${(state.config.frequenciaRevisao || [1, 7, 30, 90]).join(', ')} dias</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab-btn active" onclick="switchRevTab('pendentes', this)">🔄 Pendentes (${pending.length})</div>
      <div class="tab-btn" onclick="switchRevTab('proximas', this)">📅 Próximas 30 dias (${upcoming.length})</div>
    </div>

    <div id="rev-tab-pendentes" class="tab-content active">
      ${pending.length === 0 ? `
        <div class="empty-state"><div class="icon">✅</div><h4>Nenhuma revisão pendente!</h4><p>Conclua assuntos para que as revisões sejam agendadas automaticamente.</p></div>
      ` : pending.map(r => {
    const isOverdue = r.data < today;
    const revNum = (r.assunto.revisoesFetas || []).length + 1;
    return `
          <div class="rev-item">
            <div class="rev-days ${isOverdue ? 'overdue' : 'today'}">
              <div class="num">${revNum}ª</div>
              <div class="label">Rev</div>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
              <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} • ${r.edital.nome}</div>
              <div style="font-size:11px;color:${isOverdue ? 'var(--red)' : 'var(--accent)'};margin-top:2px;">
                ${isOverdue ? '⚠️ Atrasada' : '📅 Hoje'} • Prevista para ${formatDate(r.data)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-primary btn-sm" onclick="marcarRevisao('${r.assunto.id}')">✅ Feita</button>
              <button class="btn btn-ghost btn-sm" onclick="adiarRevisao('${r.assunto.id}')">⏩ +1 dia</button>
            </div>
          </div>
        `;
  }).join('')}
    </div>

    <div id="rev-tab-proximas" class="tab-content">
      ${upcoming.length === 0 ? `
        <div class="empty-state"><div class="icon">📅</div><h4>Nenhuma revisão nos próximos 30 dias</h4><p>Continue estudando e concluíndo assuntos!</p></div>
      ` : (() => {
      // Group by week
      let lastWeek = null;
      return upcoming.map(r => {
        const d = new Date(r.data + 'T00:00:00');
        const weekLabel = `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
        const diffDays = Math.ceil((new Date(r.data + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
        return `
            <div class="rev-item">
              <div class="rev-days" style="background:#dbeafe;color:#1d4ed8;">
                <div class="num">${r.revNum}ª</div>
                <div class="label">Rev</div>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;">${r.assunto.nome}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${r.disc.nome} • ${r.edital.nome}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:700;color:var(--blue);">${formatDate(r.data)}</div>
                <div style="font-size:11px;color:var(--text-muted);">em ${diffDays} dia${diffDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
          `;
      }).join('');
    })()}
    </div>
  `;
}

export function switchRevTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rev-tab-pendentes').classList.toggle('active', tab === 'pendentes');
  document.getElementById('rev-tab-proximas').classList.toggle('active', tab === 'proximas');
}

export function marcarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
        const ass = disc.assuntos.find(a => a.id === assId);
        if (ass) {
          if (!ass.revisoesFetas) ass.revisoesFetas = [];
          ass.revisoesFetas.push(todayStr());
          scheduleSave();
          renderCurrentView();
          showToast('Revisão registrada! ­ƒë', 'success');
          return;
        }
      }
  }
}

export function adiarRevisao(assId) {
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
        const ass = disc.assuntos.find(a => a.id === assId);
        if (ass) {
          // Store a deferral date: push back the base date by 1 day
          if (!ass.adiamentos) ass.adiamentos = 0;
          ass.adiamentos = (ass.adiamentos || 0) + 1;
          // Shift dataConclusao forward 1 day so all subsequent revisions shift
          const base = new Date(ass.dataConclusao + 'T00:00:00');
          base.setDate(base.getDate() + 1);
          ass.dataConclusao = base.toISOString().split('T')[0];
          scheduleSave();
          renderCurrentView();
          showToast('Revisão adiada por 1 dia', 'info');
          return;
        }
      }
  }
}

// =============================================
// HABITOS VIEW
// =============================================
export let habitHistPage = 1;
export const HABIT_HIST_PAGE_SIZE = 20;

export function renderHabitos(el) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  el.innerHTML = `
    <div class="habit-grid">
      ${HABIT_TYPES.map(h => {
    const all = state.habitos[h.key] || [];
    const recent = all.filter(r => r.data >= cutoffStr);
    const total = h.key === 'questoes' ? all.reduce((s, q) => s + (q.quantidade || 1), 0) : all.length;
    return `
          <div class="habit-card" onclick="openHabitModal('${h.key}')">
            <div class="hc-icon">${h.icon}</div>
            <div class="hc-label">${h.label}</div>
            <div class="hc-count" style="color:${h.color};">${total}</div>
            <div class="hc-sub">${recent.length} nos últimos 7 dias</div>
          </div>
        `;
  }).join('')}
    </div>

    <div class="card">
      <div class="card-header">
        <h3>📏 Histórico de Hábitos</h3>
        <span style="font-size:12px;color:var(--text-muted);" id="habit-hist-count"></span>
      </div>
      <div class="card-body" style="padding:0;" id="habit-hist-list">
      </div>
      <div id="habit-hist-footer" style="padding:12px 16px;display:flex;gap:8px;align-items:center;border-top:1px solid var(--border);"></div>
    </div>
  `;
  renderHabitHistPage();
}

export function renderHabitHistPage() {
  const all = HABIT_TYPES
    .flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })))
    .sort((a, b) => b.data.localeCompare(a.data));
  const total = all.length;
  const page = habitHistPage;
  const start = (page - 1) * HABIT_HIST_PAGE_SIZE;
  const end = start + HABIT_HIST_PAGE_SIZE;
  const items = all.slice(start, end);
  const totalPages = Math.max(1, Math.ceil(total / HABIT_HIST_PAGE_SIZE));

  const countEl = document.getElementById('habit-hist-count');
  if (countEl) countEl.textContent = `${total} registro(s)`;

  const listEl = document.getElementById('habit-hist-list');
  if (listEl) {
    listEl.innerHTML = items.length === 0
      ? '<div class="empty-state"><div class="icon">⚡</div><p>Nenhum hábito registrado ainda</p></div>'
      : items.map(r => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);">
          <div style="font-size:20px;">${r.tipo.icon}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${esc(r.tipo.label)}${r.descricao ? ' - ' + r.descricao : ''}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${formatDate(r.data)}${r.quantidade ? ' • ' + r.quantidade + ' questões' : ''}${r.acertos !== undefined && r.tipo.key === 'questoes' ? ' • ' + r.acertos + ' acertos' : ''}${r.total ? ` • ${r.acertos}/${r.total} (${Math.round(r.acertos / r.total * 100)}%)` : ''}</div>
            ${r.gabaritoPorDisc && r.gabaritoPorDisc.length ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
                ${r.gabaritoPorDisc.map(g => `<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:20px;padding:1px 8px;color:var(--text-secondary);">${g.discNome}: ${g.acertos}/${g.total}</span>`).join('')}
              </div>` : ''}
          </div>
          <button class="icon-btn" onclick="deleteHabito('${r.tipo.key}','${r.id}')">🗑️</button>
        </div>
      `).join('');
  }

  const footerEl = document.getElementById('habit-hist-footer');
  if (footerEl && total > HABIT_HIST_PAGE_SIZE) {
    footerEl.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="setHabitPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>⇉ Anterior</button>
      <span style="font-size:12px;color:var(--text-muted);flex:1;text-align:center;">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" onclick="setHabitPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Próxima ⇆</button>
    `;
    footerEl.style.display = 'flex';
  } else if (footerEl) {
    footerEl.style.display = 'none';
  }
}

export function setHabitPage(p) {
  const all = HABIT_TYPES.flatMap(h => (state.habitos[h.key] || []).map(r => ({ ...r, tipo: h })));
  const totalPages = Math.max(1, Math.ceil(all.length / HABIT_HIST_PAGE_SIZE));
  habitHistPage = Math.max(1, Math.min(p, totalPages));
  renderHabitHistPage();
  document.getElementById('habit-hist-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function openHabitModal(tipo) {
  currentHabitType = tipo;
  const h = tipo ? HABIT_TYPES.find(h => h.key === tipo) : null;
  document.getElementById('modal-habit-title').textContent = h ? `Registrar: ${h.label}` : 'Registrar Hábito';

  const discOptions = getAllDisciplinas().map(d => `<option value="${d.disc.id}">${d.disc.nome}</option>`).join('');

  document.getElementById('modal-habit-body').innerHTML = `
    ${!tipo ? `
      <div class="form-group">
        <label class="form-label">Tipo de Hábito</label>
        <div class="event-type-grid">
          ${HABIT_TYPES.map(h => `
            <div class="event-type-card" onclick="selectHabitType('${h.key}', this)" data-tipo="${h.key}">
              <div class="et-icon">${h.icon}</div>
              <div class="et-label">${h.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    <div class="form-group">
      <label class="form-label">Data</label>
      <input type="date" class="form-control" id="habit-data" value="${todayStr()}">
    </div>
    ${tipo === 'questoes' ? `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantidade de Questões</label>
          <input type="number" class="form-control" id="habit-qtd" value="10" min="1">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="habit-disc">${discOptions}</select>
      </div>
    ` : tipo === 'simulado' ? `
      <div class="form-group">
        <label class="form-label">Nome do Simulado</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Simulado CEBRASPE 01">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Total de Questões</label>
          <input type="number" class="form-control" id="habit-total" value="120" oninput="calcSimuladoPerc()">
        </div>
        <div class="form-group">
          <label class="form-label">Acertos (Geral)</label>
          <input type="number" class="form-control" id="habit-acertos" value="0" min="0" oninput="calcSimuladoPerc()">
        </div>
      </div>
      <div id="sim-perc" style="font-size:13px;font-weight:700;text-align:center;color:var(--accent);margin-bottom:12px;"></div>

      <!-- Feature 13: gabarito por disciplina -->
      <details>
        <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:4px 0;margin-bottom:8px;">📈 Gabarito por Disciplina (opcional)</summary>
        <div id="sim-disc-list" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          ${getAllDisciplinas().map(({ disc, edital }) => `
            <div style="display:flex;align-items:center;gap:8px;background:var(--bg);padding:8px;border-radius:8px;">
              <span style="font-size:13px;flex:1;font-weight:500;" title="${esc(edital.nome)}">${disc.icone || '📚'} ${esc(disc.nome)}</span>
              <input type="number" class="form-control" style="width:70px;" placeholder="Total" id="sim-total-${disc.id}" min="0">
              <span style="color:var(--text-muted);font-size:12px;">/</span>
              <input type="number" class="form-control" style="width:70px;" placeholder="Acertos" id="sim-acertos-${disc.id}" min="0">
            </div>
          `).join('')}
          ${getAllDisciplinas().length === 0 ? '<div style="font-size:12px;color:var(--text-muted);padding:8px;">Cadastre disciplinas para usar o gabarito detalhado.</div>' : ''}
        </div>
      </details>
    ` : tipo === 'discursiva' ? `
      <div class="form-group">
        <label class="form-label">Tema</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Tema da discursiva">
      </div>
      <div class="form-group">
        <label class="form-label">Nota/Pontuação (opcional)</label>
        <input type="number" class="form-control" id="habit-nota" placeholder="Ex: 8.5">
      </div>
    ` : tipo === 'leitura' ? `
      <div class="form-group">
        <label class="form-label">Título / Legislação</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Ex: Lei 8.112/1990">
      </div>
      <div class="form-group">
        <label class="form-label">Páginas/Artigos lidos</label>
        <input type="number" class="form-control" id="habit-paginas" placeholder="Ex: 30">
      </div>
    ` : `
      <div class="form-group">
        <label class="form-label">Descrição (opcional)</label>
        <input type="text" class="form-control" id="habit-desc" placeholder="Observações">
      </div>
    `}
  `;
  openModal('modal-habit');
}

export function selectHabitType(tipo, el) {
  document.querySelectorAll('.event-type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  currentHabitType = tipo;
}

export function saveHabit() {
  if (!currentHabitType) { showToast('Selecione o tipo de hábito', 'error'); return; }
  const data = document.getElementById('habit-data')?.value || todayStr();
  const registro = { id: uid(), data, tipo: currentHabitType };

  if (currentHabitType === 'questoes') {
    const qtd = parseInt(document.getElementById('habit-qtd')?.value || '10');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate questoes
    if (isNaN(qtd) || qtd < 1) { showToast('Informe uma quantidade válida de questões (mínimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos não pode ser negativo', 'error'); return; }
    if (acertos > qtd) { showToast(`Acertos (${acertos}) não pode ser maior que o total (${qtd})`, 'error'); return; }
    registro.quantidade = qtd;
    registro.acertos = acertos;
    registro.discId = document.getElementById('habit-disc')?.value;

  } else if (currentHabitType === 'simulado') {
    const total = parseInt(document.getElementById('habit-total')?.value || '0');
    const acertos = parseInt(document.getElementById('habit-acertos')?.value || '0');
    // Fix J: validate simulado
    if (isNaN(total) || total < 1) { showToast('Informe o total de questões do simulado (mínimo 1)', 'error'); return; }
    if (isNaN(acertos) || acertos < 0) { showToast('Acertos não pode ser negativo', 'error'); return; }
    if (acertos > total) { showToast(`Acertos (${acertos}) não pode ser maior que o total (${total})`, 'error'); return; }
    registro.total = total;
    registro.acertos = acertos;
    registro.descricao = document.getElementById('habit-desc')?.value;
    // Feature 13: collect gabarito por disciplina
    const gabDiscs = [];
    getAllDisciplinas().forEach(({ disc }) => {
      const tot = parseInt(document.getElementById(`sim-total-${disc.id}`)?.value || '');
      const ace = parseInt(document.getElementById(`sim-acertos-${disc.id}`)?.value || '');
      if (!isNaN(tot) && tot > 0) {
        // Fix J: cap per-disc acertos at its total
        gabDiscs.push({ discId: disc.id, discNome: disc.nome, total: tot, acertos: isNaN(ace) ? 0 : Math.min(ace, tot) });
      }
    });
    if (gabDiscs.length > 0) registro.gabaritoPorDisc = gabDiscs;

  } else if (currentHabitType === 'discursiva') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const nota = parseFloat(document.getElementById('habit-nota')?.value || '0');
    // Fix J: validate nota
    if (!isNaN(nota) && (nota < 0 || nota > 10)) { showToast('Nota deve estar entre 0 e 10', 'error'); return; }
    registro.nota = isNaN(nota) ? null : nota;

  } else if (currentHabitType === 'leitura') {
    registro.descricao = document.getElementById('habit-desc')?.value;
    const paginas = parseInt(document.getElementById('habit-paginas')?.value || '0');
    // Fix J: validate paginas
    if (isNaN(paginas) || paginas < 1) { showToast('Informe o número de páginas (mínimo 1)', 'error'); return; }
    registro.paginas = paginas;

  } else {
    registro.descricao = document.getElementById('habit-desc')?.value;
  }

  if (!state.habitos[currentHabitType]) state.habitos[currentHabitType] = [];
  state.habitos[currentHabitType].push(registro);
  scheduleSave();
  closeModal('modal-habit');
  renderCurrentView();
  showToast('Hábito registrado!', 'success');
}

export function calcSimuladoPerc() {
  const tot = parseInt(document.getElementById('habit-total')?.value || '0');
  const ace = parseInt(document.getElementById('habit-acertos')?.value || '0');
  const el = document.getElementById('sim-perc');
  if (!el || !tot) return;
  const pct = Math.round(ace / tot * 100);
  const color = pct >= 70 ? 'var(--accent)' : pct >= 50 ? 'var(--orange)' : 'var(--red)';
  el.innerHTML = `<span style="color:${color};">${pct}% de aproveitamento (${ace}/${tot})</span>`;
}

export function deleteHabito(tipo, id) {
  showConfirm('Excluir este registro de hábito?', () => {
    state.habitos[tipo] = (state.habitos[tipo] || []).filter(h => h.id !== id);
    habitHistPage = 1;
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir', title: 'Excluir registro' });
}

// =============================================
// EDITAIS VIEW
// =============================================
export let _vertSearchDebounce = null;

export function onVertSearch(val) {
  vertSearch = val;
  clearTimeout(_vertSearchDebounce);
  _vertSearchDebounce = setTimeout(() => {
    // Fix 3: only re-render the list portion, not the entire view
    const listEl = document.getElementById('vert-list-container');
    if (listEl) {
      renderVerticalList(listEl);
    } else {
      renderCurrentView(); // fallback if container not found
    }
  }, 200);
}
export let vertFilterEdital = '';
export let vertFilterStatus = 'todos';
export let vertSearch = '';

export function getFilteredVertItems() {
  let items = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
        for (const ass of disc.assuntos) {
          items.push({ edital, grupo, disc, ass });
        }
      }
  }
  if (vertFilterEdital) items = items.filter(i => i.edital.id === vertFilterEdital);
  if (vertFilterStatus === 'pendentes') items = items.filter(i => !i.ass.concluído);
  if (vertFilterStatus === 'concluídos') items = items.filter(i => i.ass.concluído);
  if (vertSearch) {
    const q = vertSearch.toLowerCase();
    items = items.filter(i => i.ass.nome.toLowerCase().includes(q) || i.disc.nome.toLowerCase().includes(q));
  }
  return items;
}

export function renderVertical(el) {
  // Fix 3: render the shell ONCE (filters, header); list gets its own container
  el.innerHTML = `
    <!-- Filters row — full re-render only when filter chips change -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <div style="position:relative;flex:1;min-width:180px;">
        <i class="fa fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px;"></i>
        <input class="form-control" style="padding-left:32px;" id="vert-search" value="${esc(vertSearch)}"
          placeholder="Buscar assunto ou disciplina..."
          oninput="onVertSearch(this.value)">
      </div>
      <select class="form-control" style="width:auto;" onchange="vertFilterEdital=this.value;renderCurrentView()">
        <option value="">Todos os editais</option>
        ${state.editais.map(e => `<option value="${e.id}" ${vertFilterEdital === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
      </select>
      <div class="filter-row" style="margin:0;gap:4px;">
        ${['todos', 'pendentes', 'concluídos'].map(s => `
          <div class="filter-chip ${vertFilterStatus === s ? 'active' : ''}" onclick="vertFilterStatus='${s}';renderCurrentView()">
            ${{ todos: 'Todos', pendentes: 'Pendentes', concluídos: 'Concluídos' }[s]}
          </div>`).join('')}
      </div>
    </div>

    <!-- Stats header -->
    <div id="vert-stats-bar" class="card" style="margin-bottom:16px;padding:14px 20px;"></div>

    <!-- Fix 3: isolated list container — only this gets re-rendered on search -->
    <div class="card"><div id="vert-list-container" style="padding:0;"></div></div>
  `;
  renderVerticalList(document.getElementById('vert-list-container'));
}

export function renderVerticalList(container) {
  if (!container) return;
  const allItems = getFilteredVertItems();
  const total = allItems.length;
  const concluídos = allItems.filter(i => i.ass.concluído).length;
  const pct = total > 0 ? Math.round(concluídos / total * 100) : 0;

  // Update stats bar
  const statsBar = document.getElementById('vert-stats-bar');
  if (statsBar) {
    statsBar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:2px;">VISÃO LINEAR DO EDITAL</div>
          <div style="font-size:20px;font-weight:800;">${concluídos} de ${total} assuntos concluídos</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:900;color:var(--accent);">${pct}<span style="font-size:16px;opacity:0.7;">%</span></div>
          <div style="background:var(--border);height:6px;border-radius:4px;width:120px;margin-top:4px;">
            <div style="background:var(--accent);height:6px;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>`;
  }

  if (allItems.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div>
      <h4>${state.editais.length === 0 ? 'Nenhum edital cadastrado' : 'Nenhum assunto encontrado'}</h4>
      <p>${state.editais.length === 0 ? 'Crie um edital em Editais para usar esta visualização.' : 'Tente ajustar os filtros.'}</p>
    </div>`;
    return;
  }

  const hiReg = vertSearch ? new RegExp(`(${vertSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
  const highlight = str => hiReg ? esc(str).replace(hiReg, '<mark>$1</mark>') : esc(str);

  container.innerHTML = allItems.map(({ edital, disc, ass }) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);${ass.concluído ? 'background:#f8fafc;' : ''}">
      <div class="check-circle ${ass.concluído ? 'done' : ''}" onclick="toggleAssunto('${disc.id}','${ass.id}')" style="flex-shrink:0;">${ass.concluído ? 'Ô£ô' : ''}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${ass.concluído ? '400' : '600'};color:${ass.concluído ? 'var(--text-muted)' : 'var(--text-primary)'};${ass.concluído ? 'text-decoration:line-through;' : ''}">${highlight(ass.nome)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${esc(disc.icone || '📚')} ${highlight(disc.nome)} • ${esc(edital.nome)}</div>
      </div>
      ${ass.concluído ? `<div style="text-align:right;flex-shrink:0;">
        <div style="font-size:10px;color:var(--accent);font-weight:600;">✅ Concluído</div>
        <div style="font-size:10px;color:var(--text-muted);">${formatDate(ass.dataConclusao)}</div>
        <div style="font-size:10px;color:var(--text-muted);">${(ass.revisoesFetas || []).length} rev.</div>
      </div>` : `<button class="btn btn-ghost btn-sm" onclick="addEventoParaAssunto('${edital.id}','${disc.id}','${ass.id}')">📅 Agendar</button>`}
    </div>
  `).join('');
}

export function addEventoParaAssunto(editaId, discId, assId) {
  const d = getDisc(discId);
  const ass = d?.disc.assuntos.find(a => a.id === assId);
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
          if (ti) { ti.value = ass.nome; ti.dataset.autoFilled = 'true'; }
        }
      }, 50);
    }
  }, 50);
}

export function renderEditais(el) {
  el.innerHTML = `
    ${state.editais.length === 0 ? `
      <div class="empty-state" style="padding:80px 20px;">
        <div class="icon">📋</div>
        <h4>Nenhum edital cadastrado</h4>
        <p style="margin-bottom:16px;">Crie seu edital com disciplinas e assuntos para organizar seus estudos.</p>
        <button class="btn btn-primary" onclick="openEditaModal()"><i class="fa fa-plus"></i> Criar Edital</button>
      </div>
    ` : `
      <div class="edital-tree">
        ${state.editais.map(edital => renderEditalTree(edital)).join('')}
      </div>
    `}
  `;
}

export function renderEditalTree(edital) {
  return `
    <div class="tree-edital" id="edital-${edital.id}">
      <div class="tree-edital-header" onclick="toggleEdital('${edital.id}')">
        <span style="width:10px;height:10px;border-radius:50%;background:${edital.cor || '#10b981'};flex-shrink:0;display:inline-block;"></span>
        <span style="flex:1;font-size:14px;font-weight:700;">${esc(edital.nome)}</span>
        <span style="font-size:11px;opacity:0.7;">${edital.disciplinas ? edital.disciplinas.length : 0} disc.</span>
        <button class="icon-btn" style="color:#fff;" title="Editar" onclick="event.stopPropagation();openEditaModal('${edital.id}')">✏️</button>
        <button class="icon-btn" style="color:#fff;" title="Excluir" onclick="event.stopPropagation();deleteEdital('${edital.id}')">🗑️</button>
        <i class="fa fa-chevron-down" style="font-size:12px;opacity:0.7;"></i>
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" onclick="openDiscModal('${edital.id}')" style="margin-right:15px;margin-bottom:10px;">+ Disciplina</button>
      </div>
      <div id="edital-tree-${edital.id}">
        <div class="disc-grid">
          ${(edital.disciplinas || []).map(disc => {
    const totais = disc.assuntos.length;
    const estudados = disc.assuntos.filter(a => a.concluído).length;
    return `
              <div class="disc-card" style="--card-color: ${disc.cor || 'var(--accent)'};">
                <div class="disc-card-title">${disc.icone || '📚'} ${esc(disc.nome)}</div>
                <div class="disc-stats">
                  <div class="disc-stat">
                    <span class="disc-stat-val">${estudados}</span>
                    <span class="disc-stat-label">Tópicos<br>Estudados</span>
                  </div>
                  <div class="disc-stat">
                    <span class="disc-stat-val">${totais}</span>
                    <span class="disc-stat-label">Tópicos<br>Totais</span>
                  </div>
                  <div class="disc-stat">
                    <span class="disc-stat-val">0</span>
                    <span class="disc-stat-label">Questões<br>Resolvidas</span>
                  </div>
                </div>
                <!-- Hover Overlay -->
                <div class="disc-overlay">
                  <button class="disc-action" onclick="event.stopPropagation();openDiscManager('${edital.id}','${disc.id}')">
                    <i class="fa fa-folder-open"></i>
                    <span>Visualizar</span>
                  </button>
                  <button class="disc-action" onclick="event.stopPropagation();openDiscModal('${edital.id}','${disc.id}')">
                    <i class="fa fa-edit"></i>
                    <span>Editar</span>
                  </button>
                  <button class="disc-action" onclick="event.stopPropagation();deleteDisc('${edital.id}','${disc.id}')">
                    <i class="fa fa-trash"></i>
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            `;
  }).join('')}
          ${(edital.disciplinas || []).length === 0 ? '<div style="color:var(--text-muted);font-style:italic;grid-column:1/-1;">Nenhuma disciplina</div>' : ''}
        </div>
      </div>
    </div>
  `;
}

export function toggleEdital(id) {
  const el = document.getElementById(`edital-tree-${id}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

export function toggleDisc(discId) {
  const el = document.getElementById(`disc-tree-${discId}`);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

export function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue; const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      const ass = disc.assuntos.find(a => a.id === assId);
      if (ass) {
        ass.concluído = !ass.concluído;
        ass.dataConclusao = ass.concluído ? todayStr() : null;
        if (ass.concluído) ass.revisoesFetas = [];
        scheduleSave();
        renderCurrentView();
        return;
      }
    }
  }
}


export function deleteAssunto(discId, assId) {
  showConfirm('Excluir este assunto? Eventos vinculados serão desvinculados.', () => {
    const entry = getDisc(discId);
    if (entry) {
      entry.disc.assuntos = entry.disc.assuntos.filter(a => a.id !== assId);
      invalidateDiscCache();
      scheduleSave();
      renderCurrentView();
      if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
        openDiscManager(editingSubjectCtx.editaId, discId);
      }
    }
  }, { danger: true, label: 'Excluir', title: 'Excluir assunto' });
}

export function deleteDisc(editaId, discId) {
  showConfirm('Excluir esta disciplina e todos seus assuntos?\n\nEsta ação não pode ser desfeita.', () => {
    const edital = state.editais.find(e => e.id === editaId);
    if (!edital) return;
    if (!edital.disciplinas) return; edital.disciplinas = edital.disciplinas.filter(d => d.id !== discId);
    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' });
}

export function deleteEdital(editaId) {
  const edital = state.editais.find(e => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(`Excluir "${nome}" completamente?

Todos os grupos, disciplinas e assuntos serão removidos. Esta ação não pode ser desfeita.`, () => {
    state.editais = state.editais.filter(e => e.id !== editaId);
    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir edital', title: 'Excluir edital' });
}

// =============================================
// EDITAL MODAL
// =============================================
export function openEditaModal(editaId = null) {
  const edital = editaId ? state.editais.find(e => e.id === editaId) : null;
  document.getElementById('modal-edital-title').textContent = edital ? 'Editar Edital' : 'Novo Edital';
  document.getElementById('modal-edital-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome do Edital</label>
      <input type="text" class="form-control" id="edital-nome" placeholder="Ex: Concurso TRF 2025" value="${edital ? edital.nome : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="edital-colors">
        ${COLORS.map(c => `<div class="color-swatch ${edital && edital.cor === c ? 'selected' : ''}" style="background:${c};" onclick="selectColor('${c}','edital-colors')"></div>`).join('')}
      </div>
      <input type="hidden" id="edital-cor" value="${edital ? edital.cor : COLORS[0]}">
    </div>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-edital')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEdital('${editaId || ''}')">Salvar Edital</button>
    </div>
  `;
  if (!edital) {
    document.querySelector('#edital-colors .color-swatch').classList.add('selected');
  }
  openModal('modal-edital');
}

export function selectColor(color, containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  container.querySelector(`[style="background:${color};"]`).classList.add('selected');
  const input = document.getElementById(containerId === 'edital-colors' ? 'edital-cor' : containerId === 'disc-colors' ? 'disc-cor' : 'edital-cor');
  if (input) input.value = color;
}

export function saveEdital(editaId) {
  const nome = document.getElementById('edital-nome').value.trim();
  if (!nome) { showToast('Informe o nome do edital', 'error'); return; }
  const cor = document.getElementById('edital-cor').value || COLORS[0];

  if (editaId) {
    const edital = state.editais.find(e => e.id === editaId);
    if (edital) { edital.nome = nome; edital.cor = cor; }
  } else {
    state.editais.push({
      id: uid(), nome, cor,
      disciplinas: []
    });
  }
  scheduleSave();
  closeModal('modal-edital');
  renderCurrentView();
  showToast('Edital salvo!', 'success');
}

// =============================================
// DISCIPLINE MODAL
// =============================================
export function openDiscModal(editaId) {
  editingDiscCtx = { editaId };
  document.getElementById('modal-disc-title').textContent = 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional">
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;" id="disc-icons">
        ${DISC_ICONS.map((ic, i) => `<div style="width:36px;height:36px;border-radius:8px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;transition:all 0.15s;" class="${i === 0 ? 'selected-icon' : ''}" onclick="selectIcon('${ic}', this)">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c, i) => `<div class="color-swatch ${i === 0 ? 'selected' : ''}" style="background:${c};" onclick="selectDiscColor('${c}')"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${COLORS[0]}">
    </div>
  `;
  openModal('modal-disc');
}

export function selectIcon(icon, el) {
  document.querySelectorAll('#disc-icons > div').forEach(d => {
    d.style.border = '2px solid var(--border)';
    d.classList.remove('selected-icon');
  });
  el.style.border = '2px solid var(--accent)';
  el.classList.add('selected-icon');
  document.getElementById('disc-icone').value = icon;
}

export function selectDiscColor(color) {
  document.querySelectorAll('#disc-colors .color-swatch').forEach(s => s.classList.remove('selected'));
  document.querySelector(`#disc-colors [style="background:${color};"]`).classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

export function saveDisc() {
  const nome = document.getElementById('disc-nome').value.trim();
  if (!nome) { showToast('Informe o nome da disciplina', 'error'); return; }
  const icone = document.getElementById('disc-icone').value;
  const cor = document.getElementById('disc-cor').value;
  const { editaId } = editingDiscCtx;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  if (!edital.disciplinas) edital.disciplinas = []; edital.disciplinas.push({ id: uid(), nome, icone, cor, assuntos: [] });
  scheduleSave();
  closeModal('modal-disc');
  renderCurrentView();
  showToast('Disciplina criada!', 'success');
}

// =============================================
// SUBJECT MANAGER AND BULK ADD
// =============================================
export function openDiscManager(editaId, discId) {
  let disc = null;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const d = edital.disciplinas.find(x => x.id === discId);
    if (d) { disc = d; break; }
  }
  if (!disc) return;

  editingSubjectCtx = { editaId, discId };

  // Render subject items
  const subjectsHtml = disc.assuntos.map((ass, idx) => `
    <div class="sm-list-item" draggable="true"
         data-disc-id="${disc.id}"
         data-ass-idx="${idx}"
         ondragstart="dndStart(event,'${disc.id}',${idx})"
         ondragover="dndOver(event)"
         ondragleave="dndLeave(event)"
         ondrop="dndDrop(event,'${disc.id}',${idx})">
      <div class="sm-drag-handle" title="Arrastar">☰</div>
      <div class="sm-item-text" onclick="editSubjectInline('${disc.id}', '${ass.id}', this)">${esc(ass.nome)}</div>
      <div class="sm-item-actions">
        <button onclick="moveSubject('${disc.id}', ${idx}, -1)" title="Subir"><i class="fa fa-chevron-up"></i></button>
        <button onclick="moveSubject('${disc.id}', ${idx}, 1)" title="Descer"><i class="fa fa-chevron-down"></i></button>
        <button onclick="deleteAssunto('${disc.id}', '${ass.id}')" title="Excluir"><i class="fa fa-trash"></i></button>
      </div>
    </div>
  `).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">Nenhum tópico adicionado.</div>';

  const colorOptions = COLORS.map(c => `<option value="${c}" ${disc.cor === c ? 'selected' : ''} style="background:${c};color:#fff;">${c}</option>`).join('');

  document.getElementById('modal-disc-manager-title').textContent = disc.nome || 'Gerenciar Disciplina';
  document.getElementById('modal-disc-manager-body').innerHTML = `
    <div class="sm-header">
      <div class="sm-form-group">
        <label>Nome</label>
        <input type="text" id="dm-nome" value="${esc(disc.nome)}">
      </div>
      <div class="sm-form-group" style="flex:0.4;">
        <label>Cor</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="color" id="dm-cor-picker" value="${disc.cor || COLORS[0]}" style="width:30px;height:30px;padding:0;border:none;border-radius:4px;cursor:pointer;">
          <select id="dm-cor" class="form-control" style="flex:1;" onchange="document.getElementById('dm-cor-picker').value=this.value">
            ${colorOptions}
          </select>
        </div>
      </div>
    </div>
    
    <div class="sm-toolbar">
      <span>Tópicos (${disc.assuntos.length})</span>
      <div class="sm-toolbar-actions">
        <!-- <button class="sm-toolbar-btn"><i class="fa fa-sort"></i> Ordenar Tópicos</button> -->
        <button class="sm-toolbar-btn" onclick="openSubjectAddModal('${editaId}', '${discId}')"><i class="fa fa-plus"></i> Novo Tópico</button>
      </div>
    </div>
    
    <div class="sm-list" id="dm-subject-list">
      ${subjectsHtml}
    </div>
    
    <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <button class="btn btn-ghost" style="color:var(--danger);" onclick="deleteDisc('${editaId}','${discId}');closeModal('modal-disc-manager');">Remover</button>
      <button class="btn btn-primary" onclick="saveDiscManager('${editaId}','${discId}')">Salvar</button>
    </div>
  `;
  openModal('modal-disc-manager');
}

export function editSubjectInline(discId, assId, el) {
  const currentText = el.innerText;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.style.width = '100%';
  input.style.border = '1px solid var(--accent)';
  input.style.padding = '4px 8px';
  input.style.borderRadius = '4px';
  input.style.background = 'var(--bg)';
  input.style.color = 'var(--text)';

  input.onblur = () => finishInlineEdit(discId, assId, input.value, el);
  input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); else if (e.key === 'Escape') { input.value = currentText; input.blur(); } };

  el.innerHTML = '';
  el.appendChild(input);
  input.focus();
}

export function finishInlineEdit(discId, assId, newName, el) {
  newName = newName.trim();
  const entry = getDisc(discId);
  if (entry && newName) {
    const ass = entry.disc.assuntos.find(a => a.id === assId);
    if (ass) {
      ass.nome = newName;
      scheduleSave();
    }
  }
  if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
    openDiscManager(editingSubjectCtx.editaId, discId);
    renderCurrentView();
  }
}

export function moveSubject(discId, idx, dir) {
  const entry = getDisc(discId);
  if (!entry) return;
  const assuntos = entry.disc.assuntos;
  if (idx + dir < 0 || idx + dir >= assuntos.length) return;

  const temp = assuntos[idx];
  assuntos[idx] = assuntos[idx + dir];
  assuntos[idx + dir] = temp;

  scheduleSave();
  if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
    openDiscManager(editingSubjectCtx.editaId, discId);
    renderCurrentView();
  }
}

export function saveDiscManager(editaId, discId) {
  const entry = getDisc(discId);
  if (!entry) return;

  const nome = document.getElementById('dm-nome').value.trim();
  const cor = document.getElementById('dm-cor-picker').value;

  if (nome) entry.disc.nome = nome;
  if (cor) entry.disc.cor = cor;

  scheduleSave();
  closeModal('modal-disc-manager');
  renderCurrentView();
  showToast('Disciplina atualizada!', 'success');
}

export function openSubjectAddModal(editaId, discId) {
  editingSubjectCtx = { editaId, discId };
  document.getElementById('modal-subject-add-body').innerHTML = `
    <div class="form-group">
      <label class="form-label" style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:600;">Conteúdo</label>
      <textarea id="bulk-subject-text" class="form-control" rows="8" style="font-family:inherit;font-size:14px;resize:vertical;" placeholder="Ex:\n1. Configuração do Estado\n2. Direitos Fundamentais\n3. ..."></textarea>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        Dica: Você pode fazer quebra de linha com Enter para adicionar mais de um tópico. O sistema limpará numerações como "1.", "1.1", "-", etc.
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
        <input type="checkbox" id="bulk-save-continue"> Salvar e continuar
      </label>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="closeModal('modal-subject-add')">Cancelar</button>
        <button class="btn btn-primary" onclick="saveBulkSubjects()">Adicionar</button>
      </div>
    </div>
  `;
  openModal('modal-subject-add');
  setTimeout(() => document.getElementById('bulk-subject-text').focus(), 100);
}

export function saveBulkSubjects() {
  const text = document.getElementById('bulk-subject-text').value;
  if (!text.trim()) { closeModal('modal-subject-add'); return; }

  const { discId } = editingSubjectCtx;
  const entry = getDisc(discId);
  if (!entry) return;

  // Parse lines and clean numbering
  const lines = text.split('\n')
    .map(s => s.trim())
    // Matches: "1. ", "1.1 ", "1) ", "a) ", "III - ", "- ", "• "
    .map(s => s.replace(/^([\d]+\.[\d\.]*|\d+\)|[a-z]\)|[IVXLCDM]+\s*-|[-•])\s+/i, ''))
    .filter(s => s.length > 0);

  let added = 0;
  lines.forEach(nome => {
    if (!entry.disc.assuntos.find(a => a.nome === nome)) {
      entry.disc.assuntos.push({ id: uid(), nome, concluído: false, dataConclusao: null, revisoesFetas: [] });
      added++;
    }
  });

  scheduleSave();
  renderCurrentView();

  const keepOpen = document.getElementById('bulk-save-continue').checked;
  if (keepOpen) {
    document.getElementById('bulk-subject-text').value = '';
    document.getElementById('bulk-subject-text').focus();
    showToast(`${added} tópico(s) adicionado(s)!`, 'success');
  } else {
    closeModal('modal-subject-add');
    openDiscManager(editingSubjectCtx.editaId, discId);
    showToast(`${added} tópico(s) adicionado(s)!`, 'success');
  }
}

// =============================================
// ADD EVENT MODAL
// =============================================
export function openAddEventModal(dateStr = null) {
  editingEventId = null;
  const allDiscs = getAllDisciplinas();
  const discOptions = allDiscs.map(({ disc, edital }) => `<option value="${disc.id}" data-edital="${edital.id}">${esc(edital.nome)} → ${esc(disc.nome)}</option>`
  ).join('');

  document.getElementById('modal-event-title').textContent = 'Adicionar Evento de Estudo';
  document.getElementById('modal-event-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">O que você vai estudar?</label>
      <div class="event-type-grid" style="grid-template-columns:repeat(2,1fr);">
        <div class="event-type-card selected" id="etype-conteudo" onclick="selectEventType('conteudo')">
          <div class="et-icon">📖</div>
          <div class="et-label">Avançar no Edital</div>
          <div class="et-sub">Estudar disciplinas e assuntos</div>
        </div>
        <div class="event-type-card" id="etype-habito" onclick="selectEventType('habito')">
          <div class="et-icon">⚡</div>
          <div class="et-label">Hábito de Estudo</div>
          <div class="et-sub">Questões, simulado, etc.</div>
        </div>
      </div>
    </div>

    <div id="event-conteudo-fields">
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="form-control" id="event-disc" onchange="loadAssuntos()">
          <option value="">Sem disciplina específica</option>
          ${discOptions}
        </select>
      </div>
      <div class="form-group" id="event-assunto-group" style="display:none;">
        <label class="form-label">Assunto (opcional)</label>
        <select class="form-control" id="event-assunto">
          <option value="">Sem assunto específico</option>
        </select>
      </div>
    </div>

    <div id="event-habito-fields" style="display:none;">
      <div class="form-group">
        <label class="form-label">Tipo de Hábito</label>
        <select class="form-control" id="event-habito">
          ${HABIT_TYPES.map(h => `<option value="${h.key}">${h.icon} ${h.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Título do Evento</label>
      <input type="text" class="form-control" id="event-titulo" placeholder="Ex: Estudar Direito Constitucional">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Data</label>
        <input type="date" class="form-control" id="event-data" value="${dateStr || todayStr()}"
          oninput="updateDayLoad(this.value)">
        <div id="day-load-hint" style="font-size:11px;margin-top:4px;color:var(--text-muted);"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Duração Prevista</label>
        <select class="form-control" id="event-duracao">
          <option value="30">30 min</option>
          <option value="60" selected>1 hora</option>
          <option value="90">1h30</option>
          <option value="120">2 horas</option>
          <option value="180">3 horas</option>
          <option value="240">4 horas</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Anotações (opcional)</label>
      <textarea class="form-control" id="event-notas" rows="2" placeholder="Observações rápidas sobre o estudo..."></textarea>
    </div>
    <details style="margin-bottom:12px;">
      <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:6px 0;">📝 Fontes e referências (opcional)</summary>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Fontes de Estudo</label>
          <input type="text" class="form-control" id="event-fontes" placeholder="Ex: Gran Cursos pág. 45, Art. 37 CF/88...">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Legislação Pertinente</label>
          <input type="text" class="form-control" id="event-legislacao" placeholder="Ex: Lei 8.112/90, CF Art. 5º...">
        </div>
      </div>
    </details>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-event')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEvent()">Adicionar Evento</button>
    </div>
  `;
  openModal('modal-event');
  // Tech 3: Show day load immediately
  setTimeout(() => updateDayLoad(dateStr || todayStr()), 50);
}

export let currentEventType = 'conteudo';
export function selectEventType(tipo) {
  currentEventType = tipo;
  document.getElementById('etype-conteudo').classList.toggle('selected', tipo === 'conteudo');
  document.getElementById('etype-habito').classList.toggle('selected', tipo === 'habito');
  document.getElementById('event-conteudo-fields').style.display = tipo === 'conteudo' ? '' : 'none';
  document.getElementById('event-habito-fields').style.display = tipo === 'habito' ? '' : 'none';
}

// Tech 3: Real-time day-load hint
export function updateDayLoad(dateStr) {
  const el = document.getElementById('day-load-hint');
  if (!el || !dateStr) return;
  const evts = state.eventos.filter(e => e.data === dateStr && e.status !== 'estudei');
  const mins = evts.reduce((s, e) => s + (e.duracao || 0), 0);
  if (evts.length === 0) {
    el.textContent = '📅 Dia livre';
    el.style.color = 'var(--accent)';
  } else {
    const horas = (mins / 60).toFixed(1);
    const color = mins > 480 ? 'var(--red)' : mins > 300 ? 'var(--orange)' : 'var(--text-muted)';
    el.textContent = `⚠️ ${evts.length} evento(s) já agendado(s) neste dia — ${horas}h previstas`;
    el.style.color = color;
  }
}

export function loadAssuntos() {
  const discId = document.getElementById('event-disc').value;
  const assuntoGroup = document.getElementById('event-assunto-group');
  const assuntoSel = document.getElementById('event-assunto');
  if (!discId) {
    assuntoGroup.style.display = 'none';
    return;
  }
  const d = getDisc(discId);
  // Fix 5: auto-fill title when user hasn't typed anything yet
  const tituloInput = document.getElementById('event-titulo');
  if (d && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
    tituloInput.value = `Estudar ${d.disc.nome}`;
    tituloInput.dataset.autoFilled = 'true';
  }
  if (!d || d.disc.assuntos.length === 0) { assuntoGroup.style.display = 'none'; return; }
  const pending = d.disc.assuntos.filter(a => !a.concluído);
  assuntoSel.innerHTML = `<option value="">Sem assunto específico</option>` +
    pending.map(a => `<option value="${a.id}">${esc(a.nome)}</option>`).join('');
  assuntoGroup.style.display = '';
  assuntoSel.onchange = () => {
    const assId = assuntoSel.value;
    if (assId && (!tituloInput.value || tituloInput.dataset.autoFilled === 'true')) {
      const ass = d.disc.assuntos.find(a => a.id === assId);
      if (ass) {
        tituloInput.value = ass.nome;
        tituloInput.dataset.autoFilled = 'true';
      }
    } else if (!assId && tituloInput.dataset.autoFilled === 'true') {
      tituloInput.value = `Estudar ${d.disc.nome}`;
    }
  };
}

// Clear auto-filled flag if user manually types in title
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'event-titulo') {
    e.target.dataset.autoFilled = 'false';
  }
});

export function saveEvent() {
  const titulo = document.getElementById('event-titulo').value.trim();
  const data = document.getElementById('event-data').value;
  const duracao = parseInt(document.getElementById('event-duracao').value || '60');
  const notas = document.getElementById('event-notas').value.trim();
  const fontes = document.getElementById('event-fontes')?.value.trim() || '';
  const legislacao = document.getElementById('event-legislacao')?.value.trim() || '';

  let discId, assId, habito, autoTitle = titulo;

  if (currentEventType === 'conteudo') {
    discId = document.getElementById('event-disc').value;
    assId = document.getElementById('event-assunto')?.value;
    if (!titulo && discId) {
      const d = getDisc(discId);
      autoTitle = `Estudar ${d?.disc.nome || 'Disciplina'}`;
    }
  } else {
    habito = document.getElementById('event-habito').value;
    const h = getHabitType(habito);
    if (!titulo && h) autoTitle = h.label;
  }

  if (!autoTitle) { showToast('Informe um título para o evento', 'error'); return; }

  // Helper that actually creates and saves the event
  const doSave = () => {
    const evento = {
      id: uid(), titulo: autoTitle, data, duracao, notas, fontes, legislacao,
      status: 'agendado', tempoAcumulado: 0,
      tipo: currentEventType,
      discId: discId || null,
      assId: assId || null,
      habito: habito || null,
      criadoEm: new Date().toISOString()
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Evento adicionado!', 'success');
  };

  // Tech 3: Warn if there are already many events on this day
  const existingOnDay = state.eventos.filter(e => e.data === data && e.status !== 'estudei');
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round(totalDuracao / 60 * 10) / 10;
    const msg = existingOnDay.length >= 3
      ? `Você já tem ${existingOnDay.length} evento(s) neste dia. Adicionar mais pode gerar sobrecarga.`
      : `Você já tem ${Math.round((totalDuracao - duracao) / 60 * 10) / 10}h agendadas neste dia. Com este evento seriam ${horas}h.`;
    showConfirm(msg, doSave, { label: 'Adicionar mesmo assim', title: 'Muitos eventos no dia' });
    return;
  }

  doSave();
}

// =============================================
// CONFIG VIEW
// =============================================
export function renderConfig(el) {
  const cfg = state.config;
  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>🎨 Aparência</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Modo escuro</div>
                <div class="config-sub">Reduz o brilho da tela para uso noturno</div>
              </div>
              <div class="toggle ${cfg.darkMode ? 'on' : ''}" id="dark-toggle"
                onclick="applyTheme(true);this.classList.toggle('on');renderCurrentView()"></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>⚖️ Calendário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Visualização padrão</div>
                <div class="config-sub">Modo inicial do calendário</div>
              </div>
              <select class="form-control" style="width:120px;" onchange="updateConfig('visualizacao',this.value)">
                <option value="mes" ${cfg.visualizacao === 'mes' ? 'selected' : ''}>Mês</option>
                <option value="semana" ${cfg.visualizacao === 'semana' ? 'selected' : ''}>Semana</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Primeiro dia da semana</div>
              </div>
              <select class="form-control" style="width:130px;" onchange="updateConfig('primeirodiaSemana',parseInt(this.value))">
                <option value="0" ${cfg.primeirodiaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${cfg.primeirodiaSemana === 1 ? 'selected' : ''}>Segunda-feira</option>
              </select>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Número da semana</div>
              </div>
              <div class="toggle ${cfg.mostrarNumeroSemana ? 'on' : ''}" onclick="toggleConfig('mostrarNumeroSemana',this)"></div>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade visível</div>
              </div>
              <div class="toggle ${cfg.agruparEventos ? 'on' : ''}" onclick="toggleConfig('agruparEventos',this)"></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>🔄 Frequência de Revisão</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
              Defina em quantos dias após concluir um assunto o programa vai sugerir cada revisão.
            </div>
            <div class="form-group">
              <label class="form-label">Intervalos (em dias, separados por vírgula)</label>
              <input type="text" class="form-control" id="freq-input" value="${(cfg.frequenciaRevisao || [1, 7, 30, 90]).join(', ')}"
                onchange="updateFrequencia(this.value)">
            </div>
            <div style="font-size:12px;color:var(--text-muted);">Ex: 1, 7, 30, 90 = 4 revisões no 1º, 7º, 30º e 90º dia</div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>😁️ Google Drive</h3></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="font-size:32px;">😁️</div>
              <div>
                <div style="font-size:14px;font-weight:700;">${cfg.driveConnected ? 'Conectado ao Google Drive' : 'Não conectado'}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${cfg.driveConnected ? 'Seus dados são sincronizados automaticamente' : 'Sincronize seus dados entre dispositivos'}</div>
              </div>
            </div>
            ${cfg.driveConnected ? `
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" onclick="syncToDrive();showToast('Sincronizando...','info')">
                  <i class="fa fa-cloud-upload-alt"></i> Sincronizar agora
                </button>
                <button class="btn btn-ghost btn-sm" onclick="loadFromDrive()">
                  <i class="fa fa-cloud-download-alt"></i> Carregar do Drive
                </button>
                <button class="btn btn-danger btn-sm" onclick="driveDisconnect()">Desconectar</button>
              </div>
            ` : `
              <button class="btn btn-primary" onclick="openDriveModal()">
                <i class="fa fa-cloud"></i> Conectar ao Google Drive
              </button>
            `}
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>🔖 Notificações</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Notificações do browser</div>
                <div class="config-sub">${'Notification' in window ? (Notification.permission === 'granted' ? '✅ Ativadas' : Notification.permission === 'denied' ? '­ƒÜ½ Bloqueadas (altere nas config do browser)' : 'Permite receber lembretes de eventos e revisões') : '❌ Browser não suporta'}</div>
              </div>
              ${'Notification' in window && Notification.permission !== 'denied' && Notification.permission !== 'granted' ? `
                <button class="btn btn-primary btn-sm" onclick="requestNotifPermission()">🔖 Ativar</button>
              ` : Notification.permission === 'granted' ? `
                <button class="btn btn-ghost btn-sm" onclick="scheduleNotifications(true);showToast('Lembretes enviados!','success')">🔖 Testar</button>
              ` : ''}
            </div>
            ${Notification.permission === 'granted' ? `
            <div class="config-row">
              <div>
                <div class="config-label">Lembrete noturno</div>
                <div class="config-sub">Aviso às 20h se houver eventos pendentes</div>
              </div>
              <div style="font-size:12px;color:var(--accent);font-weight:600;">👙 20:00</div>
            </div>` : ''}
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>💾 Dados</h3></div>
          <div class="card-body">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
              ${state.eventos.length} evento(s) ativos
              ${(state.arquivo || []).length > 0 ? ` • ${state.arquivo.length} arquivado(s)` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-ghost" onclick="exportData()">📱 Exportar JSON</button>
              <button class="btn btn-ghost" onclick="importData()">📡 Importar JSON</button>
              <button class="btn btn-ghost btn-sm" onclick="archiveOldEvents(90)" title="Move eventos concluídos há mais de 90 dias para o arquivo">🙉 Arquivar antigos</button>
              <button class="btn btn-danger btn-sm" onclick="clearAllData()">🙆 Limpar tudo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>ℹ️ Sobre</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
              <strong>Estudo Organizado</strong> é um app para planejamento e organização de estudos para concursos públicos.<br><br>
              Baseado no Ciclo PDCA: planeje no Calendário, execute no Meu Estudo Diário, meça no Dashboard e corrija com as Revisões.<br><br>
              <span style="font-size:11px;color:var(--text-muted);">Versão 1.0 • Dados salvos localmente + Google Drive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function updateConfig(key, value) {
  state.config[key] = value;
  scheduleSave();
}

export function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

export function updateFrequencia(value) {
  const nums = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

export function driveDisconnect() {
  state.config.driveConnected = false;
  state.config.driveToken = null;
  state.config.driveFileId = null;
  saveLocal();
  updateDriveUI();
  renderCurrentView();
  showToast('Google Drive desconectado', 'info');
}

// Fix 7: Move concluded events older than N days into state.arquivo.
// Archived events are excluded from all renders/filters but kept in export/Drive sync.
export function archiveOldEvents(days = 90) {
  const cutoffStr = cutoffDateStr(days);
  const toArchive = state.eventos.filter(e => e.status === 'estudei' && e.data && e.data < cutoffStr);
  if (toArchive.length === 0) {
    showToast('Nenhum evento para arquivar.', 'info');
    return;
  }
  showConfirm(
    `Arquivar ${toArchive.length} evento(s) concluído(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
    () => {
      state.arquivo = [...(state.arquivo || []), ...toArchive];
      const archiveIds = new Set(toArchive.map(e => e.id));
      state.eventos = state.eventos.filter(e => !archiveIds.has(e.id));
      scheduleSave();
      renderCurrentView();
      showToast(`${toArchive.length} evento(s) arquivados.`, 'success');
    },
    { label: 'Arquivar', title: `Arquivar eventos (>${days} dias)` }
  );
}

export function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `estudo-organizado-backup-${todayStr()}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Dados exportados!', 'success');
}

export function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        showConfirm(
          `Importar dados de "${file.name}"?\n\nIsso substituirá todos os dados atuais. Faça um export antes para garantir o backup.`,
          () => {
            setState(imported);
            invalidateDiscCache();
            invalidateRevCache();
            invalidateTodayCache();
            saveLocal();
            renderCurrentView();
            showToast('Dados importados com sucesso!', 'success');
          },
          { label: 'Importar', title: 'Importar dados' }
        );
      } catch (err) {
        showToast('Arquivo inválido! Verifique se î um JSON de backup do Estudo Organizado.', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function clearAllData() {
  showConfirm(
    '⚠️ Apagar TODOS os dados permanentemente?\n\nEditais, eventos, hábitos e configurações serão removidos.\n\nEsta ação é irreversível.',
    () => {
      showConfirm(
        'Última confirmação: isso não pode ser desfeito.',
        () => {
          localStorage.removeItem('estudo-organizado');
          location.reload();
        },
        { danger: true, label: 'Apagar tudo definitivamente', title: '⚠️ Confirmação final' }
      );
    },
    { danger: true, label: 'Continuar com exclusão', title: '⚠️ Apagar todos os dados' }
  );
}

// =============================================
// UX 3 — DRAG AND DROP ASSUNTOS
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
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  const srcIdx = _dndSrcIdx;
  if (srcIdx === null || srcIdx === targetIdx || _dndSrcDiscId !== discId) return;
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue; const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      const moved = disc.assuntos.splice(srcIdx, 1)[0];
      disc.assuntos.splice(targetIdx, 0, moved);
      scheduleSave();
      // Re-render then re-open that disc's assuntos if available
      renderCurrentView();
      if (editingSubjectCtx && editingSubjectCtx.discId === discId) {
        openDiscManager(editingSubjectCtx.editaId, discId);
      }
      showToast('Assunto reordenado!', 'success');
      _dndSrcDiscId = null; _dndSrcIdx = null; return;
    }
  }
} document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

// =============================================
// UX 1 — GLOBAL SEARCH
// =============================================
export let searchBlurTimeout = null;

export function onSearch(query) {
  const box = document.getElementById('search-results');
  if (!query || query.length < 2) { box.classList.remove('open'); return; }
  const q = query.toLowerCase();
  const results = { eventos: [], assuntos: [], habitos: [] };

  // Search eventos
  state.eventos.forEach(ev => {
    if (ev.titulo.toLowerCase().includes(q)) {
      const disc = ev.discId ? getDisc(ev.discId)?.disc : null;
      results.eventos.push({ ev, disc });
    }
  });

  // Search assuntos
  getAllDisciplinas().forEach(({ disc, edital }) => {
    disc.assuntos.forEach(ass => {
      if (ass.nome.toLowerCase().includes(q) || disc.nome.toLowerCase().includes(q)) {
        results.assuntos.push({ ass, disc, edital });
      }
    });
  });

  // Search hábitos
  HABIT_TYPES.forEach(h => {
    (state.habitos[h.key] || []).forEach(r => {
      if ((r.descricao || '').toLowerCase().includes(q)) {
        results.habitos.push({ r, h });
      }
    });
  });

  const highlight = str => str.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  let html = '';

  if (results.eventos.length) {
    html += `<div class="search-section-title">📅 Eventos</div>`;
    html += results.eventos.slice(0, 5).map(({ ev, disc }) => `
      <div class="search-item" onclick="openEventDetail('${ev.id}');clearSearch()">
        <div class="search-item-icon">${disc ? disc.icone || '📚' : '📅'}</div>
        <div>
          <div class="search-item-label">${highlight(ev.titulo)}</div>
          <div class="search-item-sub">${ev.data ? formatDate(ev.data) : ''}${disc ? ' • ' + disc.nome : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.assuntos.length) {
    html += `<div class="search-section-title">📚 Assuntos</div>`;
    html += results.assuntos.slice(0, 5).map(({ ass, disc, edital }) => `
      <div class="search-item" onclick="navigate('editais');clearSearch()">
        <div class="search-item-icon">${disc.icone || '📚'}</div>
        <div>
          <div class="search-item-label">${highlight(ass.nome)}</div>
          <div class="search-item-sub">${esc(disc.nome)} • ${esc(edital.nome)} ${ass.concluído ? '✅' : ''}</div>
        </div>
      </div>`).join('');
  }

  if (results.habitos.length) {
    html += `<div class="search-section-title">⚡ Hábitos</div>`;
    html += results.habitos.slice(0, 3).map(({ r, h }) => `
      <div class="search-item" onclick="navigate('habitos');clearSearch()">
        <div class="search-item-icon">${h.icon}</div>
        <div>
          <div class="search-item-label">${highlight(r.descricao || h.label)}</div>
          <div class="search-item-sub">${formatDate(r.data)}</div>
        </div>
      </div>`).join('');
  }

  if (!html) html = `<div class="search-empty">Nenhum resultado para "<strong>${query}</strong>"</div>`;
  box.innerHTML = html;
  box.classList.add('open');
}

export function onSearchFocus() {
  clearTimeout(searchBlurTimeout);
  const val = document.getElementById('global-search').value;
  if (val && val.length >= 2) onSearch(val);
}

export function onSearchBlur() {
  searchBlurTimeout = setTimeout(() => {
    document.getElementById('search-results')?.classList.remove('open');
  }, 200);
}

export function clearSearch() {
  document.getElementById('global-search').value = '';
  document.getElementById('search-results').classList.remove('open');
}

// ESC closes search
document.addEventListener('keydown', e => {
  // Fix H: ESC — close the topmost open modal, or clear search
  if (e.key === 'Escape') {
    const openModals = [...document.querySelectorAll('.modal-overlay.open')];
    if (openModals.length > 0) {
      const top = openModals[openModals.length - 1];
      if (top.id === 'modal-confirm') {
        _confirmCallback = null; // Fix B: cancel callback
      }
      closeModal(top.id);
    } else {
      clearSearch();
    }
  }

  // Fix H: Enter submits the active modal form (not inside textarea)
  if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
    const openModal = document.querySelector('.modal-overlay.open:not(#modal-confirm):not(#modal-event-detail)');
    if (openModal) {
      const saveBtn = openModal.querySelector('button[onclick*="save"], button[onclick*="Save"], button.btn-primary');
      if (saveBtn && !saveBtn.disabled) {
        e.preventDefault();
        saveBtn.click();
      }
    }
  }
});

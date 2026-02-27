import { applyTheme, closeModal, currentView, navigate, showConfirm, showToast, openModal, cancelConfirm } from './app.js';
import { cutoffDateStr, esc, formatDate, formatTime, getEventStatus, invalidateTodayCache, todayStr, uid, HABIT_TYPES } from './utils.js';
import { scheduleSave, state, setState, runMigrations } from './store.js';
import { calcRevisionDates, getAllDisciplinas, getDisc, getPendingRevisoes, invalidateDiscCache, invalidateRevCache, reattachTimers, getElapsedSeconds, getPerformanceStats, getPagesReadStats, getSyllabusProgress, getConsistencyStreak, getSubjectStats, getCurrentWeekStats, getPredictiveStats, syncCicloToEventos } from './logic.js';
import { renderCurrentView, renderEventCard, updateBadges } from './components.js';
import { updateDriveUI } from './drive-sync.js';

let calDate = new Date();
export let calViewMode = 'mes';
export function setCalViewMode(mode) {
  calViewMode = mode;
  renderCurrentView();
}
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
// NOVO HOME VIEW (DASHBOARD REDESIGN)
// =============================================
export function renderHome(el) {
  const perf = getPerformanceStats();
  const perfPerc = perf.questionsTotal > 0 ? Math.round((perf.questionsCorrect / perf.questionsTotal) * 100) : 0;

  const prog = getSyllabusProgress();
  const progPerc = prog.totalAssuntos > 0 ? Math.round((prog.totalConcluidos / prog.totalAssuntos) * 100) : 0;

  const pagesReadTotal = getPagesReadStats();

  const streak = getConsistencyStreak();
  const subjStats = getSubjectStats();
  const weekStats = getCurrentWeekStats();

  // Metas
  const metaHoras = state.config.metas?.horasSemana || 20;
  const metaQuest = state.config.metas?.questoesSemana || 150;

  const horasFeitas = weekStats.totalSeconds / 3600;
  const percHoras = Math.min(100, Math.round((horasFeitas / metaHoras) * 100));

  const questFeitas = weekStats.totalQuestions;
  const percQuest = Math.min(100, Math.round((questFeitas / metaQuest) * 100));

  // Data da Prova
  const dataProva = state.config.dataProva;
  let provaText = 'Acompanhe aqui quantos dias faltam para a sua prova! <span data-action="prompt-prova" style="color:var(--accent);font-weight:600;cursor:pointer;">Criar Prova</span>';
  if (dataProva) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const provaDate = new Date(dataProva + 'T00:00:00');
    const diffTime = provaDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      provaText = `<div style="font-size:32px;font-weight:800;color:var(--accent);line-height:1;">${diffDays}</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">dias para a prova (${formatDate(dataProva)})</div>`;
    } else if (diffDays === 0) {
      provaText = `<strong style="color:var(--accent);font-size:18px;">É hoje! Boa sorte! 🍀</strong>`;
    } else {
      provaText = `Prova já foi realizada há ${Math.abs(diffDays)} dias. <span data-action="prompt-prova" style="color:var(--accent);font-weight:600;cursor:pointer;">Nova Prova</span>`;
    }
  }

  // Previsões da Semana
  const pred = getPredictiveStats(metaHoras);
  const statusColors = {
    'verde': 'var(--green)',
    'amarelo': 'var(--yellow)',
    'vermelho': 'var(--red)'
  };
  const statusIcons = {
    'verde': 'fa-check-circle',
    'amarelo': 'fa-exclamation-triangle',
    'vermelho': 'fa-skull-crossbones'
  };
  const sc = statusColors[pred.status];
  const si = statusIcons[pred.status];

  const previsorHtml = `
    <div class="card p-16" style="border-left: 4px solid ${sc};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="dash-label">PREVISÃO DA SEMANA</div>
        <i class="fa ${si}" style="color:${sc};font-size:16px;"></i>
      </div>
      <div style="font-size:13px;color:var(--text-primary);margin-bottom:8px;">
        Projeção: <strong>${pred.projectedPerc}%</strong> da meta (Ritmo: ${formatTime(pred.burnRate).slice(0, 5)}/dia).
      </div>
      <div style="font-size:12px;color:var(--text-secondary); background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; line-height: 1.4;">
        ${pred.suggestion}
      </div>
    </div>
  `;

  // HEATMAP
  const heatmapHtml = streak.heatmap.map(x =>
    `<div class="streak-dot ${x ? 'streak-dot-ok' : 'streak-dot-miss'}"><i class="fa ${x ? 'fa-check' : 'fa-times'}"></i></div>`
  ).join('');

  // SESSIONS CHART
  const maxWeeklySec = Math.max(...weekStats.dailySeconds, 3600); // at least 1h scale
  const barsHtml = weekStats.dailySeconds.map((sec, i) => {
    const h = (sec / maxWeeklySec) * 100;
    const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;height:100%;justify-content:flex-end;">
        <div style="width:100%;max-width:30px;height:${h}%;background:var(--accent);border-radius:4px 4px 0 0;min-height:2px;transition:height 0.3s;" title="${formatTime(sec)}"></div>
        <div style="font-size:10px;font-weight:600;color:var(--text-muted);margin-top:8px;">${days[i]}</div>
      </div>
    `;
  }).join('');

  // SUBJECTS TABLE
  const subjHtml = subjStats.map(s => {
    const apr = s.acertos + s.erros > 0 ? Math.round((s.acertos / (s.acertos + s.erros)) * 100) : 0;
    const aprColor = apr >= 80 ? 'green' : apr >= 60 ? 'orange' : apr > 0 ? 'red' : 'gray';
    const hasData = s.tempo > 0 || (s.acertos + s.erros) > 0;

    // Only show subjects with data to avoid a huge empty list, or show all if specifically requested.
    // For now, let's show all that have at least some time or questions, or if it's empty, just '--'.
    return `
      <div style="display:grid;grid-template-columns:1fr 80px 40px 40px 40px;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;align-items:center;">
        <div style="color:var(--accent);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(s.nome)}">${esc(s.nome)}</div>
        <div style="color:var(--text-secondary);text-align:right;font-family:'DM Mono',monospace;">${s.tempo > 0 ? formatTime(s.tempo) : '-'}</div>
        <div style="color:var(--green);text-align:center;">${s.acertos}</div>
        <div style="color:var(--red);text-align:center;">${s.erros}</div>
        <div style="display:flex;justify-content:center;"><div class="event-tag ${aprColor}" style="padding:2px 6px;font-size:11px;min-width:32px;text-align:center;">${hasData ? apr : 0}</div></div>
      </div>
    `;
  }).join('');

  const totalTimeStr = formatTime(state.eventos.filter(e => e.status === 'estudei').reduce((s, e) => s + (e.tempoAcumulado || 0), 0));

  el.innerHTML = `
    <!-- LINHA 1: Cards Principais -->
    <div class="dash-grid-top">
      <div class="card p-16" style="flex:1;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div class="dash-label">TEMPO DE ESTUDO</div>
          <div style="font-size:24px;font-weight:800;color:var(--text-primary);line-height:1;margin-top:12px;font-family:'DM Mono',monospace;">${totalTimeStr}</div>
        </div>
      </div>

      <div class="card p-16" style="flex:1;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div class="dash-label">DESEMPENHO</div>
          <div style="margin-top:8px;">
            <div style="font-size:12px;color:var(--green);font-weight:600;">${perf.questionsCorrect} Acertos</div>
            <div style="font-size:12px;color:var(--red);font-weight:600;margin-top:2px;">${perf.questionsWrong} Erros</div>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--text-primary);line-height:1;">${perfPerc}%</div>
      </div>

      <div class="card p-16" style="flex:1;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div class="dash-label">PROGRESSO NO EDITAL</div>
           <div style="margin-top:8px;">
            <div style="font-size:12px;color:var(--green);font-weight:600;">${prog.totalConcluidos} Tópicos concluidos</div>
            <div style="font-size:12px;color:var(--red);font-weight:600;margin-top:2px;">${prog.totalAssuntos - prog.totalConcluidos} Tópicos Pendentes</div>
          </div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--text-primary);line-height:1;">${progPerc}%</div>
      </div>

      <div class="card p-16" style="flex:1;display:flex;justify-content:space-between;align-items:flex-end;">
         <div>
          <div class="dash-label">PÁGINAS LIDAS</div>
          <div style="font-size:24px;font-weight:800;color:var(--text-primary);line-height:1;margin-top:12px;font-family:'DM Mono',monospace;">${pagesReadTotal}</div>
        </div>
      </div>
    </div>

    <!-- LINHA 2: Constância -->
    <div class="card p-16 dash-streak-panel" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div class="dash-label">CONSTÂNCIA NOS ESTUDOS <i class="fa fa-question-circle" style="opacity:0.5;margin-left:4px;" title="Dias que você registrou sessões nos últimos 30 dias."></i></div>
        <div style="font-size:12px;font-weight:600;color:var(--accent);">Últimos 30 dias</div>
      </div>
      <div style="font-size:14px;color:var(--text-primary);margin-bottom:16px;">
        Você está há <strong>${streak.currentStreak} dias sem falhar!</strong> Seu recorde é de <strong>${streak.maxStreak} dias sem falhas.</strong> 📅
      </div>
      <div class="streak-heatmap">
        ${heatmapHtml}
      </div>
    </div>

    <!-- LINHA 3: Metas, Gráfico e Disciplinas -->
    <div class="dash-grid-bottom">
      
      <!-- Esquerda: Tabela de Disciplinas -->
      <div class="card p-16" style="display:flex;flex-direction:column;max-height:500px;">
        <div class="dash-label" style="margin-bottom:16px;">PAINEL</div>
        
        <div style="display:grid;grid-template-columns:1fr 80px 40px 40px 40px;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text-primary);align-items:center;">
          <div>Disciplinas</div>
          <div style="text-align:right;">Tempo</div>
          <div style="color:var(--green);text-align:center;"><i class="fa fa-check"></i></div>
          <div style="color:var(--red);text-align:center;"><i class="fa fa-times"></i></div>
          <div style="text-align:center;">%</div>
        </div>
        
        <div style="flex:1;overflow-y:auto;padding-right:8px;" class="custom-scrollbar">
          ${subjHtml || '<div style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma disciplina com histórico ainda.</div>'}
        </div>
      </div>

      <!-- Direita: Data, Metas e Gráfico -->
      <div style="display:flex;flex-direction:column;gap:20px;min-width:0;">
        
        ${previsorHtml}

        <div class="card p-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div class="dash-label">DATA DA PROVA</div>
            <i class="fa fa-edit" style="color:var(--text-muted);cursor:pointer;" data-action="prompt-prova" title="Editar Meta"></i>
          </div>
          ${provaText}
        </div>

        <div class="card p-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div class="dash-label">METAS DE ESTUDO SEMANAL</div>
            <i class="fa fa-edit" style="color:var(--text-muted);cursor:pointer;" data-action="prompt-metas" title="Editar Meta"></i>
          </div>
          
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
              <span style="font-family:'DM Mono',monospace;">${formatTime(weekStats.totalSeconds).slice(0, 5)}/${metaHoras}h00min</span>
              <span>Horas de Estudo</span>
            </div>
            <div class="dash-progress-track">
              <div class="dash-progress-bar" style="width:${percHoras}%;background:var(--accent);">
                <span style="position:absolute;left:8px;top:2px;font-size:10px;color:#fff;">${percHoras}%</span>
              </div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
              <span style="font-family:'DM Mono',monospace;">${questFeitas}/${metaQuest}</span>
              <span>Questões</span>
            </div>
            <div class="dash-progress-track">
              <div class="dash-progress-bar" style="width:${percQuest}%;background:#8b5cf6;">
                <span style="position:absolute;left:8px;top:2px;font-size:10px;color:#fff;">${percQuest}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card p-16" style="flex:1;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div class="dash-label">ESTUDO SEMANAL</div>
            <div style="display:flex;gap:4px;font-size:11px;">
              <div class="event-tag green" style="padding:4px 8px;border-radius:4px;font-weight:700;">TEMPO</div>
            </div>
          </div>
          <div style="flex:1;display:flex;align-items:flex-end;gap:8px;border-bottom:1px solid var(--border);padding-bottom:8px;position:relative;">
            <!-- Grid lines background -->
            <div style="position:absolute;top:0;left:0;right:0;bottom:25px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;z-index:0;opacity:0.2;">
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
            </div>
            <!-- Bars -->
            <div style="display:flex;width:100%;height:100%;z-index:1;padding-bottom:20px;">
              ${barsHtml}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);margin-top:12px;">
            <div style="width:8px;height:8px;background:var(--accent);border-radius:2px;"></div> Total Estudado: ${formatTime(weekStats.totalSeconds).slice(0, 5)}min
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
  "Cada assunto concluido é uma vitória real.",
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
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluido(s)</div>
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
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${estudados.length} evento(s) concluido(s)</div>
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
  const el = document.querySelector(`[data-event-id="${eventId}"]`);
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
            <div class="cal-view-tab ${calViewMode === 'mes' ? 'active' : ''}" onclick="setCalViewMode('mes')">Mês</div>
            <div class="cal-view-tab ${calViewMode === 'semana' ? 'active' : ''}" onclick="setCalViewMode('semana')">Semana</div>
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

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

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
      return `<div class="cal-event-chip ${st}" style="cursor:pointer;" onclick="event.stopPropagation(); window.openEventDetail('${e.id}')" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`;
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

  const getDateStr = d => {
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    return d2.toISOString().split('T')[0];
  };

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
// EVENT DETAIL MODAL
// =============================================
export function openEventDetail(eventId) {
  const ev = state.eventos.find(e => e.id === eventId);
  if (!ev) return;
  const body = document.getElementById('modal-event-detail-body');
  const status = getEventStatus(ev);
  const elapsed = getElapsedSeconds(ev);
  const tempoStr = elapsed > 0 ? formatTime(elapsed) : '00:00:00';
  const discInfo = ev.discId ? getDisc(ev.discId) : null;
  const disc = discInfo ? discInfo.disc : null;
  const ass = disc && ev.assId ? disc.assuntos.find(a => a.id === ev.assId) : null;

  let html = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:18px;font-weight:700;color:var(--text-primary);padding-bottom:12px;border-bottom:1px solid var(--border);">
        ${esc(ev.titulo)}
      </div>
      <div class="grid-2">
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">STATUS</div>
          <div style="font-size:14px;color:var(--text-primary);font-weight:500;" class="event-tag ${status}">
            ${status === 'estudei' ? 'concluido' : status === 'atrasado' ? 'Atrasado' : 'Agendado'}
          </div>
        </div>
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px;">TEMPO ACUMULADO</div>
          <div style="font-size:16px;color:var(--text-primary);font-weight:700;font-family:'DM Mono',monospace;">
            ${tempoStr}
          </div>
        </div>
      </div>
      <div><strong>Data Inicial:</strong> ${formatDate(ev.data)}</div>
      ${disc ? `<div><strong>Disciplina:</strong> ${esc(disc.nome)}</div>` : ''}
      ${ass ? `<div><strong>Assunto:</strong> ${esc(ass.nome)}</div>` : ''}
      ${ev.notas ? `<div style="margin-top:8px;"><strong>Anotações:</strong><div class="card" style="padding:12px;margin-top:8px;font-size:13px;line-height:1.5;">${esc(ev.notas)}</div></div>` : ''}
      ${ev.fontes ? `<div><strong>Fontes:</strong> ${esc(ev.fontes)}</div>` : ''}
      ${ev.legislacao ? `<div><strong>Legislação:</strong> ${esc(ev.legislacao)}</div>` : ''}
    </div>
    <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px;display:flex;justify-content:flex-end;gap:8px;">
      <button class="btn btn-ghost" onclick="closeModal('modal-event-detail')">Fechar</button>
      <button class="btn btn-danger" onclick="closeModal('modal-event-detail'); window.deleteEvento('${ev.id}')">Excluir Evento</button>
    </div>
  `;
  body.innerHTML = html;
  openModal('modal-event-detail');
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
        <div class="stat-sub">eventos concluidos</div>
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
    const d2 = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    const ds = d2.toISOString().split('T')[0];
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
    const done = disc.assuntos.filter(a => a.concluido).length;
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
  const future2 = new Date(future.getTime() - (future.getTimezoneOffset() * 60000));
  const futureStr = future2.toISOString().split('T')[0];
  const upcoming = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
      for (const ass of disc.assuntos) {
        if (!ass.concluido || !ass.dataConclusao) continue;
        const revDates = calcRevisionDates(ass.dataConclusao, ass.revisoesFetas || [], ass.adiamentos || 0);
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
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Assuntos concluidos</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent);">${getAllDisciplinas().reduce((s, { disc }) => s + disc.assuntos.filter(a => a.concluido).length, 0)}</div>
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
        // Store a deferral date natively without mutating completion history
        if (!ass.adiamentos) ass.adiamentos = 0;
        ass.adiamentos = (ass.adiamentos || 0) + 1;
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
  const cutoff2 = new Date(cutoff.getTime() - (cutoff.getTimezoneOffset() * 60000));
  const cutoffStr = cutoff2.toISOString().split('T')[0];

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
            <div style="font-size:13px;font-weight:600;">${esc(r.tipo.label)}${r.descricao ? ' - ' + esc(r.descricao) : ''}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${formatDate(r.data)}${r.quantidade ? ' • ' + r.quantidade + ' questões' : ''}${r.acertos !== undefined && r.tipo.key === 'questoes' ? ' • ' + r.acertos + ' acertos' : ''}${r.total && r.total > 0 ? ` • ${r.acertos}/${r.total} (${Math.round(r.acertos / r.total * 100)}%)` : ''}</div>
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

window.setVertFilterStatus = function (s) { vertFilterStatus = s; };
window.setVertFilterEdital = function (e) { vertFilterEdital = e; };

export function getFilteredVertItems() {
  let items = [];
  for (const edital of state.editais) {
    for (const disc of (edital.disciplinas || [])) {
      for (const ass of disc.assuntos) {
        items.push({ edital, disc, ass });
      }
    }
  }
  if (vertFilterEdital) items = items.filter(i => i.edital.id === vertFilterEdital);
  if (vertFilterStatus === 'pendentes') items = items.filter(i => !i.ass.concluido);
  if (vertFilterStatus === 'concluidos') items = items.filter(i => i.ass.concluido);
  if (vertSearch) {
    const q = vertSearch.toLowerCase();
    items = items.filter(i => i.ass.nome.toLowerCase().includes(q) || i.disc.nome.toLowerCase().includes(q));
  }
  return items;
}

window.verResumoSimulado = (simId) => {
  // Lógica descontinuada
};

window.toggleEditSeq = () => {
  window._isEditingSequence = !window._isEditingSequence;
  if (window._isEditingSequence) {
    window._tempSequencia = JSON.parse(JSON.stringify(state.planejamento.sequencia));
  } else {
    window._tempSequencia = null;
  }
  renderCurrentView();
};

window.saveEditSeq = () => {
  if (!window._tempSequencia || window._tempSequencia.length === 0) {
    alert("A sequência de estudos não pode ficar vazia.");
    return;
  }
  for (let s of window._tempSequencia) {
    if (!s.discId) {
      alert("Por favor, selecione uma disciplina para todas as etapas antes de salvar.");
      return;
    }
  }

  state.planejamento.sequencia = window._tempSequencia;
  syncCicloToEventos(state.planejamento);
  scheduleSave();

  window._isEditingSequence = false;
  window._tempSequencia = null;
  renderCurrentView();
};

window.cancelEditSeq = () => {
  window._isEditingSequence = false;
  window._tempSequencia = null;
  renderCurrentView();
};

window.updateSeqItem = (i, field, val) => {
  i = parseInt(i, 10);
  if (field === 'minutosAlvo') val = parseInt(val) || 0;
  window._tempSequencia[i][field] = val;
};

window.dupSeqItem = (i) => {
  i = parseInt(i, 10);
  const obj = JSON.parse(JSON.stringify(window._tempSequencia[i]));
  obj.id = 'seq_' + uid();
  window._tempSequencia.splice(i + 1, 0, obj);
  renderCurrentView();
};

window.remSeqItem = (i) => {
  i = parseInt(i, 10);
  window._tempSequencia.splice(i, 1);
  renderCurrentView();
};

window.moveSeqItem = (i, dir) => {
  i = parseInt(i, 10);
  const arr = window._tempSequencia;
  if (i + dir < 0 || i + dir >= arr.length) return;
  const temp = arr[i];
  arr[i] = arr[i + dir];
  arr[i + dir] = temp;
  renderCurrentView();
};

window.addSeqItem = () => {
  window._tempSequencia.push({
    id: 'seq_' + uid(),
    discId: '',
    minutosAlvo: 60
  });
  renderCurrentView();
};

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
      <select class="form-control" style="width:auto;" onchange="setVertFilterEdital(this.value);renderCurrentView()">
        <option value="">Todos os editais</option>
        ${state.editais.map(e => `<option value="${e.id}" ${vertFilterEdital === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
      </select>
      <div class="filter-row" style="margin:0;gap:4px;">
        ${['todos', 'pendentes', 'concluidos'].map(s => `
          <div class="filter-chip ${vertFilterStatus === s ? 'active' : ''}" onclick="setVertFilterStatus('${s}');renderCurrentView()">
            ${{ todos: 'Todos', pendentes: 'Pendentes', concluidos: 'Concluídos' }[s]}
          </div>`).join('')}
      </div>
    </div>

    <!-- Fix 3: isolated list container — only this gets re-rendered on search -->
    <div id="vert-list-container"></div>
  `;
  renderVerticalList(document.getElementById('vert-list-container'));
}

export function renderVerticalList(container) {
  if (!container) return;
  const allItems = getFilteredVertItems();
  const total = allItems.length;
  const concluidos = allItems.filter(i => i.ass.concluido).length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  if (total === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div>
      <h4>${state.editais.length === 0 ? 'Nenhum edital cadastrado' : 'Nenhum assunto encontrado'}</h4>
      <p>${state.editais.length === 0 ? 'Crie um edital em Editais para usar esta visualização.' : 'Tente ajustar os filtros.'}</p>
    </div>`;
    return;
  }

  // Card Progresso Global
  let html = `
    <div class="card" style="margin-bottom:24px;padding:20px;border:none;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);letter-spacing:1px;margin-bottom:8px;">PROGRESSO NO EDITAL</div>
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);">${concluidos} de ${total} tópicos concluídos</div>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--text-primary);line-height:1;">${pct}<span style="font-size:16px;opacity:0.7;">%</span></div>
      </div>
      <div class="progress-track" style="height:14px;border-radius:10px;width:100%;overflow:hidden;padding:2px;">
        <div class="progress-bar" style="width:${pct}%;transition:width 0.3s;border-radius:10px;"></div>
      </div>
    </div>
  `;

  // Agrupar itens por disciplina
  const discMap = {};
  allItems.forEach(item => {
    const did = item.disc.id;
    if (!discMap[did]) {
      discMap[did] = {
        disc: item.disc,
        edital: item.edital,
        items: []
      };
    }
    discMap[did].items.push(item);
  });

  // Agrupar logs de questoes do 'state.eventos'
  const eventosAgrupados = {};
  if (state.eventos) {
    state.eventos.forEach(ev => {
      if (ev.status === 'estudei' && ev.discId) {
        if (!eventosAgrupados[ev.discId]) eventosAgrupados[ev.discId] = { sCertas: 0, sErradas: 0, assuntos: {} };
        const evtQs = ev.questoes || { certas: 0, erradas: 0 };
        // Somar para disciplina
        eventosAgrupados[ev.discId].sCertas += evtQs.certas;
        eventosAgrupados[ev.discId].sErradas += evtQs.erradas;
        // Somar para assunto específico
        if (ev.assId) {
          if (!eventosAgrupados[ev.discId].assuntos[ev.assId]) {
            eventosAgrupados[ev.discId].assuntos[ev.assId] = { certas: 0, erradas: 0 };
          }
          eventosAgrupados[ev.discId].assuntos[ev.assId].certas += evtQs.certas;
          eventosAgrupados[ev.discId].assuntos[ev.assId].erradas += evtQs.erradas;
        }
      }
    });
  }

  const hiReg = vertSearch ? new RegExp(`(${vertSearch.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&')})`, 'gi') : null;
  const highlight = str => hiReg ? esc(str).replace(hiReg, '<mark>$1</mark>') : esc(str);

  Object.values(discMap).forEach(dMap => {
    const discId = dMap.disc.id;
    // Stats de Questoes Disc
    const evStats = eventosAgrupados[discId] || { sCertas: 0, sErradas: 0, assuntos: {} };
    const dCertas = evStats.sCertas;
    const dErradas = evStats.sErradas;
    const dTotalQ = dCertas + dErradas;
    const dPctQ = dTotalQ > 0 ? Math.round((dCertas / dTotalQ) * 100) : 0;

    // Stats Tópicos Disc
    const dTotalItems = dMap.items.length;
    const dConcluidos = dMap.items.filter(i => i.ass.concluido).length;
    const dPctConcluido = dTotalItems > 0 ? Math.round((dConcluidos / dTotalItems) * 100) : 0;

    const cor = dMap.disc.cor || dMap.edital.cor || 'var(--accent)';

    html += `
      <div class="card" style="margin-bottom:12px;overflow:hidden;border:none;">
        
        <!-- HEADER DISCIPLINA -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--card);cursor:pointer;" onclick="window.toggleVertDisc('${discId}')">
          <div style="display:flex;align-items:center;gap:12px;font-size:15px;font-weight:600;color:var(--text-primary);min-width:0;">
            <div style="width:5px;height:24px;background:${cor};border-radius:4px;"></div>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(dMap.disc.nome)}">${esc(dMap.disc.nome)}</span>
          </div>
          
          <div style="display:flex;align-items:center;gap:16px;">
            <!-- Stats Questões -->
            <div style="display:flex;align-items:center;border:1px solid var(--border);border-radius:12px;padding:2px 10px;font-size:11px;font-weight:700;gap:12px;font-family:'DM Mono',monospace;background:transparent;">
              <span style="color:var(--green);">${dCertas}</span>
              <span style="color:var(--red);">${dErradas}</span>
              <span style="color:var(--text-secondary);">${dTotalQ}</span>
              <span style="color:var(--bg);background:${dPctQ >= 70 ? 'var(--green)' : dPctQ >= 50 ? 'var(--orange)' : 'var(--text-muted)'};padding:2px 6px;border-radius:8px;">${dPctQ}</span>
            </div>
            
            <!-- Progress Bar Progresso -->
            <div style="display:flex;align-items:center;gap:8px;background:var(--bg);border-radius:12px;padding:4px;width:120px;">
              <span style="font-size:10px;font-weight:800;color:var(--text-primary);min-width:24px;text-align:right;">${dPctConcluido}%</span>
              <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${dPctConcluido}%;background:${cor};border-radius:3px;"></div>
              </div>
            </div>
            
            <!-- Ações -->
            <div style="display:flex;align-items:center;gap:8px;color:var(--text-muted);">
              <i class="fa fa-edit" onclick="event.stopPropagation(); window.openDiscManager('${dMap.edital.id}', '${discId}')" title="Gerenciar Disciplina e Tópicos" style="cursor:pointer;"></i>
              <i id="vert-disc-icon-${discId}" class="fa fa-chevron-down" style="width:16px;text-align:center;"></i>
            </div>
          </div>
        </div>

        <!-- LISTA DE TÓPICOS ANINHADA -->
        <div id="vert-disc-body-${discId}" style="display:none;border-top:1px solid var(--border);padding:16px;">
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:center;">
              <thead>
                <tr style="color:var(--text-primary);font-weight:600;border-bottom:1px solid var(--border);">
                  <th style="padding:10px;text-align:left;">Tópicos</th>
                  <th style="padding:10px;color:var(--green);"><i class="fa fa-check"></i></th>
                  <th style="padding:10px;color:var(--red);"><i class="fa fa-times"></i></th>
                  <th style="padding:10px;color:var(--text-muted);"><i class="fa fa-bullseye" title="Total de questões"></i></th>
                  <th style="padding:10px;">%</th>
                  <th style="padding:10px;"><i class="fa fa-calendar-alt"></i></th>
                </tr>
              </thead>
              <tbody>
    `;

    dMap.items.forEach(({ ass, edital, disc }) => {
      const aStats = (evStats.assuntos && evStats.assuntos[ass.id]) ? evStats.assuntos[ass.id] : { certas: 0, erradas: 0 };
      const aCertas = aStats.certas;
      const aErradas = aStats.erradas;
      const aTotalQ = aCertas + aErradas;
      const aPctQ = aTotalQ > 0 ? Math.round((aCertas / aTotalQ) * 100) : 0;

      const revCount = (ass.revisoesFetas || []).length;
      let dataStr = '-';
      if (ass.dataConclusao) {
        const d = ass.dataConclusao.split('-');
        if (d.length === 3) dataStr = `${d[2]}/${d[1]}/${d[0].substring(2)}`;
      }

      const chColor = ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)';
      const decor = ass.concluido ? 'text-decoration:line-through;opacity:0.6;' : 'font-weight:600;';

      html += `
                <tr style="border-bottom:1px solid var(--bg);">
                  <td style="padding:12px 10px;text-align:left;display:flex;align-items:center;gap:12px;min-width:300px;">
                    <input type="checkbox" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);" ${ass.concluido ? 'checked' : ''} onclick="toggleAssunto('${discId}', '${ass.id}')" />
                    <span style="color:${chColor};${decor}">${highlight(ass.nome).toUpperCase()}</span>
                  </td>
                  <td style="padding:12px 10px;font-weight:700;color:var(--green);font-family:'DM Mono',monospace;">${aCertas}</td>
                  <td style="padding:12px 10px;font-weight:700;color:var(--red);font-family:'DM Mono',monospace;">${aErradas}</td>
                  <td style="padding:12px 10px;font-weight:700;color:var(--text-secondary);font-family:'DM Mono',monospace;">${aTotalQ}</td>
                  <td style="padding:12px 10px;font-family:'DM Mono',monospace;">
                    <div style="display:inline-block;padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px;background:${aTotalQ > 0 ? (aPctQ >= 70 ? 'var(--green)' : aPctQ >= 50 ? 'var(--orange)' : 'var(--text-muted)') : 'transparent'};color:${aTotalQ > 0 ? 'var(--bg)' : 'var(--text-muted)'};border:${aTotalQ > 0 ? 'none' : '1px solid var(--border)'};">${aTotalQ > 0 ? aPctQ : 0}</div>
                  </td>
                  <td style="padding:12px 10px;color:var(--text-muted);font-size:12px;">${dataStr}</td>
                </tr>
      `;
    });

    html += `
              </tbody >
            </table >
          </div >
        </div >
      </div >
          `;
  });

  container.innerHTML = html;
}

window.toggleVertDisc = function (id) {
  const body = document.getElementById('vert-disc-body-' + id);
  const icon = document.getElementById('vert-disc-icon-' + id);
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    body.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
};

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
        <button class="icon-btn" title="Analisador de Bancas" onclick="event.stopPropagation();openBancaAnalyzerModal('${edital.id}')">🧠</button>
        <button class="icon-btn" title="Editar" onclick="event.stopPropagation();openEditaModal('${edital.id}')">✏️</button>
        <button class="icon-btn" title="Excluir" onclick="event.stopPropagation();deleteEdital('${edital.id}')">🗑️</button>
        <i class="fa fa-chevron-down" style="font-size:12px;opacity:0.7;"></i>
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" onclick="openDiscModal('${edital.id}')" style="margin-right:15px;margin-bottom:10px;">+ Disciplina</button>
      </div>
      <div id="edital-tree-${edital.id}">
        <div class="disc-grid">
          ${(edital.disciplinas || []).map(disc => {
    const totais = disc.assuntos.length;
    const estudados = disc.assuntos.filter(a => a.concluido).length;
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
                  <button class="disc-action" onclick="event.stopPropagation();openDiscDashboard('${edital.id}','${disc.id}')">
                    <i class="fa fa-folder-open"></i>
                    <span>Visualizar</span>
                  </button>
                  <button class="disc-action" onclick="event.stopPropagation();openDiscManager('${edital.id}','${disc.id}')">
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
    </div >
          `;
}

export function toggleEdital(id) {
  const el = document.getElementById(`edital - tree - ${id} `);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

export function toggleDisc(discId) {
  const el = document.getElementById(`disc - tree - ${discId} `);
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

export function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue; const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      const ass = disc.assuntos.find(a => a.id === assId);
      if (ass) {
        ass.concluido = !ass.concluido;
        ass.dataConclusao = ass.concluido ? todayStr() : null;
        if (ass.concluido) ass.revisoesFetas = [];
        scheduleSave();

        // Re-render local dashboard if open, otherwise full view
        if (window.activeDashboardDiscCtx && window.activeDashboardDiscCtx.discId === discId) {
          openDiscDashboard(window.activeDashboardDiscCtx.editaId, discId);
        } else {
          renderCurrentView();
        }
        return;
      }
    }
  }
}

window.activeDashboardDiscCtx = null;

export function openDiscDashboard(editaId, discId) {
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  const disc = edital.disciplinas.find(d => d.id === discId);
  if (!disc) return;

  window.activeDashboardDiscCtx = { editaId, discId };

  // Set window Topbar
  document.getElementById('topbar-title').textContent = `${disc.icone || '📚'} ${disc.nome} `;
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="closeDiscDashboard()"><i class="fa fa-arrow-left"></i> Voltar</button>`;

  const el = document.getElementById('content');
  el.innerHTML = renderDisciplinaDashboard(edital, disc);
  setTimeout(() => initDiscDashboardChart(disc.id), 100);
}

export function closeDiscDashboard() {
  window.activeDashboardDiscCtx = null;
  renderCurrentView();
}

export function renderDisciplinaDashboard(edital, disc) {
  const tempos = state.eventos ? state.eventos.filter(e => e.discId === disc.id && e.status === 'estudei') : [];
  let tempoTotal = 0;
  let qCertas = 0;
  let qErradas = 0;
  let pagLidas = 0;

  tempos.forEach(e => {
    tempoTotal += e.tempoEstudado || 0;
    if (e.questoes) {
      qCertas += e.questoes.certas || 0;
      qErradas += e.questoes.erradas || 0;
    }
    pagLidas += e.paginas || 0;
  });

  const totalQuestoes = qCertas + qErradas;
  const percAcertos = totalQuestoes > 0 ? Math.round((qCertas / totalQuestoes) * 100) : 0;

  const totalAssuntos = disc.assuntos.length;
  const assuntosConcluidos = disc.assuntos.filter(a => a.concluido).length;
  const percConcluido = totalAssuntos > 0 ? Math.round((assuntosConcluidos / totalAssuntos) * 100) : 0;

  return `
    <div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding-bottom:40px;">
      
      <!-- HEADER STATS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
        <div class="card p-16">
          <div class="dash-label">TEMPO DE ESTUDO</div>
          <div style="font-size:24px;font-weight:800;color:var(--text-primary);margin-top:12px;font-family:'DM Mono',monospace;">
            ${formatTime(tempoTotal)}
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">QUESTÕES (ACERTOS / TOTAL)</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px;">
            <div style="font-size:24px;font-weight:800;color:var(--text-primary);font-family:'DM Mono',monospace;">
              ${qCertas} / ${totalQuestoes}
            </div>
            <div style="font-size:16px;font-weight:700;color:${percAcertos >= 70 ? 'var(--green)' : percAcertos >= 50 ? 'var(--accent)' : 'var(--red)'};">
              ${percAcertos}%
            </div>
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">PROGRESSO DO EDITAL</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:12px;">
            <div style="font-size:24px;font-weight:800;color:var(--text-primary);font-family:'DM Mono',monospace;">
              ${assuntosConcluidos} / ${totalAssuntos}
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--accent);">
              ${percConcluido}%
            </div>
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">PÁGINAS LIDAS</div>
          <div style="font-size:24px;font-weight:800;color:var(--text-primary);margin-top:12px;font-family:'DM Mono',monospace;">
            ${pagLidas}
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(400px, 1fr));gap:20px;align-items:stretch;">
        
        <!-- HISTÓRICO DE ESTUDOS (ESQUERDA) -->
        <div class="card p-16" style="min-height:400px;display:flex;flex-direction:column;max-height:500px;">
          <div class="dash-label" style="margin-bottom:16px;">HISTÓRICO DE SESSÕES (ÚLTIMAS 50)</div>
          ${renderHistoricoDisciplina(tempos)}
        </div>

        <!-- TÓPICOS DO EDITAL (DIREITA) -->
        <div class="card p-16" style="min-height:400px;display:flex;flex-direction:column;max-height:500px;">
          <div class="dash-label" style="margin-bottom:16px;">TÓPICOS DO EDITAL</div>
          ${renderTopicosEditalDisciplina(edital, disc)}
        </div>

      </div>

      <!-- PERFORMANCE GRAPH -->
      <div class="card p-16">
        <div class="dash-label" style="margin-bottom:16px;">EVOLUÇÃO DOS ACERTOS (%) - ÚLTIMAS SESSÕES</div>
        <div style="height:250px;width:100%;position:relative;">
          <canvas id="disc-chart-acertos"></canvas>
        </div>
      </div>

    </div>
  `;
}

function renderHistoricoDisciplina(tempos) {
  const reverseTempos = [...tempos].reverse().slice(0, 50);
  if (reverseTempos.length === 0) {
    return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-style:italic;">Nenhuma sessão de estudo registrada.</div>';
  }

  return `
    <div class="custom-scrollbar" style="flex:1;overflow-y:auto;padding-right:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
              <thead style="position:sticky;top:0;background:var(--card);z-index:2;">
                <tr style="border-bottom:1px solid var(--border);color:var(--text-muted);">
                  <th style="padding:8px 4px;font-weight:600;">Data</th>
                  <th style="padding:8px 4px;font-weight:600;">Tempo</th>
                  <th style="padding:8px 4px;font-weight:600;">Pág.</th>
                  <th style="padding:8px 4px;font-weight:600;">Questões</th>
                  <th style="padding:8px 4px;font-weight:600;">Acerto</th>
                </tr>
              </thead>
              <tbody>
                ${reverseTempos.map(t => {
    const dateStr = formatDate(t.data);
    const tempoStr = formatTime(t.tempoEstudado || 0).substring(0, 5);
    const qs = t.questoes || { certas: 0, erradas: 0 };
    const totQs = qs.certas + qs.erradas;
    const perc = totQs > 0 ? Math.round((qs.certas / totQs) * 100) : 0;
    const percColor = perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';

    return `
              <tr style="border-bottom:1px solid var(--bg);">
                <td style="padding:10px 4px;color:var(--text-primary);">${dateStr}</td>
                <td style="padding:10px 4px;font-family:'DM Mono',monospace;">${tempoStr}</td>
                <td style="padding:10px 4px;">${t.paginas || '-'}</td>
                <td style="padding:10px 4px;">${qs.certas} / ${totQs}</td>
                <td style="padding:10px 4px;font-weight:700;color:${totQs > 0 ? percColor : 'inherit'};">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
  }).join('')}
              </tbody>
            </table>
    </div >
          `;
}

function renderTopicosEditalDisciplina(edital, disc) {
  if (!disc.assuntos || disc.assuntos.length === 0) {
    return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-style:italic;">Nenhum tópico cadastrado.</div>';
  }

  return `
    <div class="custom-scrollbar" style="flex:1;overflow-y:auto;padding-right:8px;">
            ${disc.assuntos.map(ass => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);${ass.concluido ? 'background:#f8fafc;border-radius:6px;' : ''}">
          <div class="check-circle ${ass.concluido ? 'done' : ''}" onclick="toggleAssunto('${disc.id}','${ass.id}')" style="flex-shrink:0;">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div style="flex:1;min-width:0;font-size:13px;font-weight:${ass.concluido ? '400' : '600'};color:${ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)'};${ass.concluido ? 'text-decoration:line-through;' : ''}">${esc(ass.nome)}</div>
          ${ass.concluido ? `
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:10px;color:var(--green);font-weight:700;">✅ concluído</div>
              <div style="font-size:10px;color:var(--text-muted);">${formatDate(ass.dataConclusao)}</div>
            </div>
          ` : `
            <button class="btn btn-ghost btn-sm" style="flex-shrink:0;padding:4px 8px;font-size:11px;" onclick="addEventoParaAssunto('${edital.id}','${disc.id}','${ass.id}')">+ Agenda</button>
          `}
        </div>
      `).join('')}
    </div>
  `;
}

export function initDiscDashboardChart(discId) {
  const canvas = document.getElementById('disc-chart-acertos');
  if (!canvas) return;

  const tempos = state.eventos ? state.eventos.filter(e => e.discId === discId && e.status === 'estudei' && e.questoes && (e.questoes.certas > 0 || e.questoes.erradas > 0)) : [];

  const grouped = {};
  [...tempos].sort((a, b) => a.data.localeCompare(b.data)).forEach(t => {
    if (!grouped[t.data]) grouped[t.data] = { certas: 0, erradas: 0 };
    grouped[t.data].certas += t.questoes.certas;
    grouped[t.data].erradas += t.questoes.erradas;
  });

  const rawLabels = Object.keys(grouped).slice(-15);
  const labels = rawLabels.map(d => formatDate(d));
  const dataPerc = rawLabels.map(d => {
    const total = grouped[d].certas + grouped[d].erradas;
    return total > 0 ? Math.round((grouped[d].certas / total) * 100) : 0;
  });

  if (window._discChartInstance) {
    window._discChartInstance.destroy();
  }

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    parent.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;font-style:italic;">Métricas insuficientes. Registre sessões com número de questões para gerar o gráfico de evolução.</div>';
    return;
  }

  const ctx = canvas.getContext('2d');
  window._discChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '% de Acertos',
        data: dataPerc,
        borderColor: 'var(--accent)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: 'var(--bg)',
        pointBorderColor: 'var(--accent)',
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'var(--card)',
          titleColor: 'var(--text-muted)',
          bodyColor: 'var(--text-primary)',
          borderColor: 'var(--border)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.raw}% de Acerto`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

export function deleteAssunto(discId, assId) {
  showConfirm('Excluir este assunto? Eventos vinculados serão desvinculados.', () => {
    const entry = getDisc(discId);
    if (entry) {
      entry.disc.assuntos = entry.disc.assuntos.filter(a => a.id !== assId);

      if (state.eventos) {
        state.eventos.forEach(e => {
          if (e.assId === assId) { delete e.assId; }
        });
      }

      invalidateDiscCache();
      scheduleSave();
      renderCurrentView();
      if (typeof editingSubjectCtx !== 'undefined' && editingSubjectCtx && editingSubjectCtx.discId === discId) {
        openDiscManager(editingSubjectCtx.editaId, discId);
      }
    }
  }, { danger: true, label: 'Excluir', title: 'Excluir assunto' });
}

export function deleteDisc(editaId, discId) {
  showConfirm('Excluir esta disciplina e todos seus assuntos?\n\nEsta ação não pode ser desfeita.', () => {
    const edital = state.editais.find(e => e.id === editaId);
    if (!edital || !edital.disciplinas) return;
    edital.disciplinas = edital.disciplinas.filter(d => d.id !== discId);

    if (state.eventos) {
      state.eventos.forEach(e => {
        if (e.discId === discId) { delete e.discId; delete e.assId; }
      });
    }
    if (state.planejamento && state.planejamento.disciplinas) {
      state.planejamento.disciplinas = state.planejamento.disciplinas.filter(id => id !== discId);
      if (state.planejamento.relevancia && state.planejamento.relevancia[discId]) delete state.planejamento.relevancia[discId];
      if (state.planejamento.sequencia) state.planejamento.sequencia = state.planejamento.sequencia.filter(s => s.discId !== discId);
    }

    invalidateDiscCache();
    scheduleSave();
    renderCurrentView();
  }, { danger: true, label: 'Excluir disciplina', title: 'Excluir disciplina' });
}

export function deleteEdital(editaId) {
  const edital = state.editais.find(e => e.id === editaId);
  const nome = edital ? edital.nome : 'edital';
  showConfirm(`Excluir "${nome}" completamente ?

          Todos os grupos, disciplinas e assuntos serão removidos.Esta ação não pode ser desfeita.`, () => {
    const discIds = edital && edital.disciplinas ? edital.disciplinas.map(d => d.id) : [];
    state.editais = state.editais.filter(e => e.id !== editaId);

    if (discIds.length > 0 && state.eventos) {
      state.eventos.forEach(e => {
        if (discIds.includes(e.discId)) { delete e.discId; delete e.assId; }
      });
    }
    if (discIds.length > 0 && state.planejamento && state.planejamento.disciplinas) {
      state.planejamento.disciplinas = state.planejamento.disciplinas.filter(id => !discIds.includes(id));
      discIds.forEach(id => {
        if (state.planejamento.relevancia && state.planejamento.relevancia[id]) delete state.planejamento.relevancia[id];
      });
      if (state.planejamento.sequencia) state.planejamento.sequencia = state.planejamento.sequencia.filter(s => !discIds.includes(s.discId));
    }

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
  container.querySelector(`[style = "background:${color};"]`).classList.add('selected');
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
export function openDiscModal(editaId, discId) {
  editingDiscCtx = { editaId, discId: discId || null };
  const edital = state.editais.find(e => e.id === editaId);
  const existingDisc = discId && edital ? edital.disciplinas.find(d => d.id === discId) : null;
  const isEdit = !!existingDisc;

  document.getElementById('modal-disc-title').textContent = isEdit ? 'Editar Disciplina' : 'Nova Disciplina';
  document.getElementById('modal-disc-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nome da Disciplina</label>
      <input type="text" class="form-control" id="disc-nome" placeholder="Ex: Direito Constitucional" value="${isEdit ? esc(existingDisc.nome) : ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Ícone</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;" id="disc-icons">
        ${DISC_ICONS.map((ic, i) => `<div style="width:36px;height:36px;border-radius:8px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;transition:all 0.15s;" class="${ic === (isEdit ? existingDisc.icone : DISC_ICONS[0]) ? 'selected-icon' : ''}" onclick="selectIcon('${ic}', this)">${ic}</div>`).join('')}
      </div>
      <input type="hidden" id="disc-icone" value="${isEdit ? existingDisc.icone : DISC_ICONS[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">Cor</label>
      <div class="color-row" id="disc-colors">
        ${COLORS.map((c, i) => `<div class="color-swatch ${c === (isEdit ? existingDisc.cor : COLORS[0]) ? 'selected' : ''}" style="background:${c};" onclick="selectDiscColor('${c}')"></div>`).join('')}
      </div>
      <input type="hidden" id="disc-cor" value="${isEdit ? existingDisc.cor : COLORS[0]}">
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
  document.querySelector(`#disc - colors[style = "background:${color};"]`).classList.add('selected');
  document.getElementById('disc-cor').value = color;
}

export function saveDisc() {
  const nome = document.getElementById('disc-nome').value.trim();
  if (!nome) { showToast('Informe o nome da disciplina', 'error'); return; }
  const icone = document.getElementById('disc-icone').value;
  const cor = document.getElementById('disc-cor').value;
  const { editaId, discId } = editingDiscCtx;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;
  if (!edital.disciplinas) edital.disciplinas = [];

  if (discId) {
    // Edit existing discipline
    const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      disc.nome = nome;
      disc.icone = icone;
      disc.cor = cor;
      showToast('Disciplina atualizada!', 'success');
    }
  } else {
    // Create new
    edital.disciplinas.push({ id: uid(), nome, icone, cor, assuntos: [] });
    showToast('Disciplina criada!', 'success');
  }
  scheduleSave();
  closeModal('modal-disc');
  renderCurrentView();
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

  const colorOptions = COLORS.map(c => `< option value = "${c}" ${disc.cor === c ? 'selected' : ''} style = "background:${c};color:#fff;" > ${c}</option > `).join('');

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
    </div >
    
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

// =============================================
// MÓDULO PREDITIVO DE BANCA E RELEVÂNCIA (WAVE 33)
// =============================================
import { applyRankingToEdital, commitEditalOrdering } from './relevance.js';

let analyzerCtx = { editaId: null, parsedHotTopics: [], tempMatchResults: [] };

export function openBancaAnalyzerModal(editaId) {
  analyzerCtx.editaId = editaId;
  const edital = state.editais.find(e => e.id === editaId);
  if (!edital) return;

  const hotTopics = state.bancaRelevance?.hotTopics || [];

  // Lista de disciplinas do Edital com check visual se já tiver topics
  const discOptions = edital.disciplinas.map(d => {
    const hasTopics = hotTopics.some(ht => ht.disciplinaId === d.id);
    return `<option value="${d.id}">${hasTopics ? '✅' : '⚪'} ${esc(d.nome)}</option>`;
  }).join('');

  document.getElementById('modal-banca-analyzer-title').textContent = 'Análise Inteligente de Edital (' + esc(edital.nome) + ')';
  document.getElementById('modal-banca-analyzer-body').innerHTML = `
        <div class="card p-16" style="margin-bottom:16px;">
            <div class="dash-label" style="margin-bottom:8px;">1. Selecione a Disciplina e Importe (Hot Topics)</div>
            
            <select id="banca-disc-select" class="form-control" style="margin-bottom:12px;font-weight:600;">
                <option value="" disabled selected>-- Escolha a Matéria --</option>
                ${discOptions}
            </select>
            
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Cole aqui o Ranking da Banca respectivo à matéria (com porcentagens ou enumerações "1.", "2.", etc).</div>
            <textarea id="banca-input-text" class="form-control" rows="6" style="font-family:inherit;font-size:13px;resize:vertical;" placeholder="Ex:\\n1. Atos Administrativos (25%)\\n2. Licitações (18%)\\n3. Improbidade Administrativa"></textarea>
            <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="window.parseBancaText()">Processar Matéria</button>
        </div>

        <div id="banca-match-results" style="display:none; max-height:400px; overflow-y:auto; padding-right:8px;" class="custom-scrollbar">
            <!-- Tabela de Match populada pelo JS -->
        </div>

        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:space-between;align-items:center;">
            <div id="banca-stats" style="font-size:12px;font-weight:600;color:var(--accent);"></div>
            <div style="display:flex;gap:8px;">
                 <button class="btn btn-ghost" onclick="closeModal('modal-banca-analyzer')">Cancelar</button>
                 <button class="btn btn-primary" id="banca-apply-btn" style="display:none;" onclick="window.applyBancaRanking()">Gravar P1/P2/P3</button>
            </div>
        </div>
    `;
  openModal('modal-banca-analyzer');
}

window.openBancaAnalyzerModal = openBancaAnalyzerModal;
window.parseBancaText = function () {
  const discId = document.getElementById('banca-disc-select').value;
  if (!discId) { showToast('Selecione uma matéria no campo acima.', 'error'); return; }

  const rawArgs = document.getElementById('banca-input-text').value;
  if (!rawArgs.trim()) { showToast('Nenhum texto informado.', 'error'); return; }

  const lines = rawArgs.split('\\n').map(l => l.trim()).filter(l => l.length > 2);
  let parsedRows = [];

  // Expressões regulares para achar padrão "1. Assunto" ou "Assunto (25%)"
  lines.forEach((line, idx) => {
    let weight = undefined;
    let extName = line;

    // Limpa numerações padrão como "1.", "1 -", "1)", etc, e assume Rank pelo index
    const rankMatch = extName.match(/^(\\d+)[\\.\\-\\)\\–\\—]\\s+(.*)/);
    if (rankMatch) {
      extName = rankMatch[2];
    }

    // Procura por % ou "Alta/Média/Baixa"
    const percMatch = extName.match(/(.*?)(?:(?:\\s*\\()|\\s*[\\-\\–\\—])?\\s*(\\d+(?:[.,]\\d+)?)\\s*%(?:\\))?/);
    if (percMatch && percMatch[2]) {
      extName = percMatch[1].trim();
      weight = parseFloat(percMatch[2].replace(',', '.')); // de 0 a 100
    } else {
      // Tenta extrair Level
      if (extName.toUpperCase().includes('ALTA')) weight = 100;
      else if (extName.toUpperCase().match(/\\bM[EÉ]DIA\\b/)) weight = 60;
      else if (extName.toUpperCase().includes('BAIXA')) weight = 30;
    }

    parsedRows.push({
      id: uid(),
      nome: extName.replace(/[\\*\\-\\–\\—•]/g, '').trim(),
      rank: idx + 1, // Se for sequencial, aproveita
      weight: weight,
      disciplinaId: discId
    });
  });

  // Mantém o histórico filtrando a disciplina selecionada e apendando os novos rows
  let existingTopics = state.bancaRelevance && state.bancaRelevance.hotTopics ? state.bancaRelevance.hotTopics : [];
  existingTopics = existingTopics.filter(ht => ht.disciplinaId !== discId);

  if (!state.bancaRelevance) state.bancaRelevance = {};
  state.bancaRelevance.hotTopics = existingTopics.concat(parsedRows);
  scheduleSave();

  // Atualiza a opção no select como Processada (Checkmark)
  const selectOpt = document.querySelector(`#banca-disc-select option[value="${discId}"]`);
  if (selectOpt && !selectOpt.text.startsWith('✅')) {
    selectOpt.text = selectOpt.text.replace('⚪', '✅');
  }
  document.getElementById('banca-input-text').value = '';

  // Roda a Engine Completa de Match para a disciplina específica para simulação na View
  analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId).filter(res => res.discId === discId);
  window.renderBancaMatches();
};

window.renderBancaMatches = function () {
  const container = document.getElementById('banca-match-results');
  const applyBtn = document.getElementById('banca-apply-btn');
  const statsDiv = document.getElementById('banca-stats');

  if (!analyzerCtx.tempMatchResults || analyzerCtx.tempMatchResults.length === 0) {
    container.style.display = 'none';
    applyBtn.style.display = 'none';
    return;
  }

  let p1c = 0, p2c = 0;

  const rows = analyzerCtx.tempMatchResults.map(res => {
    if (res.priority === 'P1') p1c++;
    if (res.priority === 'P2') p2c++;

    const stIcon = res.priority === 'P1' ? 'fa-fire' : (res.priority === 'P2' ? 'fa-bolt' : 'fa-check');
    const stColor = res.priority === 'P1' ? 'var(--red)' : (res.priority === 'P2' ? 'var(--orange)' : 'var(--text-muted)');

    const confBadgeColor = res.matchData.confidence === 'HIGH' ? 'var(--green)' : (res.matchData.confidence === 'MEDIUM' ? 'var(--yellow)' : 'var(--text-muted)');

    return `
            <div style="display:grid; grid-template-columns:30px 1fr 1fr 45px; gap:8px; border-bottom:1px solid var(--border); padding:10px 0; align-items:center;">
                <div style="color:${stColor}; font-size:14px; text-align:center;"><i class="fa ${stIcon}"></i></div>
                <div>
                   <div style="font-size:13px; font-weight:700; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${esc(res.assuntoNome)}">${esc(res.assuntoNome)}</div>
                   <div style="font-size:11px; color:var(--text-muted);">${esc(res.discNome)}</div>
                </div>
                <div>
                   <div style="font-size:12px; font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
                       ${res.matchData.matchedItem ? esc(res.matchData.matchedItem.nome) : '<span style="color:var(--text-muted);"><i>Sem Incidência</i></span>'}
                   </div>
                   <div style="font-size:10px; color:${confBadgeColor};">${res.matchData.reason} | Score: ${res.finalScore}</div>
                </div>
                <div>
                     <span class="event-tag" style="background:${stColor}; font-weight:900;">${res.priority}</span>
                </div>
                <div>
                     <button class="btn btn-ghost btn-sm" title="Corrigir Erro Textual" onclick="window.openMatchCorrector('${res.assuntoNome}')"><i class="fa fa-edit"></i></button>
                </div>
            </div>
        `;
  });

  container.innerHTML = `
        <div class="dash-label" style="margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:8px; display:flex; justify-content:space-between;">
           <span>2. Previsão de Match (Simulação)</span>
           <span>Prioridade</span>
        </div>
        ${rows.join('')}
    `;

  container.style.display = 'block';
  applyBtn.style.display = 'inline-block';
  statsDiv.textContent = `P1: ${p1c} tópicos incríveis | P2: ${p2c} tópicos de suporte`;
  showToast('Match Processado! Revise a lista antes de aplicar.', 'success');
};

window.applyBancaRanking = function () {
  if (commitEditalOrdering(analyzerCtx.editaId, analyzerCtx.tempMatchResults)) {
    showToast('Edital reordenado e prioridades P1/P2/P3 definidas!', 'success');
    closeModal('modal-banca-analyzer');
    renderCurrentView();
  } else {
    showToast('Falha crítica ao gravar novo Edital na Store', 'error');
  }
}

window.openMatchCorrector = function (assuntoNome) {
  const hotTopics = state.bancaRelevance?.hotTopics || [];

  // Lista as opções da banca detectada para o usuário "ligar os pontos"
  const optionsHtml = hotTopics.map(ht => `<option value="${ht.id}">${esc(ht.nome)} (Rank: ${ht.rank || ht.weight})</option>`).join('');

  document.getElementById('modal-match-corrector-title').textContent = 'Corrigir Assunto: ' + esc(assuntoNome);
  document.getElementById('modal-match-corrector-body').innerHTML = `
        <div class="form-group">
            <label class="form-label">Qual tema real da Banca equivale a esse tópico do Edital?</label>
            <select id="corrector-select" class="form-control">
                <option value="NONE">⚠️ Nenhuma Correspondência (Sem Incidência Real)</option>
                ${optionsHtml}
            </select>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                Isto forçará um *Match 100% (HIGH)* daqui pra frente.
            </div>
        </div>
        
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:16px;display:flex;justify-content:flex-end;gap:8px;">
             <button class="btn btn-ghost" onclick="closeModal('modal-match-corrector')">Cancelar</button>
             <button class="btn btn-primary" onclick="window.saveMatchCorrection('${esc(assuntoNome)}')">Forçar Correção</button>
        </div>
    `;
  openModal('modal-match-corrector');
}

window.saveMatchCorrection = function (assuntoOrigemRaw) {
  const overrideId = document.getElementById('corrector-select').value;
  // Salva o mapping
  if (!state.bancaRelevance.userMappings) state.bancaRelevance.userMappings = {};
  state.bancaRelevance.userMappings[assuntoOrigemRaw] = overrideId;
  scheduleSave();

  closeModal('modal-match-corrector');
  showToast('Match forçado com sucesso!', 'success');

  // Reprocessa
  if (analyzerCtx.parsedHotTopics.length > 0) {
    analyzerCtx.tempMatchResults = applyRankingToEdital(analyzerCtx.editaId);
    window.renderBancaMatches();
  }
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
    </div >
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
      entry.disc.assuntos.push({ id: uid(), nome, concluido: false, dataConclusao: null, revisoesFetas: [] });
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

  document.getElementById('modal-event-title').textContent = 'Iniciar Estudo';
  document.getElementById('modal-event-body').innerHTML = `
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
      <button class="btn btn-primary" onclick="saveEvent()">Salvar / Iniciar</button>
    </div>
        `;
  openModal('modal-event');
  // Tech 3: Show day load immediately
  setTimeout(() => updateDayLoad(dateStr || todayStr()), 50);
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
    tituloInput.value = `Estudar ${d.disc.nome} `;
    tituloInput.dataset.autoFilled = 'true';
  }
  if (!d || d.disc.assuntos.length === 0) { assuntoGroup.style.display = 'none'; return; }
  const pending = d.disc.assuntos.filter(a => !a.concluido);
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
      tituloInput.value = `Estudar ${d.disc.nome} `;
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

  let discId = document.getElementById('event-disc')?.value || '';
  let assId = document.getElementById('event-assunto')?.value || '';
  let autoTitle = titulo;

  if (!titulo && discId) {
    const d = getDisc(discId);
    autoTitle = `Estudar ${d?.disc.nome || 'Disciplina'} `;
  }

  if (!autoTitle) { showToast('Informe um título para o evento', 'error'); return; }

  // Helper that actually creates and saves the event
  const doSave = () => {
    const evento = {
      id: uid(), titulo: autoTitle, data, duracao, notas, fontes, legislacao,
      status: 'agendado', tempoAcumulado: 0,
      tipo: 'conteudo', // Fixed to conteudo since we unified it
      discId: discId || null,
      assId: assId || null,
      habito: null, // Habit array is formed upon completion
      criadoEm: new Date().toISOString()
    };

    state.eventos.push(evento);
    scheduleSave();
    closeModal('modal-event');
    renderCurrentView();
    showToast('Estudo iniciado/agendado!', 'success');
  };

  // Tech 3: Warn if there are already many events on this day
  const existingOnDay = state.eventos.filter(e => e.data === data && e.status !== 'estudei');
  const totalDuracao = existingOnDay.reduce((s, e) => s + (e.duracao || 0), 0) + duracao;
  if (existingOnDay.length >= 3 || totalDuracao > 480) {
    const horas = Math.round(totalDuracao / 60 * 10) / 10;
    const msg = existingOnDay.length >= 3
      ? `Você já tem ${existingOnDay.length} evento(s) neste dia.Adicionar mais pode gerar sobrecarga.`
      : `Você já tem ${Math.round((totalDuracao - duracao) / 60 * 10) / 10}h agendadas neste dia.Com este evento seriam ${horas} h.`;
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
                <div class="config-label">Tema Visual</div>
                <div class="config-sub">Personalize a aparência do seu sistema</div>
              </div>
              <select class="form-control" style="width:140px;" onchange="setTheme(this.value)">
                <option value="light" ${cfg.tema === 'light' || !cfg.darkMode ? 'selected' : ''}>☀️ Light</option>
                <option value="dark" ${cfg.tema === 'dark' || (cfg.darkMode && !cfg.tema) ? 'selected' : ''}>🌑 Original Dark</option>
                <option value="furtivo" ${cfg.tema === 'furtivo' ? 'selected' : ''}>🕶️ Furtivo</option>
                <option value="abismo" ${cfg.tema === 'abismo' ? 'selected' : ''}>🌌 Abismo</option>
                <option value="grafite" ${cfg.tema === 'grafite' ? 'selected' : ''}>🌫️ Grafite</option>
                <option value="matrix" ${cfg.tema === 'matrix' ? 'selected' : ''}>📟 Matrix</option>
                <option value="rubi" ${cfg.tema === 'rubi' ? 'selected' : ''}>🩸 Rubi</option>
              </select>
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
              <button type="button" class="toggle ${cfg.mostrarNumeroSemana ? 'on' : ''}" aria-pressed="${cfg.mostrarNumeroSemana ? 'true' : 'false'}" aria-label="Mostrar número da semana" onclick="toggleConfig('mostrarNumeroSemana',this);this.setAttribute('aria-pressed', this.classList.contains('on'))"></button>
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Agrupar eventos no dia</div>
                <div class="config-sub">Limita quantidade visível</div>
              </div>
              <button type="button" class="toggle ${cfg.agruparEventos ? 'on' : ''}" aria-pressed="${cfg.agruparEventos ? 'true' : 'false'}" aria-label="Agrupar eventos no dia" onclick="toggleConfig('agruparEventos',this);this.setAttribute('aria-pressed', this.classList.contains('on'))"></button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>⏱️ Temporizador</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Foco do Pomodoro (min)</div>
                <div class="config-sub">Tempo ininterrupto de estudo</div>
              </div>
              <input type="number" class="form-control" style="width:80px;text-align:center;" min="1" max="120" value="${cfg.pomodoroFoco || 25}" onchange="updateConfig('pomodoroFoco', parseInt(this.value, 10))">
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Pausa do Pomodoro (min)</div>
                <div class="config-sub">Intervalo de descanso</div>
              </div>
              <input type="number" class="form-control" style="width:80px;text-align:center;" min="1" max="60" value="${cfg.pomodoroPausa || 5}" onchange="updateConfig('pomodoroPausa', parseInt(this.value, 10))">
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>📚 Planejamento Diário</h3></div>
          <div class="card-body">
            <div class="config-row">
              <div>
                <div class="config-label">Matérias por dia no Ciclo</div>
                <div class="config-sub">Quantidade de disciplinas distribuídas diariamente no calendário/MED.</div>
              </div>
              <input type="number" class="form-control" style="width:80px;text-align:center;" min="1" max="15" value="${cfg.materiasPorDia || 3}" onchange="updateConfig('materiasPorDia', parseInt(this.value, 10))">
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
          <div class="card-header"><h3><i class="fa fa-cloud"></i> Sincronização Cloudflare (Primária)</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Sincronização em tempo real de baixíssima latência entre dispositivos via Cloudflare KV.</div>
            
            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">URL do Cloudflare Worker (API)</label>
              <input type="url" id="config-cf-url" class="form-control" placeholder="Ex: https://estudo-sync-api.xxxx.workers.dev" value="${esc(cfg.cfUrl || '')}" onchange="updateConfig('cfUrl', this.value.trim().replace(/\\/$/, ''))">
            </div>

            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">Token de Acesso (Auth Token)</label>
              <div style="display:flex; gap:8px;">
                  <input type="password" id="config-cf-token" class="form-control" placeholder="Sua senha secreta do Worker" value="${esc(cfg.cfToken || '')}" onchange="updateConfig('cfToken', this.value.trim())">
                  <button type="button" class="btn btn-outline" onclick="const t=document.getElementById('config-cf-token'); t.type=t.type==='password'?'text':'password';" title="Mostrar/Esconder Senha"><i class="fa fa-eye"></i></button>
              </div>
            </div>
            
            <div style="margin-top:16px; display:flex; align-items:center; gap:8px;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer;" class="btn ${cfg.cfSyncSyncEnabled ? 'btn-primary' : 'btn-outline'}">
                    <input type="checkbox" id="config-cf-enabled" onchange="window.toggleCfSync(this.checked)" style="display:none;" ${cfg.cfSyncSyncEnabled ? 'checked' : ''}>
                    <i class="fa fa-power-off"></i> <span id="cf-sync-toggle-text">${cfg.cfSyncSyncEnabled ? 'Sincronização Ativada' : 'Ativar Sincronização'}</span>
                </label>
                <button type="button" class="btn btn-outline" onclick="if(window.forceCloudflareSync) window.forceCloudflareSync()" id="btn-force-cf-sync" style="display: ${cfg.cfSyncSyncEnabled ? 'inline-flex' : 'none'};"><i class="fa fa-sync"></i> Forçar Sincronização Agora</button>
            </div>
            <p id="cf-sync-status" style="margin-top:12px; font-size:13px; font-weight:600;"></p>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><h3>😁️ Google Drive</h3></div>
          <div class="card-body">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <div style="font-size:32px;">😁️</div>
              <div>
                <div style="font-size:14px;font-weight:700;">${state.driveFileId ? 'Conectado ao Google Drive' : 'Não conectado'}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${state.driveFileId ? 'Seus dados são sincronizados automaticamente' : 'Sincronize seus dados entre dispositivos'}</div>
              </div>
            </div>
            ${state.driveFileId ? `
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" onclick="syncWithDrive().then(()=>showToast('Sincronizado!','success')).catch(()=>showToast('Erro ao sincronizar','error'))">
                  <i class="fa fa-cloud-upload-alt"></i> Sincronizar agora
                </button>
                <button class="btn btn-ghost btn-sm" onclick="syncWithDrive().then(()=>showToast('Dados atualizados!','success'))">
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
                <button class="btn btn-primary btn-sm" onclick="Notification.requestPermission().then(p=>{if(p==='granted')showToast('Notificações ativadas!','success');renderCurrentView()})">🔖 Ativar</button>
              ` : Notification.permission === 'granted' ? `
                <button class="btn btn-ghost btn-sm" onclick="new Notification('Estudo Organizado',{body:'Notificações funcionando!',icon:'📚'});showToast('Lembretes enviados!','success')">🔖 Testar</button>
              ` : ''}
            </div>
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Início)</div>
                <div class="config-sub">A partir de qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control" style="width:80px;text-align:center;" min="0" max="23" value="${cfg.silentModeStart ?? 22}" onchange="updateConfig('silentModeStart', parseInt(this.value, 10))">
            </div>
            
            <div class="config-row">
              <div>
                <div class="config-label">Modo Silencioso (Fim)</div>
                <div class="config-sub">Até qual horário silenciar:</div>
              </div>
              <input type="number" class="form-control" style="width:80px;text-align:center;" min="0" max="23" value="${cfg.silentModeEnd ?? 8}" onchange="updateConfig('silentModeEnd', parseInt(this.value, 10))">
            </div>
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
              <button class="btn btn-ghost btn-sm" onclick="archiveOldEvents(90)" title="Move eventos concluidos há mais de 90 dias para o arquivo">🙉 Arquivar antigos</button>
              <button class="btn btn-danger btn-sm" onclick="clearAllData()">🙆 Limpar tudo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>ℹ️ Sobre</h3></div>
          <div class="card-body">
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
              <strong>Estudo Organizado</strong> é um app para planejamento e organização de estudos para concursos públicos.<br><br>
              Baseado no Ciclo PDCA: planeje no Calendário, execute no Study Organizer, meça no Dashboard e corrija com as Revisões.<br><br>
              <span style="font-size:11px;color:var(--text-muted);">Versão 1.0 • Dados salvos localmente + Google Drive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function setTheme(themeName) {
  state.config.tema = themeName;
  state.config.darkMode = themeName !== 'light';

  document.documentElement.setAttribute('data-theme', themeName);
  scheduleSave();
  renderCurrentView();
}

export function updateConfig(key, value) {
  state.config[key] = value;
  if (key === 'materiasPorDia' && typeof syncCicloToEventos === 'function') {
    syncCicloToEventos();
  }
  scheduleSave();
  renderCurrentView();
}

export function toggleConfig(key, el) {
  state.config[key] = !state.config[key];
  el.classList.toggle('on', state.config[key]);
  scheduleSave();
}

export function toggleCfSync(enabled) {
  if (enabled) {
    const url = document.getElementById('config-cf-url').value.trim();
    const token = document.getElementById('config-cf-token').value.trim();
    if (!url || !token) {
      showToast('Preencha a URL do Worker e o Token antes de ativar.', 'error');
      const checkbox = document.getElementById('config-cf-enabled');
      if (checkbox) checkbox.checked = false;
      return;
    }
  }

  state.config.cfSyncSyncEnabled = enabled;
  scheduleSave();
  renderCurrentView();
}

export function updateFrequencia(value) {
  const nums = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (nums.length > 0) {
    state.config.frequenciaRevisao = nums;
    scheduleSave();
  }
}

export function openDriveModal() {
  openModal('modal-drive');
  const savedId = localStorage.getItem('estudo_drive_client_id');
  if (savedId) {
    const input = document.getElementById('drive-client-id');
    if (input) input.value = savedId;
  }
}

export function driveDisconnect() {
  // Delegate to the proper disconnectDrive in drive-sync.js which revokes the OAuth token
  if (typeof window.disconnectDrive === 'function') {
    window.disconnectDrive();
  } else {
    // Fallback: just clear local state
    state.driveFileId = null;
    state.lastSync = null;
    scheduleSave();
    renderCurrentView();
    showToast('Google Drive desconectado', 'info');
  }
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
    `Arquivar ${toArchive.length} evento(s) concluido(s) com mais de ${days} dias?\n\nEles continuarão no export/backup, mas não aparecerão nos relatórios.`,
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
            runMigrations();
            invalidateDiscCache();
            invalidateRevCache();
            invalidateTodayCache();
            scheduleSave();
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
          window.clearData(); // usa clearData() do store.js que limpa IndexedDB
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

  const highlight = str => esc(str).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi'), '<mark>$1</mark>');
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
          <div class="search-item-sub">${esc(disc.nome)} • ${esc(edital.nome)} ${ass.concluido ? '✅' : ''}</div>
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
        // cancel callback handled by app.js
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

// =============================================
// PLANEJAMENTO DE ESTUDOS VIEW (WIZARD RESULTS)
// =============================================
export function renderCiclo(el) {
  const plan = state.planejamento || {};

  window.recomecarCiclo = function () {
    showConfirm('Isto irá zerar o tempo estudado de todas as disciplinas do ciclo atual, contabilizando 1 Ciclo Completo.', () => {
      if (state.planejamento && state.planejamento.tipo) {
        state.planejamento.ciclosCompletos = (state.planejamento.ciclosCompletos || 0) + 1;
        state.planejamento.dataInicioCicloAtual = new Date().toISOString();
        scheduleSave();
        renderCurrentView();
        document.dispatchEvent(new CustomEvent('app:showToast', { detail: { msg: 'Ciclo recomeçado com sucesso!', type: 'success' } }));
      }
    });
  };

  if (!plan.ativo || !plan.disciplinas || plan.disciplinas.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding: 80px 20px;">
        <div class="icon">🧭</div>
        <h4>Nenhum Planejamento de Estudos</h4>
        <p style="margin-bottom: 24px; max-width: 400px; margin-left: auto; margin-right: auto;">Configure uma estratégia escolhendo entre o "Ciclo Contínuo de Estudos" ou a "Grade Semanal Fixa" para organizar seu tempo otimizadamente.</p>
        <button class="btn btn-primary" onclick="window.openPlanejamentoWizard()"><i class="fa fa-play"></i> Criar Meu Planejamento</button>
      </div>
    `;
    return;
  }

  const formatH = min => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return m > 0 ? `${h}h${m}min` : `${h}h`;
    return `${m}min`;
  };

  if (plan.tipo === 'ciclo') {
    // Calculo do tempo estudado desde dataInicioCicloAtual
    let dataInicio = plan.dataInicioCicloAtual || '1970-01-01T00:00:00.000Z';
    dataInicio = dataInicio.substring(0, 10);
    const statsPorDisc = {};
    plan.disciplinas.forEach(id => statsPorDisc[id] = 0);

    const eventosFiltrados = state.eventos.filter(ev => {
      const isEstudado = ev.status === 'estudei' && (ev.tempoAcumulado && ev.tempoAcumulado > 0);
      const evDate = ev.dataEstudo || ev.data;
      return isEstudado && evDate >= dataInicio;
    });

    eventosFiltrados.forEach(ev => {
      if (statsPorDisc[ev.discId] !== undefined) {
        statsPorDisc[ev.discId] += (ev.tempoAcumulado / 60); // min
      }
    });

    let totalTarget = 0;
    let sequenceHtml = '';
    const dictDisciplinas = {};
    plan.disciplinas.forEach(id => {
      const disc = getDisc(id);
      if (disc) dictDisciplinas[id] = disc;
    });

    // Construção Progressiva de Blocos da Sequência
    const copyStats = { ...statsPorDisc };
    let minutosCompletosCiclo = 0;

    let targetLoop = window._isEditingSequence ? (window._tempSequencia || []) : plan.sequencia;

    let optionsHtml = '<option value="">(Selecione)</option>';
    if (window._isEditingSequence) {
      plan.disciplinas.forEach(dId => {
        const disc = getDisc(dId);
        if (disc) optionsHtml += `<option value="${dId}">${esc(disc.disc.nome)}</option>`;
      });
    }

    targetLoop.forEach((seq, i) => {
      const d = dictDisciplinas[seq.discId];
      if (!window._isEditingSequence && !d) return; // skip se não estiver editando e for nulo

      totalTarget += seq.minutosAlvo;

      // Consome os minutos estudados para esta disciplina progressivamente
      let pct = 0;
      let usedMins = 0;
      if (seq.discId && copyStats[seq.discId] > 0) {
        if (copyStats[seq.discId] >= seq.minutosAlvo) {
          usedMins = seq.minutosAlvo;
          pct = 100;
          copyStats[seq.discId] -= seq.minutosAlvo;
        } else {
          usedMins = copyStats[seq.discId];
          pct = (usedMins / seq.minutosAlvo) * 100;
          copyStats[seq.discId] = 0;
        }
      }
      minutosCompletosCiclo += usedMins;
      const pctStr = pct.toFixed(2);
      const cor = d ? (d.disc.cor || d.edital.cor || '#3b82f6') : '#ccc';

      if (!window._isEditingSequence && window._hideConcluidosCiclo && pct >= 100) return;

      if (window._isEditingSequence) {
        let selHtml = optionsHtml;
        if (seq.discId) selHtml = selHtml.replace(`value="${seq.discId}"`, `value="${seq.discId}" selected`);

        sequenceHtml += `
          <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex;">
            <div style="width:6px; background:${cor}; flex-shrink:0;"></div>
            <div style="padding:16px; flex:1; display:flex; gap:16px; align-items:center;">
               <div style="flex:2;">
                 <div style="font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:4px; letter-spacing:1px; text-transform:uppercase;">Disciplina</div>
                 <select class="form-control" onchange="window.updateSeqItem('${i}', 'discId', this.value)" style="width:100%; border:none; border-bottom:1px solid var(--accent); border-radius:0; background:transparent; padding:4px 0; color:var(--text-primary); outline:none;">
                   ${selHtml}
                 </select>
               </div>
               <div style="flex:1;">
                 <div style="font-size:10px; font-weight:700; color:var(--text-muted); margin-bottom:4px; letter-spacing:1px; text-transform:uppercase;">Minutos</div>
                 <input type="number" class="form-control" value="${seq.minutosAlvo}" onchange="window.updateSeqItem('${i}', 'minutosAlvo', this.value)" style="width:100%; border:none; border-bottom:1px solid var(--accent); border-radius:0; background:transparent; padding:4px 0; color:var(--text-primary); outline:none;">
               </div>
               
               <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                 <div style="display:flex; gap:8px;">
                   <button class="btn btn-ghost btn-sm" onclick="window.dupSeqItem('${i}')" style="font-size:11px; padding:4px 8px; background:var(--card);">Duplicar</button>
                   <button class="btn btn-ghost btn-sm" onclick="window.remSeqItem('${i}')" style="font-size:11px; padding:4px 8px; background:var(--card);">Remover</button>
                 </div>
                 <div style="font-size:11px; color:var(--text-muted); font-family:'DM Mono',monospace; opacity:0.8;">
                   <i class="fa fa-clock"></i> ${formatH(usedMins)} ${pct >= 100 ? '(Feito)' : ''}
                 </div>
               </div>
               
               <div style="display:flex; flex-direction:column; align-items:center; justify-content:space-between; height:40px;">
                 ${i > 0 ? `<i class="fa fa-caret-up" style="cursor:pointer; color:var(--text-muted); font-size:16px;" onclick="window.moveSeqItem('${i}', -1)"></i>` : '<div style="height:16px"></div>'}
                 ${i < targetLoop.length - 1 ? `<i class="fa fa-caret-down" style="cursor:pointer; color:var(--text-muted); font-size:16px;" onclick="window.moveSeqItem('${i}', 1)"></i>` : '<div style="height:16px"></div>'}
               </div>
               
            </div>
          </div>
        `;
      } else {
        sequenceHtml += `
          <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex;">
            <div style="width:6px; background:${cor}; flex-shrink:0;"></div>
            <div style="padding:16px; flex:1;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="font-weight:600; font-size:15px; color:var(--text-primary); cursor:pointer;" title="Editar Nome do Evento" onclick="window.openCicloHistory('${seq.id}')">${d.disc.icone || '📚'} ${esc(d.disc.nome)}</div>
                <div style="font-size:12px; color:var(--text-muted); font-family:'DM Mono',monospace; display:flex; align-items:center; gap:6px;">
                   <i class="fa fa-clock"></i> <span style="font-weight:700; color:var(--text-primary);">${formatH(usedMins)}</span> / ${formatH(seq.minutosAlvo)}
                </div>
              </div>
              
              <div style="height:14px; background:rgba(255,255,255,0.05); border-radius:8px; overflow:hidden; position:relative; margin-bottom:12px;">
                <div style="position:absolute; top:0; left:0; height:100%; width:${Math.min(pct, 100)}%; background:${cor}; border-radius:8px; opacity:0.6;"></div>
                <div style="position:absolute; top:0; width:100%; text-align:center; font-size:10px; font-weight:700; color:var(--text-primary); line-height:14px; text-shadow:0px 1px 2px rgba(0,0,0,0.8);">${pctStr}%</div>
              </div>

              <div style="display:flex; gap:16px; font-size:11px;">
                <span style="color:var(--text-muted); cursor:pointer; font-weight:600; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-muted)'" onclick="window.iniciarEtapaPlanejamento('${seq.id}')"><i class="fa fa-play"></i> Iniciar Estudo</span>
                <span style="color:var(--text-muted); cursor:pointer; font-weight:600; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-muted)'" onclick="window.openAddEventModal()"><i class="fa fa-plus"></i> Adicionar Estudo Manualmente</span>
                <span style="color:var(--text-muted); cursor:pointer; font-weight:600; transition:0.2s;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-muted)'" onclick="window.openCicloHistory('${seq.id}')"><i class="fa fa-history"></i> Ver Últimos Estudos</span>
              </div>
            </div>
          </div>
        `;
      }
    });

    if (window._isEditingSequence) {
      sequenceHtml += `
         <div style="display:flex; justify-content:space-between; margin-top:24px; border-top:1px solid var(--border); padding-top:16px;">
           <button class="btn btn-ghost" style="border:1px solid var(--accent); color:var(--accent);" onclick="window.addSeqItem()"><i class="fa fa-plus"></i> Adicionar Disciplina</button>
           <div style="display:flex; gap:12px;">
              <button class="btn btn-ghost" onclick="window.cancelEditSeq()">Cancelar</button>
              <button class="btn btn-primary" onclick="window.saveEditSeq()"><i class="fa fa-save"></i> Salvar Alterações</button>
           </div>
         </div>
      `;
    }

    const progressoGlobalPct = totalTarget > 0 ? ((minutosCompletosCiclo / totalTarget) * 100).toFixed(2) : 0;
    const ciclosFeitos = plan.ciclosCompletos || 0;

    el.innerHTML = `
      <!-- HEADER ACTIONS -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:700;color:var(--text-primary);">Planejamento</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="window.recomecarCiclo()" style="background:var(--card); font-weight:600; color:var(--text-primary);"><i class="fa fa-sync"></i> Recomeçar Ciclo</button>
          <button class="btn btn-ghost btn-sm" onclick="window.openPlanejamentoWizard()" style="background:var(--card); font-weight:600; color:var(--text-primary);"><i class="fa fa-edit"></i> Replanejar</button>
          <button class="btn btn-ghost btn-sm" data-action="remover-planejamento" style="background:var(--card); font-weight:600; color:var(--text-primary);"><i class="fa fa-trash"></i> Remover</button>
        </div>
      </div>

      <div class="grid-2" style="grid-template-columns: 1fr 400px; gap:24px; align-items:start;">
        
        <!-- COLUNA ESQUERDA -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <div style="display:flex; gap:16px;">
            <!-- CICLOS COMPLETOS -->
            <div class="card" style="padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; min-width:140px;">
              <div style="font-size:11px; font-weight:700; color:var(--text-secondary); letter-spacing:1px; margin-bottom:12px;">CICLOS COMPLETOS</div>
              <div style="width:48px; height:48px; border:3px solid var(--accent); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:var(--text-primary);">${ciclosFeitos}</div>
            </div>
            <!-- PROGRESSO GERAL -->
            <div class="card" style="padding:16px; flex:1; display:flex; flex-direction:column; justify-content:center;">
              <div style="font-size:11px; font-weight:700; color:var(--text-secondary); letter-spacing:1px; margin-bottom:8px;">PROGRESSO</div>
              <div style="font-family:'DM Mono',monospace; font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:8px;">${formatH(minutosCompletosCiclo)} <span style="color:var(--text-muted);">/ ${formatH(totalTarget)}</span></div>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="padding:4px 8px; font-size:12px; font-weight:700; background:var(--accent); color:var(--bg); border-radius:4px;">${progressoGlobalPct}%</div>
                <div style="flex:1; height:12px; background:var(--bg); border-radius:6px; overflow:hidden;">
                  <div style="height:100%; width:${Math.min(progressoGlobalPct, 100)}%; background:rgba(255,255,255,0.7); border-radius:6px;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- SEQUENCIA DOS ESTUDOS -->
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
               <div style="font-size:12px; font-weight:700; color:var(--text-primary); letter-spacing:0.5px; text-transform:uppercase;">Sequência dos Estudos</div>
               <div style="display:flex; align-items:center; gap:16px;">
                 ${!window._isEditingSequence ? `
                   <button class="btn btn-ghost btn-sm" onclick="window.toggleEditSeq()" style="color:var(--text-muted); font-size:11px; padding:4px 8px;"><i class="fa fa-pencil"></i> Editar Sequência</button>
                 ` : ''}
                 <label style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color:var(--text-muted);">
                   <input type="checkbox" onchange="window.toggleCicloFin(this.checked)" ${window._hideConcluidosCiclo ? 'checked' : ''} style="cursor:pointer; accent-color:var(--accent); width:14px; height:14px;"> FINALIZADOS
                 </label>
               </div>
            </div>
            <div class="custom-scrollbar" style="max-height:600px; overflow-y:auto; padding-right:8px;">
              ${sequenceHtml}
            </div>
          </div>
        </div>

        <!-- COLUNA DIREITA -->
        <div class="card" style="padding:24px; display:flex; flex-direction:column;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); letter-spacing:0.5px; margin-bottom:24px;">CICLO</div>
          
          <div style="width: 100%; height: 300px; position:relative; margin-bottom:32px;">
             <canvas id="planejamentoChart"></canvas>
             <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-weight:800; font-size:28px; color:var(--text-muted);">${formatH(totalTarget)}</div>
          </div>
          
          <!-- FILETE LINEAR -->
          <div id="filete-linear-ciclo" style="display:flex; height:12px; border-radius:6px; overflow:hidden; opacity:0.8;"></div>
        </div>
      </div>
    `;

    // Render Chart.js
    setTimeout(() => {
      const ctx = document.getElementById('planejamentoChart');
      if (ctx) {
        const labels = [];
        const data = [];
        const bgColors = [];

        // Agrupar targets por disciplina para o gráfico
        const chartData = {};
        plan.sequencia.forEach(seq => {
          if (!chartData[seq.discId]) chartData[seq.discId] = 0;
          chartData[seq.discId] += seq.minutosAlvo;
        });

        let linearHtml = '';
        for (const [id, min] of Object.entries(chartData)) {
          const d = dictDisciplinas[id];
          if (d) {
            labels.push(d.disc.nome);
            data.push(min);
            const color = d.disc.cor || d.edital.cor || '#3b82f6';
            bgColors.push(color);
            const wPct = ((min / totalTarget) * 100).toFixed(2);
            linearHtml += `<div style="width:${wPct}%; background:${color}; height:100%;"></div>`;
          }
        }

        document.getElementById('filete-linear-ciclo').innerHTML = linearHtml;

        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: bgColors,
              borderColor: 'transparent',
              borderWidth: 0,
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleFont: { size: 13 },
                bodyFont: { size: 14, weight: 'bold' },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                  label: function (context) {
                    return ' ' + formatH(context.raw);
                  }
                }
              }
            }
          }
        });
      }
    }, 100);

  } else if (plan.tipo === 'semanal') {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    let weeklyHtml = '';
    let totalTarget = 0;

    for (let i = 0; i < 7; i++) {
      if (plan.horarios.diasAtivos.includes(i)) {
        weeklyHtml += `
            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px;">
               <div style="font-weight:700; margin-bottom:8px;">${days[i]}</div>
               <div style="color:var(--text-muted); font-size:13px;">${plan.horarios.horasPorDia[i]} horas planejadas</div>
            </div>
          `;
      }
    }

    let sequenceHtml = '';
    const dictDisciplinas = {};
    if (plan.disciplinas && plan.sequencia) {
      plan.disciplinas.forEach(id => {
        const disc = getDisc(id);
        if (disc) dictDisciplinas[id] = disc;
      });

      plan.sequencia.forEach((seq, i) => {
        const d = dictDisciplinas[seq.discId];
        if (!d) return;
        totalTarget += seq.minutosAlvo;

        sequenceHtml += `
            <div class="ciclo-item ${seq.concluido ? 'concluido' : ''}" style="margin-bottom:12px;">
              <div class="ciclo-item-cor" style="background:${d.disc.cor || d.edital.cor || '#3b82f6'};"></div>
              <div class="ciclo-item-body">
                <div class="ciclo-item-header">
                  <div class="ciclo-item-title" style="display:flex; align-items:center; gap:8px;">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                      <button class="icon-btn" style="padding:0px 4px; font-size:10px; height:16px; color:var(--text-muted);" onclick="window.moveCicloSeq(${i}, -1)" ${i === 0 ? 'disabled' : ''}><i class="fa fa-chevron-up"></i></button>
                      <button class="icon-btn" style="padding:0px 4px; font-size:10px; height:16px; color:var(--text-muted);" onclick="window.moveCicloSeq(${i}, 1)" ${i === plan.sequencia.length - 1 ? 'disabled' : ''}><i class="fa fa-chevron-down"></i></button>
                    </div>
                    <div style="cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="window.openCicloHistory('${seq.id}')" title="Ver Histórico de Sessões">${d.disc.icone || '📚'} <span style="text-decoration:underline;">${esc(d.disc.nome)}</span></div>
                  </div>
                  <div class="ciclo-item-meta" style="cursor:pointer; text-decoration:underline;" onclick="window.editCicloSeqHours(${i})" title="Clique para editar as horas planejadas">${formatH(seq.minutosAlvo)} planejado</div>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Etapa ${i + 1} da sequência global da semana</div>
                <div style="margin-top:8px;">
                   ${!seq.concluido
            ? `<button class="btn btn-primary btn-sm" onclick="window.iniciarEtapaPlanejamento('${seq.id}')"><i class="fa fa-play"></i> Estudar Agora</button>`
            : `<span style="color:var(--green);font-size:12px;font-weight:600;"><i class="fa fa-check"></i> Etapa Concluída</span>`
          }
                </div>
              </div>
            </div>
          `;
      });
    }

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;color:var(--text-primary);"><i class="fa fa-calendar-alt"></i> Sua Grade Semanal</h2>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="window.openPlanejamentoWizard()"><i class="fa fa-edit"></i> Editar Grade</button>
          <button class="btn btn-danger btn-sm" data-action="remover-planejamento"><i class="fa fa-trash"></i> Remover</button>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:24px;">
        <div>
          ${weeklyHtml || '<p>Nenhum dia de estudo planejado.</p>'}
        </div>
        <div class="card">
          <div class="card-header" style="padding-bottom:12px;border:none;">
            <h3 style="display:flex; align-items:center; gap:8px;"><i class="fa fa-list-ol" style="color:var(--text-muted);"></i> Sequência Gerada</h3>
          </div>
          <div class="card-body" style="padding-top:0;">
            <div class="ciclo-lista" style="max-height: 400px; overflow-y:auto; padding-right:8px;">
              ${sequenceHtml || '<div style="padding:20px;text-align:center;color:var(--text-muted);">Sequência vazia.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

window.openCicloHistory = function (seqId) {
  const plan = state.planejamento;
  if (!plan || !plan.sequencia) return;
  const seqItem = plan.sequencia.find(s => s.id === seqId);
  if (!seqItem) return;

  const discInfo = getDisc(seqItem.discId);
  if (!discInfo) return;

  const titleEl = document.getElementById('modal-ciclo-history-title');
  if (titleEl) titleEl.innerHTML = `🕒 Histórico: ${discInfo.disc.icone || '📚'} ${esc(discInfo.disc.nome)}`;

  const bodyEl = document.getElementById('modal-ciclo-history-body');

  // Filtrar histórico de estudos da disciplina
  const eventosDisc = state.eventos
    .filter(e => e.discId === seqItem.discId && e.status === 'estudei' && e.tempoAcumulado > 0)
    .sort((a, b) => (b.data + 'T' + (b.hora || '00:00:00')).localeCompare(a.data + 'T' + (a.hora || '00:00:00'))).reverse();

  let btnDesfazer = '';
  if (seqItem.concluido) {
    btnDesfazer = `
      <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
        <button class="btn btn-ghost" style="color:var(--orange); border: 1px solid var(--border);" onclick="window.desfazerEtapa('${seqId}')">
          <i class="fa fa-undo"></i> Desfazer 'Etapa Concluída' desta matéria
        </button>
      </div>
    `;
  }

  let htmlHistorico = '';
  if (eventosDisc.length === 0) {
    htmlHistorico = `<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size:14px;">Nenhuma sessão de estudo registrada ainda.</div>`;
  } else {
    htmlHistorico = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${eventosDisc.map(ev => {
      return `
            <div class="card" style="padding:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:600; font-size:14px; color:var(--text-primary); margin-bottom:4px;">
                  ${formatDate(ev.data)} ${ev.hora ? `às ${ev.hora}` : ''}
                </div>
                <div style="font-size:13px; color:var(--text-muted);">
                  📍 ${esc(ev.titulo)}
                </div>
                <div style="font-size:13px; color:var(--blue); font-weight:700; margin-top:2px;">
                   ⏱️ ${formatTime(ev.tempoAcumulado)} estudados
                </div>
              </div>
              <div>
                <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-ciclo-history'); window.openEventModal('${ev.id}')"><i class="fa fa-edit"></i> Editar</button>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="padding:16px;">
        ${btnDesfazer}
        <h4 style="margin-bottom:12px; font-size:15px; color:var(--text-secondary);">Sessões Recentes (${eventosDisc.length})</h4>
        ${htmlHistorico}
      </div>
    `;
  }

  openModal('modal-ciclo-history');
};

// Global exports for Disc Dashboard
window.openDiscDashboard = openDiscDashboard;
window.closeDiscDashboard = closeDiscDashboard;
window.addEventoParaAssunto = addEventoParaAssunto;
window.setTheme = setTheme;

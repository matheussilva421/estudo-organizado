/**
 * Home View (Dashboard Principal)
 * Renderiza o dashboard em 4 faixas:
 *   1. KPIs lifetime (com delta semanal)
 *   2. HERO: countdown da prova + próxima ação + CTAs
 *   3. ESTA SEMANA: 4 KPIs com progresso vs metas
 *   4. ANÁLISE: barras por disciplina + previsão visual + heatmap + gráfico semanal
 */

import { state } from '../store.js?v=8.37';
import { esc, formatDate, formatTime } from '../utils.js?v=8.37';
import { getUiSection, setUiSection } from '../ui-state.js?v=8.37';
import {
  getAggregatedStats,
  getPerformanceStats,
  getSyllabusProgress,
  getSyllabusProgressByEdital,
  getPagesReadStats,
  getConsistencyStreak,
  getSubjectStats,
  getCurrentWeekStats,
  getPreviousWeekStats,
  getPredictiveStats,
  getNextSuggestedLesson,
  getAulasWeeklyStats,
  getDisciplineProgressByEdital,
} from '../logic.js?v=8.37';

// Edital ativo selecionado nas tabs da Faixa 4 — persistido em ui-state (per-device).
function getActiveEditalId() {
  const editais = state.editais || [];
  const stored = getUiSection('home').activeEditalId;
  if (stored && editais.some((e) => e.id === stored)) return stored;
  return editais.length > 0 ? editais[0].id : null;
}

function setActiveEditalId(id) {
  setUiSection('home', { activeEditalId: id });
}

function fmtHM(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fmtHMHumano(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}min`;
}

/**
 * Renderiza um indicador de delta (▲ verde / ▼ vermelho / – cinza)
 * com formatação humana. label opcional contextualiza ("vs semana anterior").
 */
function fmtDelta(current, previous, formatter = (n) => n.toString(), label = 'vs sem. ant.') {
  const diff = current - previous;
  if (previous === 0 && current === 0) {
    return `<span class="dash-delta dash-delta--neutral">— ${label}</span>`;
  }
  if (diff === 0) {
    return `<span class="dash-delta dash-delta--neutral">≡ igual ${label}</span>`;
  }
  const sign = diff > 0 ? '▲' : '▼';
  const cls = diff > 0 ? 'dash-delta--up' : 'dash-delta--down';
  return `<span class="dash-delta ${cls}">${sign} ${formatter(Math.abs(diff))} ${label}</span>`;
}

/**
 * Sparkline SVG inline (24x12) — usa os 7 valores como heights normalizadas.
 * Retorna string vazia se todos zerados.
 */
function renderSparkline(values, color = 'var(--accent)') {
  const max = Math.max(...values);
  if (max === 0) return '<span class="dash-sparkline-empty" title="Sem registros nos últimos 7 dias">—</span>';
  const w = 56;
  const h = 16;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="dash-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${points}"></polyline>
    </svg>`;
}

// --- FAIXA 1: KPIs LIFETIME (com delta semanal + cards clicáveis) ----------
function renderLifetimeKpis(ctx) {
  const { perf, perfPerc, prog, progPerc, pagesReadTotal, totalTimeStr, weekStats, prevWeekStats } = ctx;
  const weekHours = fmtHMHumano(weekStats.totalSeconds);
  const weekPerf = weekStats.questionsCorrect + weekStats.questionsWrong;
  const weekPercAcerto = weekStats.totalQuestions > 0
    ? Math.round((weekStats.questionsCorrect / weekStats.totalQuestions) * 100)
    : 0;

  const deltaTempo = fmtDelta(
    weekStats.totalSeconds,
    prevWeekStats.totalSeconds,
    (sec) => fmtHMHumano(sec)
  );
  const deltaQuestoes = fmtDelta(
    weekStats.totalQuestions,
    prevWeekStats.totalQuestions,
    (n) => `${n} q.`
  );
  const deltaPaginas = fmtDelta(
    weekStats.totalPages,
    prevWeekStats.totalPages,
    (n) => `${n} pág`
  );

  return `
    <div class="dash-grid-top">
      <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" data-action="navigate" data-view="dashboard" role="button" tabindex="0" title="Ver estatísticas detalhadas">
        <div>
          <div class="dash-label">TEMPO DE ESTUDO</div>
          <div class="dashboard-stat-value dashboard-stat-value--mono">${totalTimeStr}</div>
          <div class="dash-stat-delta">${weekStats.totalSeconds > 0 ? `+${weekHours} esta semana` : 'Sem registros esta semana'}</div>
          <div class="dash-stat-delta-row">${deltaTempo}</div>
        </div>
      </div>

      <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" data-action="navigate" data-view="dashboard" role="button" tabindex="0" title="Ver estatísticas detalhadas">
        <div>
          <div class="dash-label">DESEMPENHO</div>
          <div class="dashboard-stat-detail-list">
            <div class="dashboard-stat-detail dashboard-stat-detail--positive">${perf.questionsCorrect} Acertos</div>
            <div class="dashboard-stat-detail dashboard-stat-detail--negative">${perf.questionsWrong} Erros</div>
          </div>
          <div class="dash-stat-delta">${weekPerf > 0 ? `${weekPerf} q. / ${weekPercAcerto}% acerto na semana` : 'Sem questões esta semana'}</div>
          <div class="dash-stat-delta-row">${deltaQuestoes}</div>
        </div>
        <div class="dashboard-stat-value">${perfPerc}%</div>
      </div>

      <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" data-action="navigate" data-view="editais" role="button" tabindex="0" title="Abrir edital">
        <div>
          <div class="dash-label">PROGRESSO NO EDITAL</div>
          <div class="dashboard-stat-detail-list">
            <div class="dashboard-stat-detail dashboard-stat-detail--positive">${prog.totalConcluidos} Aulas concluídas</div>
            <div class="dashboard-stat-detail dashboard-stat-detail--negative">${prog.totalAssuntos - prog.totalConcluidos} Aulas Pendentes</div>
          </div>
        </div>
        <div class="dashboard-stat-value">${progPerc}%</div>
      </div>

      <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" data-action="navigate" data-view="dashboard" role="button" tabindex="0" title="Ver estatísticas detalhadas">
        <div>
          <div class="dash-label">PÁGINAS LIDAS</div>
          <div class="dashboard-stat-value dashboard-stat-value--mono">${pagesReadTotal}</div>
          <div class="dash-stat-delta">+${weekStats.totalPages} esta semana</div>
          <div class="dash-stat-delta-row">${deltaPaginas}</div>
        </div>
      </div>
    </div>
  `;
}

// --- FAIXA 2: HERO (countdown + próxima ação + CTAs) -----------------------
function renderHero(ctx) {
  const { dataProva, streak } = ctx;
  const activeEditalId = getActiveEditalId();
  const next = getNextSuggestedLesson(activeEditalId);

  let countdownHtml;
  if (dataProva) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const provaDate = new Date(dataProva + 'T00:00:00');
    const diffDays = Math.ceil((provaDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      countdownHtml = `
        <div class="dash-hero-countdown">
          <div class="dash-hero-countdown-num">${diffDays}</div>
          <div class="dash-hero-countdown-label">dias para a prova<br><span class="text-secondary">${formatDate(dataProva)}</span></div>
        </div>`;
    } else if (diffDays === 0) {
      countdownHtml = `
        <div class="dash-hero-countdown">
          <div class="dash-hero-countdown-num text-accent">É hoje!</div>
          <div class="dash-hero-countdown-label">Boa sorte 🍀</div>
        </div>`;
    } else {
      countdownHtml = `
        <div class="dash-hero-countdown">
          <div class="dash-hero-countdown-num text-muted">${Math.abs(diffDays)}</div>
          <div class="dash-hero-countdown-label">dias atrás · <span data-action="prompt-prova" class="text-accent cursor-pointer">Nova prova</span></div>
        </div>`;
    }
  } else {
    countdownHtml = `
      <div class="dash-hero-countdown">
        <div class="dash-hero-countdown-num text-muted">—</div>
        <div class="dash-hero-countdown-label"><span data-action="prompt-prova" class="text-accent cursor-pointer font-semibold">Criar Prova</span> para iniciar countdown</div>
      </div>`;
  }

  let suggestionHtml;
  if (next) {
    suggestionHtml = `
      <div class="dash-hero-suggestion">
        <div class="dash-label">PRÓXIMA AÇÃO</div>
        <div class="dash-hero-next-line">
          <span class="dash-hero-edital-dot" style="background:${next.edital.cor || 'var(--accent)'};"></span>
          <strong class="text-primary">${esc(next.disc.nome)}</strong>
          <span class="text-secondary">·</span>
          <span class="text-secondary">${esc(next.aula.nome || 'Próxima aula')}</span>
        </div>
        <div class="text-base text-muted mt-1">${esc(next.edital.nome)}</div>
      </div>`;
  } else {
    suggestionHtml = `
      <div class="dash-hero-suggestion">
        <div class="dash-label">PRÓXIMA AÇÃO</div>
        <div class="text-md text-secondary mt-2">Todas as aulas do edital ativo estão concluídas. <span class="text-accent">Parabéns!</span></div>
      </div>`;
  }

  const streakBadge = streak.currentStreak > 0
    ? `<span class="dash-hero-streak"><i class="fa fa-fire"></i> ${streak.currentStreak} dia${streak.currentStreak === 1 ? '' : 's'} sem falhar</span>`
    : `<span class="dash-hero-streak dash-hero-streak--idle"><i class="fa fa-fire"></i> Comece um novo streak hoje</span>`;

  return `
    <div class="card p-16 home-card dash-hero">
      <div class="dash-hero-left">
        ${countdownHtml}
        ${streakBadge}
      </div>
      <div class="dash-hero-mid">
        ${suggestionHtml}
      </div>
      <div class="dash-hero-actions">
        <button class="btn btn-primary dash-hero-cta" data-action="navigate" data-view="cronometro">
          <i class="fa fa-play"></i> Iniciar sessão
        </button>
        <button class="btn btn-ghost dash-hero-cta" data-action="navigate" data-view="editais">
          <i class="fa fa-list"></i> Ver edital
        </button>
      </div>
    </div>
  `;
}

// --- FAIXA 3: ESTA SEMANA (4 KPIs com progresso e deltas) ------------------
function renderWeekKpis(ctx) {
  const { weekStats, prevWeekStats, metaHoras, metaQuest, percHoras, percQuest, aulasWeek, pred } = ctx;
  const horasFmt = fmtHM(weekStats.totalSeconds);
  const weekPerc = weekStats.totalQuestions > 0
    ? Math.round((weekStats.questionsCorrect / weekStats.totalQuestions) * 100)
    : 0;

  const statusColor = pred.status === 'verde' ? 'var(--green)'
    : pred.status === 'amarelo' ? 'var(--yellow)' : 'var(--red)';

  // Ritmo necessário p/ bater meta nos dias restantes
  const targetSecs = metaHoras * 3600;
  const remainingSecs = Math.max(0, targetSecs - weekStats.totalSeconds);
  const ritmoNecessario = pred.daysRemaining > 0
    ? remainingSecs / pred.daysRemaining
    : remainingSecs;
  const burnRateMin = Math.round(pred.burnRate / 60);
  const ritmoNecessarioMin = Math.round(ritmoNecessario / 60);
  const deltaRitmoMin = burnRateMin - ritmoNecessarioMin;
  const ritmoIcon = deltaRitmoMin >= 0 ? '▲' : '▼';
  const ritmoCls = deltaRitmoMin >= 0 ? 'dash-delta--up' : 'dash-delta--down';

  const deltaHoras = fmtDelta(weekStats.totalSeconds, prevWeekStats.totalSeconds, fmtHMHumano);
  const deltaQuestoes = fmtDelta(weekStats.totalQuestions, prevWeekStats.totalQuestions, (n) => `${n} q.`);
  const deltaAulas = fmtDelta(aulasWeek.thisWeek, aulasWeek.prevWeek, (n) => `${n} aula${n === 1 ? '' : 's'}`);
  const deltaPaginas = fmtDelta(weekStats.totalPages, prevWeekStats.totalPages, (n) => `${n} pág`);

  return `
    <div class="dash-week-grid">
      <div class="card p-16 home-card dash-week-card">
        <div class="dash-label">HORAS ESTA SEMANA</div>
        <div class="dash-week-value text-mono">${horasFmt} <span class="dash-week-target">/ ${metaHoras}h00</span></div>
        <div class="dash-progress-track" style="margin-top:8px;">
          <div class="dash-progress-bar" style="width:${percHoras}%; background:var(--accent);">
            <span class="text-xs absolute dash-progress-bar-label">${percHoras}%</span>
          </div>
        </div>
        <div class="dash-stat-delta" style="margin-top:6px; color:${statusColor};">
          Projeção ${pred.projectedPerc}% · ritmo ${formatTime(pred.burnRate).slice(0, 5)}/dia
          <span class="dash-delta ${ritmoCls}" style="margin-left:6px;">${ritmoIcon} ${Math.abs(deltaRitmoMin)}min ${deltaRitmoMin >= 0 ? 'acima' : 'abaixo'} do necessário</span>
        </div>
        <div class="dash-stat-delta-row">${deltaHoras}</div>
      </div>

      <div class="card p-16 home-card dash-week-card">
        <div class="dash-label">QUESTÕES ESTA SEMANA</div>
        <div class="dash-week-value text-mono">${weekStats.totalQuestions} <span class="dash-week-target">/ ${metaQuest}</span></div>
        <div class="dash-progress-track" style="margin-top:8px;">
          <div class="dash-progress-bar dash-progress-bar--questions" style="width:${percQuest}%;">
            <span class="text-xs absolute dash-progress-bar-label">${percQuest}%</span>
          </div>
        </div>
        <div class="dash-stat-delta" style="margin-top:6px;">
          ${weekStats.totalQuestions > 0
            ? `<span class="text-green">${weekStats.questionsCorrect} acertos</span> · <span class="text-red">${weekStats.questionsWrong} erros</span> · ${weekPerc}%`
            : 'Nenhuma questão registrada'}
        </div>
        <div class="dash-stat-delta-row">${deltaQuestoes}</div>
      </div>

      <div class="card p-16 home-card dash-week-card">
        <div class="dash-label">AULAS CONCLUÍDAS</div>
        <div class="dash-week-value">${aulasWeek.thisWeek}</div>
        <div class="dash-stat-delta" style="margin-top:8px;">
          esta semana · ${aulasWeek.totalPending} pendentes no edital
        </div>
        <div class="dash-stat-delta-row">${deltaAulas}</div>
      </div>

      <div class="card p-16 home-card dash-week-card">
        <div class="dash-label">PÁGINAS LIDAS</div>
        <div class="dash-week-value">${weekStats.totalPages}</div>
        <div class="dash-stat-delta" style="margin-top:8px;">esta semana</div>
        <div class="dash-stat-delta-row">${deltaPaginas}</div>
      </div>
    </div>
  `;
}

// --- FAIXA 4: ANÁLISE (esquerda: barras por disciplina | direita: gráficos) -
function renderSubjectProgress(ctx) {
  const editais = state.editais || [];
  const activeId = getActiveEditalId();
  const groups = ctx.disciplineProgress;
  const activeGroup = groups.find((g) => g.edital.id === activeId);

  const tabsHtml = editais.length > 1
    ? editais.map((e) => `
        <button class="dash-edital-tab ${e.id === activeId ? 'dash-edital-tab--active' : ''}" data-action="set-active-edital" data-edital-id="${e.id}">
          <span class="home-edital-dot" style="background:${e.cor || 'var(--accent)'};"></span>
          ${esc(e.nome)}
        </button>
      `).join('')
    : '';

  if (!activeGroup || activeGroup.disciplinas.length === 0) {
    return `
      <div class="card p-16 home-card dash-subject-panel">
        <div class="flex-between mb-3">
          <div class="dash-label">PROGRESSO POR DISCIPLINA</div>
        </div>
        ${tabsHtml ? `<div class="dash-edital-tabs">${tabsHtml}</div>` : ''}
        <div class="text-center text-muted" style="padding:24px;">Nenhuma disciplina cadastrada neste edital.</div>
      </div>`;
  }

  // Ordena pelo MENOR progresso (precisa de atenção primeiro), com tempo > 0 vindo após zerados.
  const sorted = [...activeGroup.disciplinas].sort((a, b) => {
    if (a.percent !== b.percent) return a.percent - b.percent;
    return a.tempo - b.tempo;
  });

  const rowsHtml = sorted.map((row) => {
    const fill = row.percent;
    const color = row.percent >= 80 ? 'var(--green)'
      : row.percent >= 50 ? 'var(--accent)'
      : row.percent >= 20 ? 'var(--yellow)' : 'var(--red)';
    const tempoStr = row.tempo > 0 ? formatTime(row.tempo).slice(0, 5) + 'h' : '—';
    const sparklineHtml = renderSparkline(row.sparkline || [0,0,0,0,0,0,0], color);
    return `
      <div class="dash-subject-progress-row" data-action="navigate-with-ctx" data-view="dashboard" data-ctx="${encodeURIComponent(JSON.stringify({ discId: row.disc.id, editalId: activeGroup.edital.id }))}" title="Abrir ${esc(row.disc.nome)}">
        <div class="dash-subject-progress-name text-ellipsis" title="${esc(row.disc.nome)}">${esc(row.disc.nome)}</div>
        <div class="dash-subject-progress-bar-wrap">
          <div class="dash-subject-progress-bar" style="width:${fill}%; background:${color};"></div>
        </div>
        <div class="dash-subject-sparkline" title="Tempo de estudo nos últimos 7 dias">${sparklineHtml}</div>
        <div class="dash-subject-progress-meta">
          <span class="dash-subject-progress-perc">${row.percent}%</span>
          <span class="dash-subject-progress-tempo text-muted">${tempoStr}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="card p-16 home-card dash-subject-panel">
      <div class="flex-between mb-3">
        <div class="dash-label">PROGRESSO POR DISCIPLINA</div>
        <span class="text-xs text-muted">${activeGroup.disciplinas.filter(d => d.percent >= 100).length}/${activeGroup.disciplinas.length} concluídas</span>
      </div>
      ${tabsHtml ? `<div class="dash-edital-tabs">${tabsHtml}</div>` : ''}
      <div class="dash-subject-progress-list">
        ${rowsHtml}
      </div>
    </div>
  `;
}

function renderAnalysisColumn(ctx) {
  const { weekStats, pred, streak } = ctx;
  const statusColor = pred.status === 'verde' ? 'var(--green)'
    : pred.status === 'amarelo' ? 'var(--yellow)' : 'var(--red)';
  const statusIcon = pred.status === 'verde' ? 'fa-check-circle'
    : pred.status === 'amarelo' ? 'fa-exclamation-triangle' : 'fa-skull-crossbones';

  // Barra visual: meta vs projetado (clamp 0..150% do target).
  const ratio = Math.min(150, Math.max(0, pred.projectedPerc));
  const projWidth = (ratio / 150) * 100;
  const targetMark = (100 / 150) * 100;

  // Gráfico semanal
  const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  const maxSec = Math.max(...weekStats.dailySeconds, 3600);
  const hasData = weekStats.totalSeconds > 0;
  const barsHtml = hasData
    ? weekStats.dailySeconds.map((sec, i) => {
        const h = (sec / maxSec) * 100;
        return `
          <div class="flex-col flex-center flex-1 h-full justify-end">
            <div class="home-weekly-study-bar" style="height:${h}%;" title="${formatTime(sec)}" role="img" aria-label="${days[i]}: ${formatTime(sec)} estudados"></div>
            <div class="text-xs font-semibold text-muted mt-2">${days[i]}</div>
          </div>`;
      }).join('')
    : `<div class="flex flex-center flex-1 text-muted text-sm dash-week-empty">
         <em>Nenhuma sessão de estudo registrada esta semana</em>
         <span data-action="navigate" data-view="cronometro" class="text-accent cursor-pointer font-semibold mt-2"><i class="fa fa-play"></i> Iniciar agora</span>
       </div>`;

  // Heatmap compacto
  const heatmapHtml = streak.heatmap.map((x) =>
    `<div class="streak-dot streak-dot--compact ${x ? 'streak-dot-ok' : 'streak-dot-miss'}"></div>`
  ).join('');

  return `
    <div class="dash-analysis-col">
      <div class="card p-16 home-card home-predictive-card" style="--predictive-status-color:${statusColor};">
        <div class="flex-between mb-3">
          <div class="dash-label">PREVISÃO DA SEMANA</div>
          <i class="fa ${statusIcon} home-predictive-icon"></i>
        </div>
        <div class="dash-prediction-bar">
          <div class="dash-prediction-bar-track">
            <div class="dash-prediction-bar-fill" style="width:${projWidth}%; background:${statusColor};"></div>
            <div class="dash-prediction-bar-mark" style="left:${targetMark}%;" title="Meta 100%"></div>
          </div>
          <div class="dash-prediction-bar-labels">
            <span>0%</span>
            <span class="dash-prediction-bar-target">Meta</span>
            <span>150%</span>
          </div>
        </div>
        <div class="text-md text-primary mt-3">
          Projeção: <strong>${pred.projectedPerc}%</strong> · ritmo ${formatTime(pred.burnRate).slice(0, 5)}/dia
        </div>
        <div class="text-base text-secondary surface-note mt-2">${pred.suggestion}</div>
      </div>

      <div class="card p-16 home-card home-weekly-study-card flex-col">
        <div class="flex-between mb-5">
          <div class="dash-label">ESTUDO SEMANAL</div>
          <div class="text-sm text-secondary">Total: ${fmtHM(weekStats.totalSeconds)}h</div>
        </div>
        <div class="home-weekly-study-chart ${hasData ? '' : 'home-weekly-study-chart--empty'} flex-1 flex border-b gap-sm pb-2 relative" style="align-items:${hasData ? 'flex-end' : 'center'};">
          ${hasData ? `<div class="flex-col absolute justify-between home-weekly-study-gridlines">
            <div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div>
          </div>` : ''}
          <div class="flex w-full h-full home-weekly-study-bars" style="padding-bottom:${hasData ? '20px' : '0'};">
            ${barsHtml}
          </div>
        </div>
      </div>

      <div class="card p-16 home-card dash-streak-compact">
        <div class="flex-between mb-2">
          <div class="dash-label">CONSTÂNCIA · 30 DIAS</div>
          <div class="text-sm text-secondary"><strong class="text-primary">${streak.currentStreak}</strong> sem falhar · recorde <strong>${streak.maxStreak}</strong></div>
        </div>
        <div class="streak-heatmap streak-heatmap--compact">${heatmapHtml}</div>
      </div>
    </div>
  `;
}

// --- ENTRY POINT -----------------------------------------------------------
export function renderHome(el) {
  // Memoização explícita: garante que o aggregator é construído uma única vez por turno.
  // (cache interno de logic.js é preservado entre re-renders, mas aqui força preenchimento
  // antes das demais chamadas e dá contexto explícito de performance.)
  const agg = getAggregatedStats();

  // Calcula tudo uma vez.
  const perf = getPerformanceStats();
  const perfPerc = perf.questionsTotal > 0
    ? Math.round((perf.questionsCorrect / perf.questionsTotal) * 100)
    : 0;

  const activeEditalId = getActiveEditalId();
  const prog = getSyllabusProgressByEdital(activeEditalId);
  const progPerc = prog.totalAssuntos > 0
    ? Math.round((prog.totalConcluidos / prog.totalAssuntos) * 100)
    : 0;

  const pagesReadTotal = getPagesReadStats();
  const streak = getConsistencyStreak();
  const subjStats = getSubjectStats();
  const weekStats = getCurrentWeekStats();
  const prevWeekStats = getPreviousWeekStats();
  const aulasWeek = getAulasWeeklyStats();
  const disciplineProgress = getDisciplineProgressByEdital();

  const metaHoras = state.config.metas?.horasSemana || 20;
  const metaQuest = state.config.metas?.questoesSemana || 150;
  const horasFeitas = weekStats.totalSeconds / 3600;
  const percHoras = Math.min(100, Math.round((horasFeitas / metaHoras) * 100) || 0);
  const questFeitas = weekStats.totalQuestions;
  const percQuest = Math.min(100, Math.round((questFeitas / metaQuest) * 100) || 0);

  const pred = getPredictiveStats(metaHoras, subjStats);

  // Tempo total lifetime — usa agg em vez de re-iterar eventos.
  let totalSeconds = 0;
  state.eventos.forEach((e) => {
    if (e.status === 'estudei') totalSeconds += e.tempoAcumulado || 0;
  });
  const totalTimeStr = formatTime(totalSeconds);

  const ctx = {
    agg,
    perf, perfPerc, prog, progPerc, pagesReadTotal,
    streak, weekStats, prevWeekStats, aulasWeek, disciplineProgress,
    metaHoras, metaQuest, percHoras, percQuest, pred,
    totalTimeStr,
    dataProva: state.config.dataProva,
  };

  el.innerHTML = `
    <!-- FAIXA 1: KPIs LIFETIME -->
    ${renderLifetimeKpis(ctx)}

    <!-- FAIXA 2: HERO de ação -->
    ${renderHero(ctx)}

    <!-- FAIXA 3: ESTA SEMANA -->
    ${renderWeekKpis(ctx)}

    <!-- FAIXA 4: ANÁLISE -->
    <div class="dash-grid-bottom">
      ${renderSubjectProgress(ctx)}
      ${renderAnalysisColumn(ctx)}
    </div>

    <!-- Botões de edição rápida (metas + prova) -->
    <div class="dash-quick-actions">
      <button class="btn btn-ghost btn-sm" data-action="prompt-prova"><i class="fa fa-edit"></i> Editar prova</button>
      <button class="btn btn-ghost btn-sm" data-action="prompt-metas"><i class="fa fa-edit"></i> Editar metas</button>
    </div>
  `;
}

/**
 * Action handler exportado para tabs de edital (registrado em navegacao.js).
 */
export function setActiveEdital(editalId) {
  setActiveEditalId(editalId);
  document.dispatchEvent(new Event('app:renderCurrentView'));
}

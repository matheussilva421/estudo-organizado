/**
 * Home View (Dashboard Principal)
 * Renderiza o dashboard principal com stats, metas, constância e painel de disciplinas
 */

import { state } from '../store.js?v=8.15';
import { esc, formatDate, formatTime } from '../utils.js?v=8.15';
import {
  getPerformanceStats,
  getSyllabusProgress,
  getPagesReadStats,
  getConsistencyStreak,
  getSubjectStats,
  getCurrentWeekStats,
  getPredictiveStats
} from '../logic.js?v=8.15';

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
  const percHoras = Math.min(100, Math.round((horasFeitas / metaHoras) * 100) || 0);

  const questFeitas = weekStats.totalQuestions;
  const percQuest = Math.min(100, Math.round((questFeitas / metaQuest) * 100) || 0);

  // Data da Prova
  const dataProva = state.config.dataProva;
  let provaText = 'Acompanhe aqui quantos dias faltam para a sua prova! <span data-action="prompt-prova" class="text-accent font-semibold cursor-pointer">Criar Prova</span>';
  if (dataProva) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const provaDate = new Date(dataProva + 'T00:00:00');
    const diffTime = provaDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      provaText = `<div class="text-3xl font-extrabold text-accent leading-none">${diffDays}</div><div class="text-md text-secondary mt-1">dias para a prova (${formatDate(dataProva)})</div>`;
    } else if (diffDays === 0) {
      provaText = `<strong class="text-accent" style="font-size:18px;">É hoje! Boa sorte! 🍀</strong>`;
    } else {
      provaText = `Prova já foi realizada há ${Math.abs(diffDays)} dias. <span data-action="prompt-prova" class="text-accent font-semibold cursor-pointer">Nova Prova</span>`;
    }
  }

  // Previsões da Semana
  const pred = getPredictiveStats(metaHoras, subjStats);
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
    <div class="card p-16 home-predictive-card" style="--predictive-status-color:${sc};">
      <div class="flex-between mb-3">
        <div class="dash-label">PREVISÃO DA SEMANA</div>
        <i class="fa ${si} home-predictive-icon"></i>
      </div>
      <div class="text-md text-primary mb-2">
        Projeção: <strong>${pred.projectedPerc}%</strong> da meta (Ritmo: ${formatTime(pred.burnRate).slice(0, 5)}/dia).
      </div>
      <div class="text-base text-secondary surface-note">
        ${pred.suggestion}
      </div>
    </div>
  `;

  // HEATMAP
  const heatmapHtml = streak.heatmap.map(x =>
    `<div class="streak-dot ${x ? 'streak-dot-ok' : 'streak-dot-miss'}"><i class="fa ${x ? 'fa-check' : 'fa-times'}"></i></div>`
  ).join('');

  // SESSIONS CHART
  const maxWeeklySec = Math.max(...weekStats.dailySeconds, 3600);
  const hasWeekData = weekStats.totalSeconds > 0;

  const barsHtml = hasWeekData ? weekStats.dailySeconds.map((sec, i) => {
    const h = (sec / maxWeeklySec) * 100;
    const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    return `
      <div class="flex-col flex-center flex-1 h-full justify-end">
        <div class="home-weekly-study-bar" style="height:${h}%;" title="${formatTime(sec)}"></div>
        <div class="text-xs font-semibold text-muted mt-2">${days[i]}</div>
      </div>
    `;
  }).join('') : `
    <div class="flex flex-center flex-1 text-muted text-sm">
      <em>Nenhuma sessão de estudo registrada esta semana</em>
    </div>
  `;

  // SUBJECTS TABLE
  const subjHtml = subjStats.map(s => {
    const apr = s.acertos + s.erros > 0 ? Math.round((s.acertos / (s.acertos + s.erros)) * 100) : 0;
    const aprColor = apr >= 80 ? 'green' : apr >= 60 ? 'orange' : apr > 0 ? 'red' : 'gray';
    const hasData = s.tempo > 0 || (s.acertos + s.erros) > 0;

    return `
      <div class="border-b text-md flex-center gap-md" style="display:grid; grid-template-columns:1fr 80px 40px 40px 40px; padding:8px 0;">
        <div class="text-accent font-semibold text-ellipsis" title="${esc(s.nome)}">${esc(s.nome)}</div>
        <div class="text-secondary text-right text-mono">${s.tempo > 0 ? formatTime(s.tempo) : '-'}</div>
        <div class="text-green text-center">${s.acertos}</div>
        <div class="text-red text-center">${s.erros}</div>
        <div class="flex flex-center"><div class="event-tag ${aprColor} text-center" style="padding:2px 6px; font-size:11px; min-width:32px;">${hasData ? apr : 0}</div></div>
      </div>
    `;
  }).join('');

  const totalTimeStr = formatTime(state.eventos.filter(e => e.status === 'estudei').reduce((s, e) => s + (e.tempoAcumulado || 0), 0));

  el.innerHTML = `
    <!-- LINHA 1: Cards Principais -->
    <div class="dash-grid-top">
      <div class="card p-16 dashboard-stat-card">
        <div>
          <div class="dash-label">TEMPO DE ESTUDO</div>
          <div class="dashboard-stat-value dashboard-stat-value--mono">${totalTimeStr}</div>
        </div>
      </div>

      <div class="card p-16 dashboard-stat-card">
        <div>
          <div class="dash-label">DESEMPENHO</div>
          <div class="dashboard-stat-detail-list">
            <div class="dashboard-stat-detail dashboard-stat-detail--positive">${perf.questionsCorrect} Acertos</div>
            <div class="dashboard-stat-detail dashboard-stat-detail--negative">${perf.questionsWrong} Erros</div>
          </div>
        </div>
        <div class="dashboard-stat-value">${perfPerc}%</div>
      </div>

      <div class="card p-16 dashboard-stat-card">
        <div>
          <div class="dash-label">PROGRESSO NO EDITAL</div>
           <div class="dashboard-stat-detail-list">
            <div class="dashboard-stat-detail dashboard-stat-detail--positive">${prog.totalConcluidos} Aulas concluídas</div>
            <div class="dashboard-stat-detail dashboard-stat-detail--negative">${prog.totalAssuntos - prog.totalConcluidos} Aulas Pendentes</div>
          </div>
        </div>
        <div class="dashboard-stat-value">${progPerc}%</div>
      </div>

      <div class="card p-16 dashboard-stat-card">
         <div>
          <div class="dash-label">PÁGINAS LIDAS</div>
          <div class="dashboard-stat-value dashboard-stat-value--mono">${pagesReadTotal}</div>
        </div>
      </div>
    </div>

    <!-- LINHA 2: Constância -->
    <div class="card p-16 dash-streak-panel mb-6">
      <div class="flex-between mb-3">
        <div class="dash-label">CONSTÂNCIA NOS ESTUDOS <i class="fa fa-question-circle" style="opacity:0.5; margin-left:4px;" title="Dias que você registrou sessões nos últimos 30 dias."></i></div>
        <div class="text-base font-semibold text-accent">Últimos 30 dias</div>
      </div>
      <div class="text-lg text-primary mb-4">
        Você está há <strong>${streak.currentStreak} dias sem falhar!</strong> Seu recorde é de <strong>${streak.maxStreak} dias sem falhas.</strong> 📅
      </div>
      <div class="streak-heatmap">
        ${heatmapHtml}
      </div>
    </div>

    <!-- LINHA 3: Metas, Gráfico e Disciplinas -->
    <div class="dash-grid-bottom">

      <!-- Esquerda: Tabela de Disciplinas -->
      <div class="card p-16 flex-col" style="max-height:500px;">
        <div class="dash-label mb-4">PAINEL</div>

        <div class="border-b text-base font-bold text-primary flex-center gap-md pb-2" style="display:grid; grid-template-columns:1fr 80px 40px 40px 40px;">
          <div>Disciplinas</div>
          <div class="text-right">Tempo</div>
          <div class="text-green text-center"><i class="fa fa-check"></i></div>
          <div class="text-red text-center"><i class="fa fa-times"></i></div>
          <div class="text-center">%</div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
          ${subjHtml || '<div class="text-center text-muted" style="padding:20px;">Nenhuma disciplina com histórico ainda.</div>'}
        </div>
      </div>

      <!-- Direita: Data, Metas e Gráfico -->
      <div class="flex-col min-w-0" style="gap:24px;">

        ${previsorHtml}

        <div class="card p-16">
          <div class="flex-between mb-2">
            <div class="dash-label">DATA DA PROVA</div>
            <i class="fa fa-edit text-muted cursor-pointer" data-action="prompt-prova" title="Editar Meta"></i>
          </div>
          ${provaText}
        </div>

        <div class="card p-16">
          <div class="flex-between mb-4">
            <div class="dash-label">METAS DE ESTUDO SEMANAL</div>
            <i class="fa fa-edit text-muted cursor-pointer" data-action="prompt-metas" title="Editar Meta"></i>
          </div>

          <div style="margin-bottom:16px;">
            <div class="flex-between text-base font-semibold text-primary mb-2">
              <span class="text-mono">${Math.floor(weekStats.totalSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((weekStats.totalSeconds % 3600) / 60).toString().padStart(2, '0')}/${metaHoras}h00min</span>
              <span>Horas de Estudo</span>
            </div>
            <div class="dash-progress-track">
              <div class="dash-progress-bar" style="width:${percHoras}%; background:var(--accent);">
                <span class="text-xs absolute dash-progress-bar-label">${percHoras}%</span>
              </div>
            </div>
          </div>

          <div>
            <div class="flex-between text-base font-semibold text-primary mb-2">
              <span class="text-mono">${questFeitas}/${metaQuest}</span>
              <span>Questões</span>
            </div>
            <div class="dash-progress-track">
              <div class="dash-progress-bar dash-progress-bar--questions" style="width:${percQuest}%;">
                <span class="text-xs absolute dash-progress-bar-label">${percQuest}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card p-16 flex-1 flex-col home-weekly-study-card">
          <div class="flex-between mb-5">
            <div class="dash-label">ESTUDO SEMANAL</div>
            <div class="flex text-sm gap-xs">
              <div class="event-tag green font-bold rounded-sm" style="padding:4px 8px;">TEMPO</div>
            </div>
          </div>
          <div class="home-weekly-study-chart ${hasWeekData ? '' : 'home-weekly-study-chart--empty'} flex-1 flex border-b gap-sm pb-2 relative" style="align-items:${hasWeekData ? 'flex-end' : 'center'};">
            ${hasWeekData ? `<div class="flex-col absolute justify-between home-weekly-study-gridlines">
              <div class="border-t-muted"></div>
              <div class="border-t-muted"></div>
              <div class="border-t-muted"></div>
              <div class="border-t-muted"></div>
              <div class="border-t-muted"></div>
            </div>` : ''}
            <div class="flex w-full h-full home-weekly-study-bars" style="padding-bottom:${hasWeekData ? '20px' : '0'};">
              ${barsHtml}
            </div>
          </div>
          <div class="flex flex-center text-sm font-semibold text-secondary gap-sm mt-3">
            <div class="home-weekly-study-legend-dot"></div> Total Estudado: ${Math.floor(weekStats.totalSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((weekStats.totalSeconds % 3600) / 60).toString().padStart(2, '0')}h
          </div>
        </div>

      </div>

    </div>
  `;
}

export default { renderHome };

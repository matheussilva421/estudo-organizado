/**
 * Home View (Dashboard Principal)
 * Renderiza o dashboard principal com stats, metas, constância e painel de disciplinas
 */

import { state } from '../store.js?v=8.3';
import { esc, formatDate, formatTime } from '../utils.js?v=8.3';
import {
  getPerformanceStats,
  getSyllabusProgress,
  getPagesReadStats,
  getConsistencyStreak,
  getSubjectStats,
  getCurrentWeekStats,
  getPredictiveStats
} from '../logic.js?v=8.3';

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
  const maxWeeklySec = Math.max(...weekStats.dailySeconds, 3600);
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
    <div class="card p-16 dash-streak-panel" style="margin-bottom:24px;">
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
      <div style="display:flex;flex-direction:column;gap:24px;min-width:0;">

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
              <span style="font-family:'DM Mono',monospace;">${Math.floor(weekStats.totalSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((weekStats.totalSeconds % 3600) / 60).toString().padStart(2, '0')}/${metaHoras}h00min</span>
              <span>Horas de Estudo</span>
            </div>
            <div class="dash-progress-track">
              <div class="dash-progress-bar" style="width:${percHoras}%;background:var(--accent);">
                <span style="position:absolute;left:8px;top:2px;font-size:10px;color:var(--accent-text);">${percHoras}%</span>
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
            <div style="position:absolute;top:0;left:0;right:0;bottom:25px;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;z-index:0;opacity:0.2;">
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
              <div style="border-top:1px solid var(--text-muted);"></div>
            </div>
            <div style="display:flex;width:100%;height:100%;z-index:1;padding-bottom:20px;">
              ${barsHtml}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);margin-top:12px;">
            <div style="width:8px;height:8px;background:var(--accent);border-radius:2px;"></div> Total Estudado: ${Math.floor(weekStats.totalSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((weekStats.totalSeconds % 3600) / 60).toString().padStart(2, '0')}h
          </div>
        </div>

      </div>

    </div>
  `;
}

export default { renderHome };

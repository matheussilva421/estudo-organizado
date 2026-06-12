// Visual Layout Lab — renderers puros (data → html) com o MARKUP REAL do app.
// Cada renderer emite as mesmas classes/estrutura DOM que as views de
// src/js/views/*.js produzem, mas SEM importar nenhum módulo de src/js/.
// Helpers visuais (sparkline, event card) são réplicas fiéis dos originais.

import { HOME, MED, CICLO, DASHBOARD, HABITOS } from './visual-layout-lab-data.js';

function formatDateBR(iso) {
  const [y, m, d] = String(iso || '').split('-');
  if (!y || !m || !d) return iso || '';
  return `${d}/${m}/${y}`;
}

// Réplica de renderSparkline de home-view.js (24x12 → 56x16).
function homeSparkline(values, color = 'var(--accent)') {
  const max = Math.max(...values);
  if (max === 0) {
    return '<span class="dash-sparkline-empty" title="Sem registros nos últimos 7 dias">—</span>';
  }
  const w = 56;
  const h = 16;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(' ');
  return `
    <svg class="dash-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${points}"></polyline>
    </svg>`;
}

// Réplica de renderSparkline de utils.js (usada em Hábitos).
function utilsSparkline(
  data,
  { width = 80, height = 24, stroke = 'currentColor', strokeWidth = 1.5, fill = false } = {}
) {
  if (!Array.isArray(data) || data.length === 0) {
    return `<svg class="sparkline sparkline-empty" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>`;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - strokeWidth) - strokeWidth / 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const fillPath = fill
    ? `<polygon points="0,${height} ${points} ${width},${height}" fill="${stroke}" opacity="0.18"/>`
    : '';
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${fillPath}<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// Réplica de renderEventCard de components.js (data-actions preservados como
// atributos inertes — o lab não registra o dispatcher do app).
function eventCard(ev) {
  return `
    <div class="event-card" data-event-id="${ev.id}" role="button" tabindex="0" aria-label="Abrir detalhes de ${ev.titulo}">
      <div class="event-stripe ${ev.status}"></div>
      <div class="event-disc-icon" style="background:${ev.cor}20;color:${ev.cor};">${ev.icone}</div>
      <div class="event-info">
        <div class="event-title">${ev.titulo}</div>
        <div class="event-sub">${ev.sub}</div>
        <div class="event-meta">
          <span class="event-tag ${ev.status}">${ev.statusLabel}</span>
          ${ev.tempo ? `<span style="font-size:11px;color:var(--text-muted);font-family:'DM Mono',monospace;">${ev.tempo}</span>` : ''}
          ${ev.timerAtivo ? '<span style="font-size:11px;color:var(--accent);font-weight:600;animation:pulse 1s infinite;">● Cronômetro ativo</span>' : ''}
        </div>
      </div>
      <div class="event-actions">
        ${ev.status !== 'estudei' ? `<button class="icon-btn ${ev.timerAtivo ? 'active' : ''}" title="${ev.timerAtivo ? 'Pausar' : 'Iniciar'} cronômetro" aria-label="${ev.timerAtivo ? 'Pausar' : 'Iniciar'} cronômetro">${ev.timerAtivo ? '⏸' : '▶'}</button>` : ''}
        ${ev.status !== 'estudei' ? '<button class="icon-btn" title="Marcar como Estudei" aria-label="Marcar como Estudei">✅</button>' : ''}
        <button class="icon-btn" title="Excluir" aria-label="Excluir evento">🗑</button>
      </div>
    </div>`;
}

function medGroup(title, eventos) {
  return `
    <div class="med-agenda-group">
      <div class="section-header"><h2>${title}</h2></div>
      ${eventos.map(eventCard).join('')}
    </div>`;
}

function progressLine(label, axis) {
  return `
    <div class="dash-progress-line ${axis.total === 0 ? 'dash-progress-line--empty' : ''}">
      <span class="dash-progress-line-label">${label}</span>
      <div class="dash-progress-line-track">
        <div class="dash-progress-line-fill" style="width:${axis.pct}%;"></div>
      </div>
      <span class="dash-progress-line-meta">${axis.pct}% · ${axis.done}/${axis.total}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------

const homeRenderers = {
  'home-kpi-tempo': () => `
    <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" role="button" tabindex="0" title="Ver estatísticas detalhadas" aria-label="Ver estatísticas detalhadas">
      <div>
        <div class="dash-label">TEMPO DE ESTUDO</div>
        <div class="dashboard-stat-value dashboard-stat-value--mono">${HOME.totalTimeStr}</div>
        <div class="dash-stat-delta">+16h32min esta semana</div>
        <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 2h22min vs sem. ant.</span></div>
      </div>
    </div>`,

  'home-kpi-desempenho': () => `
    <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" role="button" tabindex="0" title="Ver estatísticas detalhadas" aria-label="Ver estatísticas detalhadas">
      <div>
        <div class="dash-label">DESEMPENHO</div>
        <div class="dashboard-stat-detail-list">
          <div class="dashboard-stat-detail dashboard-stat-detail--positive">${HOME.perf.questionsCorrect} Acertos</div>
          <div class="dashboard-stat-detail dashboard-stat-detail--negative">${HOME.perf.questionsWrong} Erros</div>
        </div>
        <div class="dash-stat-delta">${HOME.weekStats.totalQuestions} q. / 73% acerto na semana</div>
        <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 23 q. vs sem. ant.</span></div>
      </div>
      <div class="dashboard-stat-value">${HOME.perfPerc}%</div>
    </div>`,

  'home-kpi-edital': () => `
    <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" role="button" tabindex="0" title="Abrir edital" aria-label="Abrir edital">
      <div>
        <div class="dash-label">PROGRESSO NO EDITAL</div>
        <div class="dashboard-stat-detail-list">
          <div class="dashboard-stat-detail dashboard-stat-detail--positive">${HOME.prog.totalConcluidos} Aulas concluídas</div>
          <div class="dashboard-stat-detail dashboard-stat-detail--negative">${HOME.prog.totalAssuntos - HOME.prog.totalConcluidos} Aulas Pendentes</div>
        </div>
      </div>
      <div class="dashboard-stat-value">${HOME.progPerc}%</div>
    </div>`,

  'home-kpi-paginas': () => `
    <div class="card p-16 dashboard-stat-card home-card dash-stat-card--clickable" role="button" tabindex="0" title="Ver estatísticas detalhadas" aria-label="Ver estatísticas detalhadas">
      <div>
        <div class="dash-label">PÁGINAS LIDAS</div>
        <div class="dashboard-stat-value dashboard-stat-value--mono">${HOME.pagesReadTotal}</div>
        <div class="dash-stat-delta">+${HOME.weekStats.totalPages} esta semana</div>
        <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 24 pág vs sem. ant.</span></div>
      </div>
    </div>`,

  'home-hero': () => `
    <div class="card p-16 home-card dash-hero">
      <div class="dash-hero-left">
        <div class="dash-hero-countdown">
          <div class="dash-hero-countdown-num">${HOME.diasParaProva}</div>
          <div class="dash-hero-countdown-label">dias para a prova<br><span class="text-secondary">${formatDateBR(HOME.dataProva)}</span></div>
        </div>
        <span class="dash-hero-streak"><i class="fa fa-fire"></i> ${HOME.streak.currentStreak} dias sem falhar</span>
      </div>
      <div class="dash-hero-mid">
        <div class="dash-hero-suggestion">
          <div class="dash-label">PRÓXIMA AÇÃO</div>
          <div class="dash-hero-next-line">
            <span class="dash-hero-edital-dot" style="background:${HOME.proximaAcao.cor};"></span>
            <strong class="text-primary">${HOME.proximaAcao.disciplina}</strong>
            <span class="text-secondary">·</span>
            <span class="text-secondary">${HOME.proximaAcao.aula}</span>
          </div>
          <div class="text-base text-muted mt-1">${HOME.proximaAcao.edital}</div>
        </div>
      </div>
      <div class="dash-hero-actions">
        <button class="btn btn-primary dash-hero-cta"><i class="fa fa-play"></i> Iniciar sessão</button>
        <button class="btn btn-ghost dash-hero-cta"><i class="fa fa-list"></i> Ver edital</button>
      </div>
    </div>`,

  'home-semana-horas': () => `
    <div class="card p-16 home-card dash-week-card">
      <div class="dash-label">HORAS ESTA SEMANA</div>
      <div class="dash-week-value text-mono">16:32 <span class="dash-week-target">/ ${HOME.metaHoras}h00</span></div>
      <div class="dash-progress-track" style="margin-top:8px;">
        <div class="dash-progress-bar" style="width:${HOME.percHoras}%; background:var(--accent);">
          <span class="text-xs absolute dash-progress-bar-label">${HOME.percHoras}%</span>
        </div>
      </div>
      <div class="dash-stat-delta" style="margin-top:6px; color:var(--green);">
        Projeção ${HOME.pred.projectedPerc}% · ritmo 02:22/dia
        <span class="dash-delta dash-delta--up" style="margin-left:6px;">▲ 28min acima do necessário</span>
      </div>
      <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 2h22min vs sem. ant.</span></div>
    </div>`,

  'home-semana-questoes': () => `
    <div class="card p-16 home-card dash-week-card">
      <div class="dash-label">QUESTÕES ESTA SEMANA</div>
      <div class="dash-week-value text-mono">${HOME.weekStats.totalQuestions} <span class="dash-week-target">/ ${HOME.metaQuest}</span></div>
      <div class="dash-progress-track" style="margin-top:8px;">
        <div class="dash-progress-bar dash-progress-bar--questions" style="width:${HOME.percQuest}%;">
          <span class="text-xs absolute dash-progress-bar-label">${HOME.percQuest}%</span>
        </div>
      </div>
      <div class="dash-stat-delta" style="margin-top:6px;">
        <span class="text-green">${HOME.weekStats.questionsCorrect} acertos</span> · <span class="text-red">${HOME.weekStats.questionsWrong} erros</span> · 73%
      </div>
      <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 23 q. vs sem. ant.</span></div>
    </div>`,

  'home-semana-aulas': () => `
    <div class="card p-16 home-card dash-week-card">
      <div class="dash-label">AULAS CONCLUÍDAS</div>
      <div class="dash-week-value">${HOME.aulasWeek.thisWeek}</div>
      <div class="dash-stat-delta" style="margin-top:8px;">
        esta semana · ${HOME.aulasWeek.totalPending} pendentes no edital
      </div>
      <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 2 aulas vs sem. ant.</span></div>
    </div>`,

  'home-semana-paginas': () => `
    <div class="card p-16 home-card dash-week-card">
      <div class="dash-label">PÁGINAS LIDAS</div>
      <div class="dash-week-value">${HOME.weekStats.totalPages}</div>
      <div class="dash-stat-delta" style="margin-top:8px;">esta semana</div>
      <div class="dash-stat-delta-row"><span class="dash-delta dash-delta--up">▲ 24 pág vs sem. ant.</span></div>
    </div>`,

  'home-progresso-disciplina': () => {
    const rows = HOME.subjectProgress
      .map((row) => {
        const color =
          row.percent >= 80
            ? 'var(--green)'
            : row.percent >= 50
              ? 'var(--accent)'
              : row.percent >= 20
                ? 'var(--yellow)'
                : 'var(--red)';
        return `
        <div class="dash-subject-progress-row" role="button" tabindex="0" title="Abrir ${row.nome}" aria-label="Abrir ${row.nome}">
          <div class="dash-subject-progress-name text-ellipsis" title="${row.nome}">${row.nome}</div>
          <div class="dash-subject-progress-bar-wrap">
            <div class="dash-subject-progress-bar" style="width:${row.percent}%; background:${color};"></div>
          </div>
          <div class="dash-subject-sparkline" title="Tempo de estudo nos últimos 7 dias">${homeSparkline(row.sparkline, color)}</div>
          <div class="dash-subject-progress-meta">
            <span class="dash-subject-progress-perc">${row.percent}%</span>
            <span class="dash-subject-progress-tempo text-muted">${row.tempo}h</span>
          </div>
        </div>`;
      })
      .join('');
    return `
    <div class="card p-16 home-card dash-subject-panel">
      <div class="flex-between mb-3">
        <div class="dash-label">PROGRESSO POR DISCIPLINA</div>
        <span class="text-xs text-muted">${HOME.subjectProgress.filter((r) => r.percent >= 100).length}/${HOME.subjectProgress.length} concluídas</span>
      </div>
      <div class="dash-subject-progress-list">
        ${rows}
      </div>
    </div>`;
  },

  'home-previsao-semana': () => `
    <div class="card p-16 home-card home-predictive-card" style="--predictive-status-color:var(--green);">
      <div class="flex-between mb-3">
        <div class="dash-label">PREVISÃO DA SEMANA</div>
        <i class="fa fa-check-circle home-predictive-icon"></i>
      </div>
      <div class="dash-prediction-bar">
        <div class="dash-prediction-bar-track">
          <div class="dash-prediction-bar-fill" style="width:${(Math.min(150, HOME.pred.projectedPerc) / 150) * 100}%; background:var(--green);"></div>
          <div class="dash-prediction-bar-mark" style="left:${(100 / 150) * 100}%;" title="Meta 100%"></div>
        </div>
        <div class="dash-prediction-bar-labels">
          <span>0%</span>
          <span class="dash-prediction-bar-target">Meta</span>
          <span>150%</span>
        </div>
      </div>
      <div class="text-md text-primary mt-3">
        Projeção: <strong>${HOME.pred.projectedPerc}%</strong> · ritmo 02:22/dia
      </div>
      <div class="text-base text-secondary surface-note mt-2">${HOME.pred.suggestion}</div>
    </div>`,

  'home-estudo-semanal': () => {
    const days = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    const maxSec = Math.max(...HOME.weekStats.dailySeconds, 3600);
    const bars = HOME.weekStats.dailySeconds
      .map((sec, i) => {
        const h = (sec / maxSec) * 100;
        return `
        <div class="flex-col flex-center flex-1 h-full justify-end">
          <div class="home-weekly-study-bar" style="height:${h}%;" role="img" aria-label="${days[i]}"></div>
          <div class="text-xs font-semibold text-muted mt-2">${days[i]}</div>
        </div>`;
      })
      .join('');
    return `
    <div class="card p-16 home-card home-weekly-study-card flex-col">
      <div class="flex-between mb-5">
        <div class="dash-label">ESTUDO SEMANAL</div>
        <div class="text-sm text-secondary">Total: 16:32h</div>
      </div>
      <div class="home-weekly-study-chart flex-1 flex border-b gap-sm pb-2 relative" style="align-items:flex-end;">
        <div class="flex-col absolute justify-between home-weekly-study-gridlines">
          <div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div><div class="border-t-muted"></div>
        </div>
        <div class="flex w-full h-full home-weekly-study-bars" style="padding-bottom:20px;">
          ${bars}
        </div>
      </div>
    </div>`;
  },

  'home-acoes': () => `
    <div class="dash-quick-actions">
      <button class="btn btn-ghost btn-sm"><i class="fa fa-edit"></i> Editar prova</button>
      <button class="btn btn-ghost btn-sm"><i class="fa fa-edit"></i> Editar metas</button>
    </div>`,

  'home-constancia': () => `
    <div class="card p-16 home-card dash-streak-compact">
      <div class="flex-between mb-2">
        <div class="dash-label">CONSTÂNCIA · 30 DIAS</div>
        <div class="text-sm text-secondary"><strong class="text-primary">${HOME.streak.currentStreak}</strong> sem falhar · recorde <strong>${HOME.streak.maxStreak}</strong></div>
      </div>
      <div class="streak-heatmap streak-heatmap--compact">${HOME.streak.heatmap
        .map(
          (ok) =>
            `<div class="streak-dot streak-dot--compact ${ok ? 'streak-dot-ok' : 'streak-dot-miss'}"></div>`
        )
        .join('')}</div>
    </div>`,
};

// ---------------------------------------------------------------------------
// MED (Study Organizer)
// ---------------------------------------------------------------------------

const medRenderers = {
  'med-resumo-dia': () => `
    <div class="med-sticky-header">
      <div class="med-sticky-row">
        <div class="med-sticky-time">⏱ 02:47:00</div>
        <div class="med-sticky-meta">
          <div class="med-sticky-bar"><div class="med-sticky-bar-fill" style="width:${MED.metaPct}%"></div></div>
          <span class="med-sticky-meta-label">${MED.metaPct}% da meta diária</span>
        </div>
        <div class="med-sticky-counts">
          <span class="badge med-badge--running">⏱ ${MED.emAndamentoCount} ativo(s)</span>
          <span class="badge">${MED.pendentesCount} pendente(s)</span>
          <span class="badge">${MED.concluidosCount} concluído(s)</span>
        </div>
      </div>
    </div>`,

  'med-stat-tempo': () => `
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Tempo Total Hoje</div>
      <div class="dashboard-stat-value dashboard-stat-value--mono">02:47:00</div>
      <div class="caption">${MED.concluidosCount} evento(s) concluido(s)</div>
    </div>`,

  'med-stat-pendentes': () => `
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Pendentes</div>
      <div class="text-3xl font-extrabold text-blue">${MED.pendentesCount + MED.emAndamentoCount}</div>
      <div class="caption">evento(s) para hoje</div>
    </div>`,

  'med-stat-foco': () => `
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Maior Foco</div>
      <div class="text-lg font-bold text-primary mt-2 med-focus-title" title="${MED.maiorFoco.titulo}">${MED.maiorFoco.titulo}</div>
      <div class="caption">${MED.maiorFoco.tempo}</div>
    </div>`,

  'med-em-andamento': () => `
    <div id="med-section-running">
      <div class="section-header"><h2>⏱ Em Andamento</h2></div>
      ${MED.eventos.emAndamento.map(eventCard).join('')}
    </div>`,

  'med-agendado-hoje': () => medGroup('Agendado para Hoje', MED.eventos.agendadoHoje),
  'med-agendado-amanha': () => medGroup('Amanhã', MED.eventos.amanha),
  'med-proximos-dias': () => medGroup('Próximos 7 dias', MED.eventos.proximosDias),

  'med-estudado-hoje': () => `
    <div id="med-section-estudado">
      <div class="section-header"><h2>✅ Estudado Hoje</h2></div>
      ${MED.eventos.estudadoHoje.map(eventCard).join('')}
    </div>`,
};

// ---------------------------------------------------------------------------
// CICLO
// ---------------------------------------------------------------------------

function cicloSeqItem(seq) {
  return `
    <div class="seq-item-card seq-item-card--static">
      <div class="seq-item-color-bar" style="background:${seq.cor};"></div>
      <div class="seq-item-content seq-item-content--static">
        <div class="seq-item-header">
          <div class="seq-item-title seq-item-discipline" role="button" tabindex="0" aria-label="Ver histórico de ${seq.nome}">${seq.icone} ${seq.nome}</div>
          ${seq.status === 'pulada' ? '<span class="grade-concluded-badge seq-item-pulada-badge"><i class="fa fa-forward"></i> Etapa pulada</span>' : ''}
          <div class="seq-item-time-display">
            <i class="fa fa-clock"></i> <span class="seq-item-time-value">${seq.feitoStr}</span> de ${seq.alvoStr}
          </div>
        </div>
        <div class="seq-progress-bar">
          <div class="seq-progress-fill absolute h-full rounded-lg" style="top:0; left:0; width:${Math.min(seq.pct, 100)}%; background:${seq.cor}; opacity:0.6;"></div>
          <div class="seq-progress-text">${seq.pct}%</div>
        </div>
        <div class="ciclo-sequence-actions">
          ${
            seq.status === 'pulada'
              ? '<button type="button" class="ciclo-action-link"><i class="fa fa-undo"></i> Reabrir etapa</button>'
              : `<button type="button" class="ciclo-action-link ciclo-action-link--primary"><i class="fa fa-play"></i> Iniciar Estudo</button>
                 <button type="button" class="ciclo-action-link"><i class="fa fa-plus"></i> Adicionar Estudo Manualmente</button>`
          }
          <button type="button" class="ciclo-action-link"><i class="fa fa-history"></i> Ver Últimos Estudos</button>
        </div>
      </div>
    </div>`;
}

const cicloRenderers = {
  'ciclo-cabecalho': () => `
    <div class="ciclo-header-actions">
      <h2 class="ciclo-header-title">Planejamento</h2>
      <div class="ciclo-header-buttons">
        <button class="btn btn-primary btn-sm ciclo-btn ciclo-btn--primary"><i class="fa fa-edit"></i> Replanejar</button>
        <div class="ciclo-kebab-wrap">
          <button class="btn btn-ghost btn-sm ciclo-kebab-btn" aria-haspopup="true" aria-expanded="false" title="Mais ações"><i class="fa fa-ellipsis-v"></i></button>
        </div>
      </div>
    </div>`,

  'ciclo-stat-completos': () => `
    <div class="card ciclo-stat-card ciclo-stat-card--center">
      <div class="ciclo-stat-label">CICLOS COMPLETOS</div>
      <div class="ciclo-stat-value">${CICLO.ciclosCompletos}</div>
      <div class="ciclo-stat-sub">acumulado: ${CICLO.acumuladoStr}</div>
    </div>`,

  'ciclo-stat-progresso': () => `
    <div class="card ciclo-stat-card ciclo-stat-card--fill">
      <div class="ciclo-stat-label">PROGRESSO</div>
      <div class="ciclo-stat-detail">${CICLO.progresso.feitoStr} de ${CICLO.progresso.totalStr}</div>
      <div class="ciclo-stat-meta">
        <span>faltam ${CICLO.progresso.faltamStr}</span>
        <span>${CICLO.progresso.sessoesConcluidas} de ${CICLO.progresso.totalSessoes} sessões concluídas</span>
      </div>
      <div class="flex cluster-sm">
        <div class="ciclo-stat-badge">${CICLO.progresso.pct}%</div>
        <div class="ciclo-progress-track">
          <div class="ciclo-progress-bar" style="width:${CICLO.progresso.pct}%;"></div>
        </div>
      </div>
    </div>`,

  'ciclo-sequencia': () => `
    <div class="card ciclo-sequence-card">
      <div class="ciclo-sequence-header">
        <div class="ciclo-sequence-title">Sequência dos Estudos</div>
        <div class="ciclo-sequence-controls">
          <button class="btn btn-ghost btn-sm ciclo-sequence-edit-btn"><i class="fa fa-pencil"></i> Editar Sequência</button>
          <label class="ciclo-filter-label">
            <input type="checkbox" class="ciclo-filter-checkbox"> FINALIZADOS
          </label>
        </div>
      </div>
      <div class="custom-scrollbar scroll-area-md">
        ${CICLO.sequencia.map(cicloSeqItem).join('')}
      </div>
    </div>`,

  'ciclo-distribuicao': () => `
    <div class="card ciclo-side-panel">
      <div class="ciclo-side-panel-header">
        <span>CICLO</span>
        <button class="btn btn-ghost btn-sm ciclo-side-panel-btn"><i class="fa fa-undo"></i> Zerar</button>
      </div>
      <div class="ciclo-chart-container">
        <canvas data-lab-chart="ciclo-doughnut"></canvas>
        <div class="ciclo-chart-total">${CICLO.totalTargetStr}</div>
      </div>
      <div class="ciclo-filete-linear">${CICLO.distribuicao
        .map((d) => {
          const total = CICLO.distribuicao.reduce((s, x) => s + x.minutos, 0);
          return `<div style="width:${((d.minutos / total) * 100).toFixed(2)}%; background:${d.cor}; height:100%;"></div>`;
        })
        .join('')}</div>
    </div>`,

  'ciclo-previsao': () => `
    <div class="card ciclo-side-panel">
      <div class="ciclo-predict-box">
        <h4 class="ciclo-predict-title"><i class="fa fa-calculator ciclo-predict-title-icon"></i> PREVISÃO DE SESSÕES</h4>
        <div class="ciclo-predict-dates">
          <div class="ciclo-predict-field">
            <label class="ciclo-predict-label">DATA INICIAL</label>
            <input type="date" class="form-control ciclo-predict-input" value="${CICLO.previsao.dataInicial}">
          </div>
          <div class="ciclo-predict-field">
            <label class="ciclo-predict-label">DATA FINAL</label>
            <input type="date" class="form-control ciclo-predict-input" value="${CICLO.previsao.dataFinal}">
          </div>
        </div>
        <div class="ciclo-predict-results" style="display:flex;">
          <div class="ciclo-predict-summary">
            <span>${CICLO.previsao.resumo.sessoes} sessões previstas</span>
            <span>${CICLO.previsao.resumo.duracaoStr} totais</span>
            <span class="ciclo-predict-summary-date">${formatDateBR(CICLO.previsao.dataInicial)} a ${formatDateBR(CICLO.previsao.dataFinal)}</span>
          </div>
          ${CICLO.previsao.porDisciplina
            .map(
              (d) => `
          <div class="seq-discipline-list-item">
            <div class="seq-discipline-info">
              <div class="seq-discipline-dot" style="background:${d.cor};"></div>
              <span class="seq-discipline-name">${d.nome}</span>
            </div>
            <div class="seq-discipline-stats">
              <span class="seq-discipline-stats-count">${d.sessoes}</span> sessões <span class="seq-discipline-stats-meta">(${d.duracaoStr})</span>
            </div>
          </div>`
            )
            .join('')}
        </div>
      </div>
    </div>`,
};

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

const dashboardRenderers = {
  'dash-filtro-periodo': () => `
    <div class="flex-between mb-4">
      <div class="text-md text-secondary">Exibindo dados: <strong class="text-primary">${DASHBOARD.periodLabel}</strong></div>
      <div class="cal-view-tabs" role="tablist" aria-label="Período do dashboard">
        ${[
          ['7d', 7],
          ['15d', 15],
          ['30d', 30],
          ['3m', 90],
          ['1a', 365],
          ['Total', null],
        ]
          .map(
            ([label, p]) => `
          <button type="button" class="cal-view-tab ${DASHBOARD.activePeriod === p ? 'active' : ''}" role="tab" aria-selected="${DASHBOARD.activePeriod === p}">${label}</button>`
          )
          .join('')}
      </div>
    </div>`,

  'dash-stat-tempo': () => `
    <div class="stat-card green">
      <div class="stat-label">Tempo Estudado</div>
      <div class="stat-value">${DASHBOARD.stats.tempoStr}</div>
      <div class="stat-sub">${DASHBOARD.periodLabel}</div>
    </div>`,

  'dash-stat-sessoes': () => `
    <div class="stat-card blue">
      <div class="stat-label">Sessões Realizadas</div>
      <div class="stat-value">${DASHBOARD.stats.sessoes}</div>
      <div class="stat-sub">eventos concluidos</div>
    </div>`,

  'dash-stat-questoes': () => `
    <div class="stat-card orange">
      <div class="stat-label">Questões</div>
      <div class="stat-value">${DASHBOARD.stats.questoes}</div>
      <div class="stat-sub">${DASHBOARD.periodLabel}</div>
    </div>`,

  'dash-stat-simulados': () => `
    <div class="stat-card red">
      <div class="stat-label">Simulados</div>
      <div class="stat-value">${DASHBOARD.stats.simulados}</div>
      <div class="stat-sub">${DASHBOARD.periodLabel}</div>
    </div>`,

  'dash-chart-diario': () => `
    <div class="card">
      <div class="card-header">
        <h3>📊 Horas por Dia</h3>
        <span class="text-sm text-muted">${DASHBOARD.periodLabel}</span>
      </div>
      <div class="card-body">
        <div class="chart-wrap"><canvas data-lab-chart="dash-daily"></canvas></div>
      </div>
    </div>`,

  'dash-chart-disciplina': () => `
    <div class="card">
      <div class="card-header">
        <h3>📚 Tempo por Disciplina</h3>
        <span class="text-sm text-muted">${DASHBOARD.periodLabel}</span>
      </div>
      <div class="card-body">
        <div class="chart-wrap"><canvas data-lab-chart="dash-disc"></canvas></div>
      </div>
    </div>`,

  'dash-habitos': () => `
    <div class="card">
      <div class="card-header"><h3>⚡ Hábitos (${DASHBOARD.periodLabel})</h3></div>
      <div class="card-body">${DASHBOARD.habitos
        .map(
          (h) => `
        <div class="flex border-b habit-row">
          <div class="text-xl">${h.icon}</div>
          <div class="flex-1 text-md font-medium">${h.label}</div>
          <div class="text-xl font-bold habit-count" data-habit-color="${h.color}">${h.count}</div>
        </div>`
        )
        .join('')}</div>
    </div>`,

  'dash-progresso': () => `
    <div class="card">
      <div class="card-header"><h3>📏 Progresso por Disciplina</h3></div>
      <div class="card-body">${DASHBOARD.progressoDisciplinas
        .map(
          (d) => `
        <button type="button" class="dash-progress-row" title="${d.nome}" style="--progress-color:${d.cor};">
          <div class="dash-progress-main">
            <div class="dash-progress-title" title="${d.nome}">
              <span>${d.icone}</span> ${d.nome}
            </div>
            <div class="dash-progress-sub">Geral ${d.overall.done}/${d.overall.total}</div>
          </div>
          <div class="dash-progress-bars" aria-label="Progresso de ${d.nome}">
            ${progressLine('Geral', d.overall)}
            ${progressLine('Tópicos', d.topics)}
            ${progressLine('Aulas', d.lessons)}
          </div>
        </button>`
        )
        .join('')}</div>
    </div>`,
};

// ---------------------------------------------------------------------------
// HÁBITOS
// ---------------------------------------------------------------------------

function habitCard(h) {
  return `
    <div class="habit-card" role="button" tabindex="0" aria-label="Registrar ${h.label}">
      <div class="hc-icon">${h.icon}</div>
      <div class="hc-label">${h.label}</div>
      <div class="hc-count" data-habit-color="${h.color}">${h.total}</div>
      <div class="hc-sub">${h.sub}</div>
      <div class="hc-spark" style="color:${h.color};margin-top:6px;">${utilsSparkline(h.series, { width: 90, height: 22, stroke: h.color, fill: true })}</div>
      ${h.streak > 0 ? `<div class="hc-streak" title="Sequência de dias com registro">🔥 ${h.streak}d</div>` : ''}
    </div>`;
}

const habitosRenderers = {};
for (const habit of HABITOS.cards) {
  habitosRenderers[`hab-${habit.key}`] = () => `<div class="habit-grid">${habitCard(habit)}</div>`;
}

habitosRenderers['hab-historico'] = () => `
  <div class="card habit-history-card">
    <div class="card-header">
      <h3>📏 Histórico de Hábitos</h3>
      <span class="text-base text-muted">${HABITOS.totalRegistros} registro(s)</span>
    </div>
    <div class="card-body habit-hist-list">
      ${HABITOS.historico
        .map(
          (r) => `
      <div class="flex border-b habit-hist-item">
        <div class="habit-item-icon">${r.icon}</div>
        <div class="flex-1">
          <div class="text-md font-semibold">${r.label}${r.descricao ? ' - ' + r.descricao : ''}</div>
          <div class="text-base text-secondary">${formatDateBR(r.data)}${r.extra ? ` • ${r.extra}` : ''}</div>
          ${
            r.tags.length
              ? `<div class="flex-wrap gap-sm mt-1 habit-disc-tags">
              ${r.tags.map((g) => `<span class="habit-disc-tag">${g.nome}: ${g.acertos}/${g.total}</span>`).join('')}
            </div>`
              : ''
          }
        </div>
        <button class="icon-btn" aria-label="Excluir hábito">🗑️</button>
      </div>`
        )
        .join('')}
    </div>
    <div class="habit-hist-footer" style="display:flex;">
      <button class="btn btn-ghost btn-sm" disabled>← Anterior</button>
      <span class="text-base text-muted flex-1 text-center">Página 1 de 11</span>
      <button class="btn btn-ghost btn-sm">Próxima →</button>
    </div>
  </div>`;

// ---------------------------------------------------------------------------

export const RENDERERS = {
  ...homeRenderers,
  ...medRenderers,
  ...cicloRenderers,
  ...dashboardRenderers,
  ...habitosRenderers,
};

export function renderCard(cardId) {
  const renderer = RENDERERS[cardId];
  if (!renderer) {
    return `<div class="card p-16"><div class="dash-label">CARD SEM RENDERER</div><div class="text-md text-muted">${cardId}</div></div>`;
  }
  return renderer();
}

// Gráficos Chart.js (vendor local do app) — inicializados pela cola DOM após
// o mount; aqui só a configuração com mock data.
export function getChartConfigs() {
  return {
    'ciclo-doughnut': {
      type: 'doughnut',
      data: {
        labels: CICLO.distribuicao.map((d) => d.nome),
        datasets: [
          {
            data: CICLO.distribuicao.map((d) => d.minutos),
            backgroundColor: CICLO.distribuicao.map((d) => d.cor),
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: { legend: { display: false } },
      },
    },
    'dash-daily': {
      type: 'bar',
      data: {
        labels: DASHBOARD.dailyLabels,
        datasets: [
          {
            label: 'Minutos',
            data: DASHBOARD.dailyMinutes,
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        },
      },
    },
    'dash-disc': {
      type: 'doughnut',
      data: {
        labels: DASHBOARD.tempoPorDisciplina.map((d) => d.nome),
        datasets: [
          {
            data: DASHBOARD.tempoPorDisciplina.map((d) => Math.round(d.minutos)),
            backgroundColor: DASHBOARD.tempoPorDisciplina.map((d) => d.cor),
            borderWidth: 2,
            borderColor: 'transparent',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } },
      },
    },
  };
}

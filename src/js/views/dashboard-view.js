/**
 * Dashboard View Module
 * Renderiza dashboard de disciplina (renderDisciplinaDashboard e helpers)
 */

import { state } from '../store.js?v=8.37';
import { cutoffDateStr, esc, formatDate, formatTime, HABIT_TYPES } from '../utils.js?v=8.37';
import { calculateContentProgress, getDisc } from '../logic.js?v=8.37';
import { getActiveDashboardTab } from '../state/dashboard-context.js?v=8.37';
import { renderCurrentView } from '../components.js?v=8.37';
import { setDiscChartInstance, getDiscChartInstance } from '../state/chart-state.js?v=8.37';
import {
  filterEventsBySelectedEdital,
  getFilteredActiveDisciplinas,
} from '../edital-filter.js?v=8.37';

// ── Main Dashboard Render ──
export function renderDisciplinaDashboard(edital, disc) {
  const tempos = state.eventos
    ? state.eventos.filter((e) => e.discId === disc.id && e.status === 'estudei')
    : [];
  let tempoTotal = 0;
  let qCertas = 0;
  let qErradas = 0;
  let pagLidas = 0;

  tempos.forEach((e) => {
    tempoTotal += e.tempoAcumulado || 0;
    const qs = e.sessao?.questoes || e.questoes;
    if (qs) {
      qCertas += qs.acertos || qs.certas || 0;
      qErradas += qs.erros || qs.erradas || 0;
    }
    pagLidas += e.sessao?.paginas?.total || e.paginas || 0;
  });

  const totalQuestoes = qCertas + qErradas;
  const percAcertos = totalQuestoes > 0 ? Math.round((qCertas / totalQuestoes) * 100) : 0;

  const progress = calculateContentProgress(disc);
  const activeDashboardTab = getActiveDashboardTab() || 'topicos';
  const tabBaseStyle =
    'padding:8px 0;font-weight:600;font-size:14px;cursor:pointer;background:transparent;border:0;font-family:inherit;text-align:left;';

  return `
    <div class="disc-dashboard-shell">

      <!-- HEADER STATS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
        <div class="card p-16">
          <div class="dash-label">TEMPO DE ESTUDO</div>
          <div class="stat-value mt-4">
            ${formatTime(tempoTotal)}
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">QUESTÕES (ACERTOS / TOTAL)</div>
          <div class="cluster-sm mt-4" style="align-items:baseline;">
            <div class="stat-value">
              ${qCertas} / ${totalQuestoes}
            </div>
            <div class="text-xl font-bold" style="color:${percAcertos >= 70 ? 'var(--green)' : percAcertos >= 50 ? 'var(--accent)' : 'var(--red)'};">
              ${percAcertos}%
            </div>
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">PROGRESSO DO EDITAL</div>
          <div class="cluster-sm mt-4" style="align-items:baseline;">
            <div class="stat-value">
              ${progress.overall.done} / ${progress.overall.total}
            </div>
            <div class="text-xl font-bold text-accent">
              ${progress.overall.pct}%
            </div>
          </div>
          <div class="progress-split mt-4">
            ${renderProgressMiniMetric('Tópicos', progress.topics)}
            ${renderProgressMiniMetric('Aulas', progress.lessons)}
          </div>
        </div>

        <div class="card p-16">
          <div class="dash-label">PÁGINAS LIDAS</div>
          <div class="stat-value mt-4">
            ${pagLidas}
          </div>
        </div>
      </div>

      <!-- MAIN CONTENT GRID -->
      <div class="disc-dashboard-main-grid">

        <!-- HISTÓRICO DE SESSÕES (ESQUERDA) -->
        <div class="card p-16 flex-col" style="min-height:400px; max-height:500px;">
          <div class="flex-between mb-6">
            <div class="dash-label">HISTÓRICO DE SESSÕES (ÚLTIMAS 50)</div>
            <button class="btn btn-sm rounded-sm soft-action" style="font-size:12px; padding:4px 8px;" data-action="open-add-past-session" data-disc-id="${disc.id}">
              <i class="fa fa-plus"></i> Registrar
            </button>
          </div>
          ${renderHistoricoDisciplina(tempos)}
        </div>

        <!-- CONTEÚDO DINÂMICO (DIREITA) -->
        <div class="card p-16 flex-col" style="min-height:400px; max-height:500px;">
          <!-- Tabs Navigation -->
          <div role="tablist" aria-label="Conteudo da disciplina" class="border-b mb-6 gap-lg" style="display:flex; align-items:flex-end;">
            <button type="button" role="tab" aria-selected="${activeDashboardTab === 'topicos'}" data-action="switch-dashboard-tab" data-tab="topicos" style="${tabBaseStyle} color:${activeDashboardTab === 'topicos' ? 'var(--accent)' : 'var(--text-muted)'}; border-bottom:2px solid ${activeDashboardTab === 'topicos' ? 'var(--accent)' : 'transparent'};">
               Tópicos do Edital
            </button>
            <button type="button" role="tab" aria-selected="${activeDashboardTab === 'aulas'}" data-action="switch-dashboard-tab" data-tab="aulas" style="${tabBaseStyle} color:${activeDashboardTab === 'aulas' ? 'var(--accent)' : 'var(--text-muted)'}; border-bottom:2px solid ${activeDashboardTab === 'aulas' ? 'var(--accent)' : 'transparent'};">
               Aulas (${disc.aulas?.length || 0})
            </button>
            <button type="button" role="tab" aria-selected="${activeDashboardTab === 'banca'}" data-action="switch-dashboard-tab" data-tab="banca" style="${tabBaseStyle} color:${activeDashboardTab === 'banca' ? 'var(--accent)' : 'var(--text-muted)'}; border-bottom:2px solid ${activeDashboardTab === 'banca' ? 'var(--accent)' : 'transparent'}; display:flex; gap:6px; align-items:center;">
               <i class="fa fa-brain" style="font-size:12px;"></i> Hot Topics
            </button>
          </div>

          <div class="flex-1 flex-col overflow-hidden" style="min-height:0;">
            ${activeDashboardTab === 'topicos' ? renderTopicosEditalDisciplina(edital, disc) : ''}
            ${activeDashboardTab === 'aulas' ? renderAulasDisciplinaDashboard(edital, disc) : ''}
            ${activeDashboardTab === 'banca' ? renderBancaDisciplinaDashboard(edital, disc) : ''}
          </div>
        </div>

      </div>

      <!-- PERFORMANCE GRAPH -->
      <div class="card p-16">
        <div class="dash-label mb-6">EVOLUÇÃO DOS ACERTOS (%) - ÚLTIMAS SESSÕES</div>
        <div class="w-full relative" style="height:250px;">
          <canvas id="disc-chart-acertos"></canvas>
        </div>
      </div>

    </div>
  `;
}

function renderProgressMiniMetric(label, axis) {
  const isEmpty = axis.total === 0;
  return `
    <div class="progress-mini ${isEmpty ? 'progress-mini--empty' : ''}">
      <div class="progress-mini-head">
        <span>${label}</span>
        <strong>${axis.done}/${axis.total}</strong>
      </div>
      <div class="progress-mini-track">
        <div class="progress-mini-fill" style="width:${axis.pct}%;"></div>
      </div>
    </div>
  `;
}

// ── Helper: Render Session History Table ──
function renderHistoricoDisciplina(tempos) {
  const reverseTempos = [...tempos].reverse().slice(0, 50);
  if (reverseTempos.length === 0) {
    return '<div class="flex-1 flex-center text-muted text-italic">Nenhuma sessão de estudo registrada.</div>';
  }

  return `
    <div class="custom-scrollbar scroll-panel" data-dashboard-scroll="historico">
            <table class="w-full text-md" style="border-collapse:collapse; text-align:left;">
              <thead style="position:sticky;top:0;background:var(--card);z-index:2;">
                <tr class="border-b text-muted">
                  <th class="th-compact">Data</th>
                  <th class="th-compact">Tempo</th>
                  <th class="th-compact">Pág.</th>
                  <th class="th-compact">Questões</th>
                  <th class="th-compact">Acerto</th>
                </tr>
              </thead>
              <tbody>
                ${reverseTempos
                  .map((t) => {
                    const dateStr = formatDate(t.data);
                    const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
                    const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
                    const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
                    const certas = qs.acertos || qs.certas || 0;
                    const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
                    const percColor =
                      perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
                    const pags = t.sessao?.paginas?.total || t.paginas || null;

                    return `
              <tr class="session-history-row cursor-pointer" style="border-bottom:1px solid var(--bg);" data-action="open-registro-sessao" data-event-id="${t.id}">
                <td class="text-primary" style="padding:10px 4px;">${dateStr}</td>
                <td class="text-mono" style="padding:10px 4px;">${tempoStr}</td>
                <td style="padding:10px 4px;">${pags ?? '-'}</td>
                <td style="padding:10px 4px;">${certas} / ${totQs}</td>
                <td class="font-bold" style="padding:10px 4px; color:${totQs > 0 ? percColor : 'inherit'};">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
                  })
                  .join('')}
              </tbody>
            </table>
    </div>
          `;
}

// ── Helper: Render Topics Tab ──
function renderTopicosEditalDisciplina(edital, disc) {
  if (!disc.assuntos || disc.assuntos.length === 0) {
    return '<div class="flex-1 flex-center text-muted text-italic">Nenhum tópico cadastrado.</div>';
  }

  return `
    <div class="custom-scrollbar scroll-panel" data-dashboard-scroll="topicos">
            ${disc.assuntos
              .map((ass) => {
                const importanceBadge =
                  ass.relevance?.priority === 'P1'
                    ? '<span class="priority-badge priority-badge--p1" title="Alta Chance de Cobrança">🔥 P1</span>'
                    : ass.relevance?.priority === 'P2'
                      ? '<span class="priority-badge priority-badge--p2">⚠️ P2</span>'
                      : '';

                return `
        <div class="list-row rounded-md" style="${ass.concluido ? 'background:var(--bg-secondary); ' : ''};">
          <div class="check-circle ${ass.concluido ? 'done' : ''} flex-shrink-0" data-action="toggle-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" role="button" tabindex="0" aria-pressed="${!!ass.concluido}" aria-label="${ass.concluido ? 'Desmarcar' : 'Concluir'} assunto ${esc(ass.nome)}">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-w-0 text-md" style="font-weight:${ass.concluido ? '400' : '600'}; color:${ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)'}; ${ass.concluido ? 'text-decoration:line-through; ' : ''};">
             ${esc(ass.nome)} ${importanceBadge}
          </div>
          ${
            ass.concluido
              ? `
            <div class="text-right flex-shrink-0">
              <div class="text-xs font-bold text-green">✅ concluído</div>
              <div class="text-xs text-muted">${formatDate(ass.dataConclusao)}</div>
            </div>
          `
              : `
            <button class="btn btn-ghost btn-sm btn-xs" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">+ Agenda</button>
          `
          }
        </div>
      `;
              })
              .join('')}
    </div>
  `;
}

// ── Helper: Render Classes Tab ──
function renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return '<div class="flex-1 flex-col flex-center text-muted text-italic items-center"><div class="text-3xl mb-3">🗂️</div>Nenhuma aula ou material cadastrado.<br><span class="text-base mt-2">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</span></div>';
  }

  return `
    <div class="custom-scrollbar scroll-panel" data-dashboard-scroll="aulas">
        ${disc.aulas
          .map(
            (aul) => `
        <div class="list-row rounded-md" style="${aul.estudada ? 'background:var(--bg-secondary); ' : ''};">
          <div class="check-circle ${aul.estudada ? 'done' : ''} flex-shrink-0 cursor-pointer" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" role="button" tabindex="0" aria-pressed="${!!aul.estudada}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}" aria-label="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'} ${esc(aul.nome)}">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-w-0 text-md" style="font-weight:${aul.estudada ? '400' : '600'}; color:${aul.estudada ? 'var(--text-muted)' : 'var(--text-primary)'}; ${aul.estudada ? 'text-decoration:line-through; ' : ''};">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div class="text-xs text-muted mt-1">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${
            !aul.estudada
              ? `
            <button class="btn btn-ghost btn-sm btn-xs" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
          `
              : ''
          }
        </div>
      `
          )
          .join('')}
    </div>
  `;
}

// ── Helper: Render Banca/Hot Topics Tab ──
function renderBancaDisciplinaDashboard(edital, disc) {
  const hasHotTopics =
    state.bancaRelevance &&
    state.bancaRelevance.hotTopics &&
    state.bancaRelevance.hotTopics.some((ht) => ht.disciplinaId === disc.id);
  const hasAulas = disc.aulas && disc.aulas.length > 0;

  if (!hasHotTopics) {
    return `
         <div class="flex-1 flex-col flex-center text-muted text-center items-center" style="padding:24px;">
           <i class="fa fa-robot mb-4" style="font-size:48px; color:var(--border);"></i>
           <div class="font-semibold mb-2 text-primary">Nenhuma análise encontrada</div>
           <div class="text-md" style="max-width:250px;">Use o Analisador de Banca no menu principal para injetar o sumário de exigência desta disciplina.</div>
         </div>
       `;
  }

  return `
       <div class="custom-scrollbar scroll-panel" data-dashboard-scroll="banca" style="padding-top:8px;">
         <div class="bg-surface border rounded-md mb-6" style="padding:12px;">
            <div class="text-base font-bold text-secondary mb-3">STATUS DO MAPEADOR DE INTELIGÊNCIA</div>

            <div class="flex-between text-md mb-2">
              <span>Dados de Banca extraídos:</span>
              <span class="font-semibold text-green">✅ ATIVO</span>
            </div>

            <div class="flex-between text-md">
              <span>Aulas atreladas aos Tópicos P1 e P2:</span>
              <span class="font-semibold" style="color:${hasAulas ? 'var(--green)' : 'var(--orange)'};">${hasAulas ? '✅ CONECTADAS' : '⚠️ FALTA IMPORTAR'}</span>
            </div>
         </div>

         <div class="text-md text-secondary mb-6" style="line-height:1.5;">
            A inteligência da prova injetou prioridades (P1 e P2) diretamente na sua janela de <strong>Tópicos do Edital</strong>. Veja as marcações em chamas 🔥 ao lado dos tópicos que demandam mais a sua atenção.
         </div>

         <button class="btn btn-outline w-full" style="border-color:var(--accent); color:var(--accent);" data-action="navigate" data-view="banca-analyzer">
            Abrir Analisador Preditivo
         </button>
       </div>
   `;
}

// ── Chart Initialization ──
export function initDiscDashboardChart(discId) {
  const canvas = document.getElementById('disc-chart-acertos');
  if (!canvas) return;
  const themeVars = getComputedStyle(document.documentElement);
  const accent = themeVars.getPropertyValue('--accent').trim() || '#8aa4bf';
  const bg = themeVars.getPropertyValue('--bg').trim() || '#08090d';
  const card = themeVars.getPropertyValue('--card').trim() || '#121821';
  const border = themeVars.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.14)';
  const textPrimary = themeVars.getPropertyValue('--text-primary').trim() || '#f3f6fb';
  const textMuted = themeVars.getPropertyValue('--text-muted').trim() || '#7f8a99';
  const grid = border;
  const accentSoft = /^#[0-9A-Fa-f]{6}$/.test(accent) ? `${accent}29` : 'rgba(138, 164, 191, 0.16)';

  const tempos = state.eventos
    ? state.eventos.filter((e) => {
        const qs = e.sessao?.questoes || e.questoes;
        return (
          e.discId === discId &&
          e.status === 'estudei' &&
          qs &&
          ((qs.acertos || qs.certas || 0) > 0 || (qs.erros || qs.erradas || 0) > 0)
        );
      })
    : [];

  const grouped = {};
  [...tempos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((t) => {
      if (!grouped[t.data]) grouped[t.data] = { certas: 0, erradas: 0 };
      const qs = t.sessao?.questoes || t.questoes;
      grouped[t.data].certas += qs.acertos || qs.certas || 0;
      grouped[t.data].erradas += qs.erros || qs.erradas || 0;
    });

  const rawLabels = Object.keys(grouped).slice(-15);
  const labels = rawLabels.map((d) => formatDate(d));
  const dataPerc = rawLabels.map((d) => {
    const total = grouped[d].certas + grouped[d].erradas;
    return total > 0 ? Math.round((grouped[d].certas / total) * 100) : 0;
  });

  if (getDiscChartInstance()) {
    getDiscChartInstance().destroy();
  }

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    parent.innerHTML =
      '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;font-style:italic;">Métricas insuficientes. Registre sessões com número de questões para gerar o gráfico de evolução.</div>';
    return;
  }

  const ctx = canvas.getContext('2d');
  setDiscChartInstance(
    new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '% de Acertos',
            data: dataPerc,
            borderColor: accent,
            backgroundColor: accentSoft,
            borderWidth: 2,
            pointBackgroundColor: bg,
            pointBorderColor: accent,
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: card,
            titleColor: textMuted,
            bodyColor: textPrimary,
            borderColor: border,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.raw}% de Acerto`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: grid },
            ticks: { color: textMuted, callback: (v) => `${v}%` },
          },
          x: {
            grid: { display: false },
            ticks: { color: textMuted, maxRotation: 45, minRotation: 45 },
          },
        },
      },
    })
  );
}

// toggleAulaDashboard vive em editais-crud.js (cópia duplicada removida daqui —
// divergia: não preservava o scroll do painel e não interrompia o loop).

// =============================================
// HOME DASHBOARD (period filter + charts)
// =============================================

export let dashPeriod = 7; // default: last 7 days
export let _chartDaily = null,
  _chartDisc = null;

function getQuestionTotal(record) {
  if (!record) return 0;
  const explicit = Number(record.total ?? record.quantidade);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const acertos = Number(record.acertos ?? record.certas ?? 0);
  const erros = Number(record.erros ?? record.erradas ?? 0);
  const derived = acertos + erros;
  if (Number.isFinite(derived) && derived > 0) return derived;

  // Legacy compatibility: some old habit records store only eventoId.
  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  if (!ev) return 0;
  const qs = ev.sessao?.questoes || ev.questoes;
  if (!qs) return 0;
  const eventTotal = Number(
    qs.total ?? qs.quantidade ?? (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0)
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function getPagesTotal(record) {
  if (!record) return 0;
  const rawPages = record.paginas;
  const pagesValue = rawPages && typeof rawPages === 'object' ? rawPages.total : rawPages;
  const total = Number(record.total ?? pagesValue ?? record.quantidade ?? record.paginasLidas ?? 0);
  if (Number.isFinite(total) && total > 0) return total;

  // Legacy compatibility: some old habit records store only eventoId.
  const ev = (state.eventos || []).find((e) => e.id === record.eventoId);
  if (!ev) return 0;
  const evPages = ev.sessao?.paginas;
  const eventTotal = Number(
    (evPages && typeof evPages === 'object' ? evPages.total : evPages) ?? ev.paginas ?? 0
  );
  return Number.isFinite(eventTotal) && eventTotal > 0 ? eventTotal : 0;
}

function sumQuestionRecords(records = []) {
  return records.reduce((sum, r) => sum + getQuestionTotal(r), 0);
}

function sumPageRecords(records = []) {
  return records.reduce((sum, r) => sum + getPagesTotal(r), 0);
}

export function destroyDashboardCharts() {
  if (_chartDaily) {
    _chartDaily.destroy();
    _chartDaily = null;
  }
  if (_chartDisc) {
    _chartDisc.destroy();
    _chartDisc = null;
  }
}

export function renderDashboard(el) {
  const periodDays = dashPeriod; // null = all time
  const periodLabel = {
    7: '7 dias',
    15: '15 dias',
    30: '30 dias',
    90: '3 meses',
    365: '1 ano',
    null: 'Total',
  }[periodDays];

  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  const visibleEvents = filterEventsBySelectedEdital(state.eventos || [], { allowAll: false });
  // Período corta pela data REAL do estudo (dataEstudo || data) — mesma régua
  // do Histórico, da Home e do getAggregatedStats. e.data é a data agendada.
  const filteredEvts = cutoffStr
    ? visibleEvents.filter((e) => {
        const studyDate = e.dataEstudo || e.data;
        return e.status === 'estudei' && studyDate && studyDate >= cutoffStr;
      })
    : visibleEvents.filter((e) => e.status === 'estudei');

  const totalSecs = filteredEvts.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const questTot = cutoffStr
    ? sumQuestionRecords((state.habitos.questoes || []).filter((r) => r.data >= cutoffStr))
    : sumQuestionRecords(state.habitos.questoes || []);
  const simTot = cutoffStr
    ? (state.habitos.simulado || []).filter((r) => r.data >= cutoffStr).length
    : (state.habitos.simulado || []).length;

  el.innerHTML = `
    <div class="flex-between mb-4">
      <div class="text-md text-secondary">Exibindo dados: <strong class="text-primary">${periodLabel}</strong></div>
      <div class="cal-view-tabs" role="tablist" aria-label="Período do dashboard">
        ${[7, 15, 30, 90, 365, null]
          .map(
            (p) => `
          <button type="button" class="cal-view-tab ${dashPeriod === p ? 'active' : ''}" data-action="set-dash-period" data-period="${p}" role="tab" aria-selected="${dashPeriod === p}">
            ${{ 7: '7d', 15: '15d', 30: '30d', 90: '3m', 365: '1a', null: 'Total' }[p]}
          </button>`
          )
          .join('')}
      </div>
    </div>

    <div class="stats-grid mb-6">
      <div class="stat-card stat-card--tempo">
        <div class="stat-label">Tempo Estudado</div>
        <div class="stat-value">${formatTime(totalSecs)}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card stat-card--sessoes">
        <div class="stat-label">Sessões Realizadas</div>
        <div class="stat-value">${filteredEvts.length}</div>
        <div class="stat-sub">eventos concluidos</div>
      </div>
      <div class="stat-card stat-card--questoes">
        <div class="stat-label">Questões</div>
        <div class="stat-value">${questTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
      <div class="stat-card stat-card--simulados">
        <div class="stat-label">Simulados</div>
        <div class="stat-value">${simTot}</div>
        <div class="stat-sub">${periodLabel}</div>
      </div>
    </div>

    <div class="grid-2 mb-4">
      <div class="card">
        <div class="card-header">
          <h3>📊 Horas por Dia</h3>
          <span class="text-sm text-muted">${periodLabel}</span>
        </div>
        <div class="card-body">
          <div class="chart-wrap"><canvas id="chart-daily"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>📚 Tempo por Disciplina</h3>
          <span class="text-sm text-muted">${periodLabel}</span>
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
  if (_chartDaily) {
    _chartDaily.destroy();
    _chartDaily = null;
  }
  const themeVars = getComputedStyle(document.documentElement);
  const accent = themeVars.getPropertyValue('--accent').trim() || '#8aa4bf';
  const accentLight =
    themeVars.getPropertyValue('--accent-light').trim() || 'rgba(138, 164, 191, 0.16)';
  const border = themeVars.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.14)';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#b8c0cc';
  const numDays = periodDays ? Math.min(periodDays, 365) : 30;
  const secsByDate = {};
  for (const e of filterEventsBySelectedEdital(state.eventos || [], { allowAll: false })) {
    if (e.status === 'estudei' && e.tempoAcumulado) {
      const studyDate = e.dataEstudo || e.data;
      secsByDate[studyDate] = (secsByDate[studyDate] || 0) + (e.tempoAcumulado || 0);
    }
  }
  const days = [],
    data = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const d2 = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    const ds = d2.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    data.push(Math.round((secsByDate[ds] || 0) / 60));
  }
  _chartDaily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Minutos',
          data,
          backgroundColor: accentLight,
          borderColor: accent,
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
        y: {
          beginAtZero: true,
          grid: { color: border },
          ticks: { color: textSecondary, font: { size: 11 } },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textSecondary,
            font: { size: numDays > 60 ? 9 : numDays > 20 ? 10 : 11 },
            maxRotation: numDays > 20 ? 45 : 0,
            maxTicksLimit: numDays > 180 ? 12 : 20,
          },
        },
      },
    },
  });
}

export function renderDiscChart(periodDays) {
  const ctx = document.getElementById('chart-disc');
  if (!ctx) return;
  if (_chartDisc) {
    _chartDisc.destroy();
    _chartDisc = null;
  }
  const themeVars = getComputedStyle(document.documentElement);
  const border = themeVars.getPropertyValue('--border').trim() || '#e2e8f0';
  const textSecondary = themeVars.getPropertyValue('--text-secondary').trim() || '#475569';
  const discTime = {};
  const cutoffStr2 = periodDays ? cutoffDateStr(periodDays) : null;
  const visibleEvents = filterEventsBySelectedEdital(state.eventos || [], { allowAll: false });
  const evts = cutoffStr2
    ? visibleEvents.filter(
        (e) =>
          e.status === 'estudei' &&
          e.discId &&
          e.tempoAcumulado &&
          (e.dataEstudo || e.data) >= cutoffStr2
      )
    : visibleEvents.filter((e) => e.status === 'estudei' && e.discId && e.tempoAcumulado);
  evts.forEach((e) => {
    discTime[e.discId] = (discTime[e.discId] || 0) + e.tempoAcumulado;
  });
  const labels = [],
    data = [],
    colors = [];
  Object.entries(discTime).forEach(([id, secs]) => {
    const d = getDisc(id);
    labels.push(d ? d.disc.nome : id);
    data.push(Math.round(secs / 60));
    colors.push(d ? d.disc.cor || '#8aa4bf' : '#7f8a99');
  });
  let dummyTooltip = false;
  if (data.length === 0) {
    labels.push('Sem Dados Registrados');
    data.push(1);
    colors.push(border);
    dummyTooltip = true;
  }
  _chartDisc = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textSecondary, font: { size: 11 }, boxWidth: 12 },
        },
        tooltip: { enabled: !dummyTooltip },
      },
    },
  });
}

export function renderHabitSummary(periodDays) {
  const cutoffStr = periodDays ? cutoffDateStr(periodDays) : null;
  return HABIT_TYPES.map((h) => {
    const recent = cutoffStr
      ? (state.habitos[h.key] || []).filter((r) => r.data >= cutoffStr)
      : state.habitos[h.key] || [];
    let count = recent.length;
    if (h.key === 'questoes') count = sumQuestionRecords(recent);
    if (h.key === 'paginas') count = sumPageRecords(recent);
    return `
      <div class="flex border-b habit-row">
        <div class="text-xl">${h.icon}</div>
        <div class="flex-1 text-md font-medium">${h.label}</div>
        <div class="text-xl font-bold habit-count" data-habit-color="${h.color}">${count}</div>
      </div>
    `;
  }).join('');
}

export function renderDiscProgress() {
  const discs = getFilteredActiveDisciplinas({ allowAll: false });
  if (discs.length === 0)
    return '<div class="empty-state"><div class="icon">📋</div><p>Nenhuma disciplina cadastrada</p></div>';
  return discs
    .slice(0, 8)
    .map(({ disc, edital: _edital }) => {
      const progress = calculateContentProgress(disc);
      const color = disc.cor || 'var(--accent)';
      return `
      <button type="button" class="dash-progress-row" data-action="open-disc-dashboard" data-edital-id="${_edital.id}" data-disc-id="${disc.id}" title="${esc(disc.nome)}" style="--progress-color:${color};">
        <div class="dash-progress-main">
          <div class="dash-progress-title" title="${esc(disc.nome)}">
            <span>${disc.icone || '📚'}</span> ${esc(disc.nome)}
          </div>
          <div class="dash-progress-sub">Geral ${progress.overall.done}/${progress.overall.total}</div>
        </div>
        <div class="dash-progress-bars" aria-label="Progresso de ${esc(disc.nome)}">
          ${renderProgressLine('Geral', progress.overall)}
          ${renderProgressLine('Tópicos', progress.topics)}
          ${renderProgressLine('Aulas', progress.lessons)}
        </div>
      </button>
    `;
    })
    .join('');
}

function renderProgressLine(label, axis) {
  return `
    <div class="dash-progress-line ${axis.total === 0 ? 'dash-progress-line--empty' : ''}">
      <span class="dash-progress-line-label">${label}</span>
      <div class="dash-progress-line-track">
        <div class="dash-progress-line-fill" style="width:${axis.pct}%;"></div>
      </div>
      <span class="dash-progress-line-meta">${axis.pct}% · ${axis.done}/${axis.total}</span>
    </div>
  `;
}

export default {
  renderDisciplinaDashboard,
  renderDashboard,
  destroyDashboardCharts,
  setDashPeriod,
  renderDailyChart,
  renderDiscChart,
  renderHabitSummary,
  renderDiscProgress,
};

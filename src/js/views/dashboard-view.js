/**
 * Dashboard View Module
 * Renderiza dashboard de disciplina (renderDisciplinaDashboard e helpers)
 */

import { scheduleSave, state } from '../store.js?v=8.21';
import { esc, formatDate, formatTime, todayStr } from '../utils.js?v=8.21';
import { getDisc } from '../logic.js?v=8.21';

// ── Main Dashboard Render ──
export function renderDisciplinaDashboard(edital, disc) {
  const tempos = state.eventos ? state.eventos.filter(e => e.discId === disc.id && e.status === 'estudei') : [];
  let tempoTotal = 0;
  let qCertas = 0;
  let qErradas = 0;
  let pagLidas = 0;

  tempos.forEach(e => {
    tempoTotal += e.tempoAcumulado || 0;
    const qs = e.sessao?.questoes || e.questoes;
    if (qs) {
      qCertas += (qs.acertos || qs.certas || 0);
      qErradas += (qs.erros || qs.erradas || 0);
    }
    pagLidas += e.sessao?.paginas?.total || e.paginas || 0;
  });

  const totalQuestoes = qCertas + qErradas;
  const percAcertos = totalQuestoes > 0 ? Math.round((qCertas / totalQuestoes) * 100) : 0;

  const totalAulas = disc.aulas ? disc.aulas.length : 0;
  const aulasEstudadas = disc.aulas ? disc.aulas.filter(a => a.estudada).length : 0;
  const percConcluido = totalAulas > 0 ? Math.round((aulasEstudadas / totalAulas) * 100) : 0;
  const activeDashboardTab = window.activeDashboardTab || 'topicos';
  const tabBaseStyle = 'padding:8px 0;font-weight:600;font-size:14px;cursor:pointer;background:transparent;border:0;font-family:inherit;text-align:left;';

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
              ${aulasEstudadas} / ${totalAulas}
            </div>
            <div class="text-xl font-bold text-accent">
              ${percConcluido}%
            </div>
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

// ── Helper: Render Session History Table ──
function renderHistoricoDisciplina(tempos) {
  const reverseTempos = [...tempos].reverse().slice(0, 50);
  if (reverseTempos.length === 0) {
    return '<div class="flex-1 flex-center text-muted text-italic">Nenhuma sessão de estudo registrada.</div>';
  }

  return `
    <div class="custom-scrollbar scroll-panel">
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
                ${reverseTempos.map(t => {
    const dateStr = formatDate(t.data);
    const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
    const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
    const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
    const certas = qs.acertos || qs.certas || 0;
    const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
    const percColor = perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
    const pags = t.sessao?.paginas?.total || t.paginas || null;

    return `
              <tr class="session-history-row cursor-pointer" style="border-bottom:1px solid var(--bg);" data-action="open-registro-sessao" data-disc-id="${t.id}">
                <td class="text-primary" style="padding:10px 4px;">${dateStr}</td>
                <td class="text-mono" style="padding:10px 4px;">${tempoStr}</td>
                <td style="padding:10px 4px;">${pags ?? '-'}</td>
                <td style="padding:10px 4px;">${certas} / ${totQs}</td>
                <td class="font-bold" style="padding:10px 4px; color:${totQs > 0 ? percColor : 'inherit'};">${totQs > 0 ? perc + '%' : '-'}</td>
              </tr>
            `;
  }).join('')}
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
    <div class="custom-scrollbar scroll-panel">
            ${disc.assuntos.map(ass => {
    const importanceBadge = ass.relevance?.priority === 'P1' ?
      `<span class="priority-badge priority-badge--p1" title="Alta Chance de Cobrança">🔥 P1</span>` :
      (ass.relevance?.priority === 'P2' ? `<span class="priority-badge priority-badge--p2">⚠️ P2</span>` : '');

    return `
        <div class="list-row rounded-md" style="${ass.concluido ? 'background:var(--bg-secondary); ' : ''};">
          <div class="check-circle ${ass.concluido ? 'done' : ''} flex-shrink-0" data-action="toggle-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-w-0 text-md" style="font-weight:${ass.concluido ? '400' : '600'}; color:${ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)'}; ${ass.concluido ? 'text-decoration:line-through; ' : ''};">
             ${esc(ass.nome)} ${importanceBadge}
          </div>
          ${ass.concluido ? `
            <div class="text-right flex-shrink-0">
              <div class="text-xs font-bold text-green">✅ concluído</div>
              <div class="text-xs text-muted">${formatDate(ass.dataConclusao)}</div>
            </div>
          ` : `
            <button class="btn btn-ghost btn-sm btn-xs" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">+ Agenda</button>
          `}
        </div>
      `}).join('')}
    </div>
  `;
}

// ── Helper: Render Classes Tab ──
function renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return '<div class="flex-1 flex-col flex-center text-muted text-italic items-center"><div class="text-3xl mb-3">🗂️</div>Nenhuma aula ou material cadastrado.<br><span class="text-base mt-2">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</span></div>';
  }

  return `
    <div class="custom-scrollbar scroll-panel">
        ${disc.aulas.map(aul => `
        <div class="list-row rounded-md" style="${aul.estudada ? 'background:var(--bg-secondary); ' : ''};">
          <div class="check-circle ${aul.estudada ? 'done' : ''} flex-shrink-0 cursor-pointer" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div class="flex-1 min-w-0 text-md" style="font-weight:${aul.estudada ? '400' : '600'}; color:${aul.estudada ? 'var(--text-muted)' : 'var(--text-primary)'}; ${aul.estudada ? 'text-decoration:line-through; ' : ''};">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div class="text-xs text-muted mt-1">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${!aul.estudada ? `
            <button class="btn btn-ghost btn-sm btn-xs" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Helper: Render Banca/Hot Topics Tab ──
function renderBancaDisciplinaDashboard(edital, disc) {
  const hasHotTopics = state.bancaRelevance && state.bancaRelevance.hotTopics && state.bancaRelevance.hotTopics.some(ht => ht.disciplinaId === disc.id);
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
       <div class="custom-scrollbar scroll-panel" style="padding-top:8px;">
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

  const tempos = state.eventos ? state.eventos.filter(e => {
    const qs = e.sessao?.questoes || e.questoes;
    return e.discId === discId && e.status === 'estudei' && qs &&
      ((qs.acertos || qs.certas || 0) > 0 || (qs.erros || qs.erradas || 0) > 0);
  }) : [];

  const grouped = {};
  [...tempos].sort((a, b) => a.data.localeCompare(b.data)).forEach(t => {
    if (!grouped[t.data]) grouped[t.data] = { certas: 0, erradas: 0 };
    const qs = t.sessao?.questoes || t.questoes;
    grouped[t.data].certas += (qs.acertos || qs.certas || 0);
    grouped[t.data].erradas += (qs.erros || qs.erradas || 0);
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
        borderColor: accent,
        backgroundColor: accentSoft,
        borderWidth: 2,
        pointBackgroundColor: bg,
        pointBorderColor: accent,
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
          backgroundColor: card,
          titleColor: textMuted,
          bodyColor: textPrimary,
          borderColor: border,
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
          grid: { color: grid },
          ticks: { color: textMuted, callback: (v) => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: textMuted, maxRotation: 45, minRotation: 45 }
        }
      }
    }
  });
}

// ── Toggle Assunto Conclusão ──
export function toggleAssunto(discId, assId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find(d => d.id === discId);
    if (disc) {
      const ass = (disc.assuntos || []).find(a => a.id === assId);
      if (ass) {
        ass.concluido = !ass.concluido;
        ass.dataConclusao = ass.concluido ? todayStr() : null;
        if (ass.concluido) ass.revisoesFetas = [];
        scheduleSave();

        if (window.activeDashboardDiscCtx && window.activeDashboardDiscCtx.discId === discId) {
          window.openDiscDashboard(window.activeDashboardDiscCtx.editaId, discId);
        } else {
          window.renderCurrentView?.();
        }
        return;
      }
    }
  }
}

// ── Toggle Aula Conclusão ──
export function toggleAulaDashboard(editaId, discId, aulaId) {
  for (const edital of state.editais) {
    if (!edital.disciplinas) continue;
    const disc = edital.disciplinas.find(d => d.id === discId);
    if (!disc) continue;

    const aula = (disc.aulas || []).find(a => a.id === aulaId);
    if (!aula) return;

    aula.estudada = !aula.estudada;
    aula.dataEstudo = aula.estudada ? todayStr() : null;
    scheduleSave();

    if (window.activeDashboardDiscCtx && window.activeDashboardDiscCtx.discId === discId) {
      window.openDiscDashboard(editaId, discId);
    } else {
      window.renderCurrentView?.();
    }

    window.showToast?.(aula.estudada ? 'Aula marcada como estudada.' : 'Aula desmarcada.', 'success');
  }
}

export default {
  renderDisciplinaDashboard,
  initDiscDashboardChart,
  toggleAssunto,
  toggleAulaDashboard
};

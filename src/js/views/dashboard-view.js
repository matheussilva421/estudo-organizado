/**
 * Dashboard View Module
 * Renderiza dashboard de disciplina (renderDisciplinaDashboard e helpers)
 */

import { scheduleSave, state } from '../store.js?v=8.3';
import { esc, formatDate, formatTime, todayStr } from '../utils.js?v=8.3';
import { getDisc } from '../logic.js?v=8.3';

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
              ${aulasEstudadas} / ${totalAulas}
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
      <div class="disc-dashboard-main-grid">

        <!-- HISTÓRICO DE SESSÕES (ESQUERDA) -->
        <div class="card p-16" style="min-height:400px;display:flex;flex-direction:column;max-height:500px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div class="dash-label">HISTÓRICO DE SESSÕES (ÚLTIMAS 50)</div>
            <button class="btn btn-sm" style="font-size:12px;padding:4px 8px;background:rgba(255,255,255,0.06);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);" data-action="open-add-past-session" data-disc-id="${disc.id}">
              <i class="fa fa-plus"></i> Registrar
            </button>
          </div>
          ${renderHistoricoDisciplina(tempos)}
        </div>

        <!-- CONTEÚDO DINÂMICO (DIREITA) -->
        <div class="card p-16" style="min-height:400px;display:flex;flex-direction:column;max-height:500px;">
          <!-- Tabs Navigation -->
          <div role="tablist" aria-label="Conteudo da disciplina" style="display:flex; gap:16px; border-bottom:1px solid var(--border); margin-bottom:16px; align-items:flex-end;">
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

          <div style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
            ${activeDashboardTab === 'topicos' ? renderTopicosEditalDisciplina(edital, disc) : ''}
            ${activeDashboardTab === 'aulas' ? renderAulasDisciplinaDashboard(edital, disc) : ''}
            ${activeDashboardTab === 'banca' ? renderBancaDisciplinaDashboard(edital, disc) : ''}
          </div>
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

// ── Helper: Render Session History Table ──
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
    const tempoStr = formatTime(t.tempoAcumulado || 0).substring(0, 5);
    const qs = t.sessao?.questoes || t.questoes || { certas: 0, erradas: 0 };
    const totQs = (qs.acertos || qs.certas || 0) + (qs.erros || qs.erradas || 0);
    const certas = qs.acertos || qs.certas || 0;
    const perc = totQs > 0 ? Math.round((certas / totQs) * 100) : 0;
    const percColor = perc >= 70 ? 'var(--green)' : perc >= 50 ? 'var(--accent)' : 'var(--red)';
    const pags = t.sessao?.paginas?.total || t.paginas || null;

    return `
              <tr class="session-history-row" style="border-bottom:1px solid var(--bg); cursor:pointer;" data-action="open-registro-sessao" data-disc-id="${t.id}">
                <td style="padding:10px 4px;color:var(--text-primary);">${dateStr}</td>
                <td style="padding:10px 4px;font-family:'DM Mono',monospace;">${tempoStr}</td>
                <td style="padding:10px 4px;">${pags ?? '-'}</td>
                <td style="padding:10px 4px;">${certas} / ${totQs}</td>
                <td style="padding:10px 4px;font-weight:700;color:${totQs > 0 ? percColor : 'inherit'};">${totQs > 0 ? perc + '%' : '-'}</td>
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
    return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-style:italic;">Nenhum tópico cadastrado.</div>';
  }

  return `
    <div class="custom-scrollbar" style="flex:1;overflow-y:auto;padding-right:8px;">
            ${disc.assuntos.map(ass => {
    const importanceBadge = ass.relevance?.priority === 'P1' ?
      `<span style="background:rgba(211,47,47,0.1); color:var(--red); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;" title="Alta Chance de Cobrança">🔥 P1</span>` :
      (ass.relevance?.priority === 'P2' ? `<span style="background:rgba(234,179,8,0.1); color:var(--orange); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; margin-left:8px;">⚠️ P2</span>` : '');

    return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);${ass.concluido ? 'background:var(--bg-secondary);border-radius:6px;' : ''}">
          <div class="check-circle ${ass.concluido ? 'done' : ''}" data-action="toggle-assunto" data-disc-id="${disc.id}" data-assunto-id="${ass.id}" style="flex-shrink:0;">${ass.concluido ? '<i class="fa fa-check"></i>' : ''}</div>
          <div style="flex:1;min-width:0;font-size:13px;font-weight:${ass.concluido ? '400' : '600'};color:${ass.concluido ? 'var(--text-muted)' : 'var(--text-primary)'};${ass.concluido ? 'text-decoration:line-through;' : ''}">
             ${esc(ass.nome)} ${importanceBadge}
          </div>
          ${ass.concluido ? `
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:10px;color:var(--green);font-weight:700;">✅ concluído</div>
              <div style="font-size:10px;color:var(--text-muted);">${formatDate(ass.dataConclusao)}</div>
            </div>
          ` : `
            <button class="btn btn-ghost btn-sm" style="flex-shrink:0;padding:4px 8px;font-size:11px;" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="${ass.id}">+ Agenda</button>
          `}
        </div>
      `}).join('')}
    </div>
  `;
}

// ── Helper: Render Classes Tab ──
function renderAulasDisciplinaDashboard(edital, disc) {
  if (!disc.aulas || disc.aulas.length === 0) {
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-style:italic;"><div style="font-size:32px;margin-bottom:12px;">🗂️</div>Nenhuma aula ou material cadastrado.<br><span style="font-size:12px;margin-top:8px;">Vá em "Gerenciar" nesta matéria para importar suas Aulas.</span></div>';
  }

  return `
    <div class="custom-scrollbar" style="flex:1;overflow-y:auto;padding-right:8px;">
        ${disc.aulas.map(aul => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);${aul.estudada ? 'background:var(--bg-secondary);border-radius:6px;' : ''}">
          <div class="check-circle ${aul.estudada ? 'done' : ''}" data-action="toggle-aula-dashboard" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-aula-id="${aul.id}" title="${aul.estudada ? 'Desmarcar aula' : 'Marcar aula como estudada'}" style="flex-shrink:0;cursor:pointer;">${aul.estudada ? '<i class="fa fa-check"></i>' : ''}</div>
          <div style="flex:1;min-width:0;font-size:13px;font-weight:${aul.estudada ? '400' : '600'};color:${aul.estudada ? 'var(--text-muted)' : 'var(--text-primary)'};${aul.estudada ? 'text-decoration:line-through;' : ''}">
             ${esc(aul.nome)}
             ${aul.linkedAssuntoIds && aul.linkedAssuntoIds.length > 0 ? `<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">🔗 ${aul.linkedAssuntoIds.length} tópico(s) do edital conectado(s)</div>` : ''}
          </div>
          ${!aul.estudada ? `
            <button class="btn btn-ghost btn-sm" style="flex-shrink:0;padding:4px 8px;font-size:11px;" data-action="add-evento-para-assunto" data-edital-id="${edital.id}" data-disc-id="${disc.id}" data-assunto-id="aul_${aul.id}">+ Agenda</button>
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
         <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);text-align:center;padding:24px;">
           <i class="fa fa-robot" style="font-size:48px;margin-bottom:16px;color:var(--border);"></i>
           <div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);">Nenhuma análise encontrada</div>
           <div style="font-size:13px;max-width:250px;">Use o Analisador de Banca no menu principal para injetar o sumário de exigência desta disciplina.</div>
         </div>
       `;
  }

  return `
       <div class="custom-scrollbar" style="flex:1;overflow-y:auto;padding-right:8px;padding-top:8px;">
         <div style="background:var(--bg); border-radius:8px; padding:12px; margin-bottom:16px; border:1px solid var(--border);">
            <div style="font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:12px;">STATUS DO MAPEADOR DE INTELIGÊNCIA</div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px;">
              <span>Dados de Banca extraídos:</span>
              <span style="font-weight:600; color:var(--green);">✅ ATIVO</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
              <span>Aulas atreladas aos Tópicos P1 e P2:</span>
              <span style="font-weight:600; color:${hasAulas ? 'var(--green)' : 'var(--orange)'};">${hasAulas ? '✅ CONECTADAS' : '⚠️ FALTA IMPORTAR'}</span>
            </div>
         </div>

         <div style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:16px;">
            A inteligência da prova injetou prioridades (P1 e P2) diretamente na sua janela de <strong>Tópicos do Edital</strong>. Veja as marcações em chamas 🔥 ao lado dos tópicos que demandam mais a sua atenção.
         </div>

         <button class="btn btn-outline" style="width:100%; border-color:var(--accent); color:var(--accent);" data-action="navigate" data-view="banca-analyzer">
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
  const accent = themeVars.getPropertyValue('--accent').trim() || '#3b82f6';
  const bg = themeVars.getPropertyValue('--bg').trim() || '#0f172a';
  const card = themeVars.getPropertyValue('--card').trim() || '#1e293b';
  const border = themeVars.getPropertyValue('--border').trim() || '#334155';
  const textPrimary = themeVars.getPropertyValue('--text-primary').trim() || '#f1f5f9';
  const textMuted = themeVars.getPropertyValue('--text-muted').trim() || '#94a3b8';
  const grid = border;
  const accentSoft = /^#[0-9A-Fa-f]{6}$/.test(accent) ? `${accent}1A` : 'rgba(59,130,246,0.1)';

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

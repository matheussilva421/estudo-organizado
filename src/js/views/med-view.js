// =============================================
// MED VIEW
// =============================================

import { state } from '../store.js?v=8.37';
import { todayStr, formatTime, esc } from '../utils.js?v=8.37';
import { renderEventCard } from '../components.js?v=8.37';

// Shared stats row builder — eliminates duplication between renderMED and refreshMEDSections
function buildMEDStatsHTML(estudados, agendados) {
  const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);
  const best =
    estudados.length > 0
      ? estudados.reduce((a, b) => ((b.tempoAcumulado || 0) > (a.tempoAcumulado || 0) ? b : a))
      : null;
  return `
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Tempo Total Hoje</div>
      <div class="dashboard-stat-value dashboard-stat-value--mono" id="total-time">${formatTime(totalSeconds)}</div>
      <div class="caption">${estudados.length} evento(s) concluido(s)</div>
    </div>
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Pendentes</div>
      <div class="text-3xl font-extrabold text-blue">${agendados.length}</div>
      <div class="caption">evento(s) para hoje</div>
    </div>
    <div class="card med-stat-card med-stat-card--wide">
      <div class="section-label">Maior Foco</div>
      <div class="text-lg font-bold text-primary mt-2">${best ? esc(best.titulo || 'N/A') : '\u2014'}</div>
      <div class="caption">${best ? formatTime(best.tempoAcumulado || 0) : ''}</div>
    </div>`;
}

export function renderMED(el) {
  const today = todayStr();
  const todayEvents = state.eventos.filter((e) => e.data === today);
  const emAndamento = todayEvents.filter((e) => e._timerStart);
  const agendados = todayEvents.filter((e) => e.status !== 'estudei' && !e._timerStart);
  const estudados = todayEvents.filter((e) => e.status === 'estudei');
  const totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  // Sticky header with daily progress (uses optional `metaDiariaSeg` if user has set one)
  const metaSeg = (state.config?.metaDiariaSeg || 0);
  const metaPct = metaSeg > 0 ? Math.min(100, Math.round((totalSeconds / metaSeg) * 100)) : 0;
  const stickyHeader = `
    <div class="med-sticky-header">
      <div class="med-sticky-row">
        <div class="med-sticky-time">⏱ ${formatTime(totalSeconds)}</div>
        ${
          metaSeg > 0
            ? `<div class="med-sticky-meta">
                <div class="med-sticky-bar"><div class="med-sticky-bar-fill" style="width:${metaPct}%"></div></div>
                <span class="med-sticky-meta-label">${metaPct}% da meta diária</span>
              </div>`
            : `<div class="med-sticky-meta-empty">Sem meta diária definida</div>`
        }
        <div class="med-sticky-counts">
          ${emAndamento.length > 0 ? `<span class="badge med-badge--running">⏱ ${emAndamento.length} ativo(s)</span>` : ''}
          <span class="badge">${agendados.length} pendente(s)</span>
          <span class="badge">${estudados.length} concluído(s)</span>
        </div>
      </div>
    </div>
  `;

  if (todayEvents.length === 0) {
    el.innerHTML = `
      ${stickyHeader}
      <div id="med-stats-row" class="med-stats-row">
        ${buildMEDStatsHTML([], [])}
      </div>
      <div class="empty-state med-empty-state">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p class="mb-4">Como você quer começar?</p>
        <div class="med-empty-actions">
          <button class="btn btn-primary" data-action="open-add-event"><i class="fa fa-plus"></i> Adicionar Evento</button>
          <button class="btn btn-ghost" data-action="navigate" data-view="cronometro"><i class="fa fa-stopwatch"></i> Sessão Livre</button>
          <button class="btn btn-ghost" data-action="navigate" data-view="calendario"><i class="fa fa-calendar"></i> Ver Calendário</button>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    ${stickyHeader}

    <div id="med-stats-row" class="med-stats-row">
      ${buildMEDStatsHTML(estudados, agendados.concat(emAndamento))}
    </div>

    ${
      emAndamento.length > 0
        ? `
      <div id="med-section-running">
        <div class="section-header"><h2>⏱ Em Andamento</h2></div>
        ${emAndamento.map((e) => renderEventCard(e)).join('')}
      </div>`
        : ''
    }

    <div id="med-section-agendado">
      ${
        agendados.length > 0
          ? `
        <div class="section-header"><h2>📌 Agendado para Hoje</h2></div>
        ${agendados.map((e) => renderEventCard(e)).join('')}
      `
          : ''
      }
    </div>
    <div id="med-section-estudado">
      ${
        estudados.length > 0
          ? `
        <div class="section-header"><h2>✅ Estudado Hoje</h2></div>
        ${estudados.map((e) => renderEventCard(e)).join('')}
      `
          : ''
      }
    </div>
  `;
}

export function refreshMEDSections() {
  const el = document.getElementById('main-content');
  if (!el) return;
  renderMED(el);
}

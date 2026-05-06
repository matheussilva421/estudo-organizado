// =============================================
// MED VIEW
// =============================================

import { state } from '../store.js';
import { todayStr, formatTime, esc } from '../utils.js';
import { renderEventCard } from '../components.js';

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
  const agendados = todayEvents.filter((e) => e.status !== 'estudei');
  const estudados = todayEvents.filter((e) => e.status === 'estudei');
  const _totalSeconds = estudados.reduce((s, e) => s + (e.tempoAcumulado || 0), 0);

  el.innerHTML = `
    <div id="med-stats-row" class="med-stats-row">
      ${buildMEDStatsHTML(estudados, agendados)}
    </div>


        ${
          agendados.length === 0 && estudados.length === 0
            ? `
      <div class="empty-state med-empty-state">
        <div class="icon">📅</div>
        <h4>Nenhum evento para hoje</h4>
        <p class="mb-4">Adicione eventos de estudo para começar a registrar seu tempo.</p>
        <button class="btn btn-primary" data-action="open-add-event"><i class="fa fa-plus"></i> Iniciar Estudo</button>
      </div>
    `
            : `
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
    `
        }
    `;
}

export function refreshMEDSections() {
  const el = document.getElementById('main-content');
  if (!el) return;
  renderMED(el);
}

// =============================================
// EDITAIS ANTERIORES — estatísticas dos editais arquivados
// =============================================
// Página dedicada (sem seletor global de edital) para ver as estatísticas
// PRESERVADAS de editais arquivados. Uma aba por edital arquivado; ao escolher,
// renderiza o Dashboard completo daquele edital reaproveitando `renderDashboard`,
// escopado via `withEditalScope`. É somente leitura: nada aqui altera dados —
// apenas muda o escopo de renderização (estado de UI por-dispositivo).

import { getArchivedEditais } from '../logic.js?v=8.37';
import { withEditalScope } from '../edital-filter.js?v=8.37';
import { renderDashboard } from './dashboard-view.js';
import { getUiSection, setUiSection } from '../ui-state.js?v=8.37';
import { esc } from '../utils.js?v=8.37';

const UI_SECTION = 'editaisAnteriores';

function getActiveAnteriorId(archived) {
  const stored = getUiSection(UI_SECTION).activeTab || null;
  if (stored && archived.some((e) => e.id === stored)) return stored;
  return archived[0]?.id || null;
}

export function setAnteriorTab(editalId) {
  setUiSection(UI_SECTION, { activeTab: editalId || null });
  import('../components.js?v=8.37').then(({ renderCurrentView }) => renderCurrentView());
}

export function renderEditaisAnteriores(el) {
  const archived = getArchivedEditais();

  if (archived.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">🗄️</div>
        <h4>Nenhum edital anterior</h4>
        <p>Quando você arquivar um edital ou trocar de edital principal, ele aparecerá aqui com todas as estatísticas preservadas.</p>
      </div>`;
    return;
  }

  const activeId = getActiveAnteriorId(archived);

  const tabs = archived
    .map(
      (ed) => `
      <button type="button"
        class="filter-chip ${ed.id === activeId ? 'active' : ''}"
        data-action="set-anterior-tab" data-edital-id="${esc(ed.id)}">
        ${esc(ed.nome || 'Edital')}
      </button>`
    )
    .join('');

  el.innerHTML = `
    <div class="editais-anteriores">
      <div class="ea-banner text-muted text-sm mb-3">
        <i class="fa fa-lock"></i> Estatísticas preservadas (somente leitura) dos seus editais arquivados.
      </div>
      <div class="ea-tabs flex gap-sm mb-4" style="flex-wrap:wrap;">
        ${tabs}
      </div>
      <div id="ea-dashboard-host"></div>
    </div>`;

  const host = document.getElementById('ea-dashboard-host');
  if (host && activeId) {
    // Reaproveita o Dashboard completo, escopado ao edital arquivado escolhido.
    // O override cobre todo o render síncrono de renderDashboard (KPIs + charts).
    withEditalScope(activeId, () => renderDashboard(host));
  }
}

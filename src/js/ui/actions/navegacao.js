/**
 * Ações de Navegação e UI
 * Handlers para navegação entre views, sidebar e theme toggle
 */

import { registerAction } from './dispatcher.js';
import { debouncedOnSearch, onSearchFocus, clearSearch } from '../../views.js?v=8.29';
import { setCalViewMode, calNavigate } from '../../views/calendar-view.js?v=8.29';
import { navigate, closeSidebar, toggleSidebar, toggleSidebarCollapse, applyTheme, promptDataProva, promptMetas } from '../../app.js?v=8.29';
import { setDashPeriod, renderCurrentView } from '../../components.js?v=8.29';
import { closeDiscDashboard } from '../../views/dashboard-view.js';
import { toggleCicloFin } from '../../views/ciclo-view.js';
import { setActiveDashboardDiscCtx } from '../../state/dashboard-context.js?v=8.29';

// Registrar ações
registerAction('navigate', (el) => {
  const view = el.dataset.view;
  if (view) navigate(view);
});
registerAction('navigate-with-ctx', (el) => {
  const view = el.dataset.view;
  const ctx = el.dataset.ctx;
  if (view) {
    if (ctx) {
      import('../../app.js?v=8.29').then(({ navigate }) => {
        setActiveDashboardDiscCtx(JSON.parse(decodeURIComponent(ctx)));
        navigate(view);
      });
    } else {
      navigate(view);
    }
  }
});
registerAction('navigate-clear-search', (el) => {
  const view = el.dataset.view;
  if (view) {
    navigate(view);
    clearSearch();
  }
});
registerAction('search-input', (el) => debouncedOnSearch(el.value));
registerAction('search-focus', onSearchFocus);
registerAction('clear-search', clearSearch);
registerAction('set-cal-view-mode', (el) => setCalViewMode(el.dataset.mode));
registerAction('cal-navigate', (el) => calNavigate(parseInt(el.dataset.dir, 10)));
registerAction('cal-today', () => calNavigate(0));
registerAction('set-dash-period', (el) => {
  const raw = el.dataset.period;
  const period = raw === 'null' ? null : parseInt(raw, 10);
  setDashPeriod(period);
});
registerAction('close-sidebar', closeSidebar);
registerAction('toggle-sidebar', toggleSidebar);
registerAction('toggle-sidebar-collapse', toggleSidebarCollapse);
registerAction('toggle-theme', () => {
  applyTheme(true);
  renderCurrentView();
});
registerAction('prompt-prova', promptDataProva);
registerAction('prompt-metas', promptMetas);
registerAction('close-disc-dashboard', closeDiscDashboard);
registerAction('toggle-ciclo-fin', (el) => toggleCicloFin(el.checked));

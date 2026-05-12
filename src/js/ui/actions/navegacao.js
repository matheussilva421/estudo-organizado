/**
 * Ações de Navegação e UI
 * Handlers para navegação entre views, sidebar e theme toggle
 */

import { registerAction } from './dispatcher.js';
import {
  debouncedOnSearch,
  onSearchFocus,
  clearSearch,
  setDashPeriod,
  closeDiscDashboard,
} from '../../views.js?v=8.37';
import { setCalViewMode, calNavigate, setSelectedCalendarDay } from '../../views/calendar-view.js?v=8.37';
import {
  navigate,
  closeSidebar,
  toggleSidebar,
  toggleSidebarCollapse,
  applyTheme,
  promptDataProva,
  promptMetas,
  toggleCicloFin,
} from '../../app.js?v=8.37';
import { renderCurrentView } from '../../components.js?v=8.37';
import { setActiveDashboardDiscCtx } from '../../state/dashboard-context.js?v=8.37';
import { setActiveEdital } from '../../views/home-view.js?v=8.37';
import { setSelectedEditalId } from '../../edital-filter.js?v=8.37';

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
      import('../../app.js?v=8.37').then(({ navigate }) => {
        try {
          setActiveDashboardDiscCtx(JSON.parse(decodeURIComponent(ctx)));
        } catch (err) {
          console.error('Failed to parse navigation context:', err);
        }
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
registerAction('select-calendar-day', (el) => {
  const date = el.dataset.date;
  if (date) setSelectedCalendarDay(date);
});
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
registerAction('set-active-edital', (el) => {
  const id = el.dataset.editalId;
  if (id) setActiveEdital(id);
});
registerAction('set-edital-filter', (el) => {
  setSelectedEditalId(el.value || null);
  renderCurrentView();
});
registerAction('toggle-ciclo-fin', (el) => toggleCicloFin(el.checked));

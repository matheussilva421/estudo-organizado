// ES Module Entry Point
// Imports all modules and exposes functions to window for onclick handlers

import * as store from './store.js?v=8.2';
import * as app from './app.js?v=8.2';
import * as logic from './logic.js?v=8.2';
import * as components from './components.js?v=8.2';
import * as views from './views.js?v=8.2';
import * as drive_sync from './drive-sync.js?v=8.2';
import * as cloud_sync from './cloud-sync.js?v=8.2';
import * as registro from './registro-sessao.js?v=8.2';
import * as utils from './utils.js?v=8.2';
import * as wizard from './planejamento-wizard.js?v=8.2';

import * as relevance from './relevance.js?v=8.2';
import * as lesson_mapper from './lesson-mapper.js?v=8.2';

// Expose all exports to window (temporary bridge for inline onclick handlers)
const modules = [store, app, logic, components, views, drive_sync, cloud_sync, registro, utils, wizard, relevance, lesson_mapper];

for (const mod of modules) {
  for (const [key, value] of Object.entries(mod)) {
    window[key] = value;
  }
}


// ============================================================
// INITIALIZE APPLICATION
// ============================================================
// Setup DOM event handlers that need to be attached BEFORE init
app.setupConfirmHandlers();

// Call init - modules are deferred, so DOM is ready
app.init();

// ============================================================
// DOMAIN EVENT LISTENERS (Etapa 2 - Quebrando ciclos)
// ============================================================
document.addEventListener('app:renderCurrentView', () => {
  if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
});
document.addEventListener('app:updateBadges', () => {
  if (typeof window.updateBadges === 'function') window.updateBadges();
});
document.addEventListener('app:showToast', (e) => {
  if (typeof window.showToast === 'function') window.showToast(e.detail.msg, e.detail.type);
});
document.addEventListener('app:showConfirm', (e) => {
  if (typeof window.showConfirm === 'function') window.showConfirm(e.detail.msg, e.detail.onYes, e.detail.opts);
});
document.addEventListener('app:invalidateCaches', () => {
  if (typeof window.invalidateDiscCache === 'function') window.invalidateDiscCache();
  if (typeof window.invalidateRevCache === 'function') window.invalidateRevCache();
  if (typeof window.invalidatePendingRevCache === 'function') window.invalidatePendingRevCache();
  if (typeof window.invalidateTodayCache === 'function') window.invalidateTodayCache();
  if (typeof window.invalidateStreakCache === 'function') window.invalidateStreakCache();
  if (typeof window.invalidateDashCaches === 'function') window.invalidateDashCaches();
});

// Force cache invalidation if user returns to app next day
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (typeof window.invalidateTodayCache === 'function') window.invalidateTodayCache();
    if (typeof window.invalidatePendingRevCache === 'function') window.invalidatePendingRevCache();
    if (typeof window.renderCurrentView === 'function') window.renderCurrentView();
  }
});

// Domain events fired from logic.js to update specific views
document.addEventListener('app:refreshEventCard', (e) => {
  if (typeof window.refreshEventCard === 'function') window.refreshEventCard(e.detail.eventId);
});
document.addEventListener('app:refreshMEDSections', () => {
  if (typeof window.refreshMEDSections === 'function') window.refreshMEDSections();
});
document.addEventListener('app:eventoDeleted', (e) => {
  if (window.currentView === 'med' && typeof window.removeDOMCard === 'function') {
    window.removeDOMCard(e.detail.eventId);
  } else if (typeof window.renderCurrentView === 'function') {
    window.renderCurrentView();
  }
});

// ============================================================
// CENTRAL EVENT DELEGATION (Etapa 2 - JS Quality)
// ============================================================
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element)) return;
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;

  switch (action) {
    // Navigation
    case 'navigate':
      window.navigate(el.dataset.view);
      break;

    // Search results navigation
    case 'navigate-to-event':
      window.openAddEventModal?.(el.dataset.eventId);
      document.getElementById('search-results').style.display = 'none';
      break;
    case 'navigate-to-disciplina':
      window.navigate('editais');
      setTimeout(() => {
        // Scroll até a disciplina
        const card = document.querySelector(`[data-disc-id="${el.dataset.discId}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      document.getElementById('search-results').style.display = 'none';
      break;
    case 'navigate-to-assunto':
      window.navigate('vertical');
      document.getElementById('search-results').style.display = 'none';
      break;

    // Sidebar
    case 'close-sidebar':
      window.closeSidebar();
      break;
    case 'toggle-sidebar':
      window.toggleSidebar();
      break;
    case 'toggle-sidebar-collapse':
      window.toggleSidebarCollapse();
      break;

    // Theme
    case 'toggle-theme':
      window.applyTheme(true);
      window.renderCurrentView();
      break;

    // Timer
    case 'toggle-timer-mode':
      window.toggleTimerMode();
      break;

    // Modals
    case 'close-modal':
      window.closeModal(el.dataset.modal);
      break;
    case 'open-drive-modal':
      window.openDriveModal();
      break;

    // Save actions
    case 'save-disc':
      window.saveDisc();
      break;
    case 'save-habit':
      window.saveHabit();
      break;
    case 'drive-action':
      window.driveAction();
      break;
    case 'disconnect-drive':
      if (typeof window.disconnectDrive === 'function') window.disconnectDrive();
      break;

    // Dashboard Interactions
    case 'prompt-prova':
      window.promptDataProva();
      break;
    case 'prompt-metas':
      window.promptMetas();
      break;

    // Ciclo de Estudos
    case 'remover-planejamento':
      if (typeof window.deletePlanejamento === 'function') window.deletePlanejamento();
      break;
    case 'toggle-ciclo-fin':
      window.toggleCicloFin(el.checked);
      break;

    default:
      break;
  }
});

// ============================================================
// GLOBAL SEARCH HANDLERS
// ============================================================
let _searchDebounceTimeout = null;
const { esc } = utils;

export function debouncedOnSearch(query) {
  if (_searchDebounceTimeout) clearTimeout(_searchDebounceTimeout);
  _searchDebounceTimeout = setTimeout(() => {
    performGlobalSearch(query);
  }, 300);
}

export function onSearchFocus() {
  // Opcional: expandir visualmente ao focar
  const results = document.getElementById('search-results');
  if (results) results.style.display = 'block';
}

export function onSearchBlur() {
  // Delay para permitir clique nos resultados
  setTimeout(() => {
    const results = document.getElementById('search-results');
    if (results && !results.matches(':hover')) {
      results.style.display = 'none';
    }
  }, 200);
}

function performGlobalSearch(query) {
  if (!query || query.trim().length < 2) {
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
    return;
  }

  const resultsEl = document.getElementById('search-results');
  if (!resultsEl) return;

  const allDisciplinas = window.getAllDisciplinas?.() || [];
  const eventos = window.state?.eventos || [];
  const habitos = window.state?.habitos || {};

  const results = [];

  // Search eventos
  eventos.forEach(ev => {
    if (ev.titulo?.toLowerCase().includes(query.toLowerCase())) {
      results.push({ type: 'evento', data: ev });
    }
  });

  // Search disciplinas/assuntos
  allDisciplinas.forEach(({ disc, edital }) => {
    if (disc.nome?.toLowerCase().includes(query.toLowerCase())) {
      results.push({ type: 'disciplina', data: disc, edital: edital.nome });
    }
    if (disc.assuntos) {
      disc.assuntos.forEach(ass => {
        if (ass.nome?.toLowerCase().includes(query.toLowerCase())) {
          results.push({ type: 'assunto', data: ass, disciplina: disc.nome, edital: edital.nome });
        }
      });
    }
  });

  // Search hábitos
  Object.entries(habitos).forEach(([tipo, lista]) => {
    if (Array.isArray(lista)) {
      lista.forEach(h => {
        if (h.data?.includes(query)) {
          results.push({ type: 'habito', data: h, tipo });
        }
      });
    }
  });

  // Render results safely using esc()
  if (results.length === 0) {
    resultsEl.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-secondary);font-size:13px;">Nenhum resultado encontrado</div>';
  } else {
    const html = results.slice(0, 10).map(r => {
      if (r.type === 'evento') {
        const id = esc(r.data.id || '');
        const titulo = esc(r.data.titulo || '');
        const data = esc(r.data.data || '');
        return `<div class="search-result-item" data-action="navigate-to-event" data-event-id="${id}"><i class="fa fa-calendar-day"></i> ${titulo} - ${data}</div>`;
      } else if (r.type === 'disciplina') {
        const id = esc(r.data.id || '');
        const nome = esc(r.data.nome || '');
        const edital = esc(r.edital || '');
        return `<div class="search-result-item" data-action="navigate-to-disciplina" data-disc-id="${id}"><i class="fa fa-book"></i> ${nome} - ${edital}</div>`;
      } else if (r.type === 'assunto') {
        const id = esc(r.data.id || '');
        const nome = esc(r.data.nome || '');
        const disciplina = esc(r.disciplina || '');
        return `<div class="search-result-item" data-action="navigate-to-assunto" data-ass-id="${id}"><i class="fa fa-tag"></i> ${nome} - ${disciplina}</div>`;
      } else if (r.type === 'habito') {
        const tipo = esc(r.tipo || '');
        const data = esc(r.data.data || '');
        return `<div class="search-result-item"><i class="fa fa-star"></i> Hábito ${tipo} - ${data}</div>`;
      }
      return '';
    }).join('');
    resultsEl.innerHTML = html;
  }

  resultsEl.style.display = 'block';
}

// Expose search functions to window
window.debouncedOnSearch = debouncedOnSearch;
window.onSearchFocus = onSearchFocus;
window.onSearchBlur = onSearchBlur;

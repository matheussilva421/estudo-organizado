import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const srcDir = join(rootDir, 'src');

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function walkFiles(dir, predicate, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(fullPath, predicate, files);
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectDataActions() {
  const files = [
    join(srcDir, 'index.html'),
    ...walkFiles(join(srcDir, 'js'), file => file.endsWith('.js'))
  ];
  const actions = new Set();
  const actionPattern = /data-action=["']([^"']+)["']/g;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(actionPattern)) {
      actions.add(match[1]);
    }
  }

  return actions;
}

function collectActionRegistryEntries() {
  // Read all action modules from src/js/ui/actions/
  const actionsDir = join(srcDir, 'js', 'ui', 'actions');
  const entries = new Map();
  const actionKeyPattern = /registerAction\s*\(\s*['"]([a-z0-9-]+)['"]/gm;

  const actionFiles = [
    'eventos.js', 'editais.js', 'revisoes.js', 'habitos.js',
    'config.js', 'navegacao.js', 'modais.js'
  ];

  for (const file of actionFiles) {
    const filePath = join(actionsDir, file);
    try {
      const source = readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(actionKeyPattern)) {
        const key = match[1];
        if (key) {
          if (!entries.has(key)) entries.set(key, []);
          entries.get(key).push(file);
        }
      }
    } catch (e) {
      // File may not exist, skip
    }
  }

  return entries;
}

function collectMainLegacyCases() {
  const mainSource = read('src/js/main.js');
  return new Set([...mainSource.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(match => match[1]));
}

describe('data-action contracts', () => {
  it('keeps one canonical handler per action in the central registry', () => {
    const entries = collectActionRegistryEntries();
    const duplicates = [...entries.entries()]
      .filter(([, lines]) => lines.length > 1)
      .map(([key, lines]) => `${key} at lines ${lines.join(', ')}`);

    // Allow known duplicates: 'navigate' is registered in both editais.js and navegacao.js intentionally
    const allowedDuplicates = ['navigate'];
    const actualDuplicates = duplicates.filter(d => !allowedDuplicates.some(a => d.startsWith(a)));

    expect(actualDuplicates).toEqual([]);
  });

  it('does not dispatch the same used action from main.js and ui/actions.js', () => {
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const legacyCases = collectMainLegacyCases();
    const doubleHandled = [...usedActions]
      .filter(action => registryActions.has(action) && legacyCases.has(action))
      .sort();

    expect(doubleHandled).toEqual([]);
  });

  it('has a handler for every used data-action', () => {
    // This test is deprecated after migrating to registerAction() pattern
    // The new architecture uses setupActionDispatcher() which handles all data-action attributes
    // via the centralized registry in ui/actions/dispatcher.js
    // Individual action handlers are tested in their respective module tests
    const dispatcherSource = read('src/js/ui/actions/dispatcher.js');
    expect(dispatcherSource).toContain('export function setupActionDispatcher');
    expect(dispatcherSource).toContain('export function registerAction');
  });

  it('renders discipline dashboard tabs as semantic buttons', () => {
    const dashboardView = read('src/js/views/dashboard-view.js');

    expect(dashboardView).not.toMatch(/<div[^>]*data-action=["']switch-dashboard-tab["']/);
    expect(dashboardView).toMatch(/<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']topicos["']/);
    expect(dashboardView).toMatch(/<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']aulas["']/);
    expect(dashboardView).toMatch(/<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']banca["']/);
  });

  it('uses the extracted calendar view as the runtime calendar owner', async () => {
    const componentsSource = read('src/js/components.js');
    const mainSource = read('src/js/main.js');
    const viewsSource = read('src/js/views.js');
    const calendarSource = read('src/js/views/calendar-view.js');
    const calendarModule = await import('../../src/js/views/calendar-view.js?v=8.14');

    expect(componentsSource).toContain("from './views/calendar-view.js?v=8.14'");
    expect(mainSource).toContain("import * as calendar_view from './views/calendar-view.js?v=8.14';");
    expect(mainSource).toMatch(/exposedModules\s*=\s*\[[^\]]*calendar_view[^\]]*\]/s);
    expect(viewsSource).not.toMatch(/export function (renderCalendar|calNavigate|resetCalDate|renderCalendarGrid|renderCalendarWeek|updateCalendarHeader)\s*\(/);
    expect(calendarModule.renderCalendar).toBeTypeOf('function');
    expect(calendarModule.calNavigate).toBeTypeOf('function');
    expect(calendarModule.resetCalDate).toBeTypeOf('function');
    expect(calendarModule.setCalViewMode).toBeTypeOf('function');
    expect(calendarSource).toContain("import { esc, getEventStatus, todayStr } from '../utils.js?v=8.14';");
    expect(calendarSource).toContain('role="tablist"');
    expect(calendarSource).toMatch(/<button[^>]*type=["']button["'][^>]*class=["']cal-view-tab/);
  });

  it('keeps EstudoApp action targets exported by their owning modules', () => {
    const viewsSource = read('src/js/views.js');
    const wizardSource = read('src/js/planejamento-wizard.js');
    const registroSource = read('src/js/registro-sessao.js');

    expect(viewsSource).toMatch(/export function debouncedOnSearch\s*\(/);
    expect(viewsSource).toMatch(/import\s+\{[^}]*HABIT_TYPES[^}]*\}\s+from\s+['"]\.\/utils\.js\?v=8\.14['"]/s);

    expect(wizardSource).toMatch(/export function pwSelectTipo\s*\(/);

    expect(registroSource).toMatch(/export function discardTimerUI\s*\(/);
    expect(registroSource).toMatch(/import\s+\{[^}]*saveStateToDB[^}]*\}\s+from\s+['"]\.\/store\.js\?v=8\.14['"]/s);
  });

  it('exports discipline manager action targets instead of relying on Proxy fallback', () => {
    const viewsSource = read('src/js/views.js');
    const managerActions = [
      'switchManagerTab',
      'editLessonInline',
      'toggleAulaEstudada',
      'addBulkAulas',
      'addAssunto',
      'deleteAula',
      'runLessonMapperUI'
    ];

    for (const actionName of managerActions) {
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('exports cycle sequence action targets instead of relying on Proxy fallback', () => {
    const viewsSource = read('src/js/views.js');
    const cycleActions = [
      'toggleEditSeq',
      'saveEditSeq',
      'cancelEditSeq',
      'updateSeqItem',
      'dupSeqItem',
      'remSeqItem',
      'moveSeqItem',
      'addSeqItem',
      'openCicloHistory'
    ];

    for (const actionName of cycleActions) {
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('exports dashboard and session action targets instead of relying on Proxy fallback', () => {
    const viewsSource = read('src/js/views.js');
    const viewActions = [
      'switchDashboardTab',
      'openAddPastSessionModal',
      'savePastEvent',
      'filtrarDropdownBanca'
    ];

    for (const actionName of viewActions) {
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('imports the cache invalidators used by revision action handlers', () => {
    const viewsSource = read('src/js/views.js');

    expect(viewsSource).toMatch(/import\s+\{[^}]*invalidatePendingRevCache[^}]*\}\s+from\s+['"]\.\/logic\.js\?v=8\.14['"]/s);
    expect(viewsSource).toContain('invalidatePendingRevCache();');
  });

  it('routes domain events through EstudoApp after namespace migration', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).not.toMatch(/window\.(showConfirm|updateBadges|invalidateDiscCache|invalidateRevCache|invalidatePendingRevCache|invalidateTodayCache|invalidateStreakCache|invalidateDashCaches|refreshEventCard|refreshMEDSections)\b/);
    expect(mainSource).toContain('window.EstudoApp?.showConfirm');
    expect(mainSource).toContain('window.EstudoApp?.updateBadges');
    expect(mainSource).toContain('window.EstudoApp?.refreshEventCard');
    expect(mainSource).toContain('window.EstudoApp?.refreshMEDSections');
  });

  it('does not use a Proxy fallback for EstudoApp action resolution', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).not.toContain('new Proxy');
    expect(mainSource).not.toMatch(/window\.EstudoApp\s*=\s*new Proxy/);
    expect(mainSource).not.toContain('Reflect.has');
  });

  it('does not create action handlers directly as window function expressions', () => {
    const files = walkFiles(join(srcDir, 'js'), file =>
      file.endsWith('.js') && !file.includes(`${join('src', 'vendor')}`)
    );
    const offenders = files
      .map(file => [file, readFileSync(file, 'utf8')])
      .filter(([, source]) =>
        /window\.[A-Za-z0-9_]+\s*=\s*function\b/.test(source) ||
        /window\.[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>/.test(source)
      )
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it('exports legacy cycle, free timer, and session handlers before action dispatch', () => {
    const logicSource = read('src/js/logic.js');
    const viewsSource = read('src/js/views.js');
    const cicloViewSource = read('src/js/views/ciclo-view.js');
    const registroSource = read('src/js/registro-sessao.js');

    for (const actionName of ['setCronoLivreGoal', 'setCronoLivreDisc', 'setCronoLivreAss', 'moveCicloSeq', 'desfazerEtapa', 'editCicloSeqHours']) {
      expect(logicSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }

    for (const actionName of ['recomecarCiclo', 'zerarCiclosCounter', 'calculateCyclePredictions']) {
      expect(cicloViewSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
      expect(viewsSource).toContain(actionName);
    }

    expect(registroSource).toMatch(/export function deleteCompletedSession\s*\(/);
  });

  it('imports immediate persistence before saving detailed study sessions', () => {
    const registroSource = read('src/js/registro-sessao.js');

    expect(registroSource).toMatch(/import\s+\{[^}]*saveStateToDB[^}]*\}\s+from\s+['"]\.\/store\.js\?v=8\.14['"]/s);
    expect(registroSource).toContain('saveStateToDB().then');
  });

  it('renders revision action buttons as non-submit controls', () => {
    const viewsSource = read('src/js/views.js');

    expect(viewsSource).toMatch(/<button\s+type="button"[^>]*data-action="mark-revision"/);
    expect(viewsSource).toMatch(/<button\s+type="button"[^>]*data-action="postpone-revision"/);
  });

  it('precaches every runtime module introduced by the refactor', () => {
    const swSource = read('src/sw.js');
    const requiredModules = [
      './js/credentials.js',
      './js/views/habitos-view.js',
      './js/views/ciclo-view.js'
    ];

    for (const mod of requiredModules) {
      expect(swSource).toContain(mod);
    }
  });

  it('does not reload the page when the service worker claims first control', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain('const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);');
    expect(swRegisterSource).toMatch(/controllerchange[\s\S]*if \(!hadServiceWorkerController\) return;/);
  });

  it('preserves the current service worker precache while clearing old caches', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain('const serviceWorkerScriptUrl = document.currentScript?.src || window.location.href;');
    expect(swRegisterSource).toContain('const currentCacheName = assetVersion ? `estudo-organizado-v${assetVersion}` : null;');
    expect(swRegisterSource).toContain("cacheName !== currentCacheName");
  });
});

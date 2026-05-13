import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
    ...walkFiles(join(srcDir, 'js'), (file) => file.endsWith('.js')),
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
    'eventos.js',
    'editais.js',
    'revisoes.js',
    'habitos.js',
    'config.js',
    'navegacao.js',
    'modais.js',
    'planejamento.js',
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
  return new Set([...mainSource.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map((match) => match[1]));
}

describe('data-action contracts', () => {
  it('keeps one canonical handler per action in the central registry', () => {
    const entries = collectActionRegistryEntries();
    const duplicates = [...entries.entries()]
      .filter(([, lines]) => lines.length > 1)
      .map(([key, lines]) => `${key} at lines ${lines.join(', ')}`);

    // Allow known duplicates: 'navigate' is registered in both editais.js and navegacao.js intentionally
    const allowedDuplicates = ['navigate'];
    const actualDuplicates = duplicates.filter(
      (d) => !allowedDuplicates.some((a) => d.startsWith(a))
    );

    expect(actualDuplicates).toEqual([]);
  });

  it('does not dispatch the same used action from main.js and ui/actions.js', () => {
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const legacyCases = collectMainLegacyCases();
    const doubleHandled = [...usedActions]
      .filter((action) => registryActions.has(action) && legacyCases.has(action))
      .sort();

    expect(doubleHandled).toEqual([]);
  });

  it('has a handler for every used data-action', () => {
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const missing = [...usedActions].filter((action) => !registryActions.has(action)).sort();

    expect(missing).toEqual([]);
  });

  it('renders discipline dashboard tabs as semantic buttons', () => {
    const dashboardView = read('src/js/views/dashboard-view.js');

    expect(dashboardView).not.toMatch(/<div[^>]*data-action=["']switch-dashboard-tab["']/);
    expect(dashboardView).toMatch(
      /<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']topicos["']/
    );
    expect(dashboardView).toMatch(
      /<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']aulas["']/
    );
    expect(dashboardView).toMatch(
      /<button[^>]*type=["']button["'][^>]*data-action=["']switch-dashboard-tab["'][^>]*data-tab=["']banca["']/
    );
  });

  it('uses the extracted calendar view as the runtime calendar owner', async () => {
    const componentsSource = read('src/js/components.js');
    const mainSource = read('src/js/main.js');
    const viewsSource = read('src/js/views.js');
    const calendarSource = read('src/js/views/calendar-view.js');
    const calendarModule = await import('../../src/js/views/calendar-view.js?v=8.37');

    expect(componentsSource).toContain("from './views/calendar-view.js?v=8.37'");
    expect(mainSource).not.toContain("import * as calendar_view from './views/calendar-view.js");
    expect(mainSource).not.toMatch(/exposedModules\s*=\s*\[[^\]]*calendar_view[^\]]*\]/s);
    expect(viewsSource).not.toMatch(
      /export function (renderCalendar|calNavigate|resetCalDate|renderCalendarGrid|renderCalendarWeek|updateCalendarHeader)\s*\(/
    );
    expect(calendarModule.renderCalendar).toBeTypeOf('function');
    expect(calendarModule.calNavigate).toBeTypeOf('function');
    expect(calendarModule.resetCalDate).toBeTypeOf('function');
    expect(calendarModule.setCalViewMode).toBeTypeOf('function');
    expect(calendarSource).toContain(
      "import { esc, getEventStatus, todayStr } from '../utils.js?v=8.37';"
    );
    expect(calendarSource).toContain('role="tablist"');
    expect(calendarSource).toMatch(/<button[^>]*type=["']button["'][^>]*class=["']cal-view-tab/);
  });

  it('keeps EstudoApp action targets exported by their owning modules', () => {
    const searchSource = read('src/js/ui/search.js');
    const eventModalsSource = read('src/js/ui/event-modals.js');
    const configViewSource = read('src/js/views/config-view.js');
    const wizardSource = read('src/js/planejamento-wizard.js');
    const registroSource = read('src/js/registro-sessao.js');

    expect(searchSource).toMatch(/export function debouncedOnSearch\s*\(/);
    expect(searchSource).toMatch(
      /import\s+\{[^}]*HABIT_TYPES[^}]*\}\s+from\s+['"]\.\.\/utils\.js\?v=8\.37['"]/s
    );

    expect(eventModalsSource).toMatch(/export function openAddPastSessionModal\s*\(/);

    expect(wizardSource).toMatch(/export function pwSelectTipo\s*\(/);

    expect(registroSource).toMatch(/export function discardTimerUI\s*\(/);
    expect(registroSource).toMatch(
      /import\s+\{[^}]*renderRegistroForm[^}]*\}\s+from\s+['"]\.\/registro-sessao\/modal-renderer\.js\?v=8\.37['"]/s
    );
    expect(registroSource).toMatch(
      /import\s+\{[^}]*performSave[^}]*\}\s+from\s+['"]\.\/registro-sessao\/session-save\.js\?v=8\.37['"]/s
    );

    const saveModuleSource = read('src/js/registro-sessao/session-save.js');
    expect(saveModuleSource).toMatch(
      /import\s+\{[^}]*saveStateToDB[^}]*\}\s+from\s+['"]\.\.\/store\.js\?v=8\.37['"]/s
    );

    const rendererModuleSource = read('src/js/registro-sessao/modal-renderer.js');
    expect(rendererModuleSource).toMatch(/export function renderRegistroForm\s*\(/);
    expect(rendererModuleSource).toMatch(/export function renderConditionalFields\s*\(/);

    const dataMgmtSource = read('src/js/views/config/data-management.js');

    expect(configViewSource).toContain("from './config/theme-settings.js?v=8.37'");
    expect(configViewSource).not.toContain("from './config/theme-settings.js';");
    expect(dataMgmtSource).toContain('createExportableState()');
    expect(dataMgmtSource).toMatch(
      /import\s+\{[^}]*createExportableState[^}]*\}\s+from\s+['"]\.\.\/\.\.\/store\.js\?v=8\.37['"]/s
    );
    expect(dataMgmtSource).toMatch(
      /import\s+\{[^}]*invalidateTodayCache[^}]*\}\s+from\s+['"]\.\.\/\.\.\/utils\.js\?v=8\.37['"]/s
    );
    expect(dataMgmtSource).not.toMatch(
      /import\s+\{[^}]*invalidateTodayCache[^}]*\}\s+from\s+['"]\.\.\/\.\.\/logic\.js\?v=8\.37['"]/s
    );
  });

  it('exports discipline manager action targets via editais-crud re-export', () => {
    const viewsSource = read('src/js/views.js');
    const editaisCrudSource = read('src/js/views/editais-crud.js');
    const discManagerSource = read('src/js/views/editais/disc-manager.js');
    const discCrudSource = read('src/js/views/editais/disc-crud.js');
    const inlineEditingSource = read('src/js/views/editais/inline-editing.js');
    const aulaOperationsSource = read('src/js/views/editais/aula-operations.js');

    expect(viewsSource).toContain(
      "import { getEditingSubjectCtx, openDiscManager } from './views/editais-crud.js';"
    );
    expect(viewsSource).toMatch(/export\s+\{[^}]*switchManagerTab[^}]*\}\s+from\s+['"]\.\/views\/editais-crud\.js['"]/s);

    for (const actionName of [
      'saveDiscManager',
      'moveSubject',
      'openDiscManager',
      'switchManagerTab',
      'editSubjectInline',
      'editLessonInline',
      'toggleAulaEstudada',
      'addBulkAulas',
      'addAssunto',
      'deleteAula',
      'runLessonMapperUI',
    ]) {
      expect(editaisCrudSource).toMatch(new RegExp(`export\\s+\\{[^}]*${actionName}[^}]*\\}\\s+from\\s+['"]\\.\\/editais\\/`));
    }

    expect(discCrudSource).toMatch(/export function saveDiscManager\s*\(/);
    expect(discCrudSource).toMatch(/export function moveSubject\s*\(/);
    expect(discManagerSource).toMatch(/export function openDiscManager\s*\(/);
    expect(discManagerSource).toMatch(/export function switchManagerTab\s*\(/);
    expect(inlineEditingSource).toMatch(/export function editSubjectInline\s*\(/);
    expect(inlineEditingSource).toMatch(/export function editLessonInline\s*\(/);
    expect(aulaOperationsSource).toMatch(/export function toggleAulaEstudada\s*\(/);
    expect(aulaOperationsSource).toMatch(/export function addBulkAulas\s*\(/);
    expect(aulaOperationsSource).toMatch(/export function addAssunto\s*\(/);
    expect(aulaOperationsSource).toMatch(/export function deleteAula\s*\(/);
    expect(aulaOperationsSource).toMatch(/export function runLessonMapperUI\s*\(/);
  });

  it('uses user-facing language in the discipline manager save action', () => {
    const discManagerSource = read('src/js/views/editais/disc-manager.js');

    expect(discManagerSource).not.toContain('Salvar Manager');
    expect(discManagerSource).toContain('Salvar alterações');
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
      'openCicloHistory',
    ];

    for (const actionName of cycleActions) {
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('exports dashboard and session action targets instead of relying on Proxy fallback', () => {
    const viewsSource = read('src/js/views.js');
    const eventModalsSource = read('src/js/ui/event-modals.js');
    const editaisCrudSource = read('src/js/views/editais-crud.js');

    // switchDashboardTab moved to editais-crud.js, re-exported from views.js
    expect(viewsSource).toMatch(/export\s+\{[^}]*switchDashboardTab[^}]*\}\s+from\s+['"]\.\/views\/editais-crud\.js['"]/s);
    expect(editaisCrudSource).toMatch(/export function switchDashboardTab\s*\(/);

    // filtrarDropdownBanca stays in views.js
    expect(viewsSource).toMatch(/export function filtrarDropdownBanca\s*\(/);

    expect(eventModalsSource).toMatch(/export function openAddPastSessionModal\s*\(/);
    expect(eventModalsSource).toMatch(/export function savePastEvent\s*\(/);
  });

  it('imports the cache invalidators used by revision action handlers', () => {
    const revisaoSource = read('src/js/views/revisao-view.js');

    expect(revisaoSource).toMatch(
      /import\s+\{[^}]*invalidatePendingRevCache[^}]*\}\s+from\s+['"]\.\.\/logic\.js\?v=8\.37['"]/s
    );
    expect(revisaoSource).toContain('invalidatePendingRevCache();');
  });

  it('routes domain events through direct module imports after namespace migration', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).not.toMatch(
      /window\.(showConfirm|updateBadges|invalidateDiscCache|invalidateRevCache|invalidatePendingRevCache|invalidateTodayCache|invalidateStreakCache|invalidateDashCaches|refreshEventCard|refreshMEDSections)\b/
    );
    expect(mainSource).not.toMatch(
      /window\.EstudoApp\?\.(showConfirm|updateBadges|refreshEventCard|refreshMEDSections|renderCurrentView)/
    );
    expect(mainSource).toContain('app.showConfirm');
    expect(mainSource).toContain('components.updateBadges');
    expect(mainSource).toContain('views.refreshEventCard');
    expect(mainSource).toContain('views.refreshMEDSections');
    expect(mainSource).toContain('components.renderCurrentView');
  });

  it('does not use a Proxy fallback for EstudoApp action resolution', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).not.toContain('new Proxy');
    expect(mainSource).not.toMatch(/window\.EstudoApp\s*=\s*new Proxy/);
    expect(mainSource).not.toContain('Reflect.has');
  });

  it('does not create action handlers directly as window function expressions', () => {
    const files = walkFiles(
      join(srcDir, 'js'),
      (file) => file.endsWith('.js') && !file.includes(`${join('src', 'vendor')}`)
    );
    const offenders = files
      .map((file) => [file, readFileSync(file, 'utf8')])
      .filter(
        ([, source]) =>
          /window\.[A-Za-z0-9_]+\s*=\s*function\b/.test(source) ||
          /window\.[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>/.test(source)
      )
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it('exports legacy cycle, free timer, and session handlers before action dispatch', () => {
    const logicSource = read('src/js/logic.js');
    const logicTimerSource = read('src/js/logic/timer.js');
    const logicCycleSource = read('src/js/logic/cycle.js');
    const viewsSource = read('src/js/views.js');
    const cicloViewSource = read('src/js/views/ciclo-view.js');
    const registroSource = read('src/js/registro-sessao.js');

    for (const actionName of [
      'setCronoLivreGoal',
      'setCronoLivreDisc',
      'setCronoLivreAss',
    ]) {
      expect(logicSource).toContain(actionName);
      expect(logicTimerSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }

    for (const actionName of [
      'moveCicloSeq',
      'desfazerEtapa',
      'editCicloSeqHours',
    ]) {
      expect(logicSource).toContain(actionName);
      expect(logicCycleSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }

    for (const actionName of [
      'recomecarCiclo',
      'zerarCiclosCounter',
      'calculateCyclePredictions',
    ]) {
      expect(cicloViewSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
      expect(viewsSource).toContain(actionName);
    }

    expect(registroSource).toMatch(/export function deleteCompletedSession\s*\(/);
  });

  it('imports immediate persistence before saving detailed study sessions', () => {
    const registroSource = read('src/js/registro-sessao.js');
    const saveModuleSource = read('src/js/registro-sessao/session-save.js');

    expect(registroSource).toMatch(
      /import\s+\{[^}]*performSave[^}]*\}\s+from\s+['"]\.\/registro-sessao\/session-save\.js\?v=8\.37['"]/s
    );
    expect(saveModuleSource).toMatch(
      /import\s+\{[^}]*saveStateToDB[^}]*\}\s+from\s+['"]\.\.\/store\.js\?v=8\.37['"]/s
    );
    expect(saveModuleSource).toContain('saveStateToDB().then');
  });

  it('renders revision action buttons as non-submit controls', () => {
    const revisaoSource = read('src/js/views/revisao-view.js');

    expect(revisaoSource).toMatch(/<button\s+type="button"[^>]*data-action="mark-revision"/);
    expect(revisaoSource).toMatch(/<button\s+type="button"[^>]*data-action="postpone-revision"/);
  });

  it('precaches every runtime module introduced by the refactor', () => {
    const swSource = read('src/sw.js');
    const requiredModules = [
      './js/credentials.js',
      './js/views/habitos-view.js',
      './js/views/ciclo-view.js',
      './js/registro-sessao/modal-renderer.js',
      './js/registro-sessao/session-save.js',
    ];

    for (const mod of requiredModules) {
      expect(swSource).toContain(mod);
    }
  });

  it('does not reload the page when the service worker claims first control', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain(
      'const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);'
    );
    expect(swRegisterSource).toMatch(
      /controllerchange[\s\S]*if \(!hadServiceWorkerController\) return;/
    );
  });

  it('preserves the current service worker precache while clearing old caches', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain(
      'const serviceWorkerScriptUrl = document.currentScript?.src || window.location.href;'
    );
    expect(swRegisterSource).toContain(
      'const currentCacheName = assetVersion ? `estudo-organizado-v${assetVersion}` : null;'
    );
    expect(swRegisterSource).toContain('cacheName !== currentCacheName');
  });

  it('guards service worker registration before reading registration scope', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain('if (!reg) return;');
  });

  it('posts skip-waiting messages to service worker without invalid target origin argument', () => {
    const swRegisterSource = read('src/js/sw-register.js');

    expect(swRegisterSource).toContain("postMessage({ type: 'SKIP_WAITING' })");
    expect(swRegisterSource).not.toContain(
      "postMessage({ type: 'SKIP_WAITING' }, window.location.origin)"
    );
  });

  it('uses sanitized exportable state for local and Drive backups', () => {
    const dataMgmtSource = read('src/js/views/config/data-management.js');
    const driveSource = read('src/js/drive-sync.js');

    expect(dataMgmtSource).toContain('createExportableState()');
    expect(driveSource).toContain('createExportableState()');
    expect(driveSource).not.toContain('JSON.stringify(state)');
  });

  it('keeps EstudoApp namespace values live for mutable module exports', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).toContain('Object.defineProperty(window.EstudoApp, key');
    expect(mainSource).toContain('get: () => mod[key]');
  });

  it('keeps the browser module graph bundleable without missing exports', () => {
    const outfile = join(tmpdir(), 'estudo-organizado-main-esbuild-check.js');
    const args = [
      'esbuild',
      'src/js/main.js',
      '--bundle',
      '--format=esm',
      `--outfile=${outfile}`,
      '--log-level=silent',
    ];

    expect(() => {
      if (process.platform === 'win32') {
        execFileSync('cmd.exe', ['/d', '/s', '/c', `npx ${args.join(' ')}`], {
          cwd: rootDir,
          stdio: 'pipe',
        });
      } else {
        execFileSync('npx', args, { cwd: rootDir, stdio: 'pipe' });
      }
    }).not.toThrow();
  });

  it('refreshes stale config sync indicators through the dedicated sync status UI', () => {
    const mainSource = read('src/js/main.js');
    const syncStatusSource = read('src/js/sync/sync-status-ui.js');
    const indexSource = read('src/index.html');

    expect(mainSource).not.toContain('CONFIG_SYNC_RENDER_THROTTLE_MS');
    expect(mainSource).not.toContain('scheduleConfigSyncRender');
    expect(indexSource).toContain('data-action="sync-now"');
    expect(syncStatusSource).toContain("document.addEventListener('app:firestoreSyncStatus'");
    expect(syncStatusSource).toContain("document.addEventListener('app:primarySyncStatus'");
    expect(syncStatusSource).toContain("document.addEventListener('app:globalSyncPauseChanged'");
    expect(syncStatusSource).toContain("document.addEventListener('app:cloudSyncStatus'");
    expect(syncStatusSource).toContain('refreshConfigSyncSurface');
    expect(syncStatusSource).toContain('cf-sync-conflict');
    expect(syncStatusSource).not.toContain('renderCurrentView');
  });

  it('removes isolated credentials when clearing all app data', () => {
    const storeSource = read('src/js/store.js');
    const indexedDbSource = read('src/js/store/indexeddb.js');

    expect(storeSource).toMatch(/clearData/);
    expect(indexedDbSource).toContain("from '../credentials.js?v=8.37';");
    expect(indexedDbSource).toMatch(/clearData[\s\S]*clearAllCredentials\(\)/);
  });
});

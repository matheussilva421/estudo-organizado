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
  const actionsSource = read('src/js/ui/actions.js');
  const entries = new Map();
  const actionKeyPattern = /^\s*['"]([a-z0-9-]+)['"]\s*:/gm;

  for (const match of actionsSource.matchAll(actionKeyPattern)) {
    const line = actionsSource.slice(0, match.index).split('\n').length;
    const key = match[1];
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(line);
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

    expect(duplicates).toEqual([]);
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
    const usedActions = collectDataActions();
    const registryActions = new Set(collectActionRegistryEntries().keys());
    const legacyCases = collectMainLegacyCases();
    const missing = [...usedActions]
      .filter(action => !registryActions.has(action) && !legacyCases.has(action))
      .sort();

    expect(missing).toEqual([]);
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
    const calendarModule = await import('../../src/js/views/calendar-view.js?v=8.3');

    expect(componentsSource).toContain("from './views/calendar-view.js?v=8.3'");
    expect(mainSource).toContain("import * as calendar_view from './views/calendar-view.js?v=8.3';");
    expect(mainSource).toMatch(/exposedModules\s*=\s*\[[^\]]*calendar_view[^\]]*\]/s);
    expect(viewsSource).not.toMatch(/export function (renderCalendar|calNavigate|resetCalDate|renderCalendarGrid|renderCalendarWeek|updateCalendarHeader)\s*\(/);
    expect(calendarModule.renderCalendar).toBeTypeOf('function');
    expect(calendarModule.calNavigate).toBeTypeOf('function');
    expect(calendarModule.resetCalDate).toBeTypeOf('function');
    expect(calendarModule.setCalViewMode).toBeTypeOf('function');
    expect(calendarSource).toContain("import { esc, getEventStatus, todayStr } from '../utils.js?v=8.3';");
    expect(calendarSource).toContain('role="tablist"');
    expect(calendarSource).toMatch(/<button[^>]*type=["']button["'][^>]*class=["']cal-view-tab/);
  });

  it('keeps EstudoApp action targets exported by their owning modules', () => {
    const actionsSource = read('src/js/ui/actions.js');
    const viewsSource = read('src/js/views.js');
    const wizardSource = read('src/js/planejamento-wizard.js');
    const registroSource = read('src/js/registro-sessao.js');

    expect(actionsSource).toContain('window.EstudoApp?.debouncedOnSearch');
    expect(viewsSource).toMatch(/export function debouncedOnSearch\s*\(/);
    expect(viewsSource).toMatch(/import\s+\{[^}]*HABIT_TYPES[^}]*\}\s+from\s+['"]\.\/utils\.js\?v=8\.3['"]/s);

    expect(actionsSource).toContain('window.EstudoApp?.pwSelectTipo');
    expect(wizardSource).toMatch(/export function pwSelectTipo\s*\(/);

    expect(actionsSource).toContain('window.EstudoApp?.discardTimerUI');
    expect(registroSource).toMatch(/export function discardTimerUI\s*\(/);
  });

  it('exports discipline manager action targets instead of relying on Proxy fallback', () => {
    const actionsSource = read('src/js/ui/actions.js');
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
      expect(actionsSource).toContain(`window.EstudoApp?.${actionName}`);
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('exports cycle sequence action targets instead of relying on Proxy fallback', () => {
    const actionsSource = read('src/js/ui/actions.js');
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
      expect(actionsSource).toContain(`window.EstudoApp?.${actionName}`);
      expect(viewsSource).toMatch(new RegExp(`export function ${actionName}\\s*\\(`));
    }
  });

  it('imports the cache invalidators used by revision action handlers', () => {
    const viewsSource = read('src/js/views.js');

    expect(viewsSource).toMatch(/import\s+\{[^}]*invalidatePendingRevCache[^}]*\}\s+from\s+['"]\.\/logic\.js\?v=8\.3['"]/s);
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

  it('keeps a legacy fallback while action handlers are migrated incrementally', () => {
    const mainSource = read('src/js/main.js');

    expect(mainSource).toContain('new Proxy');
    expect(mainSource).toMatch(/window\.EstudoApp\s*=\s*new Proxy/);
  });

  it('imports immediate persistence before saving detailed study sessions', () => {
    const registroSource = read('src/js/registro-sessao.js');

    expect(registroSource).toMatch(/import\s+\{[^}]*saveStateToDB[^}]*\}\s+from\s+['"]\.\/store\.js\?v=8\.3['"]/s);
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
});

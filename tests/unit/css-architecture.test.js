import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const rootDir = process.cwd();
const srcDir = join(rootDir, 'src');
const cssDir = join(srcDir, 'css');

function read(relativePath) {
  const content = readFileSync(join(rootDir, relativePath), 'utf8').replace(/\r\n/g, '\n');
  if (!relativePath.endsWith('.css')) return content;
  return inlineCssImports(relativePath, content).replace(/\[data-theme='([^']+)'\]/g, '[data-theme="$1"]');
}

function inlineCssImports(relativePath, content, seen = new Set()) {
  const normalizedPath = normalize(relativePath).replace(/\\/g, '/');
  if (seen.has(normalizedPath)) return '';
  seen.add(normalizedPath);

  const baseDir = dirname(normalizedPath);
  return content.replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_match, importPath) => {
    const importedPath = normalize(join(baseDir, importPath)).replace(/\\/g, '/');
    const importedContent = readFileSync(join(rootDir, importedPath), 'utf8').replace(/\r\n/g, '\n');
    return inlineCssImports(importedPath, importedContent, seen);
  });
}

function extractCssBlock(content, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`, 'm'));
  return match?.groups?.body || '';
}

function extractCssVars(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)]
      .map((match) => [`--${match[1]}`, match[2].trim().toLowerCase()])
  );
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const foregroundLum = luminance(foreground);
  const backgroundLum = luminance(background);
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function getThemeVars(styles, selector) {
  return extractCssVars(extractCssBlock(styles, selector));
}

const PHASE_1_COLOR_CONTRACT_FILES = [
  'src/css/base/layout.css',
  'src/css/styles.css',
  'src/css/views/dashboard.css'
];

const PHASE_1_RADIUS_CONTRACT_FILES = [
  'src/css/base/accessibility.css',
  'src/css/base/layout.css',
  'src/css/components/buttons.css',
  'src/css/components/cards.css'
];

const PHASE_1_VIEW_COLOR_CONTRACT_FILES = [
  'src/css/views.css',
  'src/css/views/ciclo.css',
  'src/css/views/cronometro.css',
  'src/css/views/habitos.css',
  'src/css/views/sessions.css'
];

const PHASE_1_RESIDUAL_COLOR_CONTRACT_FILES = [
  'src/css/base/layout.css',
  'src/css/components/buttons.css',
  'src/css/components/search.css',
  'src/css/components/sidebar.css',
  'src/css/components/toggle-drag.css',
  'src/css/styles.css',
  'src/css/views/dashboard.css',
  'src/css/views/editais-tree.css',
  'src/css/views/revisoes.css',
  'src/js/sw-register.js',
  'src/js/utils.js',
  'src/js/views/banca-view.js',
  'src/js/views/config/sync-center.js'
];

function collectFilesByExtension(dir, extensions, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['lab', 'vendor'].includes(entry.name)) continue;
      collectFilesByExtension(entryPath, extensions, out);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      out.push(normalize(entryPath).replace(/\\/g, '/'));
    }
  }
  return out;
}

function toRelativePath(file) {
  return normalize(relative(rootDir, file)).replace(/\\/g, '/');
}

describe('CSS architecture', () => {
  it('loads design-system stylesheets before legacy styles', () => {
    const html = read('src/index.html');
    const stylesheetHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) => match[1]);

    expect(stylesheetHrefs).toEqual([
      expect.stringContaining('css/tokens.css'),
      expect.stringContaining('css/base.css'),
      expect.stringContaining('css/components.css'),
      expect.stringContaining('css/views.css'),
      expect.stringContaining('css/styles.css')
    ]);
  });

  it('keeps static HTML shell text readable as UTF-8', () => {
    const html = read('src/index.html');

    expect(html).toContain('Pular para conteúdo principal');
    expect(html).toContain('Página Inicial');
    expect(html).toContain('Cronômetro');
    expect(html).toContain('Histórico de Sessões');
    expect(html).toContain('Configurações');
    expect(html).toContain('Registro da Sessão de Estudo');
    expect(html).toContain('Próximo');
    expect(html).not.toMatch(/\u00c3[\u0080-\u00bf]|\u00c3\u0192|\u00c3\u201a|\u00f0\u0178|\u00e2[\u0080-\u009f]/);
  });

  it('keeps design tokens in css/tokens.css', () => {
    for (const filename of [
      'tokens.css',
      'base.css',
      'components.css',
      'views.css',
      'base/accessibility.css',
      'base/themes.css',
      'base/layout.css',
      'base/mobile.css',
      'components/modals-shared.css',
      'components/tabs.css',
      'components/toggle-drag.css',
      'components/timer.css',
      'components/misc-ui.css',
      'components/filter-row.css',
      'components/loading.css',
      'components/skeleton.css',
      'views/habitos.css',
      'views/revisoes.css',
      'views/editais-tree.css',
      'components/cards.css',
      'components/status-feedback.css',
      'components/search.css'
    ]) {
      expect(existsSync(join(cssDir, filename))).toBe(true);
    }

    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');

    expect(tokens).toContain('--space-1:');
    expect(tokens).toContain('--radius-sm:');
    expect(tokens).toContain('--shadow-sm:');
    expect(legacyStyles).not.toMatch(/^:root\s*{/m);
  });

  it('keeps phase-1 semantic color contracts free of generic var fallbacks', () => {
    const genericFallbackPattern = /var\(--[a-z0-9-]+,\s*(?:#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\))/g;
    const drifts = [];

    for (const relativePath of PHASE_1_COLOR_CONTRACT_FILES) {
      const file = join(rootDir, relativePath);
      const content = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      content.split('\n').forEach((line, index) => {
        if (!genericFallbackPattern.test(line)) return;
        genericFallbackPattern.lastIndex = 0;
        drifts.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(drifts).toEqual([]);
  });

  it('keeps config view colors on semantic tokens', () => {
    const rawColorPattern = /(?:#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\))/g;
    const relativePath = 'src/css/views/config/config-view.css';
    const content = readFileSync(join(rootDir, relativePath), 'utf8').replace(/\r\n/g, '\n');
    const drifts = [];

    content.split('\n').forEach((line, index) => {
      if (!rawColorPattern.test(line)) return;
      rawColorPattern.lastIndex = 0;
      drifts.push(`${relativePath}:${index + 1}: ${line.trim()}`);
    });

    expect(drifts).toEqual([]);
  });

  it('keeps phase-1 view colors on semantic tokens', () => {
    const rawColorPattern = /(?:#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\))/g;
    const drifts = [];

    for (const relativePath of PHASE_1_VIEW_COLOR_CONTRACT_FILES) {
      const content = readFileSync(join(rootDir, relativePath), 'utf8').replace(/\r\n/g, '\n');
      content.split('\n').forEach((line, index) => {
        if (!rawColorPattern.test(line)) return;
        rawColorPattern.lastIndex = 0;
        drifts.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(drifts).toEqual([]);
  });

  it('keeps phase-1 residual colors on semantic tokens', () => {
    const rawColorPattern = /(?:#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\))/g;
    const drifts = [];

    for (const relativePath of PHASE_1_RESIDUAL_COLOR_CONTRACT_FILES) {
      const content = readFileSync(join(rootDir, relativePath), 'utf8').replace(/\r\n/g, '\n');
      content.split('\n').forEach((line, index) => {
        if (!rawColorPattern.test(line)) return;
        rawColorPattern.lastIndex = 0;
        drifts.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(drifts).toEqual([]);
  });

  it('keeps phase-1 component radii on the documented radius token scale', () => {
    const literalRadiusPattern = /border-radius\s*:\s*([^;]+);/g;
    const allowedLiteralRadii = new Set(['0', '50%', 'inherit', 'var(--radius)', 'var(--radius-md, 8px)']);
    const drifts = [];

    for (const relativePath of PHASE_1_RADIUS_CONTRACT_FILES) {
      const file = join(rootDir, relativePath);
      const content = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      for (const match of content.matchAll(literalRadiusPattern)) {
        const value = match[1].trim();
        if (value.includes('var(--radius-') || allowedLiteralRadii.has(value)) continue;

        const lineNumber = content.slice(0, match.index).split('\n').length;
        drifts.push(`${relativePath}:${lineNumber}: border-radius: ${value};`);
      }
    }

    expect(drifts).toEqual([]);
  });

  it('keeps all shipped UI radii on the documented radius token scale', () => {
    const literalRadiusPattern = /border-radius\s*:\s*([^;"'`]+)[;"'`]/g;
    const allowedLiteralRadii = new Set(['0', '50%', 'inherit']);
    const drifts = [];

    for (const file of collectFilesByExtension(srcDir, ['.css', '.js', '.html'])) {
      const relativePath = toRelativePath(file);
      const content = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      for (const match of content.matchAll(literalRadiusPattern)) {
        const value = match[1].trim();
        if (value.includes('var(--radius-') || allowedLiteralRadii.has(value)) continue;

        const lineNumber = content.slice(0, match.index).split('\n').length;
        drifts.push(`${relativePath}:${lineNumber}: border-radius: ${value};`);
      }
    }

    expect(drifts).toEqual([]);
  });

  it('keeps legacy stylesheet imports before style rules', () => {
    const legacyStyles = readFileSync(join(rootDir, 'src/css/styles.css'), 'utf8').replace(/\r\n/g, '\n');
    const importBlock = [
      "@import './base/accessibility.css';",
      "@import './base/themes.css';",
      "@import './base/layout.css';",
      "@import './components/sidebar.css';",
      "@import './components/buttons.css';",
      "@import './components/cards.css';",
      "@import './components/status-feedback.css';",
      "@import './components/search.css';",
      "@import './components/modals-shared.css';",
      "@import './components/tabs.css';",
      "@import './components/toggle-drag.css';",
      "@import './components/timer.css';",
      "@import './components/misc-ui.css';",
      "@import './components/filter-row.css';",
      "@import './components/loading.css';",
      "@import './components/skeleton.css';",
      "@import './views/habitos.css';",

      "@import './views/revisoes.css';",
      "@import './views/editais-tree.css';",
      "@import './base/mobile.css';",




      "@import './base/utilities.css';",
      "@import './base/forms.css';",
      "@import './base/animations.css';"

    ].join('\n');

    expect(legacyStyles.startsWith(`${importBlock}\n\n`)).toBe(true);
    expect(legacyStyles.slice(importBlock.length)).not.toMatch(/^@import/m);
    expect(read('src/css/base/accessibility.css')).toContain('.skip-link:focus');
    expect(read('src/css/base/themes.css')).toContain("DARK PREMIUM THEME LIBRARY");
    expect(read('src/css/base/layout.css')).toContain('MAIN CONTENT');
    expect(read('src/css/components/cards.css')).toContain('CARDS');
    expect(read('src/css/components/cards.css')).toContain('STATS CARDS');
    expect(read('src/css/components/status-feedback.css')).toContain('TOAST');
    expect(read('src/css/components/status-feedback.css')).toContain('PROGRESS BAR');
    expect(read('src/css/components/status-feedback.css')).toContain('BADGE');
    expect(read('src/css/components/search.css')).toContain('SEARCH BAR');
    expect(read('src/css/components/search.css')).toContain('button.search-item');
    expect(read('src/css/base/mobile.css')).toContain('Touch feedback');
    expect(read('src/css/base/mobile.css')).toContain('Touch targets');
    expect(read('src/css/components/modals-shared.css')).toContain('MODAL');
    expect(read('src/css/components/modals-shared.css')).toContain('DRIVE MODAL');
    expect(read('src/css/components/tabs.css')).toContain('TABS');
    expect(read('src/css/components/toggle-drag.css')).toContain('TOGGLE');
    expect(read('src/css/components/toggle-drag.css')).toContain('DRAG HANDLES');
    expect(read('src/css/components/timer.css')).toContain('TIMER');
    expect(read('src/css/components/misc-ui.css')).toContain('DISCIPLINE COLOR CIRCLES');
    expect(read('src/css/components/filter-row.css')).toContain('FILTER ROW');
    expect(read('src/css/components/loading.css')).toContain('LOADING');
    expect(read('src/css/components/skeleton.css')).toContain('Loading Skeletons');
    expect(read('src/css/base/animations.css')).toContain('@keyframes spin');
    expect(read('src/css/views/habitos.css')).toContain('HABIT CARDS');
    expect(read('src/css/views/revisoes.css')).toContain('REVISOES');
    expect(read('src/css/views/editais-tree.css')).toContain('EDITAL TREE');
  });

  it('toda classe utilitária p-N usada nos templates existe no CSS', () => {
    // p-12/p-24 já foram usadas em templates sem existir no CSS — o card
    // renderizava sem padding nenhum (toolbar e empty states colados na borda).
    const collectJsFiles = (dir, out = []) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const entryPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'vendor') continue;
          collectJsFiles(entryPath, out);
        } else if (entry.name.endsWith('.js')) {
          out.push(entryPath);
        }
      }
      return out;
    };

    const allCss = read('src/css/styles.css');
    const missing = [];
    for (const file of collectJsFiles(join(srcDir, 'js'))) {
      const source = readFileSync(file, 'utf8');
      for (const classAttr of source.matchAll(/class="([^"]*)"/g)) {
        for (const padding of classAttr[1].matchAll(/\bp-(\d+)\b/g)) {
          if (!new RegExp(`\\.p-${padding[1]}\\s*\\{`).test(allCss)) {
            missing.push(`p-${padding[1]} (${file})`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('impede que cards filhos diretos do main-content-stack estiquem para preencher a viewport', () => {
    const cards = read('src/css/components/cards.css');

    expect(cards).toMatch(/#main-content\.main-content-stack\s*>\s*\.card\s*\{[^}]*height:\s*auto;/s);
  });

  it('keeps skip links hidden without intercepting pointer events until focused', () => {
    const accessibility = read('src/css/base/accessibility.css');

    expect(accessibility).toMatch(/\.skip-link\s*\{[^}]*position:\s*fixed;/s);
    expect(accessibility).toMatch(/\.skip-link\s*\{[^}]*transform:\s*translateY\(/s);
    expect(accessibility).toMatch(/\.skip-link\s*\{[^}]*pointer-events:\s*none;/s);
    expect(accessibility).toMatch(/\.skip-link:focus\s*\{[^}]*transform:\s*translateY\(0\);/s);
    expect(accessibility).toMatch(/\.skip-link:focus\s*\{[^}]*pointer-events:\s*auto;/s);
  });

  it('keeps the dark premium theme contracts', () => {
    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');
    const rootVars = extractCssVars(extractCssBlock(tokens, ':root'));
    const grafiteVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="grafite"]'));
    const ardosiaVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="ardosia"]'));
    const platinaVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="platina"]'));

    expect(rootVars).toMatchObject({
      '--bg': '#08090d',
      '--card': '#121821',
      '--surface': '#0d1117',
      '--surface-muted': 'rgba(255, 255, 255, 0.03)',
      '--surface-soft': 'rgba(255, 255, 255, 0.05)',
      '--border': 'rgba(148, 163, 184, 0.14)',
      '--text-primary': '#f3f6fb',
      '--text-secondary': '#b8c0cc',
      '--text-muted': '#7f8a99',
      '--accent': '#8aa4bf',
      '--accent-hover': '#a7bdd3',
      '--accent-light': 'rgba(138, 164, 191, 0.16)',
      '--accent-soft': 'rgba(138, 164, 191, 0.1)',
      '--accent-text': '#071018',
      '--question': '#a7a4d6',
      '--pomodoro': '#a7a4d6'
    });

    expect(grafiteVars['--bg']).toBe('#08090d');
    expect(ardosiaVars).toMatchObject({
      '--bg': '#101216',
      '--card': '#1d2027',
      '--card-header': '#262a32',
      '--card-hover': '#2d313b',
      '--border': 'rgba(220, 225, 232, 0.14)',
      '--text-secondary': '#a8aeb8',
      '--accent': '#c0c5cd'
    });
    expect(platinaVars).toMatchObject({
      '--bg': '#111112',
      '--card': '#202225',
      '--card-header': '#2b2e32',
      '--card-hover': '#363a40',
      '--border': 'rgba(235, 238, 242, 0.14)',
      '--text-secondary': '#aaaead',
      '--accent': '#d7d7d2',
      '--accent-hover': '#eeeeea'
    });
    expect(contrastRatio(ardosiaVars['--text-primary'], ardosiaVars['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ardosiaVars['--text-secondary'], ardosiaVars['--card'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(platinaVars['--text-primary'], platinaVars['--bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(platinaVars['--text-secondary'], platinaVars['--card'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rootVars['--accent-text'], rootVars['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rootVars['--text-secondary'], rootVars['--card'])).toBeGreaterThanOrEqual(4.5);
    expect(legacyStyles).toMatch(/\.btn-primary:hover\s*{[^}]*background:\s*var\(--accent-hover\)/s);
  });

  it('uses semantic visual classes for recurring soft surfaces and selected states', () => {
    const componentsCss = read('src/css/components.css');
    const viewsCss = read('src/css/views.css');
    const homeView = read('src/js/views/home-view.js');
    const stepRenderers = read('src/js/planejamento/step-renderers.js');
    const wizard = read('src/js/planejamento-wizard.js');
    const timerLogic = read('src/js/logic/timer.js');

    expect(componentsCss).toContain('.surface-note');
    expect(componentsCss).toContain('.selection-card.is-selected');
    expect(componentsCss).toContain('.priority-badge--p1');
    expect(componentsCss).toContain('.timer-mode-pill--pomodoro');
    expect(viewsCss).toContain('.dash-progress-bar--questions');
    expect(homeView).toContain('surface-note');
    expect(homeView).toContain('dash-progress-bar--questions');
    expect(stepRenderers).toContain('selection-card');
    expect(timerLogic).toContain("classList.toggle('timer-mode-pill--pomodoro'");

    expect(`${homeView}\n${wizard}\n${timerLogic}`).not.toMatch(/rgba\(88,166,255|#8b5cf6|rgba\(139,92,246|rgba\(255,255,255,0\.03\)/);
  });

  it('keeps WCAG AA contrast on thematic dark themes', () => {
    const legacyStyles = read('src/css/styles.css');
    for (const themeName of ['terminal', 'neon', 'arrakis', 'codex', 'plasma']) {
      const vars = extractCssVars(extractCssBlock(legacyStyles, `[data-theme="${themeName}"]`));
      expect(vars['--bg'], `${themeName} must define --bg`).toBeTruthy();
      expect(vars['--text-primary'], `${themeName} must define --text-primary`).toBeTruthy();
      expect(
        contrastRatio(vars['--text-primary'], vars['--bg']),
        `${themeName} text-primary vs bg must meet WCAG AA`
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars['--text-secondary'], vars['--card']),
        `${themeName} text-secondary vs card must meet WCAG AA`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('presents only the premium dark themes while keeping old theme names internal', () => {
    const html = read('src/index.html');
    const appSource = read('src/js/app.js');
    const themesSource = read('src/js/app/themes.js');
    const configViewSource = read('src/js/views/config-view.js');
    const allSources = `${appSource}\n${themesSource}\n${configViewSource}`;

    expect(html).toContain('title="Trocar tema"');
    // THEME_OPTIONS live in app/themes.js; app.js re-exports them
    expect(themesSource).toContain("label: 'Grafite'");
    expect(themesSource).toContain("label: 'Ardósia'");
    expect(themesSource).toContain("label: 'Platina'");
    expect(themesSource).not.toContain("label: 'Pergaminho'");
    expect(themesSource).toContain('LEGACY_THEME_ALIASES');
    expect(allSources).toContain('THEME_OPTIONS');
    expect(configViewSource).toContain('THEME_OPTIONS');
    expect(allSources).not.toMatch(/label:\s*'(Neutro|Noite|Furtivo|Abismo|Matrix|Rubi|Cyberpunk 2077)'/);
    expect(`${html}\n${allSources}`).not.toMatch(/Modo escuro|Modo claro|Claro profissional|Escuro profissional|Extra:/);
  });

  it('keeps every visible premium theme from inheriting the root app background', () => {
    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');
    const rootVars = getThemeVars(tokens, ':root');
    const themedSelectors = [
      '[data-theme="grafite"]',
      '[data-theme="ardosia"]',
      '[data-theme="platina"]',
      '[data-theme="terminal"]',
      '[data-theme="neon"]',
      '[data-theme="arrakis"]'
    ];

    for (const selector of themedSelectors) {
      const themeVars = getThemeVars(legacyStyles, selector);
      expect(themeVars['--app-bg'], `${selector} must define its own app background`).toBeTruthy();
      expect(themeVars['--app-bg']).not.toBe(rootVars['--app-bg']);
    }
  });

  it('uses app background on the main shell', () => {
    const legacyStyles = read('src/css/styles.css');

    expect(legacyStyles).toMatch(/body\s*{[^}]*background:\s*var\(--app-bg,\s*var\(--bg\)\)/s);
    expect(legacyStyles).toMatch(/#main\s*{[^}]*background:\s*var\(--app-bg,\s*var\(--bg\)\)/s);
  });

  it('uses surface and shadow instead of full card outlines for routine panels', () => {
    const tokens = read('src/css/tokens.css');
    const componentsCss = read('src/css/components.css');
    const legacyStyles = read('src/css/styles.css');

    expect(tokens).toContain('--panel-border:');
    expect(tokens).toContain('--panel-divider:');
    expect(tokens).toContain('--panel-shadow:');
    expect(legacyStyles).toMatch(/:is\(\[data-theme="grafite"\][^)]*\)\s*{[^}]*--panel-border:\s*transparent/s);

    for (const [selector, css] of [
      ['.card', legacyStyles],
      ['.stat-card', legacyStyles],
      ['.card-muted', componentsCss]
    ]) {
      const block = extractCssBlock(css, selector);
      expect(block, `${selector} should not draw a visible full outline`).toContain('border: 1px solid var(--panel-border)');
      expect(block, `${selector} should separate from the canvas with elevation`).toContain('box-shadow: var(--panel-shadow)');
    }

    expect(extractCssBlock(legacyStyles, '.card-header')).toContain('border-bottom: 1px solid var(--panel-divider)');
  });

  it('lets the home consistency panel grow instead of clipping its heatmap', () => {
    const legacyStyles = read('src/css/styles.css');
    const streakPanelBlock = extractCssBlock(legacyStyles, '.dash-streak-panel');

    expect(streakPanelBlock).toContain('height: auto');
    expect(streakPanelBlock).toContain('overflow: visible');
  });

  it('keeps browser cache busting aligned with the current app version', () => {
    const html = read('src/index.html');
    const serviceWorker = read('src/sw.js');
    const syncDiagnostic = read('src/js/sync/sync-diagnostic.js');
    const appSources = [
      'src/index.html',
      'src/sw.js',
      ...[
        'src/js/app.js',
        'src/js/main.js',
        'src/js/components.js',
        'src/js/views.js'
      ]
    ].map((file) => read(file)).join('\n');

    expect(html).toContain('css/styles.css?v=9.13');
    expect(serviceWorker).toContain("APP_VERSION = '9.13'");
    expect(syncDiagnostic).toContain("DIAGNOSTIC_BUILD_VERSION = '9.13'");
    expect(appSources).not.toMatch(/v=8\.(?:[3-5](?!\d))|APP_VERSION = '8\.(?:[3-5](?!\d))'/);
  });

  it('lets the revisions configuration panel grow instead of clipping controls', () => {
    const styles = read('src/css/styles.css');
    const panelBlock = extractCssBlock(styles, '.rev-control-panel.card');
    const editorBlock = extractCssBlock(styles, '.rev-frequency-editor .form-control');

    expect(panelBlock).toContain('height: auto');
    expect(panelBlock).toContain('min-height: max-content');
    expect(panelBlock).toContain('overflow: visible');
    expect(editorBlock).toContain('width: auto');
    expect(editorBlock).toContain('flex: 1 1 0');
  });

  it('moves repeated home dashboard stat-card layout into a view class', () => {
    const homeView = read('src/js/views/home-view.js');
    const viewsCss = read('src/css/views.css');

    expect(homeView).toContain('dashboard-stat-card');
    expect(homeView).not.toContain('style="flex:1;display:flex;justify-content:space-between;align-items:flex-end;"');
    expect(viewsCss).toContain('.dashboard-stat-card');
  });

  it('moves repeated home dashboard stat typography into view classes', () => {
    const homeView = read('src/js/views/home-view.js');
    const viewsCss = read('src/css/views.css');

    expect(homeView).toContain('dashboard-stat-value');
    expect(homeView).toContain('dashboard-stat-detail-list');
    expect(homeView).not.toContain('font-size:24px;font-weight:800;color:var(--text-primary);line-height:1');
    expect(homeView).not.toContain('font-size:12px;color:var(--green);font-weight:600;');
    expect(viewsCss).toContain('.dashboard-stat-value');
    expect(viewsCss).toContain('.dashboard-stat-detail-list');
  });

  it('keeps empty states stacked so text and actions do not overlap', () => {
    const componentsCss = read('src/css/components.css');
    const legacyStyles = read('src/css/styles.css');
    const combinedCss = `${componentsCss}\n${legacyStyles}`;

    expect(combinedCss).toMatch(/\.empty-state\s*{[^}]*flex-direction:\s*column/s);
    expect(combinedCss).toMatch(/\.empty-state\s*{[^}]*gap:\s*var\(--space-3\)/s);
    expect(combinedCss).toMatch(/\.empty-state\s+\.btn\s*{[^}]*align-self:\s*center/s);
  });

  it('keeps ciclo prediction panel stretched with the study sequence column', () => {
    const viewsCss = read('src/css/views.css');
    const layoutBlock = extractCssBlock(viewsCss, '.ciclo-layout');
    const sidePanelBlock = extractCssBlock(viewsCss, '.ciclo-side-panel');
    const predictBlock = extractCssBlock(viewsCss, '.ciclo-predict-box');

    expect(layoutBlock).toContain('minmax(0, 58fr) minmax(360px, 42fr)');
    expect(layoutBlock).toContain('gap: 40px');
    expect(layoutBlock).toContain('align-items: stretch');
    expect(sidePanelBlock).toContain('height: 100%');
    expect(predictBlock).toContain('width: 100%');
    expect(predictBlock).not.toContain('calc(100% + 32px)');
  });

  it('keeps weekly study chart from collapsing when there is no data', () => {
    const homeView = read('src/js/views/home-view.js');
    const viewsCss = read('src/css/views.css');
    const weeklyCardBlock = extractCssBlock(viewsCss, '.home-weekly-study-card');
    const weeklyChartBlock = extractCssBlock(viewsCss, '.home-weekly-study-chart');

    expect(homeView).toContain('home-weekly-study-card');
    expect(homeView).toContain('home-weekly-study-chart');
    expect(homeView).toContain('home-weekly-study-chart--empty');
    expect(weeklyCardBlock).toContain('min-height:');
    expect(weeklyChartBlock).toContain('min-height:');
  });

  it('lets long history and habit cards reveal their item details', () => {
    const viewsCss = read('src/css/views.css');
    const sessionGroupBlock = extractCssBlock(viewsCss, '.session-group-section');
    const habitHistoryBlock = extractCssBlock(viewsCss, '.habit-history-card');

    expect(sessionGroupBlock).toContain('height: auto');
    expect(sessionGroupBlock).toContain('overflow: visible');
    expect(habitHistoryBlock).toContain('height: auto');
    expect(habitHistoryBlock).toContain('overflow: visible');
  });

  it('keeps the final stylesheet from clipping dynamic history cards', () => {
    const legacyStyles = read('src/css/styles.css');
    const sessionGroupBlock = extractCssBlock(legacyStyles, '.session-group-section.card');
    const sessionScrollBlock = extractCssBlock(legacyStyles, '.session-group-section .session-scroll-container');
    const habitHistoryBlock = extractCssBlock(legacyStyles, '.habit-history-card.card');
    const habitListBlock = extractCssBlock(legacyStyles, '.habit-history-card .habit-hist-list');

    expect(sessionGroupBlock).toContain('height: auto');
    expect(sessionGroupBlock).toContain('overflow: visible');
    expect(sessionScrollBlock).toContain('max-height: none');
    expect(sessionScrollBlock).toContain('overflow: visible');
    expect(habitHistoryBlock).toContain('height: auto');
    expect(habitHistoryBlock).toContain('overflow: visible');
    expect(habitListBlock).toContain('overflow: visible');
  });

  it('keeps the final stylesheet from compressing study sequence cards', () => {
    const legacyStyles = read('src/css/styles.css');
    const sequenceScrollBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-card .scroll-area-md');
    const sequenceCardBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-card .seq-item-card');
    const staticContentBlock = extractCssBlock(legacyStyles, '.seq-item-content--static');
    const actionBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-actions');

    expect(sequenceScrollBlock).toContain('display: flex');
    expect(sequenceScrollBlock).toContain('padding-right: 12px');
    expect(sequenceCardBlock).toContain('flex: 0 0 auto');
    expect(sequenceCardBlock).toContain('min-height:');
    expect(staticContentBlock).toContain('flex-direction: column');
    expect(actionBlock).toContain('flex-wrap: wrap');
  });

  it('keeps the reta final sections on one shared anatomy', () => {
    const retaFinal = read('src/css/views/reta-final.css');
    const cicloView = read('src/css/views/ciclo.css');
    const legacyStyles = read('src/css/styles.css');

    // Anatomia compartilhada: header/corpo com o mesmo respiro nas 3 seções
    expect(extractCssBlock(retaFinal, '.rf-section-header')).toContain('padding: 16px 16px 12px');
    expect(extractCssBlock(retaFinal, '.rf-section-body')).toContain('padding: 0 16px 16px');
    // Filtros alinhados: 16px à esquerda (título) e 12px à direita (borda dos cards,
    // que segue o padding-right/calha de scrollbar do scroll-area)
    expect(extractCssBlock(retaFinal, '.rf-filtros')).toContain('padding: 0 12px 0 16px');
    // Sem espaçamentos duplicados (gap do contêiner já espaça) e sem regra órfã
    expect(retaFinal).not.toMatch(/\.rf-day-group\s*\{/);
    expect(extractCssBlock(retaFinal, '.rf-foco-card')).not.toContain('margin-bottom');
    // Um único bloco canônico para o scroll-area do cronograma (styles.css);
    // o ajuste da reta final usa classe modificadora, não o id de JS
    expect(cicloView).not.toContain('.ciclo-sequence-card .scroll-area-md');
    expect(retaFinal).not.toContain('#rf-dias-lista');
    expect(retaFinal).toContain('.scroll-area-md.rf-dias-lista');
    const scrollBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-card .scroll-area-md');
    expect(scrollBlock).toContain('padding: 16px');
    expect(scrollBlock).toContain('padding-right: 12px');
    // Receita de título de seção definida uma única vez (grupo em ciclo.css)
    expect(cicloView).toMatch(
      /\.ciclo-sequence-title,\s*\.ciclo-predict-title,\s*\.rf-section-title\s*\{/
    );
    expect(retaFinal).not.toMatch(/\.rf-section-title\s*\{/);
  });

  it('keeps ciclo card actions quiet on desktop and reachable on touch layouts', () => {
    const legacyStyles = read('src/css/styles.css');
    const hoverActionBlock = extractCssBlock(legacyStyles, '.seq-item-card--static:hover .ciclo-sequence-actions,\n.seq-item-card--static:focus-within .ciclo-sequence-actions');

    expect(legacyStyles).toContain('.seq-item-card--static:hover .ciclo-sequence-actions');
    expect(legacyStyles).toContain('.seq-item-card--static:focus-within .ciclo-sequence-actions');
    expect(legacyStyles).toMatch(/\.ciclo-sequence-actions\s*{[\s\S]*max-height:\s*0/);
    expect(legacyStyles).toMatch(/\.ciclo-sequence-actions\s*{[\s\S]*overflow:\s*hidden/);
    expect(hoverActionBlock).toContain('max-height:');
    expect(legacyStyles).toContain('@media (hover: none), (max-width: 768px)');
    expect(legacyStyles).toMatch(/@media \(hover: none\), \(max-width: 768px\)[\s\S]*\.ciclo-sequence-actions\s*{[\s\S]*opacity:\s*1/);
    expect(legacyStyles).toMatch(/@media \(hover: none\), \(max-width: 768px\)[\s\S]*\.ciclo-sequence-actions\s*{[\s\S]*max-height:\s*none/);
  });

  it('keeps the prediction date summary readable instead of truncating first', () => {
    const viewsCss = read('src/css/views.css');
    const summaryBlock = extractCssBlock(viewsCss, '.ciclo-predict-summary');
    const summarySpanBlock = extractCssBlock(viewsCss, '.ciclo-predict-summary span');
    const dateBlock = extractCssBlock(viewsCss, '.ciclo-predict-summary-date');

    expect(summaryBlock).toContain('grid-template-columns: minmax(0, 0.9fr) minmax(0, 0.8fr) minmax(160px, 1.4fr)');
    expect(summarySpanBlock).not.toContain('white-space: nowrap');
    expect(dateBlock).toContain('text-align: right');
  });

  it('keeps sequence edit cards flexible and evenly spaced', () => {
    const cicloView = read('src/js/views/ciclo-view.js');
    const legacyStyles = read('src/css/styles.css');
    const sequenceScrollBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-card .scroll-area-md');
    const sequenceCardBlock = extractCssBlock(legacyStyles, '.ciclo-sequence-card .seq-item-card');
    const editingContentBlock = extractCssBlock(legacyStyles, '.seq-item-card--editing .seq-item-content');
    const editingWideFieldBlock = extractCssBlock(legacyStyles, '.seq-item-card--editing .seq-item-field--wide');

    expect(cicloView).toContain('seq-item-card--editing');
    expect(cicloView).toContain('seq-item-card--static');
    expect(sequenceScrollBlock).toContain('display: flex');
    expect(sequenceScrollBlock).toContain('gap: 12px');
    expect(sequenceCardBlock).toContain('margin-bottom: 0');
    expect(editingContentBlock).toContain('display: grid');
    expect(editingContentBlock).toContain('grid-template-columns:');
    expect(editingContentBlock).toContain('align-items: center');
    expect(editingWideFieldBlock).toContain('min-width: 0');
  });

  it('keeps session history as stacked rectangular discipline rows', () => {
    const views = read('src/js/views.js');
    const historicoView = read('src/js/views/historico-view.js');
    const legacyStyles = read('src/css/styles.css');
    const historyListBlock = extractCssBlock(legacyStyles, '.session-group-section .session-group-list');
    const discCardBlock = extractCssBlock(legacyStyles, '.session-group-section .session-disc-card');
    const discTitleBlock = extractCssBlock(legacyStyles, '.session-group-section .session-disc-title');
    const detailRowBlock = extractCssBlock(legacyStyles, '.session-group-section .session-detail-row');
    const detailContentBlock = extractCssBlock(legacyStyles, '.session-group-section .session-detail-content');
    const detailTitleBlock = extractCssBlock(legacyStyles, '.session-group-section .session-detail-title');

    expect(historicoView).toContain('session-group-list');
    expect(historyListBlock).toContain('display: flex');
    expect(historyListBlock).toContain('flex-direction: column');
    expect(discCardBlock).toContain('display: grid');
    expect(discCardBlock).toContain('grid-template-columns:');
    expect(discTitleBlock).toContain('overflow-wrap: anywhere');
    expect(detailRowBlock).toContain('flex-wrap: wrap');
    expect(detailContentBlock).toContain('flex: 1 1');
    expect(detailTitleBlock).toContain('white-space: normal');
    expect(detailTitleBlock).toContain('overflow: visible');
  });

  it('keeps final stylesheet from clipping session history summary', () => {
    const legacyStyles = read('src/css/styles.css');
    const summaryBlock = extractCssBlock(legacyStyles, '.session-history-summary.card');
    const summaryHintBlock = extractCssBlock(legacyStyles, '.session-history-summary .session-history-hint');

    expect(summaryBlock).toContain('height: auto');
    expect(summaryBlock).toContain('overflow: visible');
    expect(summaryHintBlock).toContain('display: block');
  });

  it('keeps calendar event chips constrained inside day cells', () => {
    const legacyStyles = read('src/css/styles.css');
    const eventChipBlock = extractCssBlock(legacyStyles, '.cal-event-chip');
    const buttonChipBlock = extractCssBlock(legacyStyles, 'button.cal-event-chip');

    expect(eventChipBlock).toContain('width: 100%');
    expect(eventChipBlock).toContain('box-sizing: border-box');
    expect(buttonChipBlock).not.toContain('font: inherit');
    expect(buttonChipBlock).toContain('font-size: 10.5px');
    expect(buttonChipBlock).toContain('line-height: 1.25');
  });

  it('keeps phase 4 mobile a11y layout contracts for topbar and calendar chips', () => {
    const legacyStyles = read('src/css/styles.css');
    const mobileTitleBlock = extractCssBlock(legacyStyles, '.cal-mobile-events .cal-event-title');

    expect(legacyStyles).toContain('@media (max-width: 480px)');
    expect(legacyStyles).toContain('.topbar-right');
    expect(legacyStyles).toContain('.sync-pill-wrapper');
    expect(legacyStyles).toContain('.topbar-theme-btn');
    expect(mobileTitleBlock).toContain('white-space: normal');
    expect(mobileTitleBlock).toContain('overflow: visible');
  });

  it('keeps phase 5 shipped UI progress motion off layout width and height', () => {
    const files = [
      'src/css/styles.css',
      'src/css/views.css',
      'src/css/views/dashboard.css',
      'src/css/components/sidebar.css',
      'src/css/components/status-feedback.css',
      'src/js/views/dashboard-view.js',
      'src/js/views/editais-view.js',
      'src/js/views/home-view.js',
      'src/js/views/med-view.js'
    ];

    const offenders = [];
    for (const file of files) {
      const content = readFileSync(join(rootDir, file), 'utf8').replace(/\r\n/g, '\n');
      for (const match of content.matchAll(/transition\s*:\s*[^;"']*(?<![-\w])(?:width|height)\b[^;"']*/gi)) {
        const line = content.slice(0, match.index).split('\n').length;
        offenders.push(`${file}:${line}: ${match[0].trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps phase 6 modal backdrop and desktop calendar density contracts', () => {
    const modalCss = read('src/css/components/modals-shared.css');
    const styles = readFileSync(join(rootDir, 'src/css/styles.css'), 'utf8').replace(/\r\n/g, '\n');
    const themeCss = read('src/css/base/themes.css');
    const modalOverlayBlock = extractCssBlock(modalCss, '.modal-overlay');
    const calCellBlock = extractCssBlock(styles, '.cal-cell');
    const rowsSixBlock = extractCssBlock(styles, '.cal-grid.rows-6 .cal-cell');

    expect(themeCss).toContain('--modal-backdrop: rgba(0, 0, 0, 0.68)');
    expect(modalOverlayBlock).toContain('background: var(--modal-backdrop)');
    expect(modalOverlayBlock).toContain('backdrop-filter: none');
    expect(calCellBlock).toContain('min-height: 82px');
    expect(calCellBlock).toContain('padding: 5px');
    expect(rowsSixBlock).toContain('calc((100vh - 280px) / 6)');
    expect(rowsSixBlock).toContain('72px');
  });

  it('documents phase 5 side-stripe exceptions and removes decorative accent stripes', () => {
    const design = read('DESIGN.md');
    const subjectManagerCss = read('src/css/views/subject-manager.css');
    const eventCss = read('src/css/styles.css');
    const dashboardCss = read('src/css/views/dashboard.css');
    const calendarView = read('src/js/views/calendar-view.js');

    expect(design).toContain('status ou categoria');
    expect(design).toContain('faixa lateral decorativa');
    expect(design).toContain('proibida');
    expect(subjectManagerCss).not.toContain('border-left: 4px solid var(--accent)');
    expect(eventCss).toContain('--session-disc-color');
    expect(dashboardCss).toContain('--predictive-status-color');
    expect(calendarView).toContain('border-left:3px solid');
  });

  it('prevents broad transitions and hidden focus outlines from returning', () => {
    const files = [
      'src/css/styles.css',
      'src/css/components.css',
      'src/css/views.css',
      'src/js/components.js',
      'src/js/planejamento-wizard.js'
    ];

    for (const file of files) {
      const content = read(file);
      expect(content, `${file} should not use transition: all`).not.toMatch(/transition\s*:\s*all\b/);
      expect(content, `${file} should not hide outlines`).not.toMatch(/outline\s*:\s*none\b/);
    }
  });

  it('keeps migrated index shell styles in CSS classes', () => {
    const html = read('src/index.html');
    const styles = `${read('src/css/styles.css')}\n${read('src/css/views.css')}`;
    const inlineStyleCount = (html.match(/\sstyle="/g) || []).length;

    expect(inlineStyleCount).toBeLessThanOrEqual(37);
    expect(html).toContain('topbar-timer-btn');
    expect(html).toContain('topbar-search');
    expect(html).toContain('modal-confirm-footer');
    expect(html).toContain('drive-cloud-icon');
    expect(html).not.toContain('style="order:-1;margin-right:8px;"');
    expect(html).not.toContain('style="max-width:380px;"');
    expect(styles).toContain('.topbar-timer-btn');
    expect(styles).toContain('.modal-confirm-footer');
    expect(styles).toContain('.nav-item .badge.badge-crono');
  });

  it('mantém o cabeçalho de resumo do Study Organizer rolando com o conteúdo (não-fixo)', () => {
    // A barra de resumo já foi position:sticky e sobrepunha os cards que rolavam
    // por baixo dentro do main-content-stack. Garante que continue como bloco normal.
    const viewsCss = read('src/css/views.css');
    const block = extractCssBlock(viewsCss, '.med-sticky-header');

    expect(block).not.toContain('position: sticky');
    expect(block).not.toContain('position: fixed');
  });
});

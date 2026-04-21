import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const srcDir = join(rootDir, 'src');
const cssDir = join(srcDir, 'css');

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
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

  it('keeps design tokens in css/tokens.css', () => {
    for (const filename of ['tokens.css', 'base.css', 'components.css', 'views.css']) {
      expect(existsSync(join(cssDir, filename))).toBe(true);
    }

    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');

    expect(tokens).toContain('--space-1:');
    expect(tokens).toContain('--radius-sm:');
    expect(tokens).toContain('--shadow-sm:');
    expect(legacyStyles).not.toMatch(/^:root\s*{/m);
  });

  it('keeps the dark premium theme contracts', () => {
    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');
    const rootVars = extractCssVars(extractCssBlock(tokens, ':root'));
    const grafiteVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="grafite"]'));
    const obsidianaVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="obsidiana"]'));
    const contrasteVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="contraste"]'));

    expect(rootVars).toMatchObject({
      '--bg': '#08090d',
      '--card': '#121821',
      '--surface': '#0d1117',
      '--border': 'rgba(148, 163, 184, 0.14)',
      '--text-primary': '#f3f6fb',
      '--text-secondary': '#b8c0cc',
      '--text-muted': '#7f8a99',
      '--accent': '#8aa4bf',
      '--accent-hover': '#a7bdd3',
      '--accent-light': 'rgba(138, 164, 191, 0.16)',
      '--accent-text': '#071018'
    });

    expect(grafiteVars['--bg']).toBe('#08090d');
    expect(obsidianaVars['--bg']).toBe('#030405');
    expect(contrasteVars['--text-primary']).toBe('#ffffff');
    expect(contrastRatio(rootVars['--accent-text'], rootVars['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rootVars['--text-secondary'], rootVars['--card'])).toBeGreaterThanOrEqual(4.5);
    expect(legacyStyles).toMatch(/\.btn-primary:hover\s*{[^}]*background:\s*var\(--accent-hover\)/s);
  });

  it('presents only the premium dark themes while keeping old theme names internal', () => {
    const html = read('src/index.html');
    const appSource = read('src/js/app.js');
    const viewsSource = read('src/js/views.js');

    expect(html).toContain('title="Trocar tema"');
    expect(appSource).toContain("label: 'Grafite'");
    expect(appSource).toContain("label: 'Obsidiana'");
    expect(appSource).toContain("label: 'Contraste'");
    expect(appSource).toContain('LEGACY_THEME_ALIASES');
    expect(viewsSource).toContain('THEME_OPTIONS');
    expect(`${appSource}\n${viewsSource}`).not.toMatch(/label:\s*'(Neutro|Noite|Furtivo|Abismo|Matrix|Rubi|Cyberpunk 2077)'/);
    expect(`${html}\n${appSource}\n${viewsSource}`).not.toMatch(/Modo escuro|Modo claro|Claro profissional|Escuro profissional|Extra:/);
  });

  it('keeps every visible premium theme from inheriting the root app background', () => {
    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');
    const rootVars = getThemeVars(tokens, ':root');
    const themedSelectors = [
      '[data-theme="grafite"]',
      '[data-theme="obsidiana"]',
      '[data-theme="contraste"]'
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

    expect(html).toContain('css/styles.css?v=8.12');
    expect(serviceWorker).toContain("APP_VERSION = '8.12'");
    expect(appSources).not.toMatch(/v=8\.[345]|APP_VERSION = '8\.[345]'/);
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
});

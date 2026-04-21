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

  it('keeps the professional clean light and dark theme contract', () => {
    const tokens = read('src/css/tokens.css');
    const legacyStyles = read('src/css/styles.css');
    const lightVars = extractCssVars(extractCssBlock(tokens, ':root'));
    const darkVars = extractCssVars(extractCssBlock(legacyStyles, '[data-theme="dark"]'));

    expect(lightVars).toMatchObject({
      '--bg': '#f6f8fb',
      '--card': '#ffffff',
      '--surface': '#eef3f8',
      '--border': '#d8e0ea',
      '--text-primary': '#111827',
      '--text-secondary': '#475569',
      '--text-muted': '#64748b',
      '--accent': '#0f766e',
      '--accent-hover': '#115e59',
      '--accent-light': '#ccfbf1',
      '--accent-text': '#ffffff'
    });

    expect(darkVars).toMatchObject({
      '--bg': '#0b1220',
      '--card': '#111827',
      '--surface': '#172033',
      '--border': '#253247',
      '--text-primary': '#e5edf7',
      '--text-secondary': '#a8b3c7',
      '--text-muted': '#7d8aa3',
      '--accent': '#2dd4bf',
      '--accent-hover': '#5eead4',
      '--accent-light': '#134e4a',
      '--accent-text': '#042f2e'
    });

    expect(contrastRatio(lightVars['--accent-text'], lightVars['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkVars['--accent-text'], darkVars['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(legacyStyles).toMatch(/\.btn-primary:hover\s*{[^}]*background:\s*var\(--accent-hover\)/s);
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

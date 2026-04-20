import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const srcDir = join(rootDir, 'src');
const cssDir = join(srcDir, 'css');

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
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

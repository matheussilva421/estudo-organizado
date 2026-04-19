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
});

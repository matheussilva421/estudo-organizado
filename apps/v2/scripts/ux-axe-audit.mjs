import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = 'https://estudo-organizado-v2-f7-test.matheussilva421.workers.dev';
const axeSource = await readFile('node_modules/axe-core/axe.min.js', 'utf8');
const outputPath = process.argv[2];
if (!outputPath) throw new Error('output path required');

const routes = ['home', 'content', 'planning', 'sessions', 'reviews', 'analytics', 'attention', 'settings'];
const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma', 'neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial'];
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const results = [];
const browser = await chromium.launch({ headless: true });

async function scan(page, route, viewport, theme) {
  await page.goto(base + '/#/' + route, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.evaluate(axeSource);
  const payload = await page.evaluate(async () => {
    if (typeof axe === 'undefined') throw new Error('axe unavailable');
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return {
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact ?? null,
        help: violation.help,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
      })),
      incomplete: result.incomplete.length,
    };
  });
  results.push({ route, viewport, theme, ...payload });
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    for (const route of routes) await scan(page, route, viewport.name, 'grafite');
    await context.close();
  }
  const themeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const themePage = await themeContext.newPage();
  for (const theme of themes) {
    await themePage.addInitScript((value) => localStorage.setItem('estudo-organizado:v2:theme', value), theme);
    await scan(themePage, 'home', 'desktop', theme);
  }
  await themeContext.close();
} finally {
  await browser.close();
}

const summary = {
  checkedAt: new Date().toISOString(),
  base,
  scans: results.length,
  routes,
  themes,
  viewports: viewports.map((entry) => entry.name),
  totalViolations: results.reduce((sum, entry) => sum + entry.violations.length, 0),
  results,
};
await writeFile(outputPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ scans: summary.scans, totalViolations: summary.totalViolations }));

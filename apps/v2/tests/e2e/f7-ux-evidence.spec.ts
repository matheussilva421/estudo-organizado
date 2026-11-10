import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 720 },
] as const;

test('f7 ux sanitized visual evidence', async ({ page }) => {
  const out = process.env.F7_UX_EVIDENCE_DIR;
  test.skip(!out, 'F7_UX_EVIDENCE_DIR must point to the F7-UX evidence directory');
  await mkdir(resolve(out!, 'themes'), { recursive: true });
  await mkdir(resolve(out!, 'modules'), { recursive: true });
  await resetF7Ux(page);
  await seedAcademicData(page);

  const moduleShots = [
    ['home', '/#/home', 'f6-home'],
    ['content', '/#/content/f7ux-edital?focus=f7ux-assunto', 'f7-content-workspace'],
    ['planning', '/#/planning', 'f7-planning-workspace'],
    ['sessions', '/#/sessions', 'f7-sessions-workspace'],
    ['reviews', '/#/reviews', 'f7-reviews-workspace'],
    ['attention', '/#/attention', 'f6-attention'],
    ['analytics', '/#/analytics', 'f6-analytics'],
    ['settings', '/#/settings', 'f6-settings'],
  ] as const;

  for (const [name, route, anchor] of moduleShots) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await expect(page.getByTestId(anchor)).toBeVisible();
      await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      await page.screenshot({
        path: resolve(out!, 'modules', `${name}-${viewport.name}.png`),
        fullPage: false,
      });
      if (name === 'home') {
        await page.locator('.dashboard-grid').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: resolve(out!, 'modules', `home-dashboard-${viewport.name}.png`),
          fullPage: false,
        });
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      }
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/home');
  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    for (const viewport of VIEWPORTS.slice(0, 3)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByTestId('f6-home')).toBeVisible();
      await page.locator('.dashboard-grid').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: resolve(out!, 'themes', `${theme}-${viewport.name}.png`),
        fullPage: false,
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    themes: THEMES,
    viewports: VIEWPORTS,
    moduleShots: moduleShots.map(([name, route]) => ({ name, route })),
    note: 'Somente fixtures sintéticas; nenhum token, e-mail ou acervo real.',
  };
  await writeFile(resolve(out!, 'manifest.json'), JSON.stringify(manifest, null, 2));
});

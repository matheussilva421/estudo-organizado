import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const evidenceDir = resolve(
  process.cwd(),
  '..',
  '..',
  'docs',
  'superpowers',
  'audits',
  'evidence',
);

const cases = [
  {
    theme: 'grafite',
    width: 1280,
    height: 900,
    name: '2026-10-31-v2-f4-desktop-grafite.png',
  },
  {
    theme: 'ardosia',
    width: 834,
    height: 1112,
    name: '2026-10-31-v2-f4-tablet-ardosia.png',
  },
  {
    theme: 'plasma',
    width: 390,
    height: 844,
    name: '2026-10-31-v2-f4-mobile-plasma.png',
  },
  {
    theme: 'neon',
    width: 1280,
    height: 900,
    name: '2026-10-31-v2-f4-desktop-neon.png',
  },
];

test('f4 representative visual evidence', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.getByLabel('Tema').selectOption(item.theme);
    const workspace = page.locator('[data-testid="session-workspace"]');
    await expect(workspace).toBeVisible();
    await workspace.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(evidenceDir, item.name),
      fullPage: false,
    });
  }
});

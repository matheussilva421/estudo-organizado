import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

const themes = [
  'grafite',
  'ardosia',
  'platina',
  'terminal',
  'neon',
  'arrakis',
  'codex',
  'plasma',
];

const viewports = [
  { width: 1280, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

test('f4 workspace is reachable across eight themes and three viewports', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of themes) {
      await page.getByLabel('Tema').selectOption(theme);
      await expect(page.locator('[data-testid="session-workspace"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-start"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-manual-submit"]')).toBeEnabled();
      await expect(page.locator('[data-testid="session-plan-block"]')).toBeVisible();
    }
  }
});

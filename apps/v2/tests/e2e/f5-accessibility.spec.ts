import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
const viewports = [
  { width: 1280, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

test('f5 review workspace is reachable across eight themes and three viewports', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of themes) {
      await page.getByLabel('Tema').selectOption(theme);
      await expect(page.locator('[data-testid="review-workspace"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-policy"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-topics"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-agenda"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar tópico de revisão' })).toBeVisible();
    }
  }
});

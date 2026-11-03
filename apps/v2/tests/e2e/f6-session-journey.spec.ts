import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function reset(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 active F4 session survives navigation theme viewport and reload', async ({ page }) => {
  await reset(page);
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-timer')).toContainText('RUNNING');

  await page.getByLabel('Tema').selectOption('neon');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('session-timer')).toContainText('RUNNING');

  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(page.locator('#planning-section')).toBeVisible();
  await expect(page.locator('#sessions-section')).toBeHidden();

  await page.getByRole('link', { name: 'Sessões', exact: true }).click();
  await expect(page).toHaveURL(/#\/sessions$/);
  await expect(page.getByTestId('session-timer')).toContainText('RUNNING');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('session-timer')).toContainText('RUNNING');
  await expect(page.getByTestId('session-timer')).not.toContainText('Nenhuma sessão ativa');
});


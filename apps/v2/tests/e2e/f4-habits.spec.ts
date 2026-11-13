import { expect, test } from '@playwright/test';

test('f4 habit creation and explicit confirmation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByTestId('session-habit-create').click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('TIME');

  await page.getByRole('button', { name: 'Confirmar hoje' }).click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('TIME');

  await page.getByLabel('Duração da sessão (min)').fill('30');
  await page.locator('[data-testid="session-manual-submit"]').click();
  const history = page.locator('[data-testid="session-history"]');
  await expect(history).toContainText('MANUAL');
  const details = history.locator('details').first();
  await details.locator('summary').click();
  await expect(details).toContainText('Contexto de hábitos');
  await expect(details).toContainText('TIME');
  await expect(details).toContainText('não confirma cumprimento');
  if (process.env.F7_UXH_STATE_DIR) {
    await history.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/session-habit-context.png',
    });
  }
});

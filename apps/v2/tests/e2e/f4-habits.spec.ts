import { expect, test } from '@playwright/test';

test('f4 habit creation and explicit confirmation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByTestId('session-habit-create').click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('TIME');

  await page.getByRole('button', { name: 'Confirmar hoje' }).click();
  await expect(page.locator('[data-testid="session-habits"]')).toContainText('TIME');
});

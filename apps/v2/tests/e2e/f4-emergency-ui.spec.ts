import { expect, test } from '@playwright/test';

test('f4 emergency export and idempotent reimport', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByLabel('Duração da sessão (min)').fill('20');
  await page.getByLabel('Nota').fill('intenção emergencial');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('session-emergency-export').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByTestId('session-emergency-file').setInputFiles(path as string);
  await expect(page.getByTestId('session-emergency-preview')).toContainText('READY');
  await page.getByTestId('session-emergency-apply').click();
  await expect(page.locator('body')).toContainText('Importação emergencial aplicada');
  await expect(page.locator('[data-testid="session-history"]')).toContainText('MANUAL');
  await expect(page.locator('[data-testid="session-history"]')).toContainText('00:20:00');
  await expect(page.locator('[data-testid="session-history"] li')).toHaveCount(1);

  await page.getByTestId('session-emergency-apply').click();
  await expect(page.locator('[data-testid="session-history"] li')).toHaveCount(1);
});

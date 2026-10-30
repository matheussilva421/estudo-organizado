import { expect, test } from '@playwright/test';

test('f4 timer start pause resume complete', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-workspace"]')).toBeVisible();

  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();
  await page.locator('[data-testid="session-pause"]').click();
  await expect(page.locator('[data-testid="session-resume"]')).toBeVisible();
  await page.locator('[data-testid="session-resume"]').click();
  await page.locator('[data-testid="session-complete"]').click();
  await expect(page.locator('[data-testid="session-start"]')).toBeVisible();
});

test('f4 manual session reaches history and exports CSV', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByLabel('Minutos').fill('30');
  await page.getByLabel('Nota').fill('revisão manual');
  await page.locator('[data-testid="session-manual-submit"]').click();
  await expect(page.locator('[data-testid="session-history"]')).toContainText('MANUAL');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-testid="session-export-csv"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sessoes.csv');
});

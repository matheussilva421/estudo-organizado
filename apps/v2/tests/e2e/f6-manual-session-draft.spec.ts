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

test('f6 manual session note survives reload and clears after confirmation', async ({ page }) => {
  await reset(page);
  await page.goto('/#/sessions');
  await expect(page.getByTestId('session-manual')).toBeVisible();
  const note = page.getByLabel('Nota', { exact: true });
  await note.fill('Rascunho manual');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(note).toHaveValue('Rascunho manual');

  await page.getByTestId('session-manual-submit').click();
  await expect(note).toHaveValue('');
  await page.reload();
  await expect(note).toHaveValue('');
});


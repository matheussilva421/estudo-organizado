import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

test('quota_failure_keeps_form_open_and_preserves_text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E;
    await harness.resetDb();
    harness.setFault('quota');
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E.setFault('quota');
  });

  await page.getByLabel('Nova disciplina').fill('Direito Previdenciário');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByRole('alert')).toContainText('Espaço insuficiente');
  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Direito Previdenciário');

  const counts = await page.evaluate(async () => {
    const harness = (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E;
    harness.setFault(null);
    return harness.inspectCounts('local-default');
  });
  expect(counts).toEqual({ subjects: 0, outbox: 0, operations: 0 });
});


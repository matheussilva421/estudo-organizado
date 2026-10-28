import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

test('real_indexeddb_abort_rolls_back_entity_and_outbox', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const result = await page.evaluate(async () => {
    const harness = (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E;
    await harness.resetDb();
    const command = {
      operationId: 'op-browser-abort',
      profileId: 'local-default',
      subjectId: 'subject-browser-abort',
      type: 'create' as const,
      title: 'Falha transacional',
    };
    try {
      await harness.executeWithFault(command, 'abort');
      return { failed: false, counts: await harness.inspectCounts('local-default') };
    } catch {
      return { failed: true, counts: await harness.inspectCounts('local-default') };
    }
  });

  expect(result.failed).toBe(true);
  expect(result.counts).toEqual({ subjects: 0, outbox: 0, operations: 0 });
});


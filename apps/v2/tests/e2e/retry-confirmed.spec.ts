import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

test('reload_and_retry_after_confirmed_operation_do_not_duplicate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const command = {
    operationId: 'op-confirmed-reload',
    profileId: 'local-default',
    subjectId: 'subject-confirmed-reload',
    type: 'create' as const,
    title: 'Direito Constitucional',
  };

  const first = await page.evaluate(async (cmd) => {
    const harness = (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E;
    await harness.resetDb();
    const subject = await harness.execute(cmd);
    await harness.markConfirmed(cmd.profileId, [cmd.operationId], { [cmd.operationId]: 1 });
    return { subject, counts: await harness.inspectCounts(cmd.profileId) };
  }, command);

  expect(first.subject.localRevision).toBe(1);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByText('Direito Constitucional', { exact: true })).toBeVisible();

  const retry = await page.evaluate(async (cmd) => {
    const harness = (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E;
    const subject = await harness.execute(cmd);
    return { subject, list: await harness.list(cmd.profileId), counts: await harness.inspectCounts(cmd.profileId) };
  }, command);

  expect(retry.list).toHaveLength(1);
  expect(retry.subject.localRevision).toBe(1);
  expect(retry.counts).toEqual({ subjects: 1, outbox: 1, operations: 1 });
});


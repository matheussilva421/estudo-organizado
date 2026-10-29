import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const scenario = {
  id: 'scenario-redistribute',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH' as const,
  name: 'Redistribuição',
  status: 'DRAFT' as const,
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-06-30',
  referenceZone: 'America/Fortaleza',
};

test('unallocated_blocks_are_redistributed_only_after_preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-redistribute-scenario' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-redistribute-blocks' },
      scenarioId: seed.id,
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'pending-1',
            profileId: 'local-default',
            editalId: 'edital-tjpb',
            scenarioId: seed.id,
            editalDisciplineId: 'link-1',
            plannedMinutes: 60,
            allocation: 'UNALLOCATED',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'op-redistribute-blocks',
            label: 'Pendente',
            reason: 'NO_CAPACITY_IN_HORIZON',
          },
        ],
      },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.locator('[data-action="preview-redistribution"]').click();
  await expect(page.locator('[data-testid="redistribution-preview"]')).toContainText(
    '1 bloco(s) podem ser alocados',
  );

  const before = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningListBlocks(
      'local-default',
      'scenario-redistribute',
    ),
  );
  expect(before[0]?.allocation).toBe('UNALLOCATED');

  await page.locator('[data-action="apply-redistribution"]').click();
  await expect(page.locator('.inline-notice')).toContainText('Redistribuição aplicada');

  const after = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningListBlocks(
      'local-default',
      'scenario-redistribute',
    ),
  );
  expect(after[0]?.allocation).toBe('PROJECTED');
  expect(after[0]?.civilDate).toBeTruthy();
});

import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const scenario = {
  id: 'scenario-load',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH' as const,
  name: 'Carga 180',
  status: 'DRAFT' as const,
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-06-30',
  referenceZone: 'America/Fortaleza',
};

test('one_hundred_and_eighty_blocks_stay_navigable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const measurement = await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-load-scenario' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
    const blocks = Array.from({ length: 180 }, (_, index) => ({
      id: `block-${index}`,
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      scenarioId: seed.id,
      editalDisciplineId: 'link-1',
      plannedMinutes: 45,
      allocation: 'PROJECTED' as const,
      civilDate: new Date(Date.UTC(2027, 0, 4 + index)).toISOString().slice(0, 10),
      priority: 1,
      localRevision: 1,
      sourceOperationId: 'op-load-blocks',
      label: `Conteúdo ${index}`,
    }));
    const started = performance.now();
    const commit = await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-load-blocks' },
      scenarioId: seed.id,
      baseRevision: 1,
      changes: { upsertBlocks: blocks },
    });
    const commitMs = performance.now() - started;
    const stored = await harness.planningListBlocks('local-default', seed.id);
    return { kind: commit.kind, commitMs, stored: stored.length };
  }, scenario);

  expect(measurement.kind).toBe('LOCAL_COMMITTED');
  expect(measurement.stored).toBe(180);
  // Measured locally: 180 blocks must not degrade into a timeout.
  expect(measurement.commitMs).toBeLessThan(10_000);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-action="calendar-month"]').click();
  await expect(page.locator('[data-testid="planning-calendar"] [data-days]')).toContainText(
    'Conteúdo',
  );
});

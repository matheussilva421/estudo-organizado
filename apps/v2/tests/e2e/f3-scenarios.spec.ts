import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import type { PlanningScenario } from '../../src/domain/planning';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

function scenario(id: string, editalId: string, name: string): PlanningScenario {
  return {
    id,
    profileId,
    editalId,
    kind: 'FINAL_STRETCH',
    name,
    status: 'DRAFT',
    localRevision: 1,
    schemaVersion: 1,
    priorityProfileId: 'priority-default',
    priorityProfileRevision: 1,
    examDate: '2027-01-24',
    referenceZone: 'America/Fortaleza',
  };
}

test('scenarios_survive_reload_and_activation_requires_a_checkpoint', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const created = await page.evaluate(
    async ({ first, second }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const a = await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-scenario-a' },
        scenarioId: first.id,
        baseRevision: null,
        changes: { scenario: first },
      });
      const b = await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-scenario-b' },
        scenarioId: second.id,
        baseRevision: null,
        changes: { scenario: second },
      });
      return { a: a.kind, b: b.kind };
    },
    { first: scenario('scenario-a', 'edital-tjpb', 'A'), second: scenario('scenario-b', 'edital-tjpb', 'B') },
  );
  expect(created).toEqual({ a: 'LOCAL_COMMITTED', b: 'LOCAL_COMMITTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const listed = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningList('local-default', 'edital-tjpb'),
  );
  expect(listed.map((item) => item.id).sort()).toEqual(['scenario-a', 'scenario-b']);
  expect(listed.every((item) => item.status === 'DRAFT')).toBe(true);

  const blocked = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningActivate({
      profileId: 'local-default',
      operationId: 'op-activate-without-checkpoint',
      editalId: 'edital-tjpb',
      scenarioId: 'scenario-b',
    }),
  );
  expect(blocked).toEqual({ kind: 'BLOCKED', reason: 'CHECKPOINT_REQUIRED' });

  const afterBlocked = await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return {
      list: await harness.planningList('local-default', 'edital-tjpb'),
      counts: await harness.planningCounts('local-default'),
    };
  });
  expect(afterBlocked.list.every((item) => item.status === 'DRAFT')).toBe(true);
  expect(afterBlocked.counts.scenarios).toBe(2);
  expect(afterBlocked.counts.checkpoints).toBe(0);
});

test('another_edital_activates_without_touching_tjpb', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const result = await page.evaluate(
    async ({ tjpb, dpe }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-tjpb' },
        scenarioId: tjpb.id,
        baseRevision: null,
        changes: { scenario: tjpb },
      });
      await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-dpe' },
        scenarioId: dpe.id,
        baseRevision: null,
        changes: { scenario: dpe },
      });
      const activated = await harness.planningActivate({
        profileId: 'local-default',
        operationId: 'op-activate-dpe',
        editalId: 'edital-dpe',
        scenarioId: dpe.id,
        checkpointId: 'checkpoint-dpe',
      });
      return {
        activated: activated.kind,
        tjpb: await harness.planningList('local-default', 'edital-tjpb'),
        dpe: await harness.planningList('local-default', 'edital-dpe'),
      };
    },
    {
      tjpb: scenario('scenario-a', 'edital-tjpb', 'A'),
      dpe: scenario('scenario-dpe', 'edital-dpe', 'DPE'),
    },
  );

  expect(result.activated).toBe('LOCAL_COMMITTED');
  expect(result.tjpb[0]?.status).toBe('DRAFT');
  expect(result.dpe[0]?.status).toBe('ACTIVE');
});

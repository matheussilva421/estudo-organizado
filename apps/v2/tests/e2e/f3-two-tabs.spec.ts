import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

const scenario: PlanningScenario = {
  id: 'scenario-tjpb',
  profileId,
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

function block(id: string, extra: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id,
    profileId,
    editalId: 'edital-tjpb',
    scenarioId: scenario.id,
    editalDisciplineId: 'link-1',
    plannedMinutes: 60,
    allocation: 'PROJECTED',
    civilDate: '2027-01-05',
    priority: 1,
    localRevision: 1,
    sourceOperationId: 'op-1',
    ...extra,
  };
}

test('two_tabs_apply_drafts_with_cas_inside_the_transaction', async ({ context }) => {
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  for (const page of [pageA, pageB]) {
    await page.goto('/');
    await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  }

  await pageA.evaluate(
    async ({ seed }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      await harness.resetDb();
      await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-scenario' },
        scenarioId: seed.id,
        baseRevision: null,
        changes: { scenario: seed },
      });
      await harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-blocks' },
        scenarioId: seed.id,
        baseRevision: 1,
        changes: {
          upsertBlocks: [
            {
              id: 'a',
              profileId: 'local-default',
              editalId: 'edital-tjpb',
              scenarioId: seed.id,
              editalDisciplineId: 'link-1',
              plannedMinutes: 60,
              allocation: 'PROJECTED',
              civilDate: '2027-01-05',
              priority: 1,
              localRevision: 1,
              sourceOperationId: 'op-blocks',
            },
          ],
        },
      });
    },
    { seed: scenario },
  );

  await pageB.reload();
  await expect(pageB.locator('[data-db-ready="true"]')).toBeVisible();

  const savedDraft = await pageB.evaluate(
    async ({ seed }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      return harness.planningSaveDraft({
        id: 'draft-b',
        profileId: 'local-default',
        scenarioId: seed.id,
        baseRevision: 2,
        changes: [{ blockId: 'a', field: 'plannedMinutes', value: 120, baseValue: 60 }],
        lastSavedAt: '2026-10-29T00:00:00.000Z',
      });
    },
    { seed: scenario },
  );
  expect(savedDraft.kind).toBe('LOCAL_COMMITTED');

  // Tab A commits first and moves the scenario revision forward.
  const firstApply = await pageA.evaluate(
    async ({ seed }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      return harness.planningCommit({
        scope: { profileId: 'local-default', operationId: 'op-tab-a' },
        scenarioId: seed.id,
        baseRevision: 2,
        changes: {
          upsertBlocks: [
            {
              id: 'a',
              profileId: 'local-default',
              editalId: 'edital-tjpb',
              scenarioId: seed.id,
              editalDisciplineId: 'link-1',
              plannedMinutes: 90,
              allocation: 'PROJECTED',
              civilDate: '2027-01-05',
              priority: 1,
              localRevision: 1,
              sourceOperationId: 'op-tab-a',
            },
          ],
        },
      });
    },
    { seed: scenario },
  );
  expect(firstApply.kind).toBe('LOCAL_COMMITTED');

  // Tab B still holds the stale draft: it must conflict, keep the draft and
  // never overwrite the revision written by tab A.
  const stale = await pageB.evaluate(
    async ({ seed }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      const draft = await harness.planningLoadDraft('local-default', seed.id);
      if (!draft) return { kind: 'MISSING_DRAFT' };
      return harness.planningApplyDraft('local-default', seed.id, draft);
    },
    { seed: scenario },
  );
  expect(stale.kind).toBe('CONFLICT');

  const finalState = await pageB.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return {
      scenario: await harness.planningLoad('local-default', 'scenario-tjpb'),
      draft: await harness.planningLoadDraft('local-default', 'scenario-tjpb'),
    };
  });
  expect(finalState.scenario?.scenario.localRevision).toBe(3);
  expect(finalState.scenario?.blocks.find((item) => item.id === 'a')?.plannedMinutes).toBe(90);
  expect(finalState.draft?.changes).toHaveLength(1);
});

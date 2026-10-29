import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const scenario = {
  id: 'scenario-rf',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH' as const,
  name: 'Reta Final',
  status: 'DRAFT' as const,
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

test('quota_and_abort_never_leave_a_partial_plan', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const result = await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-scenario' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
    await harness.planningSaveDraft({
      id: 'draft-1',
      profileId: 'local-default',
      scenarioId: seed.id,
      baseRevision: 1,
      changes: [{ blockId: 'block-1', field: 'plannedMinutes', value: 90, baseValue: 60 }],
      lastSavedAt: '2026-10-29T00:00:00.000Z',
    });
    const block = {
      id: 'block-1',
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      scenarioId: seed.id,
      editalDisciplineId: 'link-1',
      plannedMinutes: 60,
      allocation: 'PROJECTED' as const,
      civilDate: '2027-01-05',
      priority: 1,
      localRevision: 1,
      sourceOperationId: 'op-q',
    };
    const quota = await harness.planningCommit(
      {
        scope: { profileId: 'local-default', operationId: 'op-quota' },
        scenarioId: seed.id,
        baseRevision: 1,
        changes: { upsertBlocks: [block] },
      },
      'quota',
    );
    const abort = await harness.planningCommit(
      {
        scope: { profileId: 'local-default', operationId: 'op-abort' },
        scenarioId: seed.id,
        baseRevision: 1,
        changes: { upsertBlocks: [block] },
      },
      'abort',
    );
    return {
      quota,
      abort,
      counts: await harness.planningCounts('local-default'),
      loaded: await harness.planningLoad('local-default', seed.id),
      draft: await harness.planningLoadDraft('local-default', seed.id),
    };
  }, scenario);

  expect(result.quota).toEqual({ kind: 'FAILED', reason: 'QUOTA' });
  expect(result.abort).toEqual({ kind: 'FAILED', reason: 'ABORT' });
  expect(result.counts.blocks).toBe(0);
  expect(result.counts.operations).toBe(1);
  expect(result.loaded?.scenario.localRevision).toBe(1);
  expect(result.draft?.changes).toHaveLength(1);
});

test('planning_ui_reports_commit_locally_without_claiming_sync', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="planning-workspace"]')).toContainText(
    'Planejamento, calendário e Reta Final',
  );
  await expect(page.locator('[data-testid="planning-workspace"]')).not.toContainText(
    'sincronizado com a nuvem',
  );
});

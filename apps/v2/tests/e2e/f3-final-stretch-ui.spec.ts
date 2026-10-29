import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import type { PlanningScenario } from '../../src/domain/planning';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const scenario: PlanningScenario = {
  id: 'scenario-rf',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final TJPB',
  status: 'ACTIVE',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

test('postponing_the_exam_date_updates_the_plan_with_a_preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-scenario' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await expect(page.locator('[data-testid="final-stretch"]')).toContainText('2027-01-24');
  await page.getByLabel('Nova data').fill('2027-02-20');
  await page.locator('[data-action="postpone-exam"]').click();
  await expect(page.locator('[data-testid="final-stretch"]')).toContainText('2027-02-20');

  const stored = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(stored?.scenario.examDate).toBe('2027-02-20');
});

test('suspending_a_final_stretch_removes_the_date_without_false_success', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-suspend-scenario' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.locator('[data-action="suspend-final-stretch"]').click();
  await expect(page.locator('[data-testid="final-stretch"]')).toContainText('SUSPENDED');

  const stored = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(stored?.scenario.status).toBe('SUSPENDED');
  expect(stored?.scenario.examDate ?? null).toBeNull();
});

test('a_cycle_can_propose_a_final_stretch_and_keeps_the_cycle', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-cycle' },
      scenarioId: 'scenario-cycle',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-cycle',
          profileId: 'local-default',
          editalId: 'edital-tjpb',
          kind: 'CYCLE',
          name: 'Ciclo TJPB',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
          cycle: {
            content: [
              { editalDisciplineId: 'link-1', assuntoId: 'assunto-1', label: 'Controle', plannedMinutes: 60 },
            ],
            cursorIndex: 0,
            round: 1,
            pendings: [],
            history: [],
          },
        },
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Data da prova', { exact: false }).fill('2027-03-15');
  await page.locator('[data-action="preview-transition"]').click();
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Reta Final · Ciclo TJPB');
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Ciclo TJPB');

  const scenarios = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningList('local-default'),
  );
  expect(scenarios.map((item) => item.kind).sort()).toEqual(['CYCLE', 'FINAL_STRETCH']);
  const cycle = scenarios.find((item) => item.kind === 'CYCLE');
  expect(cycle?.cycle?.cursorIndex).toBe(0);
});

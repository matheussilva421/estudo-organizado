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
  await expect(page.getByTestId('exam-change-preview')).toBeVisible();
  const beforeConfirm = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(beforeConfirm?.scenario.examDate).toBe('2027-01-24');
  await page.locator('[data-action="confirm-exam-change"]').click();
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
  await expect(page.getByTestId('exam-change-preview')).toBeVisible();
  await page.locator('[data-action="confirm-exam-change"]').click();
  await expect(page.locator('[data-testid="final-stretch"]')).toContainText('SUSPENDED');

  const stored = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(stored?.scenario.status).toBe('SUSPENDED');
  expect(stored?.scenario.examDate ?? null).toBeNull();
});

test('closing a final stretch requires an explicit preview and confirmation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'close-preview-seed' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByLabel('Desfecho').selectOption('OCCURRED');
  await page.locator('[data-action="close-final-stretch"]').click();
  const preview = page.getByTestId('final-stretch-close-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Nada foi gravado');
  if (process.env.F7_UXH_STATE_DIR) {
    await preview.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/final-stretch-close-preview.png',
    });
  }
  const beforeConfirm = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(beforeConfirm?.scenario.status).toBe('ACTIVE');
  await page.locator('[data-action="confirm-close-final-stretch"]').click();
  const closed = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(closed?.scenario.status).toBe('CLOSED');
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
  await expect(page.getByTestId('transition-preview')).toBeVisible();
  await page.locator('[data-action="confirm-transition"]').click();
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Reta Final · Ciclo TJPB');
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Ciclo TJPB');

  const scenarios = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningList('local-default'),
  );
  expect(scenarios.map((item) => item.kind).sort()).toEqual(['CYCLE', 'FINAL_STRETCH']);
  const cycle = scenarios.find((item) => item.kind === 'CYCLE');
  expect(cycle?.cycle?.cursorIndex).toBe(0);
});

test('an exam preview never leaks into another scenario', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-rf-a' },
      scenarioId: 'scenario-rf-a',
      baseRevision: null,
      changes: { scenario: { ...seed, id: 'scenario-rf-a', name: 'RF A' } },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-rf-b' },
      scenarioId: 'scenario-rf-b',
      baseRevision: null,
      changes: {
        scenario: {
          ...seed,
          id: 'scenario-rf-b',
          name: 'RF B',
          status: 'DRAFT',
          examDate: '2027-02-10',
        },
      },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByLabel('Nova data').fill('2027-03-01');
  await page.locator('[data-action="postpone-exam"]').click();
  await expect(page.getByTestId('exam-change-preview')).toBeVisible();

  await page.locator('[data-testid="scenario-scenario-rf-b"] [data-action="select-scenario"]').click();
  await expect(page.getByTestId('exam-change-preview')).toHaveCount(0);
  const storedB = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf-b'),
  );
  expect(storedB?.scenario.examDate).toBe('2027-02-10');
});

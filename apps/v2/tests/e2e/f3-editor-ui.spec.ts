import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import type { PlanBlock, PlanningScenario } from '../../src/domain/planning';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const scenario: PlanningScenario = {
  id: 'scenario-rf',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH',
  name: 'Reta Final TJPB',
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

const block: PlanBlock = {
  id: 'block-1',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  scenarioId: scenario.id,
  editalDisciplineId: 'link-1',
  plannedMinutes: 60,
  allocation: 'PROJECTED',
  civilDate: '2027-01-05',
  priority: 1,
  localRevision: 1,
  sourceOperationId: 'op-blocks',
  label: 'Constitucional',
};

test('draft_survives_reload_and_applies_with_confirmation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ seed, item }) => {
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
      changes: { upsertBlocks: [item] },
    });
  }, { seed: scenario, item: block });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await expect(page.locator('[data-testid="draft-state"]')).toHaveAttribute('data-changes', '0');
  await page.getByLabel('Minutos').fill('90');
  await page.locator('[data-action="save-draft"]').click();
  await expect(page.locator('[data-testid="draft-state"]')).toHaveAttribute('data-changes', '1');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="draft-state"]')).toHaveAttribute('data-changes', '1');

  await page.locator('[data-action="apply-draft"]').click();
  await expect(page.locator('.inline-notice')).toContainText('Rascunho aplicado');
  const stored = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningLoad('local-default', 'scenario-rf'),
  );
  expect(stored?.blocks[0]?.plannedMinutes).toBe(90);
});

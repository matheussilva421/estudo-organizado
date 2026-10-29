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
  status: 'DRAFT',
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-01-24',
  referenceZone: 'America/Fortaleza',
};

test('export_is_selective_and_import_requires_a_safe_preview', async ({ page }) => {
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
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-blocks' },
      scenarioId: seed.id,
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'block-1',
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
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.locator('[data-action="export-planning"]').click();
  const exported = await page.locator('[data-testid="export-output"]').inputValue();
  expect(exported).toContain('"formatVersion": 1');
  expect(exported).not.toMatch(/refreshToken|accessToken|deliveryUid/);

  await page
    .getByLabel('JSON de planejamento')
    .fill(
      JSON.stringify({
        nome: 'Reta Final importada',
        dataProva: '2027-02-10',
        blocos: [{ conteudo: 'Constitucional', duracao: 45, data: '2027-01-10' }],
      }),
    );
  await page.locator('[data-action="import-planning"]').click();
  await expect(page.locator('[data-testid="portability-status"]')).toContainText('Importado');

  const scenarios = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.planningList('local-default'),
  );
  expect(scenarios.map((item) => item.name)).toEqual(
    expect.arrayContaining(['Reta Final TJPB', 'Reta Final importada']),
  );
});

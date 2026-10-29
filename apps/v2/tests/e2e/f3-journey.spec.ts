import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

async function seedF2(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'journey-subject',
      profileId: 'local-default',
      subjectId: 'subject-journey',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'journey-edital',
      profileId: 'local-default',
      editalId: 'edital-journey',
      title: 'TJPB Jornada',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'journey-link',
      profileId: 'local-default',
      editalId: 'edital-journey',
      subjectId: 'subject-journey',
      linkId: 'link-journey',
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

async function currentScenario(page: Page) {
  return page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const scenarios = await harness.planningList('local-default');
    const scenario = scenarios[0];
    if (!scenario) return null;
    const snapshot = await harness.planningLoad('local-default', scenario.id);
    return snapshot;
  });
}

async function runJourney(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedF2(page);

  // Wizard: create a final stretch from the F2 content.
  await page.getByLabel('Nome', { exact: true }).fill('Jornada F3');
  await page.getByLabel('Tipo').selectOption('FINAL_STRETCH');
  await page.getByLabel('Data da prova').fill('2027-03-01');
  await page
    .getByLabel('Edital do planejamento')
    .selectOption({ label: 'TJPB Jornada' });
  await page.getByLabel('Início').fill('2027-01-04');
  await page.getByLabel('Horizonte (dias)').fill('14');
  await page.getByLabel('Duração (min)').fill('60');
  await page.locator('[data-action="preview-generation"]').click();
  await expect(page.locator('[data-testid="wizard-preview"]')).toBeVisible();
  await page.locator('[data-action="confirm-generation"]').click();
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Jornada F3');

  // Calendar navigation.
  await page.locator('[data-action="calendar-month"]').click();
  const windowBefore = await page.locator('[data-testid="calendar-window"]').textContent();
  await page.locator('[data-action="calendar-next"]').click();
  await expect(page.locator('[data-testid="calendar-window"]')).not.toHaveText(
    windowBefore ?? '',
  );

  // Draft editor.
  await page.getByLabel('Minutos').fill('90');
  await page.locator('[data-action="save-draft"]').click();
  await expect(page.locator('[data-testid="draft-state"]')).toHaveAttribute('data-changes', '1');

  // Conflict: another writer moves the same field before the draft is applied.
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const scenarios = await harness.planningList('local-default');
    const scenario = scenarios[0]!;
    const snapshot = await harness.planningLoad('local-default', scenario.id);
    const block = snapshot!.blocks[0]!;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'journey-other-tab' },
      scenarioId: scenario.id,
      baseRevision: snapshot!.scenario.localRevision,
      changes: { upsertBlocks: [{ ...block, plannedMinutes: 75 }] },
    });
  });
  await page.locator('[data-action="apply-draft"]').click();
  await expect(page.locator('[data-testid="planning-conflicts"]')).toContainText('plannedMinutes');
  await page.locator('[data-action="use-incoming"]').first().click();
  await page.locator('[data-action="apply-draft"]').click();
  await expect(page.locator('.inline-notice')).toContainText('Rascunho aplicado');

  // Final stretch: postpone the exam date.
  await page.getByLabel('Nova data').fill('2027-04-01');
  await page.locator('[data-action="postpone-exam"]').click();
  await expect(page.locator('[data-testid="final-stretch"]')).toContainText('2027-04-01');

  // Portability: export and import into the selected edital.
  await page.locator('[data-action="export-planning"]').click();
  const exported = await page.locator('[data-testid="export-output"]').inputValue();
  expect(exported).toContain('"formatVersion": 1');
  await page
    .getByLabel('JSON de planejamento')
    .fill(
      JSON.stringify({
        nome: 'Reta importada jornada',
        dataProva: '2027-05-01',
        blocos: [{ conteudo: 'Revisão', duracao: 45, data: '2027-04-10' }],
      }),
    );
  await page
    .getByLabel('Edital de destino da importação')
    .selectOption({ label: 'TJPB Jornada' });
  await page.locator('[data-action="import-planning"]').click();
  await expect(page.locator('[data-testid="portability-status"]')).toContainText('Importado');

  const finalState = await currentScenario(page);
  expect(finalState?.scenario.examDate).toBe('2027-04-01');
}

for (const viewport of viewports) {
  test(`full_f3_journey_on_${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await runJourney(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('wizard_creates_and_activates_a_cycle_with_calendar_and_cursor', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'op-subject',
      profileId: 'local-default',
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      title: 'TJPB',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'op-link',
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Nome', { exact: true }).fill('Ciclo TJPB');
  await page.getByLabel('Tipo').selectOption('CYCLE');
  await page.getByLabel('Início').fill('2027-01-04');
  await page.locator('[data-action="preview-generation"]').click();
  await expect(page.locator('[data-testid="wizard-preview"]')).toBeVisible();

  await page.locator('[data-action="confirm-generation"]').click();
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Ciclo TJPB');
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('ACTIVE');
  await expect(page.locator('[data-testid="planning-calendar"] [data-days]')).toBeVisible();

  // With a single content item the cursor stays put; an explicit new round is
  // the meaningful advance and must survive a reload.
  await expect(page.locator('[data-testid="cycle-state"]')).toHaveAttribute('data-round', '1');
  await page.locator('[data-action="cycle-new-round"]').click();
  await expect(page.locator('[data-testid="cycle-state"]')).toHaveAttribute('data-round', '2');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="cycle-state"]')).toHaveAttribute('data-round', '2');
});

test('sequential_generation_produces_unallocated_items_when_capacity_is_short', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'op-subject',
      profileId: 'local-default',
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Administrativo',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      title: 'TJPB',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'op-link',
      profileId: 'local-default',
      editalId: 'edital-tjpb',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Nome', { exact: true }).fill('Plano curto');
  await page.getByLabel('Início').fill('2027-01-09');
  await page.getByLabel('Horizonte (dias)').fill('1');
  await page.getByLabel('Duração (min)').fill('480');
  await page.locator('[data-action="preview-generation"]').click();
  await expect(page.locator('[data-testid="wizard-preview"]')).toContainText('não alocados');
});

import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('offline_reload_keeps_the_plan_and_the_draft_with_honest_feedback', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'offline-scenario' },
      scenarioId: 'scenario-offline',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-offline',
          profileId: 'local-default',
          editalId: 'edital-offline',
          kind: 'FINAL_STRETCH',
          name: 'Plano offline',
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          examDate: '2027-06-30',
          referenceZone: 'America/Fortaleza',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'offline-blocks' },
      scenarioId: 'scenario-offline',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'offline-block',
            profileId: 'local-default',
            editalId: 'edital-offline',
            scenarioId: 'scenario-offline',
            editalDisciplineId: 'link-offline',
            plannedMinutes: 60,
            allocation: 'PROJECTED',
            civilDate: '2027-01-05',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'offline-blocks',
            label: 'Conteúdo offline',
          },
        ],
      },
    });
    await harness.planningSaveDraft({
      id: 'offline-draft',
      profileId: 'local-default',
      scenarioId: 'scenario-offline',
      baseRevision: 2,
      changes: [{ blockId: 'offline-block', field: 'plannedMinutes', value: 90, baseValue: 60 }],
      lastSavedAt: '2026-10-29T00:00:00.000Z',
    });
  });

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Plano offline');
  await expect(page.locator('[data-testid="draft-state"]')).toHaveAttribute('data-changes', '1');

  // Editing offline still commits locally and says so honestly.
  await page.getByLabel('Minutos').fill('45');
  await page.locator('[data-action="save-draft"]').click();
  await expect(page.locator('.inline-notice')).toContainText('Rascunho salvo neste dispositivo');

  await context.setOffline(false);
});

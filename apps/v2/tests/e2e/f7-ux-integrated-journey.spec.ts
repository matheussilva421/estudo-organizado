import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('F2 to F6 journey keeps content ids and separates manual, review and plan facts', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);
  const today = new Date().toISOString().slice(0, 10);

  await page.evaluate(async (civilDate) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'journey-scenario' },
      scenarioId: 'journey-scenario',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'journey-scenario',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'CYCLE',
          name: 'Ciclo integrado',
          status: 'ACTIVE',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'journey-block' },
      scenarioId: 'journey-scenario',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'journey-block-1',
            profileId: 'local-default',
            editalId: 'f7ux-edital',
            scenarioId: 'journey-scenario',
            editalDisciplineId: 'f7ux-link',
            assuntoId: 'f7ux-assunto',
            plannedMinutes: 60,
            allocation: 'CONFIRMED_DAY',
            civilDate,
            priority: 0,
            localRevision: 1,
            sourceOperationId: 'journey-block',
            label: 'Conteúdo integrado',
          },
        ],
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'journey-b' },
      scenarioId: 'journey-b',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'journey-b',
          profileId: 'local-default',
          editalId: 'f7ux-edital',
          kind: 'CYCLE',
          name: 'Ciclo B',
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          referenceZone: 'America/Fortaleza',
        },
      },
    });
  }, today);

  await page.reload();
  await page.goto('/#/planning');
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
  await expect(page.getByTestId('planning-calendar')).toContainText('Conteúdo integrado');
  const capacity = page.getByTestId('planning-capacity-comparison');
  await expect(capacity).toContainText('Ciclo integrado');
  await expect(capacity).toContainText('60 min');

  const activeA = page.locator('[data-testid="scenario-journey-scenario"]');
  const draftB = page.locator('[data-testid="scenario-journey-b"]');
  await expect(activeA).toHaveAttribute('data-status', 'ACTIVE');
  await expect(draftB).toHaveAttribute('data-status', 'DRAFT');
  await draftB.locator('[data-action="activate-scenario"]').click();
  const activation = page.getByTestId('activation-preview-journey-b');
  await expect(activation).toBeVisible();
  if (process.env.F7_UXH_STATE_DIR) {
    await activation.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/planning-activation-preview.png',
    });
  }
  await expect(activeA).toHaveAttribute('data-status', 'ACTIVE');
  await page.locator('[data-action="cancel-activate"]').click();
  await expect(activation).toHaveCount(0);
  await expect(activeA).toHaveAttribute('data-status', 'ACTIVE');
  await expect(draftB).toHaveAttribute('data-status', 'DRAFT');

  await page.goto('/#/sessions');
  const manual = page.getByTestId('session-manual');
  await manual.getByLabel('Duração da sessão (min)').fill('30');
  await manual.getByLabel('Nota').fill('Jornada integrada');
  await manual.getByTestId('session-manual-submit').click();
  await expect(page.getByTestId('session-history')).toContainText('registro manual');
  await expect(page.getByTestId('session-history')).toContainText('00:30:00');

  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.seedReviewCommitments('local-default', 1);
  });
  await page.reload();
  await page.goto('/#/reviews');
  await expect(page.getByTestId('review-workspace')).toBeVisible();
  await page.getByTestId('review-start-review-seed-0').click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByTestId('review-agenda')).toContainText('Cumprida');

  // R-09: a policy preview does not rewrite the policy, commitments or history.
  await page.getByLabel('Duração padrão (min)').fill('35');
  await page.getByTestId('review-policy-preview').click();
  await expect(page.getByTestId('review-policy-base-preview')).toContainText('35');
  if (process.env.F7_UXH_STATE_DIR) {
    await page.getByTestId('review-policy-base-preview').screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/review-policy-preview.png',
    });
  }
  await expect(page.getByRole('button', { name: 'Aplicar política' })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Duração padrão (min)')).toHaveValue('20');
  await expect(page.getByTestId('review-history-panel')).toContainText('política v1');

  // R-09: the review execution did not rewrite the planned block or the session
  // duration that originated it.
  await page.goto('/#/planning');
  await expect(page.getByTestId('planning-calendar')).toContainText('Conteúdo integrado');
  await page.goto('/#/sessions');
  await expect(page.getByTestId('session-history')).toContainText('00:30:00');

  await page.goto('/#/home');
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page.getByTestId('f6-load-error')).toHaveCount(0);
  await page.goto('/#/analytics');
  await expect(page.getByTestId('f6-analytics')).toBeVisible();
  const focusKpi = page.locator('.kpi-card', { hasText: 'Tempo de foco executado' });
  const plannedKpi = page.locator('.kpi-card', { hasText: 'Tempo planejado' });
  await expect(focusKpi).toContainText('30 min');
  await expect(plannedKpi).toContainText('60 min');
});


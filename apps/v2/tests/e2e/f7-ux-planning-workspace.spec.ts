import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function seed(page: Page) {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'ux17-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'ux17-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'ux17-link',
      profileId: profile,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      linkId: 'disc-1',
    });
    const baseScenario = {
      profileId: profile,
      editalId: 'edital-1',
      kind: 'CYCLE' as const,
      localRevision: 1,
      schemaVersion: 1,
      priorityProfileId: 'priority-default',
      priorityProfileRevision: 1,
      referenceZone: 'America/Fortaleza',
    };
    await harness.planningCommit({
      scope: { profileId: profile, operationId: 'ux17-a', baseRevision: null },
      scenarioId: 'scenario-a',
      baseRevision: null,
      changes: {
        scenario: {
          ...baseScenario,
          id: 'scenario-a',
          name: 'Ciclo A',
          status: 'ACTIVE',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: profile, operationId: 'ux17-b', baseRevision: null },
      scenarioId: 'scenario-b',
      baseRevision: null,
      changes: {
        scenario: {
          ...baseScenario,
          id: 'scenario-b',
          name: 'Ciclo B',
          status: 'DRAFT',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: profile, operationId: 'ux17-block', baseRevision: 1 },
      scenarioId: 'scenario-b',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'block-unscheduled',
            profileId: profile,
            editalId: 'edital-1',
            scenarioId: 'scenario-b',
            editalDisciplineId: 'disc-1',
            plannedMinutes: 45,
            allocation: 'UNALLOCATED',
            priority: 0,
            localRevision: 1,
            sourceOperationId: 'ux17-block',
            label: 'Bloco sem dia',
            reason: 'NO_DAY_DEFINED',
          },
        ],
      },
    });
  }, profileId);
  await page.reload();
  await page.goto('/#/planning');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
}

test('planning overview exposes real counts and studio navigation', async ({ page }) => {
  await seed(page);
  await page.goto('/#/planning');
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Seções do Planning Studio' })).toBeVisible();
  for (const testId of ['planning-stat-scenarios', 'planning-stat-blocks', 'planning-stat-minutes', 'planning-stat-unallocated']) {
    await expect(page.getByTestId(testId)).toHaveText(/^\d+$/);
  }
  await expect(page.getByRole('link', { name: 'Calendário', exact: true })).toBeVisible();
  await expect(page.locator('#planning-calendar')).toBeVisible();
  await expect(page.locator('#planning-editor')).toBeVisible();
});

test('activation requires an explicit preview and does not autoswap', async ({ page }) => {
  await seed(page);
  const target = page.locator('[data-testid="scenario-scenario-b"]');
  await expect(target).toHaveAttribute('data-status', 'DRAFT');
  await target.locator('[data-action="activate-scenario"]').click();
  await expect(page.getByTestId('activation-preview-scenario-b')).toBeVisible();
  await expect(page.getByTestId('activation-preview-scenario-b')).toContainText(
    'Substitui 1 cenário',
  );
  await expect(target).toHaveAttribute('data-status', 'DRAFT');
  await page.locator('[data-action="confirm-activate"]').click();
  await expect(target).toHaveAttribute('data-status', 'ACTIVE');
  await expect(page.locator('[data-testid="scenario-scenario-a"]')).toHaveAttribute(
    'data-status',
    'INACTIVE',
  );
});

test('calendar list shows an unscheduled block without inventing a time', async ({ page }) => {
  await seed(page);
  await page.locator('[data-testid="scenario-scenario-b"] [data-action="select-scenario"]').click();
  await page.locator('[data-action="calendar-list"]').click();
  const list = page.getByTestId('calendar-list');
  await expect(list).toBeVisible();
  await expect(list).toContainText('Sem data');
  await expect(list).toContainText('sem horário');
  await expect(list).not.toContainText('00:00');
});

test('availability and weekly goal persist and drive the shared capacity', async ({ page }) => {
  await seed(page);
  const panel = page.getByTestId('planning-availability');
  await expect(panel).toBeVisible();
  const comparison = page.getByTestId('planning-capacity-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Capacidade comparada');
  await expect(comparison).toContainText('planejado global');
  await expect(comparison).toContainText('Ciclo A');

  const monday = panel.locator('[data-day="MON"]');
  await monday.locator('input[type="time"]').nth(0).fill('19:00');
  await monday.locator('input[type="time"]').nth(1).fill('21:30');
  // Saturday becomes a declared day without study.
  await panel.locator('[data-day="SAT"] input[type="checkbox"]').uncheck();
  await page.getByTestId('planning-weekly-goal').fill('300');
  await page.getByTestId('planning-availability-save').click();
  await expect(page.getByTestId('planning-goal-progress')).toContainText('300 min');

  await page.reload();
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
  const reloaded = page.getByTestId('planning-availability');
  await expect(reloaded.locator('[data-day="MON"] input[type="time"]').nth(0)).toHaveValue('19:00');
  await expect(reloaded.locator('[data-day="MON"] input[type="time"]').nth(1)).toHaveValue('21:30');
  await expect(reloaded.locator('[data-day="SAT"] input[type="checkbox"]')).not.toBeChecked();
  await expect(page.getByTestId('planning-goal-progress')).toContainText('300 min');
});

test('planning history compares the two latest checkpoints before restore', async ({ page }) => {
  await seed(page);
  await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const snapshot = await harness.planningLoad(profile, 'scenario-a');
    if (!snapshot) throw new Error('scenario-a ausente');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('planning_checkpoints', 'readwrite');
    const store = transaction.objectStore('planning_checkpoints');
    for (let index = 0; index < 2; index += 1) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          checkpointId: 'fixture-checkpoint-' + index,
          profileId: profile,
          scenarioId: 'scenario-a',
          kind: 'MANUAL',
          createdAt: '2026-11-12T10:0' + index + ':00.000Z',
          operationId: 'fixture-checkpoint-op-' + index,
          manifest: {
            blockIds: snapshot.blocks.map((block) => block.id),
            blockCount: snapshot.blocks.length,
            scenarioRevision: snapshot.scenario.localRevision,
            digest: String(index + 1).repeat(64),
          },
          snapshot,
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, profileId);
  await page.reload();
  await page.goto('/#/planning');
  const history = page.getByTestId('planning-history');
  await expect(history).toBeVisible();
  const comparison = page.getByTestId('planning-history-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Mais recente');
  await expect(comparison).toContainText('Anterior');
  await expect(comparison).toContainText('revisão');
  await expect(comparison).toContainText('blocos');
});

test('planning remembers the chosen view and keeps Day reachable', async ({ page }) => {
  await seed(page);
  await page.locator('[data-action="calendar-month"]').click();
  await expect(page.locator('[data-action="calendar-month"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
  await expect(page.locator('[data-action="calendar-month"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('[data-action="calendar-day"]').click();
  await expect(page.locator('[data-action="calendar-day"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});


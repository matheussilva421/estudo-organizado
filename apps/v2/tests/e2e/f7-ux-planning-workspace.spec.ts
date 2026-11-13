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
  if (process.env.F7_UXH_STATE_DIR) {
    await comparison.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/planning-capacity.png',
    });
  }

  await page.reload();
  await expect(page.getByTestId('planning-workspace')).toBeVisible();
  const reloaded = page.getByTestId('planning-availability');
  await expect(reloaded.locator('[data-day="MON"] input[type="time"]').nth(0)).toHaveValue('19:00');
  await expect(reloaded.locator('[data-day="MON"] input[type="time"]').nth(1)).toHaveValue('21:30');
  await expect(reloaded.locator('[data-day="SAT"] input[type="checkbox"]')).not.toBeChecked();
  await expect(page.getByTestId('planning-goal-progress')).toContainText('300 min');
});

test('capacity exposes overload beyond the declared window', async ({ page }) => {
  await seed(page);
  const civilDate = (() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const date = new Date(today + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  })();
  await page.evaluate(
    async ({ profile, civilDate: date }) => {
      const harness = (window as unknown as HarnessWindow).__v2E2E;
      await harness.planningCommit({
        scope: { profileId: profile, operationId: 'overload-block', baseRevision: 1 },
        scenarioId: 'scenario-a',
        baseRevision: 1,
        changes: {
          upsertBlocks: [
            {
              id: 'block-overload',
              profileId: profile,
              editalId: 'edital-1',
              scenarioId: 'scenario-a',
              editalDisciplineId: 'disc-1',
              plannedMinutes: 120,
              allocation: 'PROJECTED',
              civilDate: date,
              priority: 0,
              sourceOperationId: 'overload-block',
              localRevision: 2,
            },
          ],
        },
      });
    },
    { profile: profileId, civilDate },
  );
  await page.reload();
  await page.goto('/#/planning');
  const panel = page.getByTestId('planning-availability');
  for (const day of ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) {
    const box = panel.locator('[data-day="' + day + '"] input[type="checkbox"]');
    if (await box.isChecked()) await box.uncheck();
  }
  const monday = panel.locator('[data-day="MON"]');
  const mondayBox = monday.locator('input[type="checkbox"]');
  if (!(await mondayBox.isChecked())) await mondayBox.check();
  await monday.locator('input[type="time"]').nth(0).fill('08:00');
  await monday.locator('input[type="time"]').nth(1).fill('08:30');
  await page.getByTestId('planning-availability-save').click();

  const share = page.getByTestId('planning-capacity-share');
  await expect(share).toHaveAttribute('data-overloaded', 'true');
  await expect(share).toContainText('% da janela');
  await expect(share).toContainText('excesso de');
  const balance = page.getByTestId('planning-capacity-balance');
  await expect(balance).toContainText('excesso:');
  await expect(balance).not.toContainText('saldo: 0 min');
  const percent = await share.evaluate((element) => {
    const match = element.textContent?.match(/(\d+)%/);
    return match ? Number(match[1]) : null;
  });
  expect(percent).not.toBeNull();
  expect(percent as number).toBeGreaterThan(100);
  if (process.env.F7_UXH_STATE_DIR) {
    await page.getByTestId('planning-capacity-comparison').screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/planning-capacity-overload.png',
    });
  }
});

test('history compares and restores the checkpoint the user selected', async ({ page }) => {
  await seed(page);
  await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const first = await harness.planningLoad(profile, 'scenario-b');
    if (!first) throw new Error('scenario-b ausente');
    const request = indexedDB.open('estudo-organizado-v2');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const put = (record: unknown) =>
      new Promise<void>((resolve, reject) => {
        const tx = database.transaction('planning_checkpoints', 'readwrite');
        const add = tx.objectStore('planning_checkpoints').put(record);
        add.onsuccess = () => resolve();
        add.onerror = () => reject(add.error);
        tx.onerror = () => reject(tx.error);
      });
    await put({
      checkpointId: 'fixture-checkpoint-old',
      profileId: profile,
      scenarioId: 'scenario-b',
      kind: 'MANUAL',
      createdAt: '2026-11-10T10:00:00.000Z',
      operationId: 'fixture-checkpoint-old-op',
      manifest: {
        blockIds: first.blocks.map((block) => block.id),
        blockCount: first.blocks.length,
        scenarioRevision: first.scenario.localRevision,
        digest: 'a'.repeat(64),
      },
      snapshot: first,
    });
    const secondBlock = {
      id: 'block-second',
      profileId: profile,
      editalId: 'edital-1',
      scenarioId: 'scenario-b',
      editalDisciplineId: 'disc-1',
      plannedMinutes: 30,
      allocation: 'UNALLOCATED' as const,
      priority: 0,
      sourceOperationId: 'fixture-second-block',
      localRevision: first.scenario.localRevision + 1,
      label: 'Segundo bloco',
      reason: 'NO_DAY_DEFINED' as const,
    };
    await harness.planningCommit({
      scope: { profileId: profile, operationId: 'fixture-second-block', baseRevision: first.scenario.localRevision },
      scenarioId: 'scenario-b',
      baseRevision: first.scenario.localRevision,
      changes: { upsertBlocks: [secondBlock] },
    });
    const second = await harness.planningLoad(profile, 'scenario-b');
    if (!second) throw new Error('scenario-b recarregado ausente');
    await put({
      checkpointId: 'fixture-checkpoint-new',
      profileId: profile,
      scenarioId: 'scenario-b',
      kind: 'AUTO',
      createdAt: '2026-11-12T10:00:00.000Z',
      operationId: 'fixture-checkpoint-new-op',
      manifest: {
        blockIds: second.blocks.map((block) => block.id),
        blockCount: second.blocks.length,
        scenarioRevision: second.scenario.localRevision,
        digest: 'b'.repeat(64),
      },
      snapshot: second,
    });
    database.close();
  }, profileId);
  await page.reload();
  await page.goto('/#/planning');
  await page.locator('[data-testid="scenario-scenario-b"] [data-action="select-scenario"]').click();

  const history = page.getByTestId('planning-history');
  await expect(history).toBeVisible();
  await expect(history).toContainText('Checkpoint manual');
  await expect(history).toContainText('Checkpoint automático');
  const oldRow = history.locator('[data-checkpoint="fixture-checkpoint-old"]');
  const oldTrigger = oldRow.getByRole('button', { name: 'Comparar e restaurar' });
  await oldTrigger.click();
  const comparison = page.getByTestId('planning-history-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Confirmar restauração do checkpoint selecionado');
  await expect(comparison).toContainText('Checkpoint alvo');
  await expect(comparison).toContainText('Revisão atual');
  await expect(comparison).toContainText('revisão -1 · blocos -1');
  await expect(
    comparison.getByRole('strong').filter({ hasText: 'Confirmar restauração' }),
  ).toBeFocused();

  await comparison.getByRole('button', { name: 'Cancelar' }).click();
  await expect(comparison).toHaveCount(0);
  await expect(oldTrigger).toBeFocused();

  await oldTrigger.click();
  await expect(comparison).toBeVisible();
  if (process.env.F7_UXH_STATE_DIR) {
    await comparison.screenshot({
      path: process.env.F7_UXH_STATE_DIR + '/planning-history.png',
    });
  }
  await comparison.getByRole('button', { name: 'Confirmar restauração' }).click();
  await expect(comparison).toHaveCount(0);
  await expect
    .poll(
      async () =>
        page.evaluate(async (profile) => {
          const harness = (window as unknown as HarnessWindow).__v2E2E;
          const blocks = await harness.planningListBlocks(profile, 'scenario-b');
          return blocks.length;
        }, profileId),
      { timeout: 15000 },
    )
    .toBe(1);
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


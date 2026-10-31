import { expect, test } from '@playwright/test';

test('f4 starts from a planned block and reconciles explicitly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      [
        'subjects',
        'editais',
        'edital_disciplines',
        'planning_scenarios',
        'planning_blocks',
      ],
      'readwrite',
    );
    transaction.objectStore('subjects').put({
      id: 'subject-1',
      profileId: 'local-default',
      title: 'Direito Constitucional',
      localRevision: 1,
    });
    transaction.objectStore('editais').put({
      id: 'edital-1',
      profileId: 'local-default',
      title: 'TJPB',
      status: 'ACTIVE',
      localRevision: 1,
    });
    transaction.objectStore('edital_disciplines').put({
      id: 'link-1',
      profileId: 'local-default',
      editalId: 'edital-1',
      subjectId: 'subject-1',
      status: 'ACTIVE',
      localRevision: 1,
      orderKey: 'a',
    });
    transaction.objectStore('planning_scenarios').put({
      id: 'scenario-1',
      profileId: 'local-default',
      editalId: 'edital-1',
      kind: 'FINAL_STRETCH',
      name: 'Plano F4',
      status: 'DRAFT',
      localRevision: 1,
      schemaVersion: 1,
      priorityProfileId: 'priority-default',
      priorityProfileRevision: 1,
      referenceZone: 'America/Fortaleza',
      examDate: '2026-12-31',
    });
    transaction.objectStore('planning_blocks').put({
      id: 'block-1',
      profileId: 'local-default',
      editalId: 'edital-1',
      scenarioId: 'scenario-1',
      editalDisciplineId: 'link-1',
      plannedMinutes: 60,
      allocation: 'PROJECTED',
      priority: 1,
      localRevision: 1,
      sourceOperationId: 'seed',
      civilDate: '2026-10-31',
      label: 'Direito Constitucional · Aula 1 · 2026-10-31 · 60 min',
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const startButton = page.locator('[data-testid="planning-start-session"]');
  await expect(startButton).toBeVisible();
  await startButton.click();

  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-plan-block"]')).toHaveValue('block-1');
  await page.waitForTimeout(1_000);
  await page.locator('[data-testid="session-pause"]').click();

  const history = page.locator('[data-testid="session-history"]');
  await expect(history).toContainText('Direito Constitucional');
  const partial = page.locator('[data-testid="session-reconcile-block-1-partial"]');
  await expect(partial).toBeVisible();
  await partial.click();
  await expect(page.locator('body')).toContainText('Conciliação registrada');
});

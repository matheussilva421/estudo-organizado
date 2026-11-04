import { expect, test } from '@playwright/test';

const profileId = 'local-default';

test('f6 resolved conflicts stop alerting and partial INCOMING stays diagnostic', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(async ({ profileId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const base = {
      id: 'session-f6-conflict',
      profileId,
      state: 'COMPLETED',
      origin: 'TIMER',
      localRevision: 2,
      schemaVersion: 1,
      referenceZone: 'America/Fortaleza',
      planBlockIds: [],
      editalIds: ['edital-f6'],
      intervals: [],
      recordedAtCivilDate: today,
    };
    const local = {
      ...base,
      intervals: [
        {
          id: 'i-local',
          kind: 'FOCUS',
          verifiedMs: 1800000,
          contextId: null,
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
    };
    const incoming = {
      ...base,
      intervals: [
        {
          id: 'i-incoming',
          kind: 'FOCUS',
          verifiedMs: 2400000,
          contextId: null,
          checkpoint: null,
          recoveryFlag: false,
        },
      ],
    };
    const transaction = database.transaction(['sessions', 'session_conflicts'], 'readwrite');
    transaction.objectStore('sessions').put(local);
    const conflicts = transaction.objectStore('session_conflicts');
    conflicts.put({
      id: 'conflict-local',
      profileId,
      sessionId: base.id,
      baseRevision: 1,
      local,
      incoming,
      kind: 'SAME_FIELD',
      status: 'RESOLVED',
      resolution: 'LOCAL',
    });
    conflicts.put({
      id: 'conflict-incoming',
      profileId,
      sessionId: base.id,
      baseRevision: 1,
      local,
      incoming,
      kind: 'SAME_FIELD',
      status: 'RESOLVED',
      resolution: 'INCOMING',
    });
    conflicts.put({
      id: 'conflict-open',
      profileId,
      sessionId: 'session-other',
      baseRevision: 1,
      local: { ...local, id: 'session-other' },
      incoming: { ...incoming, id: 'session-other' },
      kind: 'SAME_FIELD',
      status: 'OPEN',
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { profileId });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.goto('/#/home');
  const priorities = page.getByTestId('f6-priorities');
  await expect(priorities).toContainText('1 conflito(s) de sessão F4');
  await expect(priorities).toContainText('Conciliação parcial de sessão F4 (INCOMING)');

  await page.goto('/#/analytics');
  const analytics = page.getByTestId('f6-analytics');
  await expect(analytics).toHaveAttribute('data-analytics-status', 'PARTIAL');
  await expect(analytics).toContainText('INCOMING parcial');
});

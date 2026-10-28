import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function seedPendingEdital(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'TJPB 2026',
    }),
  profileId);
}

test('sixth_failure_survives_reload_and_recovers_automatically', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await seedPendingEdital(page);

  const t0 = Date.now();
  const firstRound = await page.evaluate(
    ({ profile, base }) =>
      (window as unknown as HarnessWindow).__v2E2E.runFailures(profile, 3, base),
    { profile: profileId, base: t0 },
  );
  expect(firstRound).toMatchObject({ attempts: 3, status: 'PENDING', pending: 1 });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const secondRound = await page.evaluate(
    ({ profile, base }) =>
      (window as unknown as HarnessWindow).__v2E2E.runFailures(profile, 3, base),
    { profile: profileId, base: t0 + 60_000 },
  );
  expect(secondRound).toMatchObject({ attempts: 6, status: 'PENDING', pending: 1 });

  // Inside the cooldown window nothing runs; the intent survives the reload.
  expect(secondRound.eligibleNow).toBe(0);

  const recovered = await page.evaluate(
    ({ profile, at }) =>
      (window as unknown as HarnessWindow).__v2E2E.reconnect(profile, at),
    { profile: profileId, at: t0 + 3_600_000 },
  );
  expect(recovered).toEqual({ confirmed: ['op-edital'], status: 'CONFIRMED' });
});

test('paused_auth_never_spins_without_a_new_decision', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await seedPendingEdital(page);

  const paused = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    // A same-origin profile state is enough to prove the loop stops.
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve) => {
      const transaction = database.transaction('profiles', 'readwrite');
      transaction.objectStore('profiles').put({
        profileId: profile,
        uid: 'uid-a',
        remoteLibraryId: 'library-x',
        syncEnabled: true,
        state: 'PAUSED_AUTH',
        primaryEditalId: null,
        localRevision: 1,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    database.close();
    return harness.runFailures(profile, 1, Date.now());
  }, profileId);

  expect(paused.pending).toBe(1);
  const recovered = await page.evaluate(
    ({ profile, at }) =>
      (window as unknown as HarnessWindow).__v2E2E.reconnect(profile, at),
    { profile: profileId, at: Date.now() + 3_600_000 },
  );
  expect(recovered.confirmed).toEqual([]);
  expect(recovered.status).toBe('PENDING');
});

import { expect, test } from '@playwright/test';

test('creates the isolated V2 IndexedDB stores on boot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const stores = await page.evaluate(async () => {
    const request = indexedDB.open('estudo-organizado-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = Array.from(db.objectStoreNames);
    db.close();
    return names;
  });

  expect(stores).toEqual(
    expect.arrayContaining(['subjects', 'outbox', 'operations', 'profiles', 'meta', 'conflicts']),
  );
});

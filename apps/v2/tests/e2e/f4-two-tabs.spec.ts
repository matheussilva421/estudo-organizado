import { expect, test } from '@playwright/test';

test('f4 second tab requires assisted authority transfer', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-testid="session-foreign-authority"]')).toBeVisible();
  await expect(second.locator('[data-testid="session-takeover"]')).toBeVisible();

  await second.locator('[data-testid="session-takeover"]').click();
  // The handover pauses at the last durable checkpoint so no unverified time
  // from the old tab is credited; the new owner resumes explicitly.
  await expect(second.locator('[data-testid="session-resume"]')).toBeVisible();
  await second.locator('[data-testid="session-resume"]').click();
  await expect(second.locator('[data-testid="session-pause"]')).toBeEnabled();
  await second.locator('[data-testid="session-pause"]').click();
  await expect(second.locator('[data-testid="session-resume"]')).toBeVisible();

  await second.close();
});

test('f4 takeover aborts when the durable session cannot be paused', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-pause')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.getByTestId('session-takeover')).toBeVisible();

  await second.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('estudo-organizado-v2');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').clear();
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await second.getByTestId('session-takeover').click();
  await expect(second.getByText(/Não foi possível pausar a sessão antes de assumir/)).toBeVisible();
  await expect(second.getByTestId('session-takeover')).toBeVisible();
  await second.close();
});

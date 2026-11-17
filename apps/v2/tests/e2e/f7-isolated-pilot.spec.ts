import { expect, test } from '@playwright/test';

const stagingUrl = process.env.F7_REAL_STAGING_URL;
const projectId = process.env.F7_REAL_PROJECT_ID;

test.skip(!stagingUrl || !projectId, 'F7_REAL_STAGING_URL and F7_REAL_PROJECT_ID are required');

test('real staging serves the isolated V2 shell and service worker', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(stagingUrl!);
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Dados locais ficam no IndexedDB isolado desta origem');
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 20_000,
  });
  const caches = await page.evaluate(() => self.caches.keys());
  expect(caches.some((name) => name.startsWith('estudo-organizado-v2-shell-'))).toBe(true);
  expect(caches.every((name) => name.startsWith('estudo-organizado-v2'))).toBe(true);
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((database) => database.name).filter(Boolean),
  );
  expect(databases).toContain('estudo-organizado-v2');
  expect(errors).toEqual([]);
});

test('real staging survives reload and does not expose a V1 host', async ({ page }) => {
  await page.goto(stagingUrl!);
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  expect(new URL(page.url()).hostname).not.toBe('app-de-estudos-14564.web.app');
  expect(new URL(page.url()).hostname).not.toBe('app-de-estudos-14564.firebaseapp.com');
  await expect(page.getByTestId('header-settings')).toBeVisible();
});

test('real staging serves the shell offline after service worker activation', async ({ page, context }) => {
  await page.goto(stagingUrl!);
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 20_000,
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Dados locais ficam no IndexedDB isolado desta origem');
  } finally {
    await context.setOffline(false);
  }
});

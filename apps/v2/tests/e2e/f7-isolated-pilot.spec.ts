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

test('real staging keeps the shell usable at mobile and tablet widths', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto(stagingUrl!);
    await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('real staging preserves a draft and active session across reload and two tabs', async ({ context, page }) => {
  await page.goto(stagingUrl + '/#/content');
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await page.getByLabel('Nova disciplina').fill('Rascunho S13');

  const sessions = await context.newPage();
  await sessions.goto(stagingUrl + '/#/sessions');
  await expect(sessions.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await sessions.locator('[data-testid="session-start"]').click();
  await expect(sessions.locator('[data-testid="session-pause"]')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Rascunho S13');
  await sessions.reload();
  if (await sessions.locator('[data-testid="session-takeover"]').isVisible().catch(() => false)) {
    await sessions.locator('[data-testid="session-takeover"]').click();
    await expect(sessions.locator('[data-testid="session-resume"]')).toBeVisible();
    await sessions.locator('[data-testid="session-resume"]').click();
  }
  await expect(sessions.locator('[data-testid="session-pause"]')).toBeVisible();

  await context.setOffline(true);
  await sessions.reload();
  await expect(sessions.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  if (await sessions.locator('[data-testid="session-takeover"]').isVisible().catch(() => false)) {
    await sessions.locator('[data-testid="session-takeover"]').click();
    await expect(sessions.locator('[data-testid="session-resume"]')).toBeVisible();
    await sessions.locator('[data-testid="session-resume"]').click();
  }
  await expect(sessions.locator('[data-testid="session-pause"]')).toBeVisible();
  await context.setOffline(false);

  await sessions.locator('[data-testid="session-complete"]').click().catch(() => undefined);
  await sessions.close();
});

test('real staging starts Google sign-in with the same-origin Firebase redirect', async ({ page }) => {
  await page.goto(stagingUrl + '/#/settings');
  await expect(page.getByRole('heading', { name: 'Estudo Organizado V2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Entrar com Google' }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/accounts\.google\.com/, { timeout: 20_000 });

  const popupUrl = new URL(popup.url());
  expect(popupUrl.host).toBe('accounts.google.com');
  expect(popupUrl.searchParams.get('redirect_uri')).toBe(
    new URL('/__/auth/handler', stagingUrl).href,
  );
  await popup.close();
});

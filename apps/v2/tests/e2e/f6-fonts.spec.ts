import { expect, test } from '@playwright/test';

test('f6 bundles Plus Jakarta Sans and DM Mono with OFL licenses', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => ({
    body: document.fonts.check('16px "Plus Jakarta Sans"'),
    mono: document.fonts.check('16px "DM Mono"'),
  }));
  expect(loaded.body).toBe(true);
  expect(loaded.mono).toBe(true);

  for (const path of [
    '/fonts/PlusJakartaSans-Variable.ttf',
    '/fonts/DMMono-Regular.ttf',
    '/fonts/DMMono-Medium.ttf',
    '/fonts/OFL-PlusJakartaSans.txt',
    '/fonts/OFL-DMMono.txt',
  ]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(1000);
  }
});


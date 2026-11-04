import { expect, test } from '@playwright/test';

test('f7 staging local proof: v2 origin, manifest and SW cache are isolated from v1', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const origin = await page.evaluate(() => location.origin);
  expect(origin).not.toContain('app-de-estudos-14564');
  expect(origin).not.toContain('estudo-organizado.matheussilva421.workers.dev');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  const keys = await page.evaluate(() => caches.keys());
  expect(keys.every((key) => key.startsWith('estudo-organizado-v2-'))).toBe(true);
});

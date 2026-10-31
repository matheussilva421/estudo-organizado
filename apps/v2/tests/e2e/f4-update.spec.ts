import { expect, test } from '@playwright/test';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serviceWorkerPath = resolve(process.cwd(), 'dist', 'sw.js');
let originalServiceWorker = '';

test.beforeEach(() => {
  originalServiceWorker = readFileSync(serviceWorkerPath, 'utf8');
});

test.afterEach(() => {
  writeFileSync(serviceWorkerPath, originalServiceWorker);
});

test('f4 update is deferred during an active session and applies when safe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();

  expect(existsSync(serviceWorkerPath)).toBe(true);
  appendFileSync(serviceWorkerPath, '\n// f4-update-test-' + Date.now());
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });

  await expect(page.locator('[data-testid="session-update-banner"]')).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('[data-testid="session-apply-update"]').click();
  await expect(page.locator('body')).toContainText('adiada');
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();

  await page.locator('[data-testid="session-complete"]').click();
  await expect(page.locator('[data-testid="session-start"]')).toBeVisible();
  await page.locator('[data-testid="session-apply-update"]').click();
  await expect(page.locator('body')).toContainText('aplicada');
  await expect(page.locator('[data-testid="session-history"]')).toContainText('COMPLETED');
});

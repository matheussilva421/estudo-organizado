import { expect, test as base } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

const offlineTest = base.extend({});
offlineTest.use({ serviceWorkers: 'allow' });

function serializeState(state) {
  return JSON.stringify(state);
}

async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };

    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, serializeState(state));
}

offlineTest.describe('Offline recovery', () => {
  offlineTest('reloads after service worker precache while offline', async ({ page, context }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toBeVisible();

    const serviceWorkerReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.ready;
      return true;
    });
    expect(serviceWorkerReady).toBe(true);

    await page.reload();
    await context.setOffline(true);

    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#topbar-title')).toBeVisible();
      await expect(page.locator('#main-content')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

base.describe('Import recovery', () => {
  base('rejects invalid JSON during local import validation', async ({ page }) => {
    const state = createE2EState();

    await page.route('**/js/sw-register.js*', route => {
      route.fulfill({ contentType: 'application/javascript', body: '' });
    });
    await seedLegacyState(page, state);
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toBeVisible();
    await page.evaluate(() => {
      window.navigate('config');
    });
    await expect(page.locator('[data-action="restore-backup"]')).toBeVisible();

    await page.locator('[data-action="restore-backup"]').dispatchEvent('click');
    const fileInput = page.locator('input[type="file"][accept=".json"]').last();
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles({
      name: 'invalid-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"editais":"not-an-array"}', 'utf8')
    });

    await expect(page.locator('#toast-container')).toContainText('Arquivo inv');
    await expect.poll(() => page.evaluate(() => {
      return Array.isArray(window.state.editais);
    })).toBe(true);
  });
});

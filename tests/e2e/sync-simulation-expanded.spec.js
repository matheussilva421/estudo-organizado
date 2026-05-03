import { expect, test } from '@playwright/test';
import { bootE2EApp, createE2EState } from '../helpers/e2e-state.js';

function createCloudSyncState() {
  const state = createE2EState();
  state.config.cfSyncEnabled = true;
  state.config.cfUrl = '/__e2e/cloud-sync';
  state.config.cfToken = 'e2e-token';
  state.config.cfRemoteUpdatedAt = null;
  return state;
}

test.describe('Sync simulado', () => {
  test('simula pull vazio seguido de push Cloudflare bem-sucedido sem rede real', async ({ page }) => {
    const state = createCloudSyncState();
    const requests = [];

    await page.route('**/__e2e/cloud-sync', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
        });
        return;
      }

      requests.push({
        method: request.method(),
        authorization: request.headers().authorization || '',
        body: request.method() === 'POST' ? request.postDataJSON() : null
      });

      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          meta: {
            updatedAt: '2026-04-29T18:00:00.000Z',
            deviceId: 'remote-device',
            version: 2
          }
        })
      });
    });

    await bootE2EApp(page, state);
    await page.click('[data-view="config"]');
    await page.evaluate(async () => {
      await window.EstudoApp.pullFromCloudflare();
      await window.EstudoApp.pushToCloudflare(true);
    });

    await expect(page.locator('#cf-sync-status')).toContainText(/Sincronizado|Nuvem atualizada/);
    expect(requests.map((request) => request.method)).toEqual(['GET', 'GET', 'POST']);
    expect(requests.every((request) => request.authorization === 'Bearer e2e-token')).toBe(true);
    const pushRequest = requests.find((request) => request.method === 'POST');
    expect(pushRequest.body.payload.config.cfToken).toBeUndefined();
  });

  test('simula erro de rede no Cloudflare e mantém feedback visível na tela de configurações', async ({ page }) => {
    const state = createCloudSyncState();

    await page.route('**/__e2e/cloud-sync', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'service unavailable in e2e simulation' })
      });
    });

    await bootE2EApp(page, state);
    await page.click('[data-view="config"]');
    const result = await page.evaluate(() => window.EstudoApp.pullFromCloudflare());

    expect(result).toBe(false);
    await expect(page.locator('#cf-sync-status')).toContainText(/Erro|erro/i);
    await expect.poll(() => page.evaluate(() => window.state.config.cfLastSyncAt || null)).toBeNull();
  });

  test('simula conflito remoto e exibe ações de recuperação sem chamar serviços externos', async ({ page }) => {
    const state = createCloudSyncState();

    await page.route('**/__e2e/cloud-sync', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null })
        });
        return;
      }

      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
        });
        return;
      }

      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'stale write',
          remoteUpdatedAt: '2026-04-29T19:00:00.000Z',
          remoteDeviceId: 'remote-device'
        })
      });
    });

    await bootE2EApp(page, state);
    await page.click('[data-view="config"]');
    const result = await page.evaluate(() => window.EstudoApp.pushToCloudflare(true));

    expect(result).toBe(false);
    await expect.poll(() => page.evaluate(() => window.state.config.cfConflict?.remoteUpdatedAt || null))
      .toBe('2026-04-29T19:00:00.000Z');
    await page.evaluate(() => window.EstudoApp.renderCurrentView());

    await page.locator('[data-testid="backup-advanced-panel"] summary').click();
    const conflict = page.locator('[data-testid="cf-sync-conflict"]');
    await expect(conflict).toBeVisible();
    await expect(conflict.locator('[data-action="cloud-conflict-export-local"]')).toBeVisible();
    await expect(conflict.locator('[data-action="cloud-conflict-pull-remote"]')).toBeVisible();
    await expect(conflict.locator('[data-action="cloud-conflict-force-push"]')).toBeVisible();
  });

  test('exibe Drive como backup configurado apenas por estado simulado', async ({ page }) => {
    const state = createE2EState();
    state.driveFileId = 'drive-file-simulated';
    state.lastSync = '2026-04-29T20:00:00.000Z';

    await bootE2EApp(page, state);
    await page.click('[data-view="config"]');

    await page.locator('[data-testid="backup-advanced-panel"] summary').click();
    await expect(page.locator('#main-content')).toContainText('Google Drive');
    await expect(page.locator('#main-content [data-action="drive-sync-now"]').first()).toBeVisible();
    await expect(page.locator('#main-content [data-action="pull-from-drive"]').first()).toBeVisible();
    await expect(page.locator('#main-content [data-action="drive-disconnect"]').first()).toBeVisible();
  });
});

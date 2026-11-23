import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

const UID = 'uid_e2e_v1_status';
const GENERATION = 'gen_e2e_v1_status';

async function installHarness(page, { mode = 'ack', delayed = false } = {}) {
  const initialState = createE2EState();
  initialState.schemaVersion = 12;
  await page.addInitScript(
    ({ uid, generationId, initialState, initialMode, delayFetch }) => {
      window.Chart = class {
        destroy() {}
      };
      localStorage.clear();
      sessionStorage.clear();
      window.__V1_STATUS_TEST__ = { mode: initialMode, applies: [] };

      const generation = (async () => {
        const codec = await import('/js/sync/v1-next/backup-codec.js');
        const converted = codec.convertBackupV12(initialState);
        return {
          control: {
            schemaVersion: 1,
            generationId,
            updatedAt: { seconds: 1800000000, nanoseconds: 0 },
          },
          manifest: {
            schemaVersion: 1,
            generationId,
            migrationId: 'migration_e2e_status',
            state: 'active',
            revision: 0,
            sourceSha256: 'c'.repeat(64),
            businessDigest: converted.manifestDraft.businessDigest,
            counts: converted.manifestDraft.counts,
            updatedAt: { seconds: 1800000000, nanoseconds: 0 },
          },
          records: Object.values(converted.records).flat(),
        };
      })();

      function receipt(operation) {
        return {
          schemaVersion: 1,
          generationId: operation.generationId,
          entityType: operation.entityType,
          entityId: operation.entityId,
          collection: operation.collection,
          revision: operation.revision,
          baseRevision: operation.baseRevision,
          opId: operation.opId,
          opDigest: operation.opDigest,
          deleted: operation.action === 'delete',
          updatedAt: { seconds: 1800000001, nanoseconds: 0 },
        };
      }

      window.__ESTUDO_V1_SYNC_TEST__ = {
        enabled: true,
        uid,
        remoteApi: {
          async getCurrentGeneration() {
            const value = await generation;
            return { uid, generationId, control: value.control, manifest: value.manifest };
          },
          async fetchGenerationRecords() {
            if (delayFetch) {
              await new Promise((resolve) => {
                window.__V1_STATUS_RELEASE_FETCH__ = resolve;
              });
            }
            const value = await generation;
            return { generationId, manifest: value.manifest, records: value.records };
          },
          subscribeGeneration() {
            return () => {};
          },
          applyRemoteOperation(operation) {
            window.__V1_STATUS_TEST__.applies.push(operation);
            const mode = window.__V1_STATUS_TEST__.mode;
            if (mode === 'hold') {
              return new Promise((resolve) => {
                window.__V1_STATUS_RELEASE_APPLY__ = () => {
                  window.__V1_STATUS_TEST__.mode = 'ack';
                  resolve({ acknowledged: true, receipt: receipt(operation) });
                };
              });
            }
            if (mode === 'conflict') {
              window.__V1_STATUS_TEST__.mode = 'ack';
              return Promise.resolve({
                conflict: {
                  code: 'V1_REMOTE_OP_CONFLICT',
                  remoteRevision: operation.revision,
                  remoteDeleted: false,
                  remoteRecord: null,
                },
              });
            }
            if (mode === 'error') {
              return Promise.reject(
                Object.assign(new Error('remote unavailable'), {
                  code: 'V1_REMOTE_UNAVAILABLE',
                })
              );
            }
            return Promise.resolve({ acknowledged: true, receipt: receipt(operation) });
          },
        },
      };
    },
    {
      uid: UID,
      generationId: GENERATION,
      initialState,
      initialMode: mode,
      delayFetch: delayed,
    }
  );
}

async function openConfig(page) {
  await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
  await page.locator('[data-view="config"]').click();
  await expect(page.locator('#topbar-title')).toHaveText('Configurações');
}

async function saveLocalConfig(page, value) {
  await page.evaluate((nextValue) => {
    window.state.config.pomodoroFoco = nextValue;
    window.scheduleSave();
  }, value);
}

async function saveLocalEvent(page, id) {
  await page.evaluate((entityId) => {
    window.state.eventos.push({
      id: entityId,
      titulo: 'Evento de status V1',
      data: '2026-04-30',
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'disc_1',
      assId: 'ass_1',
    });
    window.scheduleSave();
  }, id);
}

test.describe('V1 sync status UX', () => {
  test('keeps T5 first-use ahead of a local-only status and never requires manual sync', async ({
    page,
  }) => {
    await installHarness(page, { delayed: true });
    await page.goto('/');

    await expect(page.locator('[data-v1-sync-gate="preparing"]')).toBeVisible();
    await page.evaluate(() => window.__V1_STATUS_RELEASE_FETCH__());
    await openConfig(page);

    const status = page.locator('[data-testid="v1-sync-status"]');
    await expect(status).toHaveAttribute('data-state', 'salvo-neste-dispositivo');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toContainText('Salvo neste dispositivo');
    await expect(page.locator('[data-testid="sync-center"]')).toHaveCount(1);
    await expect(page.locator('[data-action="manual-sync-all"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="sync-center"]')).not.toContainText(
      'Tudo sincronizado'
    );
  });

  test('shows syncing until a real remote ACK, then reports synchronized', async ({ page }) => {
    await installHarness(page, { mode: 'hold' });
    await page.goto('/');
    await openConfig(page);

    await saveLocalConfig(page, 31);
    await expect.poll(() => page.evaluate(() => window.__V1_STATUS_TEST__.applies.length)).toBe(1);

    const status = page.locator('[data-testid="v1-sync-status"]');
    await expect(status).toHaveAttribute('data-state', 'sincronizando');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toContainText('Sincronizando');

    await page.evaluate(() => window.__V1_STATUS_RELEASE_APPLY__());
    await expect(status).toHaveAttribute('data-state', 'sincronizado');
    await expect(status).toContainText('Sincronizado');
  });

  test('shows a local-only state while offline', async ({ page, context }) => {
    await installHarness(page);
    await page.goto('/');
    await openConfig(page);
    await context.setOffline(true);

    await saveLocalConfig(page, 32);

    const status = page.locator('[data-testid="v1-sync-status"]');
    await expect(status).toHaveAttribute('data-state', 'salvo-neste-dispositivo');
    await expect(status).toContainText('offline');
    await expect(status).toContainText('dispositivo');
  });

  test('keeps one conflict as attention without duplicating the panel', async ({ page }) => {
    await installHarness(page, { mode: 'conflict' });
    await page.goto('/');
    await openConfig(page);

    await saveLocalEvent(page, 'ev_status_conflict');

    const status = page.locator('[data-testid="v1-sync-status"]');
    await expect(status).toHaveAttribute('data-state', 'atencao-necessaria');
    await expect(status).toHaveAttribute('aria-live', 'assertive');
    await expect(status).toContainText('1 item');
    await expect(status).toContainText('demais');
    await expect(page.locator('[data-testid="sync-center"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="v1-sync-status"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="backup-center"]')).toBeVisible();
  });

  test('turns repeated remote failures into accessible attention text', async ({ page }) => {
    await installHarness(page, { mode: 'error' });
    await page.goto('/');
    await openConfig(page);

    await saveLocalConfig(page, 34);

    const status = page.locator('[data-testid="v1-sync-status"]');
    await expect(status).toHaveAttribute('data-state', 'atencao-necessaria', { timeout: 8_000 });
    await expect(status).toHaveAttribute('aria-live', 'assertive');
    await expect(status).toContainText('Não foi possível sincronizar');
  });
});

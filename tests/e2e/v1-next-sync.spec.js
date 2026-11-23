import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

const UID = 'uid_e2e_sync';
const GENERATION = 'gen_e2e_sync';
const INITIAL_TITLE = 'DELTA INICIAL VERIFICADO';
const UPDATED_TITLE = 'DELTA REMOTO EM TEMPO REAL';

function remoteState(title) {
  const state = createE2EState();
  state.schemaVersion = 12;
  state.eventos.push({
    id: 'ev_remote_sync',
    titulo: title,
    data: '2026-04-22',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: 'disc_1',
    assId: 'ass_1',
  });
  return state;
}

async function installHarness(page) {
  await page.addInitScript(({
    uid,
    generationId,
    initialState,
    updatedState,
  }) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    window.__V1_REMOTE_CALLS__ = {
      fetchGenerationRecords: 0,
      getCurrentGeneration: 0,
      subscribeGeneration: 0,
      applyRemoteOperation: 0,
    };

    const generation = (async () => {
      const codec = await import('/js/sync/v1-next/backup-codec.js');
      const contracts = await import('/js/sync/v1-next/contracts.js');
      const sha = await import('/js/sync/v1-next/sha256.js');
      const initial = codec.convertBackupV12(initialState);
      const updated = codec.convertBackupV12(updatedState);
      const manifest = {
        schemaVersion: 1,
        generationId,
        migrationId: 'migration_e2e_sync',
        state: 'verified',
        revision: 0,
        sourceSha256: 'b'.repeat(64),
        businessDigest: initial.manifestDraft.businessDigest,
        counts: initial.manifestDraft.counts,
        updatedAt: { seconds: 1800000000, nanoseconds: 0 },
      };
      const initialRecords = Object.values(initial.records).flat();
      const initialRecord = initialRecords.find((record) => record.entityId === 'ev_remote_sync');
      const updatedRecord = Object.values(updated.records).flat()
        .find((record) => record.entityId === 'ev_remote_sync');
      const data = contracts.encodeRecordData(updatedRecord);
      return {
        control: {
          schemaVersion: 1,
          generationId,
          updatedAt: { seconds: 1800000000, nanoseconds: 0 },
        },
        manifest,
        initialRecords,
        remoteRecord: {
          schemaVersion: 1,
          generationId,
          entityType: initialRecord.entityType,
          entityId: initialRecord.entityId,
          collection: 'eventos',
          revision: 1,
          baseRevision: 0,
          opId: 'op_e2e_remote_1',
          opDigest: sha.sha256Utf8(data),
          deleted: false,
          data,
          updatedAt: { seconds: 1800000001, nanoseconds: 0 },
        },
      };
    })();

    window.__ESTUDO_V1_SYNC_TEST__ = {
      enabled: true,
      uid,
      remoteApi: {
        async getCurrentGeneration() {
          window.__V1_REMOTE_CALLS__.getCurrentGeneration += 1;
          const value = await generation;
          return {
            uid,
            generationId,
            control: value.control,
            manifest: value.manifest,
          };
        },
        async fetchGenerationRecords() {
          window.__V1_REMOTE_CALLS__.fetchGenerationRecords += 1;
          const value = await generation;
          return {
            generationId,
            manifest: value.manifest,
            records: value.initialRecords,
          };
        },
        subscribeGeneration(subscribedUid, subscribedGeneration, handlers) {
          window.__V1_REMOTE_CALLS__.subscribeGeneration += 1;
          window.__V1_EMIT_REMOTE_DELTA__ = async () => {
            const value = await generation;
            await handlers.onDelta({
              collection: 'eventos',
              entityId: 'ev_remote_sync',
              record: value.remoteRecord,
              changeType: 'modified',
              baseline: false,
            });
          };
          window.__V1_SUBSCRIPTION__ = { uid: subscribedUid, generationId: subscribedGeneration };
          return () => {
            window.__V1_EMIT_REMOTE_DELTA__ = null;
          };
        },
        async applyRemoteOperation() {
          window.__V1_REMOTE_CALLS__.applyRemoteOperation += 1;
          throw new Error('Remote delta must not create an outbox write');
        },
      },
    };
  }, {
    uid: UID,
    generationId: GENERATION,
    initialState: remoteState(INITIAL_TITLE),
    updatedState: remoteState(UPDATED_TITLE),
  });
}

async function waitForWorker(page) {
  await expect.poll(() => page.evaluate(() =>
    window.__V1_REMOTE_CALLS__?.subscribeGeneration || 0)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__V1_SUBSCRIPTION__)).toEqual({
    uid: UID,
    generationId: GENERATION,
  });
}

test.describe('V1 realtime worker', () => {
  test('accepts a verified online generation and applies a remote delta to UI and cache', async ({
    page,
  }) => {
    await installHarness(page);
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await waitForWorker(page);
    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.find((event) => event.id === 'ev_remote_sync')?.titulo))
      .toBe(INITIAL_TITLE);

    await page.evaluate(() => window.__V1_EMIT_REMOTE_DELTA__());

    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.find((event) => event.id === 'ev_remote_sync')?.titulo))
      .toBe(UPDATED_TITLE);
    await page.locator('#global-search').fill(UPDATED_TITLE);
    await expect(page.locator('#search-results')).toContainText(UPDATED_TITLE);
    expect(await page.evaluate(() => window.__V1_REMOTE_CALLS__.applyRemoteOperation)).toBe(0);
  });

  test('preserves an edit during apply and sends its successor after the original ACK', async ({ page }) => {
    await installHarness(page);
    await page.goto('/');
    await waitForWorker(page);
    await page.evaluate(async () => {
      const { saveStateToDB, state } = await import('/js/store.js?v=8.37');
      window.sentOperations = [];
      window.__ESTUDO_V1_SYNC_TEST__.remoteApi.applyRemoteOperation = async op => {
        window.sentOperations.push(op);
        if (op.entityId === 'ev_remote_sync' && !window.releaseFirstApply) {
          await new Promise(resolve => { window.releaseFirstApply = resolve; });
        }
        const { generationId, entityType, entityId, collection, baseRevision, revision, opId, opDigest } = op;
        return { acknowledged: true, receipt: { schemaVersion: 1, generationId, entityType,
          entityId, collection, baseRevision, revision, opId, opDigest, deleted: false,
          updatedAt: { seconds: 1800000001, nanoseconds: 0 } } };
      };
      window.editDuringApply = async title => {
        state.eventos.find(event => event.id === 'ev_remote_sync').titulo = title;
        await saveStateToDB();
      };
      await window.editDuringApply('Edit one');
    });
    await expect.poll(() => page.evaluate(() => !!window.releaseFirstApply)).toBe(true);
    await page.evaluate(async () => {
      await window.editDuringApply('Edit two');
      window.releaseFirstApply();
    });
    await expect.poll(() => page.evaluate(() => window.sentOperations.filter(
      op => op.entityId === 'ev_remote_sync').map(op => [op.baseRevision, op.revision, op.data.titulo])
    )).toEqual([[0, 1, 'Edit one'], [1, 2, 'Edit two']]);
    await expect.poll(() => page.evaluate(async ([uid, gen]) => {
      const local = await import('/js/sync/v1-next/local.js');
      return (await local.getPendingOperations(uid, gen)).length;
    }, [UID, GENERATION])).toBe(0);
    await page.locator('[data-view="config"]').click();
    const center = page.getByTestId('sync-center');
    await expect(center).toBeVisible();
    await expect(center.locator('[data-action*="force"], [data-action*="pull"], [data-action*="merge"], [data-action="download-from-source"], [data-action="manual-sync-all"]')).toHaveCount(0);
  });

  test('observes sign-out, same-account login and a switch to a separately installed UID', async ({ page }) => {
    await installHarness(page);
    await page.goto('/');
    await waitForWorker(page);
    await page.evaluate(async uid => {
      const { init } = await import('/js/app.js?v=8.37');
      const api = window.__ESTUDO_V1_SYNC_TEST__.remoteApi;
      await init({
        windowRef: {}, storage: { getItem: () => 'true' },
        initFirebaseServices: () => ({ configured: true, db: {}, auth: {} }),
        wireFirestores: () => {},
        observeFirebaseAuth: cb => {
          window.changeUser = cb;
          cb({ uid });
          return () => {};
        },
        remoteApi: { ...api, getCurrentGeneration: async account => ({
          ...await api.getCurrentGeneration(), uid: account,
        }) },
      });
      window.changeUser(null);
    }, UID);
    await expect(page.locator('[data-v1-sync-gate="blocked"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!window.__V1_EMIT_REMOTE_DELTA__)).toBe(false);
    await page.evaluate(uid => window.changeUser({ uid }), UID);
    await expect.poll(() => page.evaluate(() => !!window.__V1_EMIT_REMOTE_DELTA__)).toBe(true);
    await page.evaluate(() => window.changeUser({ uid: 'account_b' }));
    await expect.poll(() => page.evaluate(() => window.__V1_SUBSCRIPTION__.uid)).toBe('account_b');
    expect(await page.evaluate(async () => {
      const local = await import('/js/sync/v1-next/local.js');
      return (await local.readV1GenerationPointer('account_b')).status;
    })).toBe('ready');
  });

  test('starts the listener from a verified online cache and applies deltas without manual sync', async ({
    page,
  }) => {
    await installHarness(page);
    await page.goto('/');
    await waitForWorker(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await waitForWorker(page);
    expect(await page.evaluate(() => window.__V1_REMOTE_CALLS__.fetchGenerationRecords)).toBe(0);

    await page.evaluate(() => window.__V1_EMIT_REMOTE_DELTA__());

    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.find((event) => event.id === 'ev_remote_sync')?.titulo))
      .toBe(UPDATED_TITLE);
    await page.locator('#global-search').fill(UPDATED_TITLE);
    await expect(page.locator('#search-results')).toContainText(UPDATED_TITLE);
  });
});

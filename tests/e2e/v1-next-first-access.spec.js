import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

const UID = 'uid_e2e_v1';
const GENERATION = 'gen_e2e_v1';
const LEGACY_TITLE = 'LEGADO NAO DEVE APARECER';
const REMOTE_TITLE = 'BASELINE REMOTA CONTROLADA';

function legacyState() {
  const legacy = createE2EState();
  legacy.eventos.push({
    id: 'ev_legacy',
    titulo: LEGACY_TITLE,
    data: '2026-04-18',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: 'disc_1',
    assId: 'ass_1',
  });
  return legacy;
}

function remoteState() {
  const state = createE2EState();
  state.schemaVersion = 12;
  state.eventos.push({
    id: 'ev_remote',
    titulo: REMOTE_TITLE,
    data: '2026-04-19',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: 'disc_1',
    assId: 'ass_1',
  });
  return state;
}

async function installHarness(page, { remote = false, delayed = false } = {}) {
  await page.addInitScript(({
    uid,
    generationId,
    legacy,
    controlledRemote,
    useRemote,
    delayFetch,
  }) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', JSON.stringify(legacy));
    window.__V1_REMOTE_CALLS__ = { getCurrentGeneration: 0, fetchGenerationRecords: 0 };

    if (!useRemote) {
      window.__ESTUDO_V1_SYNC_TEST__ = { enabled: true, uid };
      return;
    }

    const generation = (async () => {
      const codec = await import('/js/sync/v1-next/backup-codec.js');
      const converted = codec.convertBackupV12(controlledRemote);
      const manifest = {
        schemaVersion: 1,
        generationId,
        migrationId: 'migration_e2e',
        state: 'active',
        revision: 0,
        sourceSha256: 'a'.repeat(64),
        businessDigest: converted.manifestDraft.businessDigest,
        counts: converted.manifestDraft.counts,
        updatedAt: { seconds: 1800000000, nanoseconds: 0 },
      };
      return {
        generationId,
        control: {
          schemaVersion: 1,
          generationId,
          updatedAt: { seconds: 1800000000, nanoseconds: 0 },
        },
        manifest,
        records: Object.values(converted.records).flat(),
      };
    })();

    window.__ESTUDO_V1_SYNC_TEST__ = {
      enabled: true,
      uid,
      remoteApi: {
        async getCurrentGeneration() {
          window.__V1_REMOTE_CALLS__.getCurrentGeneration += 1;
          const value = await generation;
          return { uid, generationId, control: value.control, manifest: value.manifest };
        },
        async fetchGenerationRecords() {
          window.__V1_REMOTE_CALLS__.fetchGenerationRecords += 1;
          if (delayFetch) {
            await new Promise((resolve) => {
              window.__V1_RELEASE_FETCH__ = resolve;
            });
          }
          const value = await generation;
          return {
            generationId,
            manifest: value.manifest,
            records: value.records,
          };
        },
      },
    };
  }, {
    uid: UID,
    generationId: GENERATION,
    legacy: legacyState(),
    controlledRemote: remoteState(),
    useRemote: remote,
    delayFetch: delayed,
  });
}

async function expectFirstAccessLocked(page, status) {
  await expect(page.locator(`[data-v1-sync-gate="${status}"]`)).toBeVisible();
  await expect(page.locator('#topbar-title')).toHaveText('Preparando dados');
  await expect(page.locator('#main-content')).not.toContainText(LEGACY_TITLE);
  await expect(page.locator('button:has-text("Iniciar Estudo")')).toHaveCount(0);
  await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  await expect(page.locator('.topbar')).toHaveAttribute('inert', '');
  await expect(page.locator('.modal-overlay:not([inert])')).toHaveCount(0);
  await expect(page.locator('body')).toHaveClass(/v1-sync-gated/);
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.querySelector('.topbar')).pointerEvents))
    .toBe('none');
}

async function waitForOfflineShell(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
}

test.describe('V1 first access gate', () => {
  test.use({ serviceWorkers: 'allow' });

  test('blocks real offline first access without a verified cache or legacy render', async ({
    context,
    page,
  }) => {
    await installHarness(page);
    await page.goto('/');
    await waitForOfflineShell(page);
    await context.setOffline(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectFirstAccessLocked(page, 'requires-network');
    expect(await page.evaluate(() => localStorage.getItem('estudo_state')))
      .not.toBeNull();
  });

  test('keeps the gate ahead of initDB while the controlled first baseline downloads', async ({
    page,
  }) => {
    await installHarness(page, { remote: true, delayed: true });
    await page.goto('/');

    await expectFirstAccessLocked(page, 'preparing');
    expect(await page.evaluate(() => localStorage.getItem('estudo_state')))
      .not.toBeNull();
    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.some((event) => event.titulo === 'LEGADO NAO DEVE APARECER')))
      .toBe(false);

    await page.evaluate(() => window.__V1_RELEASE_FETCH__());

    await expect(page.locator('[data-v1-sync-gate]')).toHaveCount(0);
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.some((event) => event.titulo === 'BASELINE REMOTA CONTROLADA')))
      .toBe(true);
    await expect(page.locator('#main-content')).not.toContainText(LEGACY_TITLE);
    await expect(page.locator('#sidebar')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.topbar')).not.toHaveAttribute('inert', '');
    await expect(page.locator('body')).not.toHaveClass(/v1-sync-gated/);
  });

  test('opens the installed verified cache offline without contacting the remote API', async ({
    context,
    page,
  }) => {
    await installHarness(page, { remote: true });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.some((event) => event.titulo === 'BASELINE REMOTA CONTROLADA')))
      .toBe(true);
    await waitForOfflineShell(page);
    await context.setOffline(true);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-v1-sync-gate]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() =>
      window.state?.eventos?.some((event) => event.titulo === 'BASELINE REMOTA CONTROLADA')))
      .toBe(true);
    await expect(page.locator('#main-content')).not.toContainText(LEGACY_TITLE);
    expect(await page.evaluate(() => window.__V1_REMOTE_CALLS__)).toEqual({
      getCurrentGeneration: 0,
      fetchGenerationRecords: 0,
    });
  });
});

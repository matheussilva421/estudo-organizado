import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

const UID = 'uid_e2e_v1';
const GENERATION = 'gen_e2e_v1';

function seedFlaggedLegacy(page, legacyTitle) {
  const legacy = createE2EState();
  legacy.eventos.push({
    id: 'ev_legacy',
    titulo: legacyTitle,
    data: '2026-04-18',
    status: 'agendado',
    tempoAcumulado: 0,
    discId: 'disc_1',
    assId: 'ass_1',
  });

  return page.addInitScript(({ state, uid }) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_v1_sync_enabled', 'true');
    localStorage.setItem('estudo_v1_sync_uid', uid);
    localStorage.setItem('estudo_state', JSON.stringify(state));
  }, { state: legacy, uid: UID });
}

test.describe('V1 first access gate', () => {
  test('does not show or enable legacy state while the first verified baseline is missing', async ({ page }) => {
    await seedFlaggedLegacy(page, 'LEGADO NAO DEVE APARECER');

    await page.goto('/');

    await expect(page.locator('[data-v1-sync-gate="blocked"]')).toBeVisible();
    await expect(page.locator('#topbar-title')).toHaveText('Preparando dados');
    await expect(page.locator('#main-content')).not.toContainText('LEGADO NAO DEVE APARECER');
    await expect(page.locator('button:has-text("Iniciar Estudo")')).toHaveCount(0);
    await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
  });

  test('opens an installed verified cache without rendering legacy as the current generation', async ({ page }) => {
    const legacyTitle = 'LEGADO NAO DEVE APARECER';
    const cacheTitle = 'CACHE V1 E2E';
    await seedFlaggedLegacy(page, legacyTitle);
    await page.goto('/');
    await expect(page.locator('[data-v1-sync-gate]')).toBeVisible();

    const cacheState = createE2EState();
    cacheState.schemaVersion = 12;
    cacheState.eventos.push({
      id: 'ev_cache',
      titulo: cacheTitle,
      data: '2026-04-18',
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'disc_1',
      assId: 'ass_1',
    });
    await page.evaluate(async ({ state, uid, generationId }) => {
      const codec = await import('/js/sync/v1-next/backup-codec.js');
      const local = await import('/js/sync/v1-next/local.js');
      const converted = codec.convertBackupV12(state);
      await local.installRemoteBaseline({
        uid,
        generationId,
        state,
        manifest: {
          schemaVersion: 1,
          generationId,
          migrationId: 'migration_e2e',
          state: 'active',
          revision: 0,
          sourceSha256: 'a'.repeat(64),
          businessDigest: converted.manifestDraft.businessDigest,
          counts: converted.manifestDraft.counts,
          updatedAt: { seconds: 1800000000, nanoseconds: 0 },
        },
      });
    }, { state: cacheState, uid: UID, generationId: GENERATION });

    await page.reload();

    await expect(page.locator('[data-v1-sync-gate]')).toHaveCount(0);
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect.poll(() => page.evaluate(() => window.state?.eventos?.[0]?.titulo))
      .toBe(cacheTitle);
    await expect(page.locator('#main-content')).not.toContainText(legacyTitle);
    await expect(page.locator('#sidebar')).not.toHaveAttribute('inert', '');
  });
});

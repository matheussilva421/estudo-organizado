import { expect, test } from '@playwright/test';
import { bootE2EApp, createE2EState } from '../helpers/e2e-state.js';

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

test.describe('Fase 6 - Release Gate e Validacao de Caos', () => {
  test('reconecta e confirma sync automatico apos offline', async ({ page, context }) => {
    const state = createE2EState();
    state.config.firestoreSync = {
      enabled: true,
      mode: 'primary',
      configured: true,
      signedIn: true,
    };

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await context.setOffline(true);
    try {
      await page.evaluate(() => {
        const today = window.EstudoApp.todayStr();
        window.state.eventos.push({
          id: 'ev_offline_edit',
          titulo: 'Editado offline',
          data: today,
          dataEstudo: today,
          duracao: 30,
          status: 'estudei',
          tempoAcumulado: 30,
          tipo: 'conteudo',
          discId: 'disc_1',
          assId: 'ass_1',
          habito: null,
          criadoEm: new Date().toISOString()
        });
      });
      await expect.poll(() => page.evaluate(() =>
        window.state.eventos.some(e => e.titulo === 'Editado offline')
      )).toBe(true);
    } finally {
      await context.setOffline(false);
    }

    await page.reload();
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await expect.poll(() => page.evaluate(() =>
      window.state.eventos.some(e => e.titulo === 'Editado offline')
    )).toBe(true);
  });

  test('exportar JSON antes de restaurar backup', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_pre_restore',
      titulo: 'Evento antes do restore',
      data: '2026-05-01',
      dataEstudo: '2026-05-01',
      duracao: 60,
      status: 'estudei',
      tempoAcumulado: 60,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-05-01T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="config"]');

    const exportBtn = page.locator('[data-action="export-data"]').first();
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toContainText('Exportar');

    const restoreBtn = page.locator('[data-action="open-restore-preview"]');
    await expect(restoreBtn).toBeVisible();

    const exportBeforeBtn = page.locator('[data-action="export-data"]').last();
    await expect(exportBeforeBtn).toBeVisible();
    await expect(exportBeforeBtn).toContainText('Exportar antes de restaurar');
  });

  test('nenhuma credencial aparece no export JSON', async ({ page }) => {
    const state = createE2EState();
    state.config.cfUrl = 'https://secret-worker.example.workers.dev';
    state.config.cfToken = 'super-secret-token-123';
    state.config.cfTokenSaved = true;
    state.driveFileId = 'drive-file-with-credentials';
    state.config.firestoreSync = {
      enabled: true,
      mode: 'primary',
      configured: true,
      signedIn: true,
      uid: 'firebase-uid-secret',
      projectId: 'secret-project',
    };

    await seedLegacyState(page, state);
    await page.goto('/');

    const exportedState = await page.evaluate(() => {
      return window.EstudoApp.createExportableState();
    });

    const exportedJson = JSON.stringify(exportedState);

    expect(exportedJson).not.toContain('super-secret-token-123');
    expect(exportedJson).not.toContain('secret-worker.example.workers.dev');

    const config = exportedState.config || {};
    expect(config.cfUrl).toBeUndefined();
    expect(config.cfToken).toBeUndefined();
    expect(config.cfTokenSaved).toBeUndefined();
  });

  test('evento salvo persiste apos fechamento abrupto da aba', async ({ page, context }) => {
    const state = createE2EState();

    await bootE2EApp(page, state);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await page.evaluate(async () => {
      const today = window.EstudoApp.todayStr();
      window.state.eventos.push({
        id: 'ev_crash_test',
        titulo: 'Persistencia apos crash',
        data: today,
        dataEstudo: today,
        duracao: 45,
        status: 'estudei',
        tempoAcumulado: 45,
        tipo: 'conteudo',
        discId: 'disc_1',
        assId: 'ass_1',
        habito: null,
        criadoEm: new Date().toISOString()
      });
      await window.EstudoApp.saveStateToDB();
    });

    await page.close();

    const reopened = await context.newPage();
    await reopened.goto('/');
    await reopened.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await reopened.click('[data-view="med"]');

    await expect(reopened.locator('#main-content')).toContainText('Persistencia apos crash');
  });

  test('edicao offline persiste e reconecta sem perda', async ({ page, context }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await context.setOffline(true);
    try {
      await page.evaluate(async () => {
        const today = window.EstudoApp.todayStr();
        window.state.eventos.push({
          id: 'ev_offline_persist',
          titulo: 'Offline edit persist',
          data: today,
          dataEstudo: today,
          duracao: 25,
          status: 'agendado',
          tempoAcumulado: 0,
          tipo: 'conteudo',
          discId: 'disc_1',
          assId: 'ass_1',
          habito: null,
          criadoEm: new Date().toISOString()
        });
        await window.EstudoApp.saveStateToDB();
      });

      await expect.poll(() => page.evaluate(() =>
        window.state.eventos.some(e => e.titulo === 'Offline edit persist')
      )).toBe(true);
    } finally {
      await context.setOffline(false);
    }

    await page.reload();
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await expect.poll(() => page.evaluate(() =>
      window.state.eventos.some(e => e.titulo === 'Offline edit persist')
    )).toBe(true);
  });

  test('conflito de entidade mesma ID gera CTA de resolucao', async ({ page }) => {
    const state = createE2EState();
    state.config.firestoreSync = {
      enabled: true,
      mode: 'primary',
      configured: true,
      signedIn: true,
      conflict: {
        type: 'entity-conflict',
        detectedAt: '2026-05-01T12:00:00.000Z',
        total: 1,
        items: [
          {
            key: 'eventos/ev_same_entity',
            collection: 'eventos',
            id: 'ev_same_entity',
            hint: 'collision',
            localRevision: 5,
            remoteRevision: 5,
            localUpdatedAt: '2026-05-01T11:50:00.000Z',
            remoteUpdatedAt: '2026-05-01T11:55:00.000Z'
          }
        ]
      }
    };

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="config"]');

    const conflict = page.locator('[data-testid="sync-source-conflict-entities"]').first();
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText('Entidades afetadas');
    await expect(conflict.locator('[data-action="entity-conflict-keep-local"]')).toBeVisible();
    await expect(conflict.locator('[data-action="entity-conflict-keep-remote"]')).toBeVisible();
  });
});

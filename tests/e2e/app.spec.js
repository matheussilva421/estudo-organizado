import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

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

test.describe('Estudo Organizado', () => {
  test('boots the app and renders the home dashboard from seeded state', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_done',
      titulo: 'Revisar constitucional',
      data: '2026-04-18',
      dataEstudo: new Date().toISOString().slice(0, 10),
      duracao: 90,
      status: 'estudei',
      tempoAcumulado: 5400,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-18T12:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');
    await expect(page.locator('#main-content')).toContainText('01:30:00');
    await expect(page.locator('#main-content')).toContainText('PREVISÃO DA SEMANA');
  });

  test('creates a study event and keeps it visible after reload', async ({ page }) => {
    const state = createE2EState();
    const eventTitle = 'Sessão E2E de Constitucional';

    await seedLegacyState(page, state);
    await page.goto('/');

    await page.click('button:has-text("Iniciar Estudo")');
    await expect(page.locator('#modal-event.open')).toBeVisible();

    await page.selectOption('#event-disc', 'disc_1');
    await page.fill('#event-titulo', eventTitle);
    await page.selectOption('#event-duracao', '90');
    await page.click('button:has-text("Salvar / Iniciar")');

    await expect(page.locator('#toast-container')).toContainText('Estudo iniciado/agendado!');

    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);

    await page.evaluate(async () => {
      await window.saveStateToDB?.();
    });

    await page.reload();
    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);

    await page.click('[data-view="calendar"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);
  });
});

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

test.describe('Registro de Sessoes', () => {
  test('manual session registration creates a valid history entry', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_manual_session',
      titulo: 'Sessao manual E2E',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: null,
      duracao: 45,
      status: 'agendado',
      tempoAcumulado: 2700,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Nenhuma sess');

    await page.evaluate(() => {
      window.openRegistroSessao('ev_manual_session');
    });

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
    await page.selectOption('#reg-disciplina', 'disc_1');
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="toggle-study-type"][data-tipo="questoes"]');
    await page.fill('#reg-q-total', '10');
    await page.fill('#reg-q-acertos', '8');
    await page.fill('#reg-q-erros', '2');
    await page.click('[data-action="save-registro-sessao"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
    await expect(page.locator('#main-content')).toContainText('45');
  });

  test('chronometer saves a new session with tracked time', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.click('[data-action="toggle-timer"][data-event-id="crono_livre"]');
    await page.waitForTimeout(1100);
    await page.click('[data-action="mark-studied"][data-event-id="crono_livre"]');

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
    await page.selectOption('#reg-disciplina', 'disc_1');
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="toggle-study-type"][data-tipo="revisao"]');
    await page.click('[data-action="save-registro-sessao"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await page.click('[data-view="historico-sessoes"]');
    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
  });
});

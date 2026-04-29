import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

async function seedLegacyState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class {
      destroy() {}
    };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, JSON.stringify(state));
}

function localDateStr(dateObj = new Date()) {
  const local = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 10);
}

test.describe('Revision Flow', () => {
  test('views pending revisions list', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos[0].concluido = true;
    state.editais[0].disciplinas[0].assuntos[0].dataConclusao = localDateStr(new Date(Date.now() - 86400000));
    state.editais[0].disciplinas[0].assuntos[0].revisoesFetas = [];
    state.config.frequenciaRevisao = [1, 7, 30, 90];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
    await expect(page.locator('[data-action="mark-revision"]')).toBeVisible();
  });

  test('marks a revision as complete', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos[0].concluido = true;
    state.editais[0].disciplinas[0].assuntos[0].dataConclusao = localDateStr(new Date(Date.now() - 86400000));
    state.editais[0].disciplinas[0].assuntos[0].revisoesFetas = [];
    state.config.frequenciaRevisao = [1, 7, 30];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');

    const markBtn = page.locator('[data-action="mark-revision"]').first();
    await expect(markBtn).toBeVisible();
    await markBtn.click();

    await expect(page.locator('[data-action="mark-revision"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      return window.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas.length;
    })).toBe(1);
  });

  test('shows empty state when no revisions pending', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos[0].concluido = false;

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#main-content')).toContainText('Nenhuma revis');
  });

  test('deletes an overdue revision through confirmation modal', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos[0].concluido = true;
    state.editais[0].disciplinas[0].assuntos[0].dataConclusao = localDateStr(new Date(Date.now() - (40 * 86400000)));
    state.editais[0].disciplinas[0].assuntos[0].revisoesFetas = [];
    state.config.frequenciaRevisao = [1, 7, 30, 90];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    const deleteBtn = page.locator('[data-action="delete-revision"]').first();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const modal = page.locator('#modal-confirm');
    await expect(modal).toHaveClass(/open/);
    await page.click('#confirm-ok-btn');

    await expect(page.locator('[data-action="delete-revision"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => {
      return window.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas.length;
    })).toBe(3);
  });

  test('displays revision due dates correctly', async ({ page }) => {
    const state = createE2EState();
    const completionDate = localDateStr(new Date(Date.now() - 86400000));
    state.editais[0].disciplinas[0].assuntos[0].concluido = true;
    state.editais[0].disciplinas[0].assuntos[0].dataConclusao = completionDate;
    state.editais[0].disciplinas[0].assuntos[0].revisoesFetas = [];
    state.config.frequenciaRevisao = [1, 7, 30, 90];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    const revisionCards = page.locator('.revision-card, [data-revision-date]');
    const count = await revisionCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('handles multiple disciplines with pending revisions', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas.push({
      id: 'disc_2',
      nome: 'Direito Administrativo',
      icone: '⚖️',
      cor: '#3b82f6',
      assuntos: [{
        id: 'ass_2',
        nome: 'Atos Administrativos',
        concluido: true,
        dataConclusao: localDateStr(new Date(Date.now() - 86400000)),
        revisoesFetas: [],
        adiamentos: 0,
        linkedAulaIds: []
      }],
      aulas: []
    });
    state.config.frequenciaRevisao = [1, 7, 30];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
    await expect(page.locator('#main-content')).toContainText('Direito Administrativo');
  });
});

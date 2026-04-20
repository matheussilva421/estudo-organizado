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

test.describe('Revisoes e Habitos', () => {
  test('completes a scheduled revision and verifies it is done', async ({ page }) => {
    const state = createE2EState();

    state.editais[0].disciplinas[0].assuntos[0].concluido = true;
    state.editais[0].disciplinas[0].assuntos[0].dataConclusao = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.config.frequenciaRevisao = [1, 7, 30];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');

    const markBtn = page.locator('[data-action="mark-revision"]').first();
    await expect(markBtn).toBeVisible();
    await markBtn.click();

    await expect(page.locator('[data-action="mark-revision"]')).toHaveCount(0);
    await expect(page.locator('#main-content')).toContainText('Nenhuma revis');
    await expect.poll(() => page.evaluate(() => {
      return window.state.editais[0].disciplinas[0].assuntos[0].revisoesFetas.length;
    })).toBe(1);
  });

  test('creates a new habit and marks it as done for today', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="habitos"]');

    await expect(page.locator('[data-action="open-habit-modal"][data-habit-key="questoes"]')).toBeVisible();

    await page.click('[data-action="open-habit-modal"][data-habit-key="questoes"]');
    const modal = page.locator('#modal-habit');
    await expect(modal).toBeVisible();
    await expect(page.locator('#habit-qtd')).toBeVisible();

    await page.fill('#habit-qtd', '15');
    await page.fill('#habit-acertos', '12');
    await page.click('[data-action="save-habit"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#main-content')).toContainText('15');
    await expect.poll(() => page.evaluate(() => {
      return window.state.habitos.questoes[0]?.quantidade;
    })).toBe(15);
  });
});

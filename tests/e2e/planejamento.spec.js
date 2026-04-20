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

test.describe('Planejamento de Estudos (Wizard)', () => {
  test('completes the planning wizard flow', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);
    await page.goto('/');

    // Go to Ciclo de Estudos
    await page.click('[data-view="ciclo"]');

    // Click "Gerar Novo Planejamento" if it exists, or open wizard
    await page.click('[data-action="open-planejamento-wizard"]');
    const wizardModal = page.locator('#modal-planejamento');
    await expect(wizardModal).toBeVisible();

    // Step 1: Organização (Should default to Ciclo)
    await expect(page.locator('#pw-step-1')).toHaveCSS('color', /rgb\(16, 185, 129\)|rgb\(.*var\(--accent\).*\)/i); // Assuming active step has some styling, but better to check button
    await page.click('[data-action="pw-select-tipo"][data-tipo="ciclo"]');
    await page.click('#pw-btn-proximo');

    // Step 2: Disciplinas
    // Need to select at least one discipline. The UI probably renders checkboxes.
    // We will click the first discipline checkbox.
    const discCheckboxes = page.locator('.pw-disc-card');
    if (await discCheckboxes.count() > 0) {
      await discCheckboxes.first().click();
    }
    await page.click('#pw-btn-proximo');

    // Step 3: Relevância
    await page.click('#pw-btn-proximo');

    // Step 4: Horários
    await page.fill('input[data-action="pw-update-hours"][data-field="horasSemanais"]', '20');
    // Ensure the event is caught by the logic
    await page.evaluate(() => {
        window.pwUpdateHours('horasSemanais', '20');
    });
    
    // Finish wizard
    await page.waitForSelector('#pw-btn-concluir:not([disabled])');
    await page.click('#pw-btn-concluir');
    
    // Wait a bit for toast to appear if there's an error
    await page.waitForTimeout(500);
    const toasts = await page.locator('.toast-container .toast').allTextContents();
    if (toasts.length > 0) {
      console.log('Toasts shown:', toasts);
    }
    
    await expect(wizardModal).not.toHaveClass(/open/);

    // Check if the plan is active in the cycle view
    await expect(page.locator('#main-content')).toContainText('CICLOS COMPLETOS');

    await page.click('[data-action="iniciar-etapa-planejamento"]');
    // After starting planning, user should be in cycle/cronometro view
    await expect(page.locator('#topbar-title')).toHaveText(/Ciclo|Cron/);
    await expect.poll(() => page.evaluate(() => {
      return window.state.eventos.some(evento => evento.seqId && evento.status === 'agendado');
    })).toBe(true);

    await page.click('[data-view="ciclo"]');
    
    // Check cycle history modal
    // Assuming there's a button to view history
    const historyBtn = page.locator('[data-action="open-ciclo-history"]').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await expect(page.locator('#modal-ciclo-history')).toBeVisible();
      await page.click('#modal-ciclo-history .modal-close');
    }
  });
});

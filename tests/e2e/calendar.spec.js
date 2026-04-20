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

test.describe('Calendario', () => {
  test('creates a study event from a calendar date', async ({ page }) => {
    const state = createE2EState();
    const title = 'Evento criado pelo calendario';

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="calendar"]');

    const dateTarget = page.locator('[data-action="open-event-modal-date"]').first();
    await expect(dateTarget).toBeVisible();
    const date = await dateTarget.getAttribute('data-date');
    await dateTarget.click({ force: true });

    const modal = page.locator('#modal-event');
    await expect(modal).toHaveClass(/open/);
    await expect(page.locator('#event-data')).toHaveValue(date);

    await page.selectOption('#event-disc', 'disc_1');
    await page.fill('#event-titulo', title);
    await page.selectOption('#event-duracao', '60');
    await page.click('[data-action="save-event"]');

    await expect(modal).not.toHaveClass(/open/);
    await expect(page.locator('#main-content')).toContainText(title);
    await expect.poll(() => page.evaluate((eventTitle) => {
      return window.state.eventos.some(evento => evento.titulo === eventTitle);
    }, title)).toBe(true);
  });
});

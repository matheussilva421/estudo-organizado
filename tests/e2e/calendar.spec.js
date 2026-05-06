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

  test('opens and deletes an existing calendar event from the detail modal', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_calendar_delete',
      titulo: 'Evento para apagar no calendario',
      data: '2026-05-06',
      status: 'agendado',
      tempoAcumulado: 0,
      duracao: 60,
      tipo: 'conteudo',
      discId: 'disc_1',
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="calendar"]');

    const chip = page.locator('[data-action="open-event-detail"][data-event-id="ev_calendar_delete"]');
    await expect(chip).toBeVisible();
    await chip.click();

    const detailModal = page.locator('#modal-event-detail');
    await expect(detailModal).toHaveClass(/open/);
    await expect(page.locator('#modal-event-detail-title')).toHaveText('Evento para apagar no calendario');

    await page.click('[data-action="delete-event-from-modal"][data-event-id="ev_calendar_delete"]');
    await expect(page.locator('#modal-confirm')).toHaveClass(/open/);
    await page.click('#confirm-ok-btn');

    await expect(detailModal).not.toHaveClass(/open/);
    await expect(chip).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      return window.state.eventos.some((evento) => evento.id === 'ev_calendar_delete');
    })).toBe(false);
  });
});

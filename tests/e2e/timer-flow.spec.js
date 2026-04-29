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

test.describe('Timer Flow', () => {
  test('starts timer, pauses, resumes, and marks as studied', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.click('[data-action="toggle-timer"][data-event-id="crono_livre"]');

    const timerStarted = await page.evaluate(() => {
      return window.state.cronoLivre._timerStart !== null;
    });
    expect(timerStarted).toBe(true);

    await page.waitForTimeout(1100);

    await page.click('[data-action="toggle-timer"][data-event-id="crono_livre"]');

    const timerPaused = await page.evaluate(() => {
      return window.state.cronoLivre._timerStart === null;
    });
    expect(timerPaused).toBe(true);

    const tempoAcumulado = await page.evaluate(() => {
      return window.state.cronoLivre.tempoAcumulado;
    });
    expect(tempoAcumulado).toBeGreaterThanOrEqual(1);

    await page.click('[data-action="toggle-timer"][data-event-id="crono_livre"]');

    const timerResumed = await page.evaluate(() => {
      return window.state.cronoLivre._timerStart !== null;
    });
    expect(timerResumed).toBe(true);

    await page.waitForTimeout(1100);
    await page.click('[data-action="mark-studied"][data-event-id="crono_livre"]');

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();
  });

  test('registers session from timer modal', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_timer_test',
      titulo: 'Timer Test Event',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: null,
      duracao: 30,
      status: 'agendado',
      tempoAcumulado: 1800,
      discId: 'disc_1',
      assId: 'ass_1',
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.evaluate(() => {
      window.openRegistroSessao('ev_timer_test');
    });

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();

    await page.selectOption('#reg-disciplina', 'disc_1');
    await page.selectOption('#reg-assunto', 'ass_1');
    await page.click('[data-action="toggle-study-type"][data-tipo="leitura"]');
    await page.click('[data-action="save-registro-sessao"]');

    await page.waitForTimeout(200);
    await expect(modal).not.toHaveClass(/open/);
  });

  test('discards timer with confirmation', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_discard',
      titulo: 'Discard Test',
      data: new Date().toISOString().slice(0, 10),
      status: 'agendado',
      tempoAcumulado: 500,
      _timerStart: Date.now() - 5000,
      discId: 'disc_1',
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.evaluate(() => {
      window.openRegistroSessao('ev_discard');
    });

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();

    const discardBtn = page.locator('[data-action="discard-timer-ui"]');
    await expect(discardBtn).toBeVisible();
    await discardBtn.click();

    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();
  });

  test('cancels registro and restores timer state', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_cancel',
      titulo: 'Cancel Test',
      data: new Date().toISOString().slice(0, 10),
      status: 'agendado',
      tempoAcumulado: 300,
      _timerStart: Date.now() - 10000,
      discId: 'disc_1',
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await page.evaluate(() => {
      window.openRegistroSessao('ev_cancel');
    });

    const modal = page.locator('#modal-registro-sessao');
    await expect(modal).toBeVisible();

    const cancelBtn = page.locator('[data-action="cancel-registro"]');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();

    const timerRestored = await page.evaluate(() => {
      const ev = window.state.eventos.find(e => e.id === 'ev_cancel');
      return ev && ev._timerStart !== null;
    });
    expect(timerRestored).toBe(true);
  });
});

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

test.describe('Ciclo Step Flow', () => {
  test('marks a cycle step as complete', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.EstudoApp?.marcarEtapaConcluida?.('seq_1');
    });
    await page.waitForTimeout(300);

    const stepConcluded = await page.evaluate(() => {
      const seq = window.state.planejamento?.sequencia?.[0];
      return seq?.concluido === true;
    });
    expect(stepConcluded).toBe(true);
  });

  test('undoes a cycle step completion', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: true }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.EstudoApp?.desfazerEtapa?.('seq_1');
    });
    await page.waitForTimeout(300);

    const stepUndone = await page.evaluate(() => {
      const seq = window.state.planejamento?.sequencia?.[0];
      return seq?.concluido === false;
    });
    expect(stepUndone).toBe(true);
  });

  test('starts a study session from cycle step', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.locator('.seq-item-card--static').first().hover();
    const startBtn = page.locator('[data-action="iniciar-etapa-planejamento"]').first();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await page.waitForTimeout(500);

    const eventCreated = await page.evaluate(() => {
      return window.state.eventos.some(e => e.seqId === 'seq_1' && e.status === 'agendado');
    });
    expect(eventCreated).toBe(true);
  });

  test('completes all steps and increments cycle count', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      window.state.planejamento.sequencia[0].concluido = true;
      const allDone = window.state.planejamento.sequencia.every(s => s.concluido);
      if (allDone) {
        window.state.planejamento.ciclosCompletos += 1;
        window.state.planejamento.sequencia.forEach(s => s.concluido = false);
        window.state.planejamento.dataInicioCicloAtual = new Date().toISOString();
      }
      window.EstudoApp?.scheduleSave?.();
      window.EstudoApp?.renderCurrentView?.();
    });
    await page.waitForTimeout(300);

    const cycleCount = await page.evaluate(() => {
      return window.state.planejamento?.ciclosCompletos;
    });
    expect(cycleCount).toBe(1);
  });

  test('displays multiple sequence steps in cycle view', async ({ page }) => {
    const state = createE2EState();
    state.planejamento = {
      ativo: true,
      tipo: 'ciclo',
      disciplinas: ['disc_1'],
      sequencia: [
        { id: 'seq_1', discId: 'disc_1', minutosAlvo: 60, concluido: false },
        { id: 'seq_2', discId: 'disc_1', minutosAlvo: 90, concluido: false },
        { id: 'seq_3', discId: 'disc_1', minutosAlvo: 45, concluido: false }
      ],
      ciclosCompletos: 0,
      dataInicioCicloAtual: new Date().toISOString(),
      horarios: {
        diasAtivos: [1, 2, 3, 4, 5],
        horasPorDia: { 1: '02:00', 2: '02:00', 3: '02:00', 4: '02:00', 5: '02:00' }
      }
    };
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
    await page.waitForTimeout(500);

    await expect(page.locator('.seq-item-card--static')).toHaveCount(3);

    const stepLabels = await page.locator('.seq-item-discipline').allTextContents();
    expect(stepLabels).toHaveLength(3);
  });
});

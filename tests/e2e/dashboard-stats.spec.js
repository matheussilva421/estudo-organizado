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

test.describe('Dashboard Discipline Stats', () => {
  test('displays discipline time stats', async ({ page }) => {
    const state = createE2EState();
    const today = localDateStr();
    state.eventos = [
      {
        id: 'ev_dash_1',
        titulo: 'Direito Constitucional - Controle',
        data: today,
        dataEstudo: today,
        status: 'estudei',
        tempoAcumulado: 3600,
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { tiposEstudo: ['leitura'] }
      }
    ];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const btn = document.querySelector('[data-action="open-disc-dashboard"][data-disc-id="disc_1"]');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    const dashboardVisible = await page.evaluate(() => {
      const modal = document.getElementById('modal-disc-dashboard');
      return modal && modal.classList.contains('open');
    });

    const discName = await page.evaluate(() => {
      return window.state.editais[0]?.disciplinas?.[0]?.nome;
    });
    expect(discName).toBe('Direito Constitucional');
  });

  test('filters dashboard by discipline', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas.push({
      id: 'disc_2',
      nome: 'Direito Administrativo',
      icone: '⚖️',
      cor: '#3b82f6',
      assuntos: [{
        id: 'ass_2',
        nome: 'Atos Administrativos',
        concluido: false,
        dataConclusao: null,
        revisoesFetas: [],
        adiamentos: 0,
        linkedAulaIds: []
      }],
      aulas: []
    });

    const today = localDateStr();
    state.eventos = [
      {
        id: 'ev_dash_const',
        titulo: 'Direito Constitucional - Topic',
        data: today,
        dataEstudo: today,
        status: 'estudei',
        tempoAcumulado: 3600,
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { tiposEstudo: ['leitura'] }
      },
      {
        id: 'ev_dash_admin',
        titulo: 'Direito Administrativo - Topic',
        data: today,
        dataEstudo: today,
        status: 'estudei',
        tempoAcumulado: 1800,
        discId: 'disc_2',
        assId: 'ass_2',
        sessao: { tiposEstudo: ['questoes'] }
      }
    ];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    const discNames = await page.evaluate(() => {
      return window.state.editais[0].disciplinas.map(d => d.nome);
    });
    expect(discNames).toContain('Direito Constitucional');
    expect(discNames).toContain('Direito Administrativo');
  });

  test('shows empty dashboard when no study sessions', async ({ page }) => {
    const state = createE2EState();
    state.eventos = [];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    const discStats = await page.evaluate(() => {
      return window.state.eventos.filter(e => e.status === 'estudei').length;
    });
    expect(discStats).toBe(0);
  });

  test('displays discipline progress bars', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos = [
      {
        id: 'ass_1',
        nome: 'Topic One',
        concluido: true,
        dataConclusao: localDateStr(new Date(Date.now() - 86400000)),
        revisoesFetas: [],
        adiamentos: 0,
        linkedAulaIds: []
      },
      {
        id: 'ass_2',
        nome: 'Topic Two',
        concluido: false,
        dataConclusao: null,
        revisoesFetas: [],
        adiamentos: 0,
        linkedAulaIds: []
      },
      {
        id: 'ass_3',
        nome: 'Topic Three',
        concluido: false,
        dataConclusao: null,
        revisoesFetas: [],
        adiamentos: 0,
        linkedAulaIds: []
      }
    ];

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    const progress = await page.evaluate(() => {
      const disc = window.state.editais[0]?.disciplinas?.[0];
      if (!disc) return null;
      const total = disc.assuntos.length;
      const concluidos = disc.assuntos.filter(a => a.concluido).length;
      return { total, concluidos, percentual: Math.round((concluidos / total) * 100) };
    });

    expect(progress).not.toBeNull();
    expect(progress.total).toBe(3);
    expect(progress.concluidos).toBe(1);
    expect(progress.percentual).toBe(33);
  });

  test('displays weekly study hours summary', async ({ page }) => {
    const state = createE2EState();
    const today = new Date();
    const events = [];

    for (let i = 0; i < 5; i++) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      events.push({
        id: `ev_week_${i}`,
        titulo: `Study Session ${i}`,
        data: localDateStr(day),
        dataEstudo: localDateStr(day),
        status: 'estudei',
        tempoAcumulado: 3600,
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { tiposEstudo: ['leitura'] }
      });
    }
    state.eventos = events;

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    const totalHours = await page.evaluate(() => {
      const totalSecs = window.state.eventos
        .filter(e => e.status === 'estudei')
        .reduce((sum, e) => sum + (e.tempoAcumulado || 0), 0);
      return Math.round(totalSecs / 3600);
    });
    expect(totalHours).toBe(5);
  });
});

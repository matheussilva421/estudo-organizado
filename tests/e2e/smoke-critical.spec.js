import { expect, test } from '@playwright/test';
import {
  bootCleanE2EApp,
  bootE2EApp,
  collectConsoleErrors,
  createE2EState,
} from '../helpers/e2e-state.js';

test.describe('Smoke crítico', () => {
  test('inicia em estado limpo, navega pelas views principais e não registra erros de console', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await bootCleanE2EApp(page);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await expect(page.locator('#topbar-title')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#sync-pill')).toBeVisible();
    await expect(page.locator('#sync-pill-label')).toBeVisible();
    await expect(page.locator('#global-search')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();

    const views = [
      'home',
      'med',
      'calendar',
      'revisoes',
      'cronometro',
      'editais',
      'vertical',
      'habitos',
      'banca-analyzer',
      'ciclo',
      'historico-sessoes',
      'pontos-fracos',
      'config'
    ];

    for (const view of views) {
      await page.evaluate((viewName) => window.EstudoApp.navigate(viewName), view);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('#topbar-title')).not.toHaveText('');
    }

    expect(consoleErrors).toEqual([]);
  });

  test('mantém estrutura principal sem overflow horizontal em viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootCleanE2EApp(page);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    await expect(page.locator('#topbar-title')).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#global-search')).toBeVisible();

    const metrics = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      bodyOverflow: document.body.scrollWidth > document.body.clientWidth + 1,
      mainVisible: Boolean(document.querySelector('#main-content')?.getBoundingClientRect().height),
      topbarVisible: Boolean(document.querySelector('.topbar')?.getBoundingClientRect().height)
    }));

    expect(metrics).toEqual({
      documentOverflow: false,
      bodyOverflow: false,
      mainVisible: true,
      topbarVisible: true
    });
  });

  test('todas as views ficam sem overflow horizontal em viewport mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bootCleanE2EApp(page);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    const views = [
      'home',
      'med',
      'calendar',
      'revisoes',
      'cronometro',
      'editais',
      'vertical',
      'habitos',
      'banca-analyzer',
      'ciclo',
      'historico-sessoes',
      'pontos-fracos',
      'config'
    ];

    const overflowing = [];
    for (const view of views) {
      await page.evaluate((viewName) => window.EstudoApp.navigate(viewName), view);
      await expect(page.locator('#main-content')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      if (overflow) overflowing.push(view);
    }

    expect(overflowing).toEqual([]);
  });

  test('views com dados populados e nomes longos ficam sem overflow mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const state = createE2EState();
    const longName = 'Disciplina Com Nome Extraordinariamente Longo Para Estressar O Layout Mobile';
    state.editais[0].disciplinas.push({
      id: 'disc_long',
      nome: longName,
      icone: '📚',
      cor: '#8a4fff',
      assuntos: [
        {
          id: 'ass_long',
          nome: 'Tópico com nome igualmente comprido que não deveria estourar a largura da tela em hipótese alguma',
          concluido: false,
          dataConclusao: null,
          revisoesFetas: [],
          adiamentos: 0,
          linkedAulaIds: [],
        },
      ],
      aulas: [],
    });
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    state.eventos.push({
      id: 'ev_long',
      titulo: 'Sessão de estudo com um título bastante extenso para validar truncamento e quebra',
      data: today,
      duracao: 90,
      status: 'agendado',
      tempoAcumulado: 0,
      discId: 'disc_long',
      assId: 'ass_long',
      aulaId: null,
    });

    await bootE2EApp(page, state);
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');

    const views = [
      'home',
      'med',
      'calendar',
      'revisoes',
      'cronometro',
      'editais',
      'vertical',
      'habitos',
      'banca-analyzer',
      'ciclo',
      'historico-sessoes',
      'pontos-fracos',
    ];

    const overflowing = [];
    for (const view of views) {
      await page.evaluate((viewName) => window.EstudoApp.navigate(viewName), view);
      await expect(page.locator('#main-content')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      if (overflow) overflowing.push(view);
    }

    expect(overflowing).toEqual([]);
  });
});

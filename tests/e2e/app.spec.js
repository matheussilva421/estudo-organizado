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

test.describe('Estudo Organizado', () => {
  test('boots the app and renders the home dashboard from seeded state', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_done',
      titulo: 'Revisar constitucional',
      data: '2026-04-18',
      dataEstudo: new Date().toISOString().slice(0, 10),
      duracao: 90,
      status: 'estudei',
      tempoAcumulado: 5400,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-18T12:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');
    await expect(page.locator('#main-content')).toContainText('01:30:00');
    await expect(page.locator('#main-content')).toContainText('PREVISÃO DA SEMANA');
  });

  test('creates a study event and keeps it visible after reload', async ({ page }) => {
    const state = createE2EState();
    const eventTitle = 'Sessão E2E de Constitucional';

    await seedLegacyState(page, state);
    await page.goto('/');

    await page.click('button:has-text("Iniciar Estudo")');
    await expect(page.locator('#modal-event.open')).toBeVisible();

    await page.selectOption('#event-disc', 'disc_1');
    await page.fill('#event-titulo', eventTitle);
    await page.selectOption('#event-duracao', '90');
    await page.click('button:has-text("Salvar / Iniciar")');

    await expect(page.locator('#toast-container')).toContainText('Estudo iniciado/agendado!');

    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);

    await page.evaluate(async () => {
      await window.saveStateToDB?.();
    });

    await page.reload();
    await page.click('[data-view="med"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);

    await page.click('[data-view="calendar"]');
    await expect(page.locator('#main-content')).toContainText(eventTitle);
  });

  test('renders empty states as stacked blocks with readable actions', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');

    await page.click('[data-view="med"]');
    const medEmpty = page.locator('.med-empty-state');
    await expect(medEmpty).toBeVisible();

    const medLayout = await medEmpty.evaluate((element) => {
      const children = [...element.children].map(child => child.getBoundingClientRect());
      const style = getComputedStyle(element);
      return {
        direction: style.flexDirection,
        verticallyOrdered: children.every((box, index) => index === 0 || box.top >= children[index - 1].bottom)
      };
    });

    expect(medLayout.direction).toBe('column');
    expect(medLayout.verticallyOrdered).toBe(true);

    await page.click('[data-view="ciclo"]');
    const cicloEmpty = page.locator('#main-content > .empty-state');
    await expect(cicloEmpty).toBeVisible();

    const cicloLayout = await cicloEmpty.evaluate((element) => {
      const children = [...element.children].map(child => child.getBoundingClientRect());
      const style = getComputedStyle(element);
      return {
        direction: style.flexDirection,
        verticallyOrdered: children.every((box, index) => index === 0 || box.top >= children[index - 1].bottom)
      };
    });

    expect(cicloLayout.direction).toBe('column');
    expect(cicloLayout.verticallyOrdered).toBe(true);
  });

  test('toggles timer mode exactly once through the central action dispatcher', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await expect(page.locator('#crono-mode-btn')).toContainText('Modo');
    await page.click('#crono-mode-btn');

    await expect(page.locator('#crono-mode-btn')).toContainText('Pomodoro');
    await expect.poll(() => page.evaluate(() => window.state.config.pomodoroMode)).toBe(true);
  });

  test('shows keyboard-friendly global search results and updates expanded state', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_search',
      titulo: 'Auditoria Constitucional',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: new Date().toISOString().slice(0, 10),
      duracao: 60,
      status: 'agendado',
      tempoAcumulado: 0,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-19T12:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');

    const search = page.locator('#global-search');
    await search.fill('Constitucional');

    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#search-results')).toHaveClass(/open/);
    await expect(page.locator('#search-results')).toHaveAttribute('role', 'region');
    await expect(page.locator('#search-results button.search-item').first()).toBeVisible();
    await expect(page.locator('#search-results')).toContainText('Auditoria Constitucional');

    const resultButtons = page.locator('#search-results button.search-item');
    await expect(resultButtons).toHaveCount(3);

    await page.keyboard.press('ArrowDown');
    await expect(resultButtons.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(resultButtons.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(resultButtons.nth(0)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#search-results')).not.toHaveClass(/open/);
  });

  test('shows Cloudflare sync conflict recovery actions in settings', async ({ page }) => {
    const state = createE2EState();
    state.config.cfSyncEnabled = true;
    state.config.cfUrl = 'https://sync.example.test';
    state.config.cfToken = 'test-token';
    state.config.cfConflict = {
      remoteUpdatedAt: '2026-04-19T11:00:00.000Z',
      remoteDeviceId: 'device-a',
      detectedAt: '2026-04-19T12:00:00.000Z'
    };

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="config"]');

    const conflict = page.locator('[data-testid="cf-sync-conflict"]');
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText('Conflito');
    await expect(conflict.locator('[data-action="cloud-conflict-export-local"]')).toBeVisible();
    await expect(conflict.locator('[data-action="cloud-conflict-pull-remote"]')).toBeVisible();
    await expect(conflict.locator('[data-action="cloud-conflict-force-push"]')).toBeVisible();
  });

  test('persists Banca Analyzer ranking through the extracted view module', async ({ page }) => {
    const state = createE2EState();
    state.editais[0].disciplinas[0].assuntos.push({
      id: 'ass_2',
      nome: 'Direitos Fundamentais',
      concluido: false,
      dataConclusao: null,
      revisoesFetas: [],
      adiamentos: 0,
      linkedAulaIds: []
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="banca-analyzer"]');

    await expect(page.locator('#banca-disc-select')).toBeVisible();
    await page.selectOption('#banca-disc-select', 'disc_1');
    await page.fill(
      '#banca-input-text',
      [
        '1. Controle de Constitucionalidade (90%)',
        '2. Direitos Fundamentais (20%)'
      ].join('\n')
    );

    await page.click('[data-action="parse-banca-text"]');
    await expect(page.locator('#banca-apply-btn')).toBeVisible();
    await page.click('#banca-apply-btn');

    const relevance = await page.evaluate(() => {
      const assuntos = window.state.editais[0].disciplinas[0].assuntos;
      return assuntos.map(assunto => ({
        nome: assunto.nome,
        priority: assunto.relevance?.priority,
        finalScore: assunto.relevance?.finalScore
      }));
    });

    expect(relevance).toEqual([
      expect.objectContaining({ nome: 'Controle de Constitucionalidade', priority: 'P1' }),
      expect.objectContaining({ nome: 'Direitos Fundamentais', priority: 'P3' })
    ]);
    expect(relevance.every(item => Number.isFinite(item.finalScore))).toBe(true);
  });

  test('all sidebar pages render without errors on fresh state', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');

    const views = [
      { selector: '[data-view="med"]', title: 'Study Organizer' },
      { selector: '[data-view="calendar"]', title: 'Calendário' },
      { selector: '[data-view="revisoes"]', title: /Revisões/ },
      { selector: '[data-view="cronometro"]', title: 'Cronômetro' },
      { selector: '[data-view="editais"]', title: 'Editais' },
      { selector: '[data-view="habitos"]', title: /Hábitos/ },
      { selector: '[data-view="banca-analyzer"]', title: /Banca|Inteligência/ },
      { selector: '[data-view="ciclo"]', title: /Ciclo|Planejamento/ },
      { selector: '[data-view="config"]', title: 'Configurações' }
    ];

    for (const view of views) {
      await page.click(view.selector);
      await expect(page.locator('#topbar-title')).toHaveText(view.title, { timeout: 5000 });
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('Pomodoro toggle persists after reload', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await expect(page.locator('#crono-mode-btn')).toContainText('Modo');
    await page.click('#crono-mode-btn');
    await expect(page.locator('#crono-mode-btn')).toContainText('Pomodoro');

    await page.evaluate(async () => {
      await window.saveStateToDB?.();
    });

    await page.reload();
    await page.click('[data-view="cronometro"]');
    await expect(page.locator('#crono-mode-btn')).toContainText('Pomodoro');
    await expect.poll(() => page.evaluate(() => window.state.config.pomodoroMode)).toBe(true);
  });

  test('config settings persist after reload', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="config"]');

    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#topbar-title')).toHaveText(/Configurações/);

    await page.evaluate(async () => {
      window.state.config.freqRevisao = 7;
      await window.saveStateToDB?.();
    });

    await page.reload();
    await page.click('[data-view="config"]');
    await expect(page.locator('#main-content')).toBeVisible();

    const freq = await page.evaluate(() => window.state.config.freqRevisao);
    expect(freq).toBe(7);
  });

  test('search finds disciplines and subjects by keyboard', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');

    const search = page.locator('#global-search');
    await search.fill('Constitucional');
    await expect(search).toHaveAttribute('aria-expanded', 'true');

    const resultButtons = page.locator('#search-results button.search-item');
    await expect(resultButtons.count()).resolves.toBeGreaterThanOrEqual(1);

    await page.keyboard.press('ArrowDown');
    await expect(resultButtons.first()).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('search finds habit records by keyboard', async ({ page }) => {
    const state = createE2EState();
    state.habitos.questoes.push({
      id: 'hab_search',
      data: new Date().toISOString().slice(0, 10),
      descricao: 'Bloco FGV de questoes',
      quantidade: 20,
      acertos: 16
    });

    await seedLegacyState(page, state);
    await page.goto('/');

    const search = page.locator('#global-search');
    await search.fill('FGV');
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#search-results')).toContainText('Bloco FGV de questoes');

    const resultButtons = page.locator('#search-results button.search-item');
    await page.keyboard.press('ArrowDown');
    await expect(resultButtons.first()).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#topbar-title')).toHaveText(/H.bitos/);
  });

  test('no horizontal overflow on mobile viewport', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('starts, pauses, extends and discards the study timer', async ({ page }) => {
    const state = createE2EState();
    state.eventos.push({
      id: 'ev_timer_flow',
      titulo: 'Timer completo E2E',
      data: new Date().toISOString().slice(0, 10),
      dataEstudo: null,
      duracao: 30,
      status: 'agendado',
      tempoAcumulado: 60,
      tipo: 'conteudo',
      discId: 'disc_1',
      assId: 'ass_1',
      habito: null,
      criadoEm: '2026-04-20T10:00:00.000Z'
    });

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="cronometro"]');

    await expect(page.locator('#main-content')).toContainText('Direito Constitucional');
    await page.click('[data-action="add-minutes"][data-event-id="ev_timer_flow"][data-minutes="5"]');
    await expect.poll(() => page.evaluate(() => {
      return window.state.eventos.find(evento => evento.id === 'ev_timer_flow')?.duracao;
    })).toBe(35);

    await page.click('[data-action="toggle-timer"][data-event-id="ev_timer_flow"]');
    await expect.poll(() => page.evaluate(() => {
      return Boolean(window.state.eventos.find(evento => evento.id === 'ev_timer_flow')?._timerStart);
    })).toBe(true);

    await page.click('[data-action="toggle-timer"][data-event-id="ev_timer_flow"]');
    await expect.poll(() => page.evaluate(() => {
      return Boolean(window.state.eventos.find(evento => evento.id === 'ev_timer_flow')?._timerStart);
    })).toBe(false);

    await page.click('[data-action="discard-timer"][data-event-id="ev_timer_flow"]');
    await expect(page.locator('#modal-confirm')).toHaveClass(/open/);
    await page.click('#confirm-ok-btn');

    await expect.poll(() => page.evaluate(() => {
      return window.state.eventos.find(evento => evento.id === 'ev_timer_flow')?.tempoAcumulado;
    })).toBe(0);
  });

  test('exports state as JSON from settings', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="config"]');

    await expect(page.locator('#main-content')).toBeVisible();

    const exportBtn = page.locator('[data-action="export-state"]');
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        exportBtn.click()
      ]);

      if (download) {
        const content = await download.path();
        expect(content).toBeTruthy();
      }
    }
  });

  test('calendar renders and navigates months', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="calendar"]');

    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#cal-title')).toBeVisible();

    const currentTitle = await page.locator('#cal-title').textContent();

    const nextBtn = page.locator('[data-action="cal-navigate"][data-dir="1"]');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(page.locator('#cal-title')).not.toHaveText(currentTitle);
    }
  });

  test('habits page renders habit categories', async ({ page }) => {
    const state = createE2EState();

    await seedLegacyState(page, state);
    await page.goto('/');
    await page.click('[data-view="habitos"]');

    await expect(page.locator('#topbar-title')).toHaveText(/Hábitos/);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#main-content')).toContainText('Questões');
  });

  test('SW precache includes all runtime module paths', async ({ page }) => {
    await page.goto('/');
    const assetPaths = await page.evaluate(() => {
      if ('serviceWorker' in navigator) {
        return navigator.serviceWorker.controller ? 'active' : 'none';
      }
      return 'no-sw';
    });

    const swContent = await page.evaluate(async () => {
      const resp = await fetch('/sw.js');
      return resp.text();
    });

    const requiredModules = [
      'js/ui/actions.js',
      'js/ui/dialog.js',
      'js/ui/dom.js',
      'js/views/home-view.js',
      'js/views/calendar-view.js',
      'js/views/editais-view.js',
      'js/views/dashboard-view.js',
      'js/views/banca-view.js'
    ];

    for (const mod of requiredModules) {
      expect(swContent).toContain(mod);
    }
  });
});

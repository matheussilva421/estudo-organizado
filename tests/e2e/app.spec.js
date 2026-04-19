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
});

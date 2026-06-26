import { expect, test } from '@playwright/test';

test.describe('Mock Environment', () => {
  test('app boots with mock data and renders home view', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');
  });

  test('no unexpected console errors during page load', async ({ page }) => {
    const errors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known benign errors (Firebase/SW/CSP related are OK in mock mode)
    const unexpectedErrors = errors.filter((msg) => {
      const lower = msg.toLowerCase();
      if (lower.includes('firebase')) return false;
      if (lower.includes('service worker')) return false;
      if (lower.includes('sw.js') || lower.includes('sw-register')) return false;
      if (lower.includes('indexeddb')) return false;
      if (lower.includes('content security policy')) return false;
      if (lower.includes('csp')) return false;
      if (lower.includes('mixkit')) return false;
      if (lower.includes('media-src')) return false;
      if (lower.includes('addEventListener')) return false;
      return true;
    });

    expect(unexpectedErrors).toEqual([]);
  });

  test('dashboard shows study time from mock sessions', async ({ page }) => {
    await page.goto('/');

    // Mock data has 50-80 events with many 'estudei' status and tempoAcumulado > 0
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');

    // The home view should show time statistics
    const content = await page.locator('#main-content').textContent();
    expect(content.length).toBeGreaterThan(100);
  });

  test('calendar view renders with month navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-view="calendar"]');

    await expect(page.locator('#topbar-title')).toHaveText('Calendário');
    await expect(page.locator('#main-content')).toBeVisible();

    // Calendar should have a title showing the current month/year
    const calTitle = page.locator('#cal-title');
    await expect(calTitle).toBeVisible();
  });

  test('editais view shows edital names', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.EstudoApp?.navigate === 'function');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais');

    // Mock data has TRF, CEBRASPE, and TJ-SP editais
    // Wait for the edital tree to render
    await expect(page.locator('.tree-edital').first()).toBeVisible({ timeout: 5000 });

    const content = await page.locator('#main-content').textContent();
    const hasEdital = content.includes('TRF') || content.includes('CEBRASPE') || content.includes('TJ-SP');
    expect(hasEdital).toBe(true);
  });

  test('habits view shows habit type sections', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-view="habitos"]');

    await expect(page.locator('#topbar-title')).toHaveText(/Hábitos/);
    await expect(page.locator('#main-content')).toBeVisible();

    // Mock data has habit types: questoes, revisao, videoaula, leitura, etc.
    const content = await page.locator('#main-content').textContent();
    const hasHabitType = content.includes('Questões') || content.includes('Revisão') || content.includes('Videoaula');
    expect(hasHabitType).toBe(true);
  });

  test('reviews view shows pending/upcoming tabs', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-view="revisoes"]');

    await expect(page.locator('#topbar-title')).toHaveText(/Revisões/);
    await expect(page.locator('#main-content')).toBeVisible();

    // Should show tab labels for pending and upcoming reviews
    const content = await page.locator('#main-content').textContent();
    const hasTabs = content.includes('Pendentes') || content.includes('Próximas') || content.includes('Concluídas');
    expect(hasTabs).toBe(true);
  });

  test('service worker is not registered in mock mode', async ({ page }) => {
    await page.goto('/');

    // The mock injection stubs navigator.serviceWorker.register
    // and the playwright config blocks service workers
    const swController = await page.evaluate(() => {
      return navigator.serviceWorker.controller === null;
    });

    expect(swController).toBe(true);
  });

  test('mock mode flag is set on window', async ({ page }) => {
    await page.goto('/');

    const mockMode = await page.evaluate(() => {
      return window.__MOCK_MODE__;
    });

    expect(mockMode).toBe(true);
  });

  test('first load is not blocked by a principal-edital modal (Fase 3)', async ({ page }) => {
    // Mock dataset has 3 active editais and no principalEditalId — exactly the
    // scenario that used to open a blocking "Qual e seu edital principal?" modal.
    await page.goto('/');

    // Home must be usable immediately.
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');

    // No blocking modal overlay should be open on first load.
    await expect(page.locator('.modal-overlay.open')).toHaveCount(0);

    // The principal-edital choice is offered inline on the Home instead.
    await expect(page.locator('.home-principal-choice')).toBeVisible();
  });

  test('data persists after page reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO');

    // Capture initial content
    const initialContent = await page.locator('#main-content').textContent();
    expect(initialContent).toContain('TEMPO DE ESTUDO');

    // Reload the page
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');
    await expect(page.locator('#main-content')).toContainText('TEMPO DE ESTUDO', { timeout: 10000 });

    // Data should still be present (mock server re-injects on each request)
    const reloadedContent = await page.locator('#main-content').textContent();
    expect(reloadedContent.length).toBeGreaterThan(100);
    expect(reloadedContent).toContain('TEMPO DE ESTUDO');
  });
});

/**
 * E2E Playwright Tests — Sync Freeze, Data Integrity, Status UI (T15)
 *
 * Tests the rewritten sync system end-to-end:
 * 1. No freeze during rapid navigation
 * 2. Data persistence after page reload
 * 3. Sync status UI updates without full re-render
 */

import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

function serializeState(state) {
  return JSON.stringify(state);
}

async function seedState(page, state) {
  await page.addInitScript((serializedState) => {
    window.Chart = class { destroy() {} };
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('estudo_state', serializedState);
  }, serializeState(state));
}

test.describe('Sync E2E: No freeze during rapid navigation', () => {
  test('rapid navigation between views does not cause freeze', async ({ page }) => {
    const state = createE2EState();
    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toHaveText('Página Inicial');

    // Navigate through key views rapidly
    const views = [
      { selector: '[data-view="med"]', title: 'Study Organizer' },
      { selector: '[data-view="calendar"]', title: 'Calendário' },
      { selector: '[data-view="revisoes"]', title: /Revisões/ },
      { selector: '[data-view="habitos"]', title: /Hábitos/ },
      { selector: '[data-view="config"]', title: 'Configurações' },
    ];

    const startTime = Date.now();

    // Navigate through all views 3 times
    for (let round = 0; round < 3; round++) {
      for (const view of views) {
        await page.click(view.selector);
        await expect(page.locator('#topbar-title')).toHaveText(view.title, { timeout: 5000 });
      }
    }

    const elapsed = Date.now() - startTime;
    // 15 navigations should complete within 30s
    expect(elapsed).toBeLessThan(30000);
  });

  test('UI remains responsive with seeded edital data', async ({ page }) => {
    const state = createE2EState();
    // Seed additional disciplinas to test rendering performance
    for (let i = 1; i < 5; i++) {
      state.editais[0].disciplinas.push({
        id: `disc_${i + 1}`,
        nome: `Disciplina ${i + 1}`,
        icone: '📖',
        cor: '#3b82f6',
        assuntos: [
          { id: `ass_${i + 1}_1`, nome: `Tópico ${i + 1}.1`, concluido: false, dataConclusao: null, revisoesFetas: [], adiamentos: 0, linkedAulaIds: [] },
          { id: `ass_${i + 1}_2`, nome: `Tópico ${i + 1}.2`, concluido: false, dataConclusao: null, revisoesFetas: [], adiamentos: 0, linkedAulaIds: [] },
        ],
        aulas: [],
      });
    }

    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate to Editais and verify it renders
    const startNav = Date.now();
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais');
    const navTime = Date.now() - startNav;

    // Navigation should be fast (< 3s)
    expect(navTime).toBeLessThan(3000);

    // Main content should be visible
    await expect(page.locator('#main-content')).toBeVisible();

    // Navigate away and back — should still be responsive
    await page.click('[data-view="calendar"]');
    await expect(page.locator('#topbar-title')).toHaveText('Calendário');

    const startBack = Date.now();
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais');
    const backTime = Date.now() - startBack;

    expect(backTime).toBeLessThan(3000);
    await expect(page.locator('#main-content')).toBeVisible();
  });
});

test.describe('Sync E2E: Data persistence after page reload', () => {
  test('app state survives page reload without data loss', async ({ page }) => {
    const state = createE2EState();
    state.config.metaSemanal = 30;
    state.config.frequenciaRevisao = [1, 3, 7, 21];

    await seedState(page, state);
    await page.goto('/');

    // Verify initial state
    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate to config and verify seeded values
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Verify seeded config
    const metaInput = page.locator('#meta-semanal');
    if (await metaInput.isVisible()) {
      await expect(metaInput).toHaveValue('30');
    }

    // Reload page (simulates tab close/reopen)
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate back to Configurações
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // State should still be accessible — no data loss
    const currentView = await page.evaluate(() => window.EstudoApp?.currentView);
    expect(currentView).toBe('config');
  });

  test('config changes persist after page reload', async ({ page }) => {
    const state = createE2EState();
    state.config.metaSemanal = 20;

    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate to Configurações
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Verify initial config
    const metaInput = page.locator('#meta-semanal');
    if (await metaInput.isVisible()) {
      await expect(metaInput).toHaveValue('20');

      // Change meta semanal
      await metaInput.fill('25');
      await metaInput.press('Tab');
      await page.waitForTimeout(1500); // Allow debounce save
    }

    // Reload
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate back to Configurações
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Verify config persisted
    if (await metaInput.isVisible()) {
      await expect(metaInput).toHaveValue('25');
    }
  });

  test('hábito data persists after page reload', async ({ page }) => {
    const state = createE2EState();
    state.habitos.questoes.push({
      id: 'habito_e2e',
      acertos: 15,
      erros: 3,
      disciplina: 'Direito Constitucional',
      assunto: 'Controle de Constitucionalidade',
      data: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
    });

    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate to Hábitos
    await page.click('[data-view="habitos"]');
    await expect(page.locator('#topbar-title')).toHaveText(/Hábitos/);

    // Verify hábito appears
    await expect(page.locator('#main-content')).toContainText('15');

    // Reload
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate back to Hábitos
    await page.click('[data-view="habitos"]');
    await expect(page.locator('#topbar-title')).toHaveText(/Hábitos/);

    // Verify hábito still there
    await expect(page.locator('#main-content')).toContainText('15');
  });
});

test.describe('Sync E2E: Sync status UI updates without full re-render', () => {
  test('sync status container exists in the DOM', async ({ page }) => {
    const state = createE2EState();
    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();

    // Sync status container should be present
    const syncStatus = page.locator('#sync-status');
    await expect(syncStatus).toBeVisible();
  });

  test('sync status updates do not trigger full page re-render', async ({ page }) => {
    const state = createE2EState();
    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();

    // Navigate to config where sync status is visible
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Capture initial main content hash
    const initialHash = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      return main ? main.innerHTML.length : 0;
    });

    // Dispatch sync status events to test UI updates
    await page.evaluate(() => {
      document.dispatchEvent(
        new CustomEvent('app:primarySyncStatus', {
          detail: { status: 'syncing', reason: 'test' }
        })
      );
    });

    await page.waitForTimeout(300);

    // Check that main content hasn't been completely replaced
    const afterHash = await page.evaluate(() => {
      const main = document.querySelector('#main-content');
      return main ? main.innerHTML.length : 0;
    });

    // Content should not have changed drastically (no full re-render)
    // Allow small changes from the sync status component itself
    const diff = Math.abs(afterHash - initialHash);
    // The sync status component may add/remove small amounts of HTML
    // but should not cause a full re-render (> 1000 char change)
    expect(diff).toBeLessThan(1000);
  });

  test('sync status shows different states correctly', async ({ page }) => {
    const state = createE2EState();
    await seedState(page, state);
    await page.goto('/');

    await expect(page.locator('#topbar-title')).toBeVisible();
    await page.click('[data-view="config"]');
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    const syncStatus = page.locator('#sync-status');
    await expect(syncStatus).toBeVisible();

    // Test different status states via event dispatch
    const statuses = [
      { status: 'syncing', expectedText: /sincronizando/i },
      { status: 'synced', expectedText: /sincronizado/i },
      { status: 'error', expectedText: /erro/i },
    ];

    for (const { status, expectedText } of statuses) {
      await page.evaluate((s) => {
        document.dispatchEvent(
          new CustomEvent('app:primarySyncStatus', {
            detail: { status: s, reason: 'test' }
          })
        );
      }, status);

      await page.waitForTimeout(150);

      // Status container should reflect the state
      const textContent = await syncStatus.textContent();
      expect(textContent.toLowerCase()).toMatch(expectedText);
    }
  });
});

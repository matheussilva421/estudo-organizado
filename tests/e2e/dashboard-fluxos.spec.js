import { expect, test } from '@playwright/test';
import { createE2EState } from '../helpers/e2e-state.js';

/**
 * Seed state with proper cleanup
 */
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

test.describe('Dashboard de Disciplina', () => {
  test('exibe dashboard vazio sem disciplinas', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify edital is visible
    await expect(page.locator('.tree-edital-header')).toBeVisible();
  });

  test('abre gerenciador de disciplina', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Open discipline manager
    await page.evaluate(() => {
      const btn = document.querySelector('[data-action="open-disc-manager"][data-edital-id="ed_1"][data-disc-id="disc_1"]');
      btn?.click();
    });
    await expect(page.locator('#modal-disc-manager.open')).toBeVisible();
    await page.waitForTimeout(500);

    // Verify modal has content
    await expect(page.locator('#modal-disc-manager .modal-header')).toContainText('Direito Constitucional');
  });
});

test.describe('Navegação entre views', () => {
  test('navega entre views principais', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Navigate to Editais
    await page.click('[data-view="editais"]');
    await expect(page.locator('#topbar-title')).toHaveText('Editais', { timeout: 10000 });

    // Navigate to MED
    await page.click('[data-view="med"]');
    await expect(page.locator('#topbar-title')).toHaveText('Study Organizer', { timeout: 10000 });

    // Navigate to Hábitos
    await page.click('[data-view="habitos"]');
    await expect(page.locator('#topbar-title')).toContainText('Hábitos', { timeout: 10000 });

    // Navigate to Ciclo
    await page.click('[data-view="ciclo"]');
    await expect(page.locator('#topbar-title')).toHaveText('Ciclo de Estudos', { timeout: 10000 });
  });

  test('persiste estado ao navegar', async ({ page }) => {
    const state = createE2EState();
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Navigate to Editais
    await page.click('[data-view="editais"]');
    await page.waitForTimeout(500);

    // Verify state is preserved
    const stateExists = await page.evaluate(() => {
      return window.state?.editais?.length > 0;
    });
    expect(stateExists).toBe(true);
  });
});

test.describe('Theme Toggle', () => {
  test('verifica estado inicial do tema', async ({ page }) => {
    const state = createE2EState();
    state.config.tema = 'light';
    await seedLegacyState(page, state);

    await page.goto('/');
    await page.waitForTimeout(500);

    // Get initial theme
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(initialTheme).toBe('light');
  });
});

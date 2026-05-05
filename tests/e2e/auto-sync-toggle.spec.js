/**
 * E2E Playwright Tests — Auto-Sync Toggle in Sync Center Advanced Settings
 *
 * Tests the auto-sync toggle interaction:
 * 1. Toggle renders inside advanced accordion
 * 2. Default OFF when globalSyncPaused is true
 * 3. Toggle updates state and shows correct badge
 * 4. State persists after page reload
 */

import { expect, test } from '@playwright/test';
import { createE2EState, seedE2EState } from '../helpers/e2e-state.js';

test.describe('Auto-Sync Toggle', () => {
  test('toggle renders inside advanced accordion with correct data-action', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await expect(advancedPanel).toBeVisible();
    await advancedPanel.locator('summary').click();

    // The auto-sync toggle should be visible
    const toggle = page.locator('[data-testid="auto-sync-toggle"]');
    await expect(toggle).toBeVisible();

    // Should have the correct action attribute
    await expect(toggle).toHaveAttribute('data-action', 'toggle-auto-sync');

    // Label should be present
    const label = page.locator('[data-testid="auto-sync-label"]');
    await expect(label).toContainText('Sincronização automática');
  });

  test('toggle shows ON state when sync is active (globalSyncPaused=false)', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanel.locator('summary').click();

    // Toggle should have 'on' class
    const toggle = page.locator('[data-testid="auto-sync-toggle"]');
    await expect(toggle).toHaveClass(/on/);

    // Badge should show "ON"
    const badge = page.locator('[data-testid="auto-sync-badge"]');
    await expect(badge).toContainText('ON');
    await expect(badge).toHaveClass(/badge-green/);
  });

  test('toggle shows OFF state when sync is paused (globalSyncPaused=true)', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanel.locator('summary').click();

    // Toggle should NOT have 'on' class
    const toggle = page.locator('[data-testid="auto-sync-toggle"]');
    await expect(toggle).not.toHaveClass(/on/);

    // Badge should show "OFF"
    const badge = page.locator('[data-testid="auto-sync-badge"]');
    await expect(badge).toContainText('OFF');
    await expect(badge).toHaveClass(/badge-gray/);
  });

  test('clicking toggle dispatches globalSyncPauseChanged event', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanel.locator('summary').click();

    // Set up event listener
    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('app:globalSyncPauseChanged', (e) => {
          resolve(e.detail);
        }, { once: true });
      });
    });

    // Click the toggle
    const toggle = page.locator('[data-testid="auto-sync-toggle"]');
    await toggle.click();

    // Verify event was dispatched with paused=true
    const detail = await eventPromise;
    expect(detail.paused).toBe(true);
  });

  test('toggle state persists after page reload', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanel.locator('summary').click();

    // Click toggle to pause sync
    const toggle = page.locator('[data-testid="auto-sync-toggle"]');
    await toggle.click();

    // Wait for state save
    await page.waitForTimeout(1500);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion again
    const advancedPanelAfter = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanelAfter.locator('summary').click();

    // Toggle should show OFF state (sync paused)
    const toggleAfter = page.locator('[data-testid="auto-sync-toggle"]');
    await expect(toggleAfter).not.toHaveClass(/on/);

    const badge = page.locator('[data-testid="auto-sync-badge"]');
    await expect(badge).toContainText('OFF');
  });
});

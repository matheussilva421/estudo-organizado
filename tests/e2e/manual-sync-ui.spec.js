/**
 * E2E Playwright Tests — Manual Sync UI in Sync Center and Data Card
 *
 * Tests the manual-first sync paradigm UI:
 * 1. Quiet panel shows "Sincronização manual" when globalSyncPaused=true
 * 2. "Sincronizar agora" button appears in quiet panel
 * 3. Health badge shows "Pausado" status
 * 4. Data card shows "Última sincronização manual" labels
 * 5. Auto-sync messaging when globalSyncPaused=false
 */

import { expect, test } from '@playwright/test';
import { createE2EState, seedE2EState } from '../helpers/e2e-state.js';

test.describe('Manual Sync UI — Quiet Panel', () => {
  test('shows "Sincronização manual" kicker when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Quiet panel kicker should say manual
    const kicker = page.locator('.sync-quiet-kicker');
    await expect(kicker).toContainText('Sincronização manual');
  });

  test('shows "Sincronizar agora" button when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // The quiet panel action is separate from the global topbar sync button.
    const syncNowBtn = page
      .locator('[data-testid="sync-quiet-panel"]')
      .getByRole('button', { name: /Sincronizar agora/i });
    await expect(syncNowBtn).toBeVisible();
    await expect(syncNowBtn).toContainText('Sincronizar agora');
  });

  test('shows "Sincronização automática" kicker when globalSyncPaused is false', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Quiet panel kicker should say automática
    const kicker = page.locator('.sync-quiet-kicker');
    await expect(kicker).toContainText('Sincronização automática');
  });

  test('does not show "Sincronizar agora" button when globalSyncPaused is false', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    const quietSyncButton = page
      .locator('[data-testid="sync-quiet-panel"]')
      .getByRole('button', { name: /Sincronizar agora/i });
    await expect(quietSyncButton).toHaveCount(0);
  });

  test('shows paused health badge when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Open the advanced accordion
    const advancedPanel = page.locator('[data-testid="backup-advanced-panel"]');
    await advancedPanel.locator('summary').click();

    // Health badge should show paused
    const healthBadge = page.locator('.sync-health-badge');
    await expect(healthBadge).toHaveClass(/paused/);
    await expect(healthBadge).toContainText('Pausado');
  });

  test('description text reflects manual mode when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    const desc = page.locator('[data-testid="sync-center"] .config-desc').first();
    await expect(desc).toContainText('apenas quando você pedir');
  });
});

test.describe('Manual Sync UI — Data Card', () => {
  test('shows "Última sincronização manual" label when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    state.config.localBackupAt = '2026-04-30T10:00:00.000Z';
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Data card should show manual sync label
    const backupGrid = page.locator('.config-backup-grid');
    await expect(backupGrid).toContainText('Última sincronização manual:');
  });

  test('does not show individual backup labels when globalSyncPaused is true', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = true;
    state.config.localBackupAt = '2026-04-30T10:00:00.000Z';
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Data card should NOT show individual backup labels
    const backupGrid = page.locator('.config-backup-grid');
    await expect(backupGrid).not.toContainText('Backup local:');
    await expect(backupGrid).not.toContainText('Backup Firestore:');
    await expect(backupGrid).not.toContainText('Backup Cloudflare:');
    await expect(backupGrid).not.toContainText('Backup Google Drive:');
  });

  test('shows individual backup labels when globalSyncPaused is false', async ({ page }) => {
    const state = createE2EState();
    state.config.globalSyncPaused = false;
    state.config.localBackupAt = '2026-04-30T10:00:00.000Z';
    state.config.firestoreSync = { remoteUpdatedAt: '2026-04-30T10:05:00.000Z' };
    state.config.cfLastSyncAt = '2026-04-30T10:10:00.000Z';
    state.lastSync = '2026-04-30T10:15:00.000Z';
    await seedE2EState(page, state);
    await page.goto('/');

    await page.evaluate(() => window.EstudoApp.navigate('config'));
    await expect(page.locator('#topbar-title')).toHaveText('Configurações');

    // Data card should show individual backup labels
    const backupGrid = page.locator('.config-backup-grid');
    await expect(backupGrid).toContainText('Backup local:');
    await expect(backupGrid).toContainText('Backup Firestore:');
    await expect(backupGrid).toContainText('Backup Cloudflare:');
    await expect(backupGrid).toContainText('Backup Google Drive:');
  });
});

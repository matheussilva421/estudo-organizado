import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';
import { DB_NAME, STORES } from '../../src/platform/indexeddb';

test('appearance changes preserve a paused session and its unsaved manual draft', async ({ page, context }) => {
  await resetF7Ux(page, '/#/sessions');
  await seedAcademicData(page);
  await page.reload();
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-timer')).toContainText(/00:00:0[1-9]/);
  await page.getByTestId('session-pause').click();
  const timer = page.getByTestId('session-timer');
  await expect(timer).toContainText('PAUSED');
  const note = page.getByTestId('session-manual').getByRole('textbox', { name: 'Nota' });
  await note.fill('Rascunho sintético ainda não registrado');
  const elapsed = (await timer.innerText()).match(/\d{2}:\d{2}:\d{2}/)?.[0];
  expect(elapsed).toBeTruthy();

  const readAcademicRecords = () => page.evaluate(async ({ name, stores }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction(stores, 'readonly');
      return await Promise.all(stores.map((store) => new Promise((resolve, reject) => {
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })));
    } finally {
      db.close();
    }
  }, { name: DB_NAME, stores: [STORES.sessions, STORES.subjects, STORES.assuntos, STORES.planningBlocks, STORES.reviewCommitments, STORES.outbox] });

  const before = await readAcademicRecords();
  await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption('neon-teal');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon-teal');
  await expect(note).toHaveValue('Rascunho sintético ainda não registrado');
  await expect(timer).toContainText(elapsed!);

  const settings = await context.newPage();
  await settings.goto('/#/settings');
  await settings.getByLabel('Densidade').selectOption('compact');
  await settings.getByLabel('Brilho/glow').selectOption('high');
  await settings.close();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(page.locator('html')).toHaveAttribute('data-glow', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon-teal');
  await expect(note).toHaveValue('Rascunho sintético ainda não registrado');
  await expect(timer).toContainText('PAUSED');
  await expect(timer).toContainText(elapsed!);
  expect(await readAcademicRecords()).toEqual(before);
});

test('premium gallery exposes 12 themes and persists visual preferences', async ({ page }) => {
  await resetF7Ux(page, '/#/settings');
  await seedAcademicData(page);
  await page.goto('/#/settings');
  await expect(page.getByTestId('f6-settings')).toBeVisible();

  const gallery = page.locator('.theme-gallery');
  await expect(gallery.locator('[data-theme-option]')).toHaveCount(12);
  await gallery.locator('[data-theme-option="neon-teal"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon-teal');
  await expect(gallery.locator('[data-theme-option="neon-teal"]')).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Brilho/glow').selectOption('high');
  await page.getByLabel('Movimento').selectOption('off');
  await page.getByLabel('Densidade').selectOption('spacious');
  await page.getByLabel('Aparência dos cards').selectOption('glass');
  await expect(page.locator('html')).toHaveAttribute('data-glow', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');

  await page.reload();
  await expect(page.getByTestId('f6-settings')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon-teal');
  await expect(page.locator('html')).toHaveAttribute('data-glow', 'high');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'spacious');
  await expect(page.locator('html')).toHaveAttribute('data-cards', 'glass');

  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  await expect(
    page.locator('.tree .tree-title').filter({ hasText: 'Controle de constitucionalidade' }).first(),
  ).toBeVisible();
});


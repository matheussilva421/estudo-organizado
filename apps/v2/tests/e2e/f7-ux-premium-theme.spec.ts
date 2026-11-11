import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

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


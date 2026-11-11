import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

test('knowledge library opens the existing edital tree by stable ID on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetF7Ux(page, '/#/content');
  const library = page.getByRole('region', { name: 'Biblioteca de editais' });
  await expect(library).toContainText('Nenhum edital ativo');
  await seedAcademicData(page);
  await page.reload();
  const link = library.getByRole('link', { name: 'TRT 2026' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/content\/f7ux-edital$/);
  await expect(page.locator('.tree .tree-title').filter({ hasText: 'Controle de constitucionalidade' }).first()).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'page');
});

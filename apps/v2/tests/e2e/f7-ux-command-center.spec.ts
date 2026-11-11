import { expect, test } from '@playwright/test';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

test('command center navigates without mutating and restores focus', async ({ page }) => {
  await resetF7Ux(page);
  await seedAcademicData(page);
  await expect(page.getByTestId('command-center-open')).toBeVisible();

  await page.keyboard.press('Control+Shift+k');
  const dialog = page.getByTestId('command-center');
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel('Buscar destinos ou o acervo local');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-activedescendant', 'command-option-home');
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'command-option-content');
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await input.fill('Planejamento');
  await input.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-route="planning"]')).toBeVisible();
  await expect(page.getByTestId('command-center-open')).toBeFocused();

  await page.keyboard.press('Control+Shift+k');
  await page.getByTestId('command-center').getByLabel('Buscar destinos ou o acervo local').fill('direito');
  await page.getByTestId('command-center').getByLabel('Buscar destinos ou o acervo local').press('Enter');
  await expect(page.locator('[data-route="search"]')).toBeVisible();
  expect(page.url()).toContain('q=direito');

  await page.keyboard.press('Control+Shift+k');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-center')).toHaveCount(0);
  await expect(page.getByTestId('command-center-open')).toBeFocused();
});


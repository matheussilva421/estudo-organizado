import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

test('f7 ux unsaved draft blocks navigation, cancel keeps text and input focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await resetF7Ux(page, '/#/content');
  const input = page.getByLabel('Nova disciplina');
  await input.fill('Rascunho preservado');

  page.once('dialog', async (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/content$/);
  await expect(input).toHaveValue('Rascunho preservado');
  await expect(page.getByRole('link', { name: 'Planejamento', exact: true })).toBeFocused();
});

test('f7 ux accepting a draft exit confirms exactly once and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await resetF7Ux(page, '/#/content');
  await page.getByLabel('Nova disciplina').fill('Rascunho com saída');
  let dialogs = 0;
  page.on('dialog', async (dialog) => {
    dialogs += 1;
    await dialog.accept();
  });
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/planning$/);
  expect(dialogs).toBe(1);
});

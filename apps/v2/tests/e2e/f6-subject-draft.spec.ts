import { expect, test } from '@playwright/test';

test('f6 subject draft survives reload and clears after confirmation', async ({ page }) => {
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const input = page.getByLabel('Nova disciplina');
  await input.fill('Rascunho recuperável');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('f6-draft-restored')).toBeVisible();
  await expect(input).toHaveValue('Rascunho recuperável');

  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByText('Rascunho recuperável', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
  await page.reload();
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('f6-draft-restored')).toHaveCount(0);
});


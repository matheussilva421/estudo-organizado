import { expect, test } from '@playwright/test';

test('f6 edital draft survives reload and clears after confirmation', async ({ page }) => {
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const input = page.getByLabel('Novo edital');
  await input.fill('Edital rascunho');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('f6-edital-draft-restored')).toBeVisible();
  await expect(input).toHaveValue('Edital rascunho');

  await page.getByRole('button', { name: 'Criar edital' }).click();
  await expect(
    page.getByRole('button', { name: 'Edital rascunho', exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue('');
  await page.reload();
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('f6-edital-draft-restored')).toHaveCount(0);
});


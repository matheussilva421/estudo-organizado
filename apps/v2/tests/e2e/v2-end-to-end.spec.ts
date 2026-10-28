import { expect, test } from '@playwright/test';

test('e2e_create_rename_reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Nova disciplina').fill('Raciocínio Lógico');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByText('Raciocínio Lógico', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Renomear Raciocínio Lógico' }).click();
  await page.getByLabel('Novo nome para Raciocínio Lógico').fill('Raciocínio Lógico e Quantitativo');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Raciocínio Lógico e Quantitativo', { exact: true })).toBeVisible();

  await page.getByLabel('Tema').selectOption('plasma');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'plasma');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByText('Raciocínio Lógico e Quantitativo', { exact: true })).toBeVisible();
  await expect(page.locator('.sync-label')).toContainText('Salvo neste dispositivo');
});

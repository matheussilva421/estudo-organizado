import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
});

test('creates, renames and restores a local subject', async ({ page }) => {
  await page.getByLabel('Nova disciplina').fill('Direito Constitucional');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByText('Direito Constitucional', { exact: true })).toBeVisible();
  await expect(page.locator('.sync-label')).toContainText('Salvo neste dispositivo');

  await page.getByRole('button', { name: 'Renomear Direito Constitucional' }).click();
  await page.getByLabel('Novo nome para Direito Constitucional').fill('Direito Civil');
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Direito Civil', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByText('Direito Civil', { exact: true })).toBeVisible();
});

test('local only never says cloud synced and toasts do not cover the action', async ({ page }) => {
  await expect(page.locator('.sync-label')).not.toContainText('nuvem');
  await expect(page.locator('.sync-label')).not.toContainText('sincronizado');
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar disciplina' })).toBeVisible();
});

test('toast_does_not_cover_primary_button', async ({ page }) => {
  await expect(page.locator('.toast')).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Adicionar disciplina' });
  await expect(button).toBeInViewport();
  const box = await button.boundingBox();
  if (!box) throw new Error('primary button has no box');
  const topElement = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim() ?? '',
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topElement).toContain('Adicionar disciplina');
});

test('blank title is blocked', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Adicionar disciplina' })).toBeDisabled();
  await page.getByLabel('Nova disciplina').fill('   ');
  await expect(page.getByRole('button', { name: 'Adicionar disciplina' })).toBeDisabled();
});

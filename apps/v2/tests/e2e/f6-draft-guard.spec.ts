import { expect, test } from '@playwright/test';

test('f6 draft guard asks before leaving an unsaved subject', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const input = page.getByLabel('Nova disciplina');
  await input.fill('Rascunho não confirmado');

  const messages: string[] = [];
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.dismiss();
  });

  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(input).toHaveValue('Rascunho não confirmado');
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain('nova disciplina');
  expect(messages[0]).toContain('Planejamento');

  page.removeAllListeners('dialog');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(input).toHaveValue('Rascunho não confirmado');
});

test('f6 draft guard intercepts browser back without losing the draft', async ({ page }) => {
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const input = page.getByLabel('Nova disciplina');
  await input.fill('Rascunho do voltar');

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole('link', { name: 'Planejamento', exact: true }).click();
  await expect(page).toHaveURL(/#\/planning$/);

  page.removeAllListeners('dialog');
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('edição não confirmada');
    await dialog.dismiss();
  });
  await page.goBack();
  await expect(page).toHaveURL(/#\/planning$/);
  await expect(input).toHaveValue('Rascunho do voltar');
});


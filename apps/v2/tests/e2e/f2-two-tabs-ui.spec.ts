import { expect, test } from '@playwright/test';

test('real_ui_two_tabs_editing_the_same_edital_requires_an_explicit_stale_choice', async ({
  context,
}) => {
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();

  await first.getByLabel('Novo edital').fill('Edital Concorrente');
  await first.getByRole('button', { name: 'Criar edital' }).click();
  await expect(
    first.getByRole('button', { name: 'Edital Concorrente', exact: true }),
  ).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(
    second.getByRole('button', { name: 'Edital Concorrente', exact: true }),
  ).toBeVisible();

  // Tab B opens the editor on revision 1 and keeps that base even if the other
  // tab commits meanwhile.
  await second.getByRole('button', { name: 'Renomear Edital Concorrente' }).click();
  await second.getByLabel('Novo nome').fill('Nome da aba B');

  await first.getByRole('button', { name: 'Renomear Edital Concorrente' }).click();
  await first.getByLabel('Novo nome').fill('Nome da aba A');
  await first.getByRole('button', { name: 'Salvar' }).click();
  await expect(first.getByRole('button', { name: 'Nome da aba A', exact: true })).toBeVisible();

  // The stale editor keeps the typed text and demands an explicit choice.
  await expect(second.getByTestId('f6-draft-stale')).toBeVisible();
  await expect(second.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  await expect(second.getByLabel('Novo nome')).toHaveValue('Nome da aba B');
  await expect(second.getByRole('button', { name: 'Nome da aba A', exact: true })).toBeVisible();

  // Only the explicit decision may replace the newer canonical title.
  await second.getByTestId('f6-draft-stale-use-mine').click();
  await second.getByRole('button', { name: 'Salvar' }).click();
  await expect(second.getByRole('button', { name: 'Nome da aba B', exact: true })).toBeVisible();

  await first.reload();
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(first.getByRole('button', { name: 'Nome da aba B', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Nome da aba A', exact: true })).toHaveCount(0);
});

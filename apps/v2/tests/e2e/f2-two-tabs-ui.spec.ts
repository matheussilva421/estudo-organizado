import { expect, test } from '@playwright/test';

test('real_ui_two_tabs_editing_the_same_edital_never_lose_an_update', async ({
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

  // The stale editor is refused, keeps the typed text and says why.
  await second.getByRole('button', { name: 'Salvar' }).click();
  await expect(second.getByRole('alert')).toContainText('Conflito');
  await expect(second.getByLabel('Novo nome')).toHaveValue('Nome da aba B');

  await first.reload();
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(first.getByRole('button', { name: 'Nome da aba A', exact: true })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Nome da aba B', exact: true })).toHaveCount(0);
});

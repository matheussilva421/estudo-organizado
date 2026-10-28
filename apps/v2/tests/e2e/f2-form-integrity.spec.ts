import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

test('failed_write_keeps_the_draft_and_never_claims_success', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Novo edital').fill('Edital Original');
  await page.getByRole('button', { name: 'Criar edital' }).click();
  await page.getByRole('button', { name: 'Renomear Edital Original' }).click();
  await page.getByLabel('Novo nome').fill('Nome em risco');

  await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.setFault('quota'),
  );
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByRole('alert')).toContainText('Não foi possível gravar');
  await expect(page.getByLabel('Novo nome')).toHaveValue('Nome em risco');
  await expect(
    page.getByRole('button', { name: 'Edital Original', exact: true }),
  ).toBeVisible();

  // Retry after the fault is gone commits and only then clears the form.
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.setFault(null));
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('button', { name: 'Nome em risco', exact: true }),
  ).toBeVisible();
});

test('archived_edital_is_read_only_in_the_ui', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Nova disciplina').fill('Direito Constitucional');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await page.getByLabel('Novo edital').fill('Edital Antigo');
  await page.getByRole('button', { name: 'Criar edital' }).click();
  await page.getByLabel('Vincular disciplina existente a Edital Antigo').selectOption({
    label: 'Direito Constitucional',
  });
  await page.getByRole('button', { name: 'Vincular' }).click();

  await page.getByRole('button', { name: 'Arquivar' }).first().click();
  await page.getByRole('button', { name: 'Arquivar edital' }).click();
  await page.getByText('Editais arquivados (1)').click();
  await page.getByRole('button', { name: 'Edital Antigo', exact: true }).click();

  await expect(page.getByText('Edital arquivado: consulta liberada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar assunto' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Adicionar aula' })).toBeDisabled();
});

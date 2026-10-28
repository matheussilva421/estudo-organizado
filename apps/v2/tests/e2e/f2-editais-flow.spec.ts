import { expect, test } from '@playwright/test';

test('browser_create_rename_reload_full_content_tree', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  // Canonical subject first, then the edital links it.
  await page.getByLabel('Nova disciplina').fill('Direito Constitucional');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await expect(page.getByText('Direito Constitucional').first()).toBeVisible();

  await page.getByLabel('Novo edital').fill('TJPB 2026');
  await page.getByRole('button', { name: 'Criar edital' }).click();
  await expect(page.getByRole('button', { name: 'TJPB 2026', exact: true })).toBeVisible();

  await page.getByLabel('Vincular disciplina existente a TJPB 2026').selectOption({
    label: 'Direito Constitucional',
  });
  await page.getByRole('button', { name: 'Vincular' }).click();
  await expect(page.getByRole('heading', { name: 'Direito Constitucional' })).toBeVisible();

  await page
    .getByLabel('Novo assunto em Direito Constitucional', { exact: true })
    .fill('Controle de constitucionalidade');
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
  await expect(
    page.locator('.tree-title', { hasText: 'Controle de constitucionalidade' }).first(),
  ).toBeVisible();

  await page.getByLabel('Pai do novo assunto em Direito Constitucional').selectOption({
    label: 'Controle de constitucionalidade',
  });
  await page.getByLabel('Novo assunto em Direito Constitucional', { exact: true }).fill('ADPF');
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();

  await page.getByLabel('Nova aula em Direito Constitucional').fill('Aula 01');
  await page.getByRole('button', { name: 'Adicionar aula' }).click();

  await page.getByLabel('Assunto para Aula 01').selectOption({ label: 'ADPF' });
  await page.getByRole('button', { name: 'Mapear aula → assunto' }).click();
  await expect(page.getByText('1 assunto(s) mapeado(s)')).toBeVisible();

  // Rename the edital and keep everything else.
  await page.getByRole('button', { name: 'Renomear TJPB 2026' }).click();
  await page.getByLabel('Novo nome').fill('TJPB 2027');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('button', { name: 'TJPB 2027', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TJPB 2027', exact: true })).toBeVisible();
  await expect(
    page.locator('.tree-title', { hasText: 'Controle de constitucionalidade' }).first(),
  ).toBeVisible();
  await expect(page.locator('.tree-title', { hasText: 'ADPF' }).first()).toBeVisible();
  await expect(page.locator('.aula-row', { hasText: 'Aula 01' })).toBeVisible();
  await expect(page.getByText('1 assunto(s) mapeado(s)')).toBeVisible();
});

test('browser_archive_primary_with_explicit_choice', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  for (const title of ['Edital A', 'Edital B']) {
    await page.getByLabel('Novo edital').fill(title);
    await page.getByRole('button', { name: 'Criar edital' }).click();
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Tornar principal' }).first().click();
  await expect(page.locator('.badge', { hasText: 'principal' })).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar' }).first().click();
  await expect(
    page.getByText('Este edital é o principal: escolha o substituto'),
  ).toBeVisible();
  await page.getByLabel('Este edital é o principal: escolha o substituto').selectOption({
    label: 'Ficar sem principal',
  });
  await page.getByRole('button', { name: 'Arquivar edital' }).click();
  await expect(page.getByText('Editais arquivados (1)')).toBeVisible();

  // The archived record stays consultable and can be reactivated.
  await page.getByText('Editais arquivados (1)').click();
  await page.getByRole('button', { name: 'Reativar Edital A' }).click();
  await expect(page.getByRole('button', { name: 'Edital A', exact: true })).toBeVisible();
});

test('archived_edital_stays_consultable_after_reload', async ({ page }) => {
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
  await page
    .getByLabel('Novo assunto em Direito Constitucional', { exact: true })
    .fill('Assunto do arquivado');
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
  await expect(page.locator('.tree-title', { hasText: 'Assunto do arquivado' })).toBeVisible();

  await page.getByRole('button', { name: 'Arquivar' }).first().click();
  await page.getByRole('button', { name: 'Arquivar edital' }).click();
  await expect(page.getByText('Editais arquivados (1)')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByText('Editais arquivados (1)').click();
  await page.getByRole('button', { name: 'Edital Antigo', exact: true }).click();

  await expect(page.getByText('Edital arquivado: consulta liberada')).toBeVisible();
  await expect(page.locator('.tree-title', { hasText: 'Assunto do arquivado' })).toBeVisible();
});

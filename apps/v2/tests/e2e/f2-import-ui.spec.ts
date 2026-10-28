import { expect, test } from '@playwright/test';

const IMPORT_JSON = JSON.stringify({
  versao: 1,
  tipo: 'edital',
  nome: 'TJRO 2026',
  centralId: 'tjro-2026',
  revisao: 'r1',
  disciplinas: [
    {
      nome: 'Direito Penal',
      topicos: [{ nome: 'Crimes contra a pessoa' }],
      aulas: [{ nome: 'Aula 01 - Parte geral' }],
    },
  ],
});

test('browser_upload_preview_confirm_creates_the_tree', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.setInputFiles('#import-file', {
    name: 'edital.json',
    mimeType: 'application/json',
    buffer: Buffer.from(IMPORT_JSON, 'utf8'),
  });

  const preview = page.getByRole('region', { name: 'Prévia da importação' });
  await expect(preview).toBeVisible();
  await expect(preview.getByText('Criar')).toBeVisible();
  await expect(preview.getByText('5', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  await expect(page.getByText('Importação concluída e registrada no recibo.')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TJRO 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'TJRO 2026', exact: true }).click();
  await expect(
    page.locator('.tree-title', { hasText: 'Crimes contra a pessoa' }).first(),
  ).toBeVisible();
  await expect(page.locator('.aula-row', { hasText: 'Aula 01 - Parte geral' })).toBeVisible();
});

test('browser_hostile_and_oversized_files_are_refused', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.setInputFiles('#import-file', {
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"versao":2,"tipo":"edital"}', 'utf8'),
  });
  await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_VERSION');

  await page.setInputFiles('#import-file', {
    name: 'grande.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 10, 0x20),
  });
  await expect(page.getByRole('alert')).toContainText('2 MiB');
});

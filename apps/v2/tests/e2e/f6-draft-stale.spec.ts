import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function seedEdital(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async ({ profileId }) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-stale-edital',
      profileId,
      editalId: 'edital-stale',
      title: 'Título original',
    });
  }, { profileId });
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

async function renameInOtherTab(page: Page, title: string): Promise<void> {
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  await page.getByLabel('Novo nome').fill(title);
  await page.locator('form.rename-form').getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('button', { name: title, exact: true }),
  ).toBeVisible();
}

test('f6 stale draft is recoverable, blocks silent overwrite and needs an explicit choice', async ({
  page,
  context,
}) => {
  await seedEdital(page);

  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  const input = page.getByLabel('Novo nome');
  await expect(input).toHaveValue('Título original');
  await input.fill('Texto antigo do rascunho');

  const second = await context.newPage();
  await renameInOtherTab(second, 'Título novo da outra aba');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /Renomear Título novo da outra aba/ }).click();
  await expect(page.getByLabel('Novo nome')).toHaveValue('Texto antigo do rascunho');
  await expect(page.getByTestId('f6-draft-stale')).toBeVisible();
  await expect(
    page.locator('form.rename-form').getByRole('button', { name: 'Salvar' }),
  ).toBeDisabled();

  await page.getByTestId('f6-draft-stale-use-mine').click();
  await expect(page.getByTestId('f6-draft-stale')).toHaveCount(0);
  await page.locator('form.rename-form').getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('button', { name: 'Texto antigo do rascunho', exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Texto antigo do rascunho', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Renomear Texto antigo do rascunho/ }).click();
  await expect(page.getByTestId('f6-draft-stale')).toHaveCount(0);
  await expect(page.getByLabel('Novo nome')).toHaveValue('Texto antigo do rascunho');
});

test('f6 stale draft can be discarded in favor of the current canonical title', async ({
  page,
  context,
}) => {
  await seedEdital(page);
  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  await page.getByLabel('Novo nome').fill('Rascunho que será descartado');

  const second = await context.newPage();
  await renameInOtherTab(second, 'Título canônico mais novo');

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /Renomear Título canônico mais novo/ }).click();
  await expect(page.getByTestId('f6-draft-stale')).toBeVisible();
  await page.getByTestId('f6-draft-stale-use-current').click();
  await expect(page.getByLabel('Novo nome')).toHaveValue('Título canônico mais novo');
  await expect(page.getByTestId('f6-draft-stale')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: /Renomear Título canônico mais novo/ }).click();
  await expect(page.getByLabel('Novo nome')).toHaveValue('Título canônico mais novo');
  await expect(page.getByTestId('f6-draft-stale')).toHaveCount(0);
});

test('f6 draft storage failure is visible and never claims preservation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string): void {
      if (key.includes(':draft:')) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      original.call(this, key, value);
    };
  });
  await seedEdital(page);
  await page.getByLabel('Novo edital').fill('Edital sem rascunho durável');
  await expect(
    page.getByText(/Não foi possível preservar este rascunho de edital/),
  ).toBeVisible();
  await page.getByRole('button', { name: /Renomear Título original/ }).click();
  await page.getByLabel('Novo nome').fill('Texto sem rascunho durável');
  await expect(
    page.getByText(/Não foi possível preservar o rascunho neste navegador/),
  ).toBeVisible();
  await expect(page.getByLabel('Novo nome')).toHaveValue('Texto sem rascunho durável');
});

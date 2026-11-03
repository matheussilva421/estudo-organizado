import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'draft-subject',
      profileId: 'local-default',
      subjectId: 'subject-draft',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'draft-edital',
      profileId: 'local-default',
      editalId: 'edital-draft',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'draft-link',
      profileId: 'local-default',
      editalId: 'edital-draft',
      subjectId: 'subject-draft',
      linkId: 'link-draft',
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 assunto draft survives reload and clears after confirmation', async ({ page }) => {
  await seed(page);
  const input = page.getByLabel('Novo assunto em Direito Constitucional', { exact: true });
  await input.fill('Assunto em rascunho');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(input).toHaveValue('Assunto em rascunho');

  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
  await expect(page.locator('.tree-title', { hasText: 'Assunto em rascunho' }).first()).toBeVisible();
  await expect(input).toHaveValue('');
  await page.reload();
  await expect(input).toHaveValue('');
});


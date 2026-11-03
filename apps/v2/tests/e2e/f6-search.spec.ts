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
      operationId: 'f6-subject',
      profileId: 'local-default',
      subjectId: 'subject-f6',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'f6-edital',
      profileId: 'local-default',
      editalId: 'edital-f6',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'f6-link',
      profileId: 'local-default',
      editalId: 'edital-f6',
      subjectId: 'subject-f6',
      linkId: 'link-f6',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'f6-assunto',
      profileId: 'local-default',
      value: {
        id: 'assunto-crase',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        parentId: null,
        parentKey: '',
        title: 'Crase e acentuação',
        orderKey: '',
        localRevision: 0,
      },
    });
    await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'f6-aula',
      profileId: 'local-default',
      value: {
        id: 'aula-crase',
        profileId: 'local-default',
        editalDisciplineId: 'link-f6',
        title: 'Aula 12 - Crase',
        orderKey: '',
        localRevision: 0,
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 local search finds accents and opens the focused entity by id', async ({ page }) => {
  await seed(page);
  await page.goto('/#/search?q=crase');
  await expect(page.getByTestId('f6-search')).toBeVisible();

  const result = page.getByRole('button', { name: /Crase e acentuação/ });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/#\/content\/edital-f6\?focus=assunto-crase$/);
  const focused = page.locator('[data-entity-id="assunto-crase"]');
  await expect(focused).toHaveAttribute('data-focus', 'true');
  await expect(focused).toBeVisible();
});

test('f6 search only returns authorized query data and never executes markup', async ({ page }) => {
  await seed(page);
  await page.goto('/#/search?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&token=secret');
  await expect(page.getByTestId('f6-search')).toBeVisible();
  await expect(page.getByText('Nenhum resultado neste perfil')).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});


import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function seedThousand(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'large-subject',
      profileId: 'local-default',
      subjectId: 'large-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'large-edital',
      profileId: 'local-default',
      editalId: 'large-edital',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'large-link',
      profileId: 'local-default',
      editalId: 'large-edital',
      subjectId: 'large-subject',
      linkId: 'large-link',
    });
    await harness.seedAssuntos('local-default', 'large-link', 1000);
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 content tree keeps one thousand assuntos paginated and responsive', async ({ page }) => {
  await seedThousand(page);
  const started = Date.now();
  await page.goto('/#/content');
  await expect(page.locator('.tree-node')).toHaveCount(50);
  const firstRenderMs = Date.now() - started;
  console.log('F6_LARGE_TREE', JSON.stringify({ assuntos: 1000, firstRenderMs }));

  let more = page.getByRole('button', { name: /Mostrar mais 950 assunto/ });
  await expect(more).toBeVisible();
  for (const expected of [100, 150, 200]) {
    await more.click();
    await expect(page.locator('.tree-node')).toHaveCount(expected);
    more = page.getByRole('button', { name: /Mostrar mais/ });
  }

  const novo = page.getByLabel('Novo assunto em Direito Constitucional', { exact: true });
  await novo.fill('Assunto pós-volume');
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
  await expect(novo).toHaveValue('');
  const persisted = await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const content = await harness.loadContent('local-default');
    return content.assuntos.length;
  });
  expect(persisted).toBe(1001);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('.tree-node')).toHaveCount(50);
  await expect(page.getByRole('button', { name: /Mostrar mais 951 assunto/ })).toBeVisible();
  expect(firstRenderMs).toBeLessThan(10000);
});


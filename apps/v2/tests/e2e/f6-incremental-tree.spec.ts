import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function seedFiftyPlus(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'inc-subject',
      profileId: 'local-default',
      subjectId: 'inc-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'inc-edital',
      profileId: 'local-default',
      editalId: 'inc-edital',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'inc-link',
      profileId: 'local-default',
      editalId: 'inc-edital',
      subjectId: 'inc-subject',
      linkId: 'inc-link',
    });
    for (let index = 0; index < 60; index += 1) {
      await harness.executeContent({
        type: 'UPSERT_ASSUNTO',
        operationId: 'inc-assunto-' + index,
        profileId: 'local-default',
        value: {
          id: 'inc-assunto-' + String(index).padStart(2, '0'),
          profileId: 'local-default',
          editalDisciplineId: 'inc-link',
          parentId: null,
          parentKey: '',
          title: 'Assunto incremental ' + index,
          orderKey: '',
          localRevision: 0,
        },
      });
    }
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 content tree renders fifty roots and reveals the rest progressively', async ({ page }) => {
  await seedFiftyPlus(page);
  await page.goto('/#/content');
  await expect(page.locator('.tree-node')).toHaveCount(50);
  const more = page.getByRole('button', { name: /Mostrar mais 10 assunto/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.locator('.tree-node')).toHaveCount(60);
  await expect(more).toHaveCount(0);
});


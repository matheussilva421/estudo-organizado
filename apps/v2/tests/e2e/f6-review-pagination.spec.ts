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
      operationId: 'review-page-subject',
      profileId: 'local-default',
      subjectId: 'review-page-subject',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'review-page-edital',
      profileId: 'local-default',
      editalId: 'edital-f6',
      title: 'TRT 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'review-page-link',
      profileId: 'local-default',
      editalId: 'edital-f6',
      subjectId: 'review-page-subject',
      linkId: 'review-page-link',
    });
    await harness.seedReviewCommitments('local-default', 30);
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f6 review agenda paginates thirty commitments in pages of twenty-five', async ({ page }) => {
  await seed(page);
  await page.goto('/#/reviews');
  const agenda = page.getByTestId('review-agenda');
  await expect(agenda).toBeVisible();
  await expect(agenda.locator('li')).toHaveCount(25);
  const more = agenda.getByRole('button', { name: /Mostrar mais 5 compromisso/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect(agenda.locator('li')).toHaveCount(30);
  await expect(more).toHaveCount(0);
});


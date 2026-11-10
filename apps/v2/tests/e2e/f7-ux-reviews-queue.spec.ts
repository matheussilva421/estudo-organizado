import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.seedReviewCommitments('local-default', 3);
  });
  // resetDb replaces the database, so the app connection must reopen it.
  await page.reload();
  await page.goto('/#/reviews');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('review-workspace')).toBeVisible();
}

test('queue filters separate overdue, today and closed reviews', async ({ page }) => {
  await seed(page);
  await expect(page.getByTestId('review-queue-count')).toHaveText('3 de 3');

  await page.getByTestId('review-queue-bucket').selectOption('TODAY');
  await expect(page.getByTestId('review-queue-count')).toHaveText('0 de 3');

  await page.getByTestId('review-queue-bucket').selectOption('OVERDUE');
  await expect(page.getByTestId('review-queue-count')).toHaveText('3 de 3');

  await page.getByTestId('review-queue-bucket').selectOption('DONE');
  await expect(page.getByTestId('review-queue-count')).toHaveText('0 de 3');
});

test('opening the queue does not execute or complete a review', async ({ page }) => {
  await seed(page);
  await expect(page.getByTestId('review-agenda')).toContainText('Revisão semeada 0');
  await page.reload();
  await expect(page.getByTestId('review-workspace')).toBeVisible();
  await expect(page.getByTestId('review-queue-count')).toHaveText('3 de 3');
  await page.getByTestId('review-queue-bucket').selectOption('DONE');
  await expect(page.getByTestId('review-queue-count')).toHaveText('0 de 3');
});


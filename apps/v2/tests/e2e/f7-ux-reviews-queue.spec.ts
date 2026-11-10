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

test('starting a review is durable and distinct from executing it', async ({ page }) => {
  await seed(page);
  await page.getByTestId('review-start-review-seed-0').click();
  await expect(page.getByTestId('review-started-review-seed-0')).toContainText(
    'iniciada em',
  );
  await page
    .locator('[data-testid="review-history-review-seed-0"] summary')
    .click();
  await expect(page.getByTestId('review-history-review-seed-0')).toContainText(
    'STARTED',
  );
  await expect(page.getByTestId('review-agenda')).toContainText('Pendente');

  await page.getByTestId('review-queue-bucket').selectOption('STARTED');
  await expect(page.getByTestId('review-queue-count')).toHaveText('1 de 3');

  await page.reload();
  await expect(page.getByTestId('review-workspace')).toBeVisible();
  await expect(page.getByTestId('review-started-review-seed-0')).toContainText(
    'iniciada em',
  );
  await page.getByTestId('review-queue-bucket').selectOption('STARTED');
  await expect(page.getByTestId('review-queue-count')).toHaveText('1 de 3');
  await page.getByTestId('review-start-review-seed-0').click();
  await expect(page.getByTestId('review-queue-count')).toHaveText('1 de 3');
});

test('base policy requires a preview before saving', async ({ page }) => {
  await seed(page);
  const duration = page.getByLabel('Duração padrão (min)');
  await duration.fill('25');
  const save = page.getByRole('button', { name: 'Aplicar política' });
  await expect(save).toBeDisabled();

  await page.getByTestId('review-policy-preview').click();
  await expect(page.getByTestId('review-policy-base-preview')).toContainText('25 min');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByTestId('review-policy-base-preview')).toContainText(
    'Gere a prévia',
  );

  await page.reload();
  await expect(page.getByTestId('review-workspace')).toBeVisible();
  await expect(page.getByLabel('Duração padrão (min)')).toHaveValue('25');
});


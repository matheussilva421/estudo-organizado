import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };
const profileId = 'local-default';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f7 storage removal offers a clean recovery path without recreating old data', async ({ page }) => {
  await ready(page);
  await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.execute({
      operationId: 'op-before-reset',
      profileId: profile,
      subjectId: 'subject-before-reset',
      type: 'create',
      title: 'Antes da remoção',
    }),
  profileId);
  expect((await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.inspectCounts(profile),
  profileId)).subjects).toBe(1);

  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  expect((await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.inspectCounts(profile),
  profileId)).subjects).toBe(0);
  await expect(page.locator('body')).toContainText('Sem dados neste perfil');

  await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.execute({
      operationId: 'op-after-reset',
      profileId: profile,
      subjectId: 'subject-after-reset',
      type: 'create',
      title: 'Depois da remoção',
    }),
  profileId);
  expect((await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.inspectCounts(profile),
  profileId)).subjects).toBe(1);
});

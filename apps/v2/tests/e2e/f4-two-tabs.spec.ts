import { expect, test } from '@playwright/test';

test('f4 second tab requires assisted authority transfer', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(second.locator('[data-testid="session-foreign-authority"]')).toBeVisible();
  await expect(second.locator('[data-testid="session-takeover"]')).toBeVisible();

  await second.locator('[data-testid="session-takeover"]').click();
  await expect(second.locator('[data-testid="session-pause"]')).toBeEnabled();
  await second.locator('[data-testid="session-pause"]').click();
  await expect(second.locator('[data-testid="session-resume"]')).toBeVisible();

  await second.close();
});

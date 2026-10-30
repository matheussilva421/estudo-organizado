import { expect, test } from '@playwright/test';

test('f4 hidden tab does not pause the timer by itself', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('[data-db-ready="true"]')).toBeVisible();
  await page.waitForTimeout(1_500);
  await page.bringToFront();

  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();
  await second.close();
});

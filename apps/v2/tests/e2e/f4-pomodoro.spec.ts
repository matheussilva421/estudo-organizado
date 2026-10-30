import { expect, test } from '@playwright/test';

test('f4 pomodoro focus break and explicit next focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.locator('[data-testid="pomodoro-start"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Foco');

  await page.locator('[data-testid="pomodoro-complete-stage"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Descanso');

  await page.locator('[data-testid="pomodoro-complete-stage"]').click();
  await expect(page.locator('[data-testid="pomodoro-next-focus"]')).toBeVisible();
  await page.locator('[data-testid="pomodoro-next-focus"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Foco');
});

test('f4 recovery preview appears after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="session-start"]').click();
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-recovery"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-takeover"]')).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('f4 pomodoro focus break and explicit next focus', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.locator('[data-testid="pomodoro-start"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Foco');

  await page.locator('[data-testid="pomodoro-complete-stage"]').click();
  await expect(page.locator('body')).toContainText('ainda não foi concluído');
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Foco');

  await page.clock.fastForward(25 * 60_000);
  await page.locator('[data-testid="pomodoro-complete-stage"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Descanso');

  await page.clock.fastForward(5 * 60_000);
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
  await expect(page.locator('[data-testid="session-recovery-resume"]')).toBeVisible();
  await expect(page.locator('[data-testid="session-recovery-correct"]')).toBeVisible();
});

test('f4 break time never becomes focus time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.locator('[data-testid="pomodoro-start"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Foco');
  await expect(page.locator('[data-testid="session-pause"]')).toBeVisible();
  await page.clock.fastForward(25 * 60_000);
  await expect(page.locator('[data-testid="session-timer"]')).toContainText('00:25:00');
  await page.locator('[data-testid="pomodoro-complete-stage"]').click();
  await expect(page.locator('[data-testid="session-pomodoro"]')).toContainText('Descanso');
  await expect(page.locator('[data-testid="session-timer"]')).toContainText('00:25:00');
  await page.clock.fastForward(5 * 60_000);
  await expect(page.locator('[data-testid="session-timer"]')).toContainText('00:25:00');
  await page.locator('[data-testid="session-pause"]').click();
  await expect(page.locator('[data-testid="session-history"]')).toContainText('00:25:00');
  await expect(page.locator('[data-testid="session-history"]')).not.toContainText('00:30:00');
});

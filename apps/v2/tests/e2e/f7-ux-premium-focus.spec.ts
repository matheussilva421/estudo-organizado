import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

test('focus mode uses the same session and clock without duplicating facts', async ({ page }) => {
  await resetF7Ux(page, '/#/sessions');
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-pause')).toBeVisible();
  await page.waitForTimeout(1_500);

  await page.getByTestId('session-focus-open').click();
  const focus = page.getByTestId('session-focus');
  await expect(focus).toBeVisible();
  await expect(page.getByTestId('session-focus-timer')).toContainText('00:00:0');
  await page.getByTestId('session-focus-pause').click();
  await expect(focus).toContainText('PAUSED');
  await page.getByTestId('session-focus-resume').click();
  await expect(focus).toContainText('RUNNING');

  await page.getByTestId('session-focus-exit').click();
  await expect(page.getByTestId('session-workspace')).toBeVisible();
  await expect(page.getByTestId('session-pause')).toBeVisible();

  await page.getByTestId('session-complete').click();
  await expect(page.getByTestId('session-start')).toBeVisible();
  await expect(page.getByTestId('session-history').locator('[data-session-id]')).toHaveCount(1);
  await expect(page.getByTestId('session-history')).toContainText('TIMER');
});


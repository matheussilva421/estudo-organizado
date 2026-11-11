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

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('session-workspace')).toBeVisible();
  await expect(page.getByTestId('session-focus-open')).toBeFocused();
  await expect(page.getByTestId('session-pause')).toBeVisible();

  await page.getByTestId('session-complete').click();
  await expect(page.getByTestId('session-start')).toBeVisible();
  await expect(page.getByTestId('session-history').locator('[data-session-id]')).toHaveCount(1);
  await expect(page.getByTestId('session-history')).toContainText('TIMER');
});


for (const width of [320, 390]) {
  test(`focus keeps the clock and primary controls on screen at ${width}px in a short window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 420 });
    await resetF7Ux(page, '/#/sessions');
    await page.getByTestId('session-start').click();
    await page.getByTestId('session-focus-open').click();

    await expect(page.getByTestId('session-focus-timer')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('session-focus-pause')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('session-focus-complete')).toBeInViewport({ ratio: 1 });
  });
}

test('focus exposes real cross-tab authority loss and keeps recovery reachable', async ({ context, page }) => {
  await page.setViewportSize({ width: 320, height: 520 });
  await resetF7Ux(page, '/#/sessions');
  await page.getByTestId('session-start').click();
  await page.getByTestId('session-focus-open').click();

  const second = await context.newPage();
  await second.goto('/#/sessions');
  await expect(second.getByTestId('session-foreign-authority')).toBeVisible();
  await second.getByTestId('session-takeover').click();
  await expect(second.getByTestId('session-resume')).toBeEnabled();
  await second.getByTestId('session-resume').click();

  const focus = page.getByTestId('session-focus');
  const warning = focus.getByRole('alert').filter({ hasText: 'Outra aba controla esta sessão' });
  await expect(warning).toBeInViewport();
  await expect(page.getByTestId('session-focus-complete')).toBeDisabled();
  await focus.getByRole('button', { name: 'Sair do Foco' }).click();
  await expect(page.getByTestId('session-foreign-authority')).toBeVisible();
  await expect(page.getByTestId('session-takeover')).toBeVisible();
});

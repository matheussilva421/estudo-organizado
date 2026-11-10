import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

test('f7 ux preserves all typed routes and neutral invalid routing', async ({ page }) => {
  await resetF7Ux(page);
  for (const route of [
    'home',
    'content',
    'planning',
    'sessions',
    'reviews',
    'analytics',
    'attention',
    'settings',
    'search',
    'overview',
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator(`[data-route="${route}"]`)).toBeVisible();
    await expect(page.getByTestId('f6-notfound')).toHaveCount(0);
  }
  await page.goto('/#/content?token=segredo&draft=texto');
  await expect(page).toHaveURL(/#\/content$/);
  await page.goto('/#/rota-invalida/com/partes');
  await expect(page.getByTestId('f6-notfound')).toBeVisible();
  await expect(page.locator('#content-section')).toBeHidden();
});

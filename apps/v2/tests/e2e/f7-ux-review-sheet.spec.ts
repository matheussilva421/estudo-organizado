import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

for (const width of [320, 390]) {
  test(`review filters return focus and preserve selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await resetF7Ux(page, '/#/reviews');
    const trigger = page.getByRole('button', { name: 'Filtrar fila' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Filtros da fila de revisão' });
    await expect(sheet).toBeVisible();
    const bucket = sheet.getByLabel('Situação');
    await expect(bucket).toBeFocused();
    await bucket.selectOption('TODAY');
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 1024, height: 640 });
    await expect(page.getByTestId('review-queue-bucket')).toHaveValue('TODAY');
  });
}

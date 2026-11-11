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
    await expect(sheet.getByTestId('review-queue-sheet-count')).toContainText('de');
    await bucket.selectOption('TODAY');
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await page.setViewportSize({ width: 1024, height: 640 });
    await expect(page.getByTestId('review-queue-bucket')).toHaveValue('TODAY');
  });
}

test('review sheet stays scrollable with 200 percent text at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await resetF7Ux(page, '/#/reviews');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.getByRole('button', { name: 'Filtrar fila' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtros da fila de revisão' });
  await expect(sheet).toBeVisible();
  const metrics = await sheet.evaluate((element) => ({
    scrollable: element.scrollHeight > element.clientHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  const close = sheet.getByRole('button', { name: 'Fechar filtros' });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
  await expect(sheet).not.toBeVisible();
});

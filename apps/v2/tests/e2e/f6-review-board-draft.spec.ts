import { expect, test } from '@playwright/test';

test('f6 review board draft survives reload and clears when emptied', async ({ page }) => {
  await page.goto('/#/reviews');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const title = page.getByLabel('Título/fonte');
  await title.fill('Fonte em rascunho');
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(title).toHaveValue('Fonte em rascunho');

  await title.fill('');
  await page.reload();
  await expect(title).toHaveValue('');
});


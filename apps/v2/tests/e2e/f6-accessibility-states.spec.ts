import { expect, test } from '@playwright/test';

test('f6 reduced motion removes meaningful animation time', async ({ page }) => {
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const measure = () =>
    page.evaluate(() => {
      const element = document.querySelector('button');
      if (!element) return -1;
      return Number.parseFloat(getComputedStyle(element).transitionDuration) || 0;
    });
  const normal = await measure();
  expect(normal).toBeGreaterThan(0.05);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await measure();
  expect(reduced).toBeLessThanOrEqual(0.001);
});

test('f6 mobile bottom navigation keeps every destination reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav).toBeVisible();
  const links = nav.locator('a[data-nav]');
  await expect(links).toHaveCount(9);
  await expect(nav.locator('a[data-nav="home"]')).toHaveAttribute('aria-current', 'page');
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeGreaterThan(700);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await nav.locator('a[data-nav="reviews"]').click();
  await expect(page.getByTestId('f6-search')).toHaveCount(0);
  await expect(page.locator('[data-route="reviews"]')).toBeVisible();
});

test('f6 narrow and zoomed layouts keep the next action and navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  let overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.goto('/#/analytics');
  overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const action = page.locator('[data-action="home-next-action"]');
  await expect(action).toBeVisible();
  await action.focus();
  await expect(action).toBeFocused();
});

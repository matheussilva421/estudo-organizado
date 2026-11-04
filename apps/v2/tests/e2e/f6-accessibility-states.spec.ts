import { expect, test } from '@playwright/test';

test('f6 reduced motion removes meaningful animation time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const durations = await page.evaluate(() => {
    const element = document.querySelector('.button-primary');
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      transition: Number.parseFloat(style.transitionDuration) || 0,
      animation: Number.parseFloat(style.animationDuration) || 0,
    };
  });
  expect(durations).not.toBeNull();
  expect(durations!.transition).toBeLessThanOrEqual(0.001);
  expect(durations!.animation).toBeLessThanOrEqual(0.001);
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

test('f6 zoomed layout keeps the next action and navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const action = page.locator('[data-action="home-next-action"]');
  await expect(action).toBeVisible();
  await action.focus();
  await expect(action).toBeFocused();
});

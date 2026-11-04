import { expect, test } from '@playwright/test';

const nav = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: 'Navegação principal' });

test('f6 desktop uses a lateral sidebar with a vertical active list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const navigation = nav(page);
  const main = page.locator('main');
  const navBox = await navigation.boundingBox();
  const mainBox = await main.boundingBox();
  expect(navBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(mainBox!.x + 1);
  expect(navBox!.width).toBeGreaterThan(150);
  expect(navBox!.width).toBeLessThan(300);
  expect(navBox!.height).toBeGreaterThan(300);

  const first = await navigation.locator('a[data-nav="home"]').boundingBox();
  const second = await navigation.locator('a[data-nav="content"]').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y + 20);
  await expect(navigation.locator('a[data-nav="home"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('f6 tablet uses a compact rail with full visible labels and accessible names', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const navigation = nav(page);
  const main = page.locator('main');
  const navBox = await navigation.boundingBox();
  const mainBox = await main.boundingBox();
  expect(navBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(mainBox!.x + 1);
  expect(navBox!.width).toBeLessThanOrEqual(120);
  expect(navBox!.height).toBeGreaterThan(300);

  const home = navigation.locator('a[data-nav="home"]');
  const fullBox = await home.locator('.nav-label').boundingBox();
  expect(fullBox).not.toBeNull();
  expect(fullBox!.width).toBeGreaterThan(0);
  await expect(home.locator('.nav-label')).toHaveText('Início');
  await expect(home).toHaveAccessibleName('Início');
  await expect(navigation.getByRole('link', { name: 'Planejamento', exact: true })).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Configurações', exact: true }),
  ).toBeVisible();
  await expect(home).toHaveAttribute('aria-current', 'page');
  const activeBorder = await home.evaluate((element) => getComputedStyle(element).borderLeftColor);
  expect(activeBorder).not.toBe('rgba(0, 0, 0, 0)');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('f6 mobile keeps a bottom navigation with every destination reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const navigation = nav(page);
  const box = await navigation.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThan(700);
  await expect(navigation.locator('a[data-nav]')).toHaveCount(9);
  await expect(navigation.locator('.nav-label').first()).toBeVisible();
  const internal = await navigation.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(internal).toBeLessThanOrEqual(1);
  const navBox = await navigation.boundingBox();
  expect(navBox).not.toBeNull();
  for (const link of await navigation.locator('a[data-nav]').all()) {
    const linkBox = await link.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(linkBox!.x).toBeGreaterThanOrEqual(navBox!.x - 1);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
  }
  // Every destination, including the last one, is visible and reachable.
  await navigation.locator('a[data-nav="settings"]').click();
  await expect(page.locator('[data-route="settings"]')).toBeVisible();
  await expect(navigation.locator('a[data-nav="settings"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('f6 navigation does not overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const navigation = nav(page);
  const box = await navigation.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThan(600);
  const internal = await navigation.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(internal).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('f6 viewport changes keep the active route and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/content');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const settings = nav(page).locator('a[data-nav="settings"]');
  await settings.focus();
  await expect(settings).toBeFocused();
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('[data-route="content"]')).toBeVisible();
    await expect(settings).toBeFocused();
    const linkBox = await settings.boundingBox();
    const navBox = await nav(page).boundingBox();
    expect(linkBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(linkBox!.x).toBeGreaterThanOrEqual(navBox!.x - 1);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
  }
});

test('f6 short viewports scroll the rail instead of losing destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.goto('/#/home');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const navigation = nav(page);
  const navBox = await navigation.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.height).toBeLessThanOrEqual(380);
  const scrollable = await navigation.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  expect(scrollable).toBe(true);
  const settings = navigation.locator('a[data-nav="settings"]');
  await settings.focus();
  await expect(settings).toBeFocused();
  const linkBox = await settings.boundingBox();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.y).toBeGreaterThanOrEqual(navBox!.y - 1);
  expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(navBox!.y + navBox!.height + 1);
});

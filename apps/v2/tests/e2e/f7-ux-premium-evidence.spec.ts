import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

const THEMES = [
  'grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma',
  'neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial',
];

test('premium home themes and focus evidence', async ({ page }) => {
  const out = process.env.F7_UX_PREMIUM_EVIDENCE ?? join(tmpdir(), 'f7-ux-premium');
  await mkdir(out, { recursive: true });

  await resetF7Ux(page);
  for (const viewport of [
    { name: 'mobile-320', width: 320, height: 720 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/#/home');
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await page.screenshot({ path: join(out, 'home-empty-' + viewport.name + '.png') });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedAcademicData(page);
  await page.goto('/#/home');
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await page.screenshot({ path: join(out, 'home-data-desktop.png') });

  await page.goto('/#/settings');
  await expect(page.locator('.theme-gallery [data-theme-option]')).toHaveCount(12);
  await page.screenshot({ path: join(out, 'settings-gallery-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'settings-gallery-mobile.png') });

  for (const theme of THEMES) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/settings');
    await page.locator('[data-theme-option="' + theme + '"]').click();
    await page.screenshot({ path: join(out, 'theme-' + theme + '.png') });
  }

  await page.goto('/#/sessions');
  await page.getByTestId('session-start').click();
  await page.getByTestId('session-focus-open').click();
  await expect(page.getByTestId('session-focus')).toBeVisible();
  await page.screenshot({ path: join(out, 'focus-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'focus-mobile.png') });
  await page.getByTestId('session-focus-exit').click();
  await page.getByTestId('session-complete').click();

  await writeFile(
    join(out, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), themes: THEMES, note: 'fixtures sintéticas' }, null, 2),
  );
});

test('capture actual home for each original premium concept', async ({ page }) => {
  test.skip(!process.env.F7_UX_PREMIUM_COMPARE, 'Explicit comparison artifact run');
  const out = process.env.F7_UX_PREMIUM_COMPARE!;
  await mkdir(out, { recursive: true });
  await resetF7Ux(page);
  for (const theme of THEMES.slice(-4)) {
    await page.setViewportSize({ width: 1586, height: 992 });
    await page.goto('/#/settings');
    await page.locator('[data-theme-option="' + theme + '"]').click();
    await page.goto('/#/home');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByTestId('home-hero')).toHaveAttribute('data-context', 'ONBOARDING');
    for (const viewport of [
      { name: 'desktop', width: 1586, height: 992 },
      { name: 'tablet', width: 900, height: 1100 },
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'mobile-320-short', width: 320, height: 568 },
      { name: 'mobile-320', width: 320, height: 720 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(page.getByRole('link', { name: 'Adicionar conteúdo' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(out, theme + '-' + viewport.name + '.png'), animations: 'disabled' });
    }
  }
});

test('capture the populated home for each premium concept', async ({ page }) => {
  test.skip(!process.env.F7_UX_PREMIUM_COMPARE, 'Explicit comparison artifact run');
  const out = process.env.F7_UX_PREMIUM_COMPARE!;
  await mkdir(out, { recursive: true });
  await resetF7Ux(page);
  await seedAcademicData(page);
  await page.goto('/#/home');
  for (const theme of THEMES.slice(-4)) {
    await page.goto('/#/settings');
    await page.locator('[data-theme-option="' + theme + '"]').click();
    await page.goto('/#/home');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByTestId('home-hero')).toBeVisible();
    for (const viewport of [
      { name: 'desktop', width: 1586, height: 992 },
      { name: 'mobile-390', width: 390, height: 844 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(out, theme + '-data-' + viewport.name + '.png'),
        animations: 'disabled',
      });
    }
  }
});


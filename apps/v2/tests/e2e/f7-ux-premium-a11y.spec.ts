import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

const THEMES = [
  'grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma',
  'neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial',
];

test('twelve themes preserve sampled contrast and reduced motion', async ({ page }) => {
  await resetF7Ux(page, '/#/settings');
  await expect(page.getByTestId('f6-settings')).toBeVisible();
  for (const theme of THEMES) {
    const ratios = await page.evaluate((name) => {
      document.documentElement.dataset.theme = name;
      const styles = getComputedStyle(document.documentElement);
      const text = styles.getPropertyValue('--text').trim();
      const secondary = styles.getPropertyValue('--text-secondary').trim();
      const muted = styles.getPropertyValue('--text-muted').trim();
      const accent = styles.getPropertyValue('--accent').trim();
      const accentText = styles.getPropertyValue('--accent-text').trim();
      const card = styles.getPropertyValue('--card').trim();
      const surface = styles.getPropertyValue('--surface').trim();
      const rgb = (value: string) => {
        const hex = value.replace('#', '');
        return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
      };
      const luminance = (channels: number[]) => {
        const [r = 0, g = 0, b = 0] = channels.map((channel) =>
          channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        );
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (foreground: number[], background: number[]) => {
        const fg = luminance(foreground);
        const bg = luminance(background);
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      };
      return [
        ratio(rgb(text), rgb(card)),
        ratio(rgb(text), rgb(surface)),
        ratio(rgb(secondary), rgb(card)),
        ratio(rgb(muted), rgb(card)),
        ratio(rgb(accentText), rgb(accent)),
      ];
    }, theme);
    expect(ratios[0], theme + ' card').toBeGreaterThanOrEqual(4.5);
    expect(ratios[1], theme + ' surface').toBeGreaterThanOrEqual(4.5);
    expect(ratios[2], theme + ' secondary').toBeGreaterThanOrEqual(4.5);
    expect(ratios[3], theme + ' muted').toBeGreaterThanOrEqual(4.5);
    expect(ratios[4], theme + ' accent text').toBeGreaterThanOrEqual(4.5);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transition = await page.evaluate(() => {
    const button = document.querySelector('.theme-card');
    return button ? getComputedStyle(button).transitionDuration : '';
  });
  expect(Number.parseFloat(transition || '0')).toBeLessThanOrEqual(0.02);
});

test('premium themes stay usable at 320px and expose the gallery', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await resetF7Ux(page, '/#/settings');
  await expect(page.getByTestId('f6-settings')).toBeVisible();
  await expect(page.locator('.theme-gallery [data-theme-option]')).toHaveCount(12);
  for (const theme of ['neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial']) {
    await page.locator('[data-theme-option="' + theme + '"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, theme).toBeLessThanOrEqual(1);
  }
});

test('home inline links meet the minimum target size on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetF7Ux(page, '/#/home');
  const home = page.getByTestId('f6-home');
  const inlineLinks = home.locator('a:not(.button-primary):not(.button-ghost):not(.badge)');
  await expect(inlineLinks.first()).toBeVisible();
  const sizes = await inlineLinks.evaluateAll((links) =>
    links.map((link) => ({
      label: link.textContent?.trim() ?? '',
      height: link.getBoundingClientRect().height,
    })),
  );
  for (const size of sizes) expect(size.height, size.label).toBeGreaterThanOrEqual(24);
});

test('each premium theme renders its own hero scene without hiding the CTA', async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await resetF7Ux(page, '/#/home');
  for (const theme of ['neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial']) {
    await page.getByRole('combobox', { name: 'Tema', exact: true }).selectOption(theme);
    const scene = page.locator('.hero-scene[data-hero-theme="' + theme + '"]');
    await expect(scene).toBeVisible();
    expect(await scene.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(300);
    await expect(page.locator('.hero-scene:visible')).toHaveCount(1);
    await expect(page.getByTestId('home-hero').getByRole('link').first()).toBeVisible();
  }
});


import { expect, test } from '@playwright/test';

const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];

test('eight_themes_sampled_AA', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  for (const theme of themes) {
    const ratio = await page.evaluate((name) => {
      document.documentElement.dataset.theme = name;
      const styles = getComputedStyle(document.documentElement);
      const text = styles.getPropertyValue('--text').trim();
      const card = styles.getPropertyValue('--card').trim();
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
      const foreground = luminance(rgb(text));
      const background = luminance(rgb(card));
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    }, theme);

    expect(ratio, theme).toBeGreaterThanOrEqual(4.5);
  }
});

test('keyboard_and_focus_accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.keyboard.press('Tab');

  const outline = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element) return 'none';
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.outlineWidth}`;
  });

  expect(outline).not.toBe('none 0px');
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`no_horizontal_overflow_${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
}

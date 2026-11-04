import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];

test('f6 shell contrast and overflow across eight themes and three viewports', async ({ page }) => {
  const out = process.env.F6_EVIDENCE_DIR;
  if (out) await mkdir(resolve(out, 'matrix'), { recursive: true });

  await page.goto('/#/home');
  await expect(page.getByTestId('f6-home')).toBeVisible();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const samples: Array<{ theme: string; viewport: string; ratios: Record<string, number> }> = [];

  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'overflow ' + theme + ' ' + viewport.name).toBeLessThanOrEqual(1);

      const ratios = await page.evaluate(() => {
        const parse = (value: string) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = match[1]!.split(',').map((item) => Number.parseFloat(item.trim()));
          return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
        };
        const channel = (value: number) => {
          const n = value / 255;
          return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
        };
        const luminance = (color: { r: number; g: number; b: number }) =>
          0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
        const ratio = (selector: string) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLElement)) return 0;
          const style = getComputedStyle(element);
          const foreground = parse(style.color);
          if (!foreground) return 0;
          let background = style.backgroundColor;
          let node: HTMLElement | null = element;
          while (node && (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')) {
            node = node.parentElement;
            background = node ? getComputedStyle(node).backgroundColor : 'rgb(255,255,255)';
          }
          const surface = parse(background);
          if (!surface) return 0;
          const light = Math.max(luminance(foreground), luminance(surface));
          const dark = Math.min(luminance(foreground), luminance(surface));
          return (light + 0.05) / (dark + 0.05);
        };
        return {
          heading: ratio('#home-title'),
          subtitle: ratio('.view-subtitle'),
          nav: ratio('[data-nav="home"]'),
          navInactive: ratio('[data-nav="settings"]'),
          countLabel: ratio('.count-label'),
          source: ratio('.source-note'),
        };
      });

      for (const [name, value] of Object.entries(ratios)) {
        expect(value, name + ' ' + theme + ' ' + viewport.name).toBeGreaterThanOrEqual(4.5);
      }
      samples.push({ theme, viewport: viewport.name, ratios });

      if (out) {
        await page.screenshot({
          path: resolve(out, 'matrix', 'f6-home-' + theme + '-' + viewport.name + '.png'),
          fullPage: false,
        });
      }
    }
  }

  console.log('F6_VISUAL_SAMPLES', JSON.stringify(samples));
});


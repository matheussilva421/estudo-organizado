import { expect, test, type Page } from '@playwright/test';

const THEMES = [
  'grafite',
  'ardosia',
  'platina',
  'terminal',
  'neon',
  'arrakis',
  'codex',
  'plasma',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'mobile', width: 390, height: 844 },
];
async function seedContent(page: Page): Promise<void> {
  await page.getByLabel('Nova disciplina').fill('Direito Constitucional');
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click();
  await page.getByLabel('Novo edital').fill('TJPB 2026');
  await page.getByRole('button', { name: 'Criar edital' }).click();
  await page.getByLabel('Vincular disciplina existente a TJPB 2026').selectOption({
    label: 'Direito Constitucional',
  });
  await page.getByRole('button', { name: 'Vincular' }).click();
  await page.getByLabel('Novo assunto em Direito Constitucional', { exact: true }).fill('Controle');
  await page.getByRole('button', { name: 'Adicionar assunto' }).click();
}

function parseCssColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const hex = value.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const int = Number.parseInt(hex[1]!, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
      a: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1,
    };
  }
  const rgb = value.trim().match(/rgba?\(([^)]+)\)/);
  if (!rgb) return null;
  const parts = rgb[1]!.split(',').map((item) => Number.parseFloat(item.trim()));
  return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
}

/** WCAG relative luminance over the surface (alpha composited). */
function controlBorderContrast(borderCss: string, surfaceCss: string): number {
  const surface = parseCssColor(surfaceCss);
  const border = parseCssColor(borderCss);
  if (!surface || !border) return 0;
  const blend = {
    r: border.a * border.r + (1 - border.a) * surface.r,
    g: border.a * border.g + (1 - border.a) * surface.g,
    b: border.a * border.b + (1 - border.a) * surface.b,
  };
  const channel = (value: number) => {
    const n = value / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const lum = (color: { r: number; g: number; b: number }) =>
    0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  const light = Math.max(lum(blend), lum(surface));
  const dark = Math.min(lum(blend), lum(surface));
  return (light + 0.05) / (dark + 0.05);
}

test('eight_themes_three_viewports_and_accessible_controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await seedContent(page);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of THEMES) {
      await page.locator('.theme-picker select').selectOption(theme);
      await expect(page.locator('.app-shell')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${theme}/${viewport.name} horizontal overflow`).toBeLessThanOrEqual(1);

      if (viewport.name === 'desktop') {
        const tokens = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          return {
            border: style.getPropertyValue('--control-border'),
            surface: style.getPropertyValue('--surface'),
          };
        });
        const borderContrast = controlBorderContrast(tokens.border, tokens.surface);
        expect(borderContrast, `${theme} control border contrast`).toBeGreaterThanOrEqual(3);
      }

      await page.screenshot({
        path: `test-results/impeccable/${theme}-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }

  // Keyboard focus stays visible on the primary action.
  await page.setViewportSize({ width: 390, height: 844 });
  const control = page.locator('.theme-picker select');
  await control.focus();
  const outline = await control.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
});

test('coarse_pointer_targets_are_at_least_44px', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: false,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.getByLabel('Novo edital').fill('TJPB 2026');
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('button, select, input')].map(
      (element) => element.getBoundingClientRect().height,
    ),
  );
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5);
  await context.close();
});

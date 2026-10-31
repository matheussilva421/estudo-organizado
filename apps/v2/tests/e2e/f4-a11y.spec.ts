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

async function contrastOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement | null;
    if (!element) return -1;
    const parse = (value: string) => {
      const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const int = Number.parseInt(hex[1]!, 16);
        return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: 1 };
      }
      if (!value.startsWith('rgb')) return null;
      const open = value.indexOf('(');
      const close = value.indexOf(')');
      if (open < 0 || close < 0) return null;
      const parts = value
        .slice(open + 1, close)
        .split(',')
        .map((item) => Number.parseFloat(item.trim()));
      return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
    };
    const style = getComputedStyle(element);
    let node: HTMLElement | null = element;
    let background = style.backgroundColor;
    while (
      node &&
      (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')
    ) {
      node = node.parentElement;
      background = node ? getComputedStyle(node).backgroundColor : 'rgb(255,255,255)';
    }
    const fg = parse(style.color);
    const bg = parse(background);
    if (!fg || !bg) return -1;
    const blend = {
      r: fg.a * fg.r + (1 - fg.a) * bg.r,
      g: fg.a * fg.g + (1 - fg.a) * bg.g,
      b: fg.a * fg.b + (1 - fg.a) * bg.b,
    };
    const channel = (value: number) => {
      const n = value / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    };
    const lum = (c: { r: number; g: number; b: number }) =>
      0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    return (
      (Math.max(lum(blend), lum(bg)) + 0.05) /
      (Math.min(lum(blend), lum(bg)) + 0.05)
    );
  }, selector);
}

test('f4 session controls meet contrast and focus in eight themes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    for (const selector of [
      '[data-testid="session-start"]',
      '[data-testid="session-manual-submit"]',
      '[data-testid="session-plan-block"]',
    ]) {
      const ratio = await contrastOf(page, selector);
      expect(ratio, theme + ' ' + selector).toBeGreaterThanOrEqual(4.5);
    }
  }
  const start = page.locator('[data-testid="session-start"]');
  await start.focus();
  const outline = await start.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      width: Number.parseFloat(style.outlineWidth),
      style: style.outlineStyle,
    };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('f4 touch targets are at least 44px on mobile', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  for (const selector of [
    '[data-testid="session-start"]',
    '[data-testid="session-manual-submit"]',
    '[data-testid="session-plan-block"]',
    '[data-testid="session-habit-create"]',
  ]) {
    const box = await page.locator(selector).boundingBox();
    expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(44);
  }
  await context.close();
});

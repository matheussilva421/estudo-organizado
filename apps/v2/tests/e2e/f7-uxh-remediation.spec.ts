import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetF7Ux, seedAcademicData } from './f7-ux-helpers';

const THEMES = [
  'grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis',
  'codex', 'plasma', 'neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial',
];

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) throw new Error('Cor não RGB: ' + value);
  const [red = 0, green = 0, blue = 0] = match[1]
    .split(',')
    .map((part) => Number(part.trim()));
  return [red, green, blue];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground: string, background: string): number {
  const first = luminance(parseRgb(foreground));
  const second = luminance(parseRgb(background));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('content guide links meet contrast and interaction states in twelve themes', async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await resetF7Ux(page, '/#/content/f7ux-edital?focus=f7ux-assunto');
  await seedAcademicData(page);
  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  const links = page.locator('.workspace-guide-links a');
  await expect(links).toHaveCount(3);
  await expect(links).toHaveText(['Disciplinas', 'Verticalização', 'Importação protegida']);
  const evidenceDir = process.env.F7_UXH_EVIDENCE_DIR ?? join(tmpdir(), 'f7-uxh-contrast');
  mkdirSync(evidenceDir, { recursive: true });
  const measurements: Array<{
    theme: string;
    link: string;
    foreground: string;
    background: string;
    contrast: number;
  }> = [];

  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    const states = await links.evaluateAll((elements) => {
      const guide = elements[0]?.closest('.workspace-guide');
      if (!guide) throw new Error('Guia de Conteúdo ausente');
      const background = getComputedStyle(guide).backgroundColor;
      return elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          text: element.textContent?.trim(),
          color: style.color,
          background,
          outline: style.outlineStyle,
        };
      });
    });

    for (const state of states) {
      expect(state.text?.length, theme).toBeGreaterThan(0);
      expect(state.color, theme + ' ainda usa azul padrão').not.toBe('rgb(0, 0, 238)');
      const ratio = contrast(state.color, state.background);
      measurements.push({
        theme,
        link: state.text ?? '',
        foreground: state.color,
        background: state.background,
        contrast: Math.round(ratio * 100) / 100,
      });
      expect(ratio, theme + ' / ' + state.text).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByTestId('f7-content-workspace').screenshot({
      path: join(evidenceDir, theme + '-content-guide.png'),
    });
  }

  await links.first().hover();
  const hover = await links.first().evaluate((element) => ({
    color: getComputedStyle(element).color,
    background: getComputedStyle(element.closest('.workspace-guide')!).backgroundColor,
  }));
  expect(contrast(hover.color, hover.background)).toBeGreaterThanOrEqual(4.5);

  await links.first().focus();
  const focused = await links.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focused.outlineStyle).not.toBe('none');
  expect(focused.outlineWidth).not.toBe('0px');
  writeFileSync(
    join(evidenceDir, 'content-guide-contrast.json'),
    JSON.stringify({ viewport: '1586x992', fontPx: 11.84, measurements }, null, 2),
  );
});

test('content guide links retain contrast at mobile and 200 percent text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await resetF7Ux(page, '/#/content/f7ux-edital?focus=f7ux-assunto');
  await seedAcademicData(page);
  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await page.addStyleTag({ content: 'html { font-size: 200% }' });
  const links = page.locator('.workspace-guide-links a');
  await expect(links).toHaveCount(3);
  const states = await links.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        background: getComputedStyle(element.closest('.workspace-guide')!).backgroundColor,
        right: element.getBoundingClientRect().right,
      };
    }),
  );
  for (const state of states) {
    expect(contrast(state.color, state.background)).toBeGreaterThanOrEqual(4.5);
    expect(state.right).toBeLessThanOrEqual(320);
  }
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          cls: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
          text: (element.textContent ?? '').trim().slice(0, 40),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > width + 1)
      .slice(0, 15);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: width,
      offenders,
    };
  });
  expect(overflow.scrollWidth, JSON.stringify(overflow.offenders)).toBeLessThanOrEqual(321);
});

test('knowledge review and insights use desktop workspace grids', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetF7Ux(page, '/#/content/f7ux-edital?focus=f7ux-assunto');
  await seedAcademicData(page);

  await page.goto('/#/content/f7ux-edital?focus=f7ux-assunto');
  await expect(page.getByTestId('f7-content-workspace')).toBeVisible();
  const knowledge = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('#content-section')!;
    const library = document.querySelector<HTMLElement>(
      '#content-section > section[data-studio="knowledge"]',
    )!;
    const subnav = document.querySelector<HTMLElement>('#content-section > .studio-subnav')!;
    const subjects = document.querySelector<HTMLElement>(
      '#content-section > section[aria-labelledby="subjects-title"]',
    )!;
    const editais = document.querySelector<HTMLElement>(
      '#content-section > section[aria-labelledby="editais-title"]',
    )!;
    return {
      display: getComputedStyle(section).display,
      libraryTop: Math.round(library.getBoundingClientRect().top),
      subnavTop: Math.round(subnav.getBoundingClientRect().top),
      subjectsTop: Math.round(subjects.getBoundingClientRect().top),
      editaisTop: Math.round(editais.getBoundingClientRect().top),
    };
  });
  expect(knowledge.display).toBe('grid');
  expect(Math.abs(knowledge.libraryTop - knowledge.subnavTop)).toBeLessThanOrEqual(2);
  expect(Math.abs(knowledge.subjectsTop - knowledge.editaisTop)).toBeLessThanOrEqual(2);

  await page.goto('/#/reviews');
  await expect(page.getByTestId('review-workspace')).toBeVisible();
  const review = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-studio="reviews"]')!;
    const policy = document.querySelector<HTMLElement>('#review-policy')!;
    const overrides = document.querySelector<HTMLElement>(
      '[data-testid="review-policy-overrides"]',
    )!;
    return {
      display: getComputedStyle(root).display,
      policyTop: Math.round(policy.getBoundingClientRect().top),
      overridesTop: Math.round(overrides.getBoundingClientRect().top),
      policyWidth: Math.round(policy.getBoundingClientRect().width),
      rootWidth: Math.round(root.getBoundingClientRect().width),
    };
  });
  expect(review.display).toBe('grid');
  expect(Math.abs(review.policyTop - review.overridesTop)).toBeLessThanOrEqual(2);
  expect(review.policyWidth).toBeGreaterThan(review.rootWidth * 0.45);
  expect(review.policyWidth).toBeLessThan(review.rootWidth * 0.7);

  await page.goto('/#/analytics');
  await expect(page.getByTestId('f6-analytics')).toBeVisible();
  const analytics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="f6-analytics"]')!;
    const editor = document.querySelector<HTMLElement>('.analytics-editor')!;
    const archive = document.querySelector<HTMLElement>(
      '[aria-labelledby="analytics-archive-title"]',
    )!;
    return {
      display: getComputedStyle(root).display,
      editorTop: Math.round(editor.getBoundingClientRect().top),
      archiveTop: Math.round(archive.getBoundingClientRect().top),
    };
  });
  expect(analytics.display).toBe('grid');
  expect(Math.abs(analytics.editorTop - analytics.archiveTop)).toBeLessThanOrEqual(2);
});

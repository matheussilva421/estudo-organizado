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

import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);
test.use({ hasTouch: true });

const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
const viewports = [
  { width: 1280, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

async function openReview(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-testid="review-workspace"]')).toBeVisible();
}

async function contrastReport(
  page: Page,
): Promise<Array<{ label: string; ratio: number; minimum: number }>> {
  return page.evaluate(() => {
    function parse(color: string): [number, number, number, number] {
      const match = color.match(/rgba?\(([^)]+)\)/);
      if (!match?.[1]) return [0, 0, 0, 1];
      const parts = match[1].split(',').map((part) => Number(part.trim()));
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
    }
    function composite(
      foreground: [number, number, number, number],
      background: [number, number, number, number],
    ): [number, number, number] {
      const alpha = foreground[3];
      return [
        foreground[0] * alpha + background[0] * (1 - alpha),
        foreground[1] * alpha + background[1] * (1 - alpha),
        foreground[2] * alpha + background[2] * (1 - alpha),
      ];
    }
    function luminance(
      color: [number, number, number] | [number, number, number, number],
    ): number {
      const [red, green, blue] = color;
      const channel = (value: number): number => {
        const normalized = value / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    }
    function backgroundOf(element: Element): [number, number, number, number] {
      let current: Element | null = element;
      let base: [number, number, number, number] = [255, 255, 255, 1];
      const layers: Array<[number, number, number, number]> = [];
      while (current) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color[3] > 0) layers.unshift(color);
        if (color[3] >= 1) break;
        current = current.parentElement;
      }
      for (const layer of layers) {
        const mixed = composite(layer, base);
        base = [mixed[0], mixed[1], mixed[2], 1];
      }
      return base;
    }
    function ratioBetween(
      foreground: [number, number, number],
      background: [number, number, number, number],
    ): number {
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    }
    function ratio(element: Element): number {
      const style = getComputedStyle(element);
      const background = backgroundOf(element);
      const foreground = composite(parse(style.color), background);
      return ratioBetween(foreground, background);
    }
    function borderRatio(element: Element): number {
      const background = backgroundOf(element);
      const border = composite(parse(getComputedStyle(element).borderTopColor), background);
      return ratioBetween(border, background);
    }
    const firstVisible = (selector: string): Element | null =>
      Array.from(document.querySelectorAll(selector)).find((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
      }) ?? null;
    const pairs: Array<{ label: string; selector: string; minimum: number }> = [
      { label: 'texto principal', selector: '[data-testid="review-workspace"] > p.empty-state', minimum: 4.5 },
      { label: 'política: título', selector: '[data-testid="review-policy"] h3', minimum: 4.5 },
      { label: 'política: dica', selector: '[data-testid="review-policy"] .hint', minimum: 4.5 },
      { label: 'override: título', selector: '[data-testid="review-policy-overrides"] h3', minimum: 4.5 },
      { label: 'override: dica', selector: '[data-testid="review-policy-overrides"] .hint', minimum: 4.5 },
      { label: 'override: campo', selector: '[data-testid="review-policy-overrides"] input', minimum: 4.5 },
      { label: 'projeção: título', selector: '[data-testid="review-projections"] h3', minimum: 4.5 },
      { label: 'projeção: status', selector: '[data-testid="review-projections"] .session-status', minimum: 4.5 },
      { label: 'lembretes: título', selector: '[data-testid="review-reminders"] h3', minimum: 4.5 },
      { label: 'lembretes: dica', selector: '[data-testid="review-reminders"] .hint', minimum: 4.5 },
      { label: 'lembretes: horário', selector: '[data-testid="review-reminders"] input[type="time"]', minimum: 4.5 },
      { label: 'agenda: título', selector: '[data-testid="review-agenda"] h3', minimum: 4.5 },
      { label: 'pontos fracos: título', selector: '[data-testid="review-weak-points"] h3', minimum: 4.5 },
      { label: 'status do workspace', selector: '[data-testid="review-status"]', minimum: 4.5 },
    ];
    const report: Array<{ label: string; ratio: number; minimum: number }> = [];
    for (const { label, selector, minimum } of pairs) {
      const element = firstVisible(selector);
      if (!element) continue;
      report.push({ label, ratio: Math.round(ratio(element) * 100) / 100, minimum });
    }
    for (const [label, selector] of [
      ['borda do botão de política', '[data-testid="review-policy"] button:not([disabled])'],
      ['borda do campo de override', '[data-testid="review-policy-overrides"] select'],
      ['borda do botão de projeção', '[data-testid="review-projections"] button:not([disabled])'],
      ['borda do botão de lembretes', '[data-testid="review-reminders"] button:not([disabled])'],
    ] as Array<[string, string]>) {
      const element = firstVisible(selector);
      if (!element) continue;
      report.push({
        label,
        ratio: Math.round(borderRatio(element) * 100) / 100,
        minimum: 3,
      });
    }
    return report;
  });
}

test('f5 review workspace is reachable across eight themes and three viewports', async ({ page }) => {
  await openReview(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of themes) {
      await page.getByLabel('Tema').selectOption(theme);
      await expect(page.locator('[data-testid="review-policy"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-topics"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-agenda"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-policy-overrides"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-projections"]')).toBeVisible();
      await expect(page.locator('[data-testid="review-reminders"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar tópico de revisão' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${theme} ${viewport.width}px overflow`).toBeLessThanOrEqual(1);
    }
  }
});

test('F5-T47 checks WCAG AA contrast in eight themes and three viewports', async ({ page }) => {
  await openReview(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of themes) {
      await page.getByLabel('Tema').selectOption(theme);
      const report = await contrastReport(page);
      expect(report.length).toBe(18);
      for (const entry of report) {
        expect(entry.ratio, `${theme} ${viewport.width}px: ${entry.label}`).toBeGreaterThanOrEqual(
          entry.minimum,
        );
      }
    }
  }
});

test('F5-T47 keeps keyboard focus visible and movable in all themes', async ({ page }) => {
  await openReview(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const button = page.getByRole('button', { name: 'Criar tópico de revisão' });
  for (const theme of themes) {
    await page.getByLabel('Tema').selectOption(theme);
    await button.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      const style = getComputedStyle(active);
      return {
        tag: active.tagName,
        text: active.textContent?.trim() ?? '',
        outlineWidth: Number.parseFloat(style.outlineWidth || '0'),
        outlineStyle: style.outlineStyle,
      };
    });
    expect(focus?.text).toContain('Criar tópico de revisão');
    expect(focus?.outlineWidth ?? 0).toBeGreaterThanOrEqual(2);
    expect(focus?.outlineStyle).not.toBe('none');
  }
  await page.keyboard.press('Tab');
  const moved = await page.evaluate(() => document.activeElement?.textContent ?? '');
  expect(moved).not.toContain('Criar tópico de revisão');
});

test('F5-T47 exposes landmarks, labels and an accessible error message', async ({ page }) => {
  await openReview(page);
  await expect(page.getByRole('region', { name: 'Revisões e inteligência' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Revisões e inteligência' })).toBeVisible();
  await expect(page.getByLabel('Duração padrão (min)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar tópico de revisão' })).toBeVisible();
  await expect(page.getByLabel('Intervalo inicial (dias)')).toBeVisible();
  await expect(page.getByLabel('Silêncio começa')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Permitir aviso externo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reconstruir cache' })).toBeVisible();

  const duration = page.locator('[data-testid="review-policy"] input[type="number"]');
  await duration.fill('1');
  await page.getByRole('button', { name: 'Gravar política' }).click();
  const notice = page.locator('.inline-notice').last();
  await expect(notice).toContainText('Duração padrão deve ficar entre 5 e 180 minutos');
  await expect(notice).toHaveAttribute('role', 'alert');
  await expect(duration).toHaveAttribute('aria-invalid', 'true');
  await expect(duration).toHaveAttribute('aria-describedby', 'review-policy-error');
});

test('F5-T47 keeps touch targets and reduced motion usable on mobile', async ({ page }) => {
  await openReview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const buttons = page.locator(
    '[data-testid="review-workspace"] button:visible, [data-testid="review-workspace"] input:not([type="checkbox"]):not([type="radio"]):visible, [data-testid="review-workspace"] select:visible, [data-testid="review-workspace"] textarea:visible',
  );
  const count = await buttons.count();
  expect(count).toBeGreaterThan(10);
  for (let index = 0; index < count; index += 1) {
    const box = await buttons.nth(index).boundingBox();
    if (!box) continue;
    expect(box.height, `botão ${index}`).toBeGreaterThanOrEqual(43.5);
    expect(box.width, `botão ${index}`).toBeGreaterThanOrEqual(43.5);
  }
  const duration = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="review-projections"] button');
    return element ? getComputedStyle(element).transitionDuration : '0s';
  });
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.01);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

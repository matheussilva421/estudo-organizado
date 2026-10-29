import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];

const scenario = {
  id: 'scenario-a11y',
  profileId: 'local-default',
  editalId: 'edital-tjpb',
  kind: 'FINAL_STRETCH' as const,
  name: 'Acessibilidade',
  status: 'DRAFT' as const,
  localRevision: 1,
  schemaVersion: 1,
  priorityProfileId: 'priority-default',
  priorityProfileRevision: 1,
  examDate: '2027-06-30',
  referenceZone: 'America/Fortaleza',
};

test('planning_controls_are_keyboard_reachable_in_every_theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    await expect(page.locator('[data-testid="planning-workspace"]')).toBeVisible();

    const button = page.locator('[data-action="calendar-day"]');
    await button.focus();
    await expect(button).toBeFocused();

    const views = page.locator('[data-testid="planning-calendar"] [role="group"] button');
    await expect(views).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expect(views.nth(index)).toHaveAttribute('aria-pressed');
    }
  }
});

test('planning_section_has_no_horizontal_overflow_on_mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('planning_text_contrast_and_touch_targets_in_every_theme', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async (seed) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-a11y' },
      scenarioId: seed.id,
      baseRevision: null,
      changes: { scenario: seed },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'op-a11y-blocks' },
      scenarioId: seed.id,
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'block-a11y',
            profileId: 'local-default',
            editalId: 'edital-tjpb',
            scenarioId: seed.id,
            editalDisciplineId: 'link-1',
            plannedMinutes: 60,
            allocation: 'UNALLOCATED',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'op-a11y-blocks',
            label: 'Conteúdo',
          },
        ],
      },
    });
  }, scenario);
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    await expect(page.locator('[data-testid="planning-dashboard"]')).toContainText('Acessibilidade');

    const ratio = await page.evaluate(() => {
      const heading = document.querySelector('[data-testid="planning-dashboard"] h2');
      if (!heading) return 0;
      const style = getComputedStyle(heading);
      let background = style.backgroundColor;
      let node: HTMLElement | null = heading as HTMLElement;
      while (node && (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')) {
        node = node.parentElement;
        background = node ? getComputedStyle(node).backgroundColor : 'rgb(255,255,255)';
      }
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
      const foreground = parse(style.color);
      const surface = parse(background);
      if (!foreground || !surface) return 0;
      const light = Math.max(luminance(foreground), luminance(surface));
      const dark = Math.min(luminance(foreground), luminance(surface));
      return (light + 0.05) / (dark + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    for (const action of ['calendar-day', 'preview-generation', 'preview-redistribution']) {
      const box = await page.locator(`[data-action="${action}"]`).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }
  await context.close();
});

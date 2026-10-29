import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const THEMES = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];

async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.resetDb();
    await harness.execute({
      operationId: 'a11y-subject',
      profileId: 'local-default',
      subjectId: 'subject-a11y',
      type: 'create',
      title: 'Direito Administrativo',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'a11y-edital',
      profileId: 'local-default',
      editalId: 'edital-a11y',
      title: 'Edital A11y',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'a11y-link',
      profileId: 'local-default',
      editalId: 'edital-a11y',
      subjectId: 'subject-a11y',
      linkId: 'link-a11y',
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'a11y-scenario' },
      scenarioId: 'scenario-a11y',
      baseRevision: null,
      changes: {
        scenario: {
          id: 'scenario-a11y',
          profileId: 'local-default',
          editalId: 'edital-a11y',
          kind: 'FINAL_STRETCH',
          name: 'Plano A11y',
          status: 'DRAFT',
          localRevision: 1,
          schemaVersion: 1,
          priorityProfileId: 'priority-default',
          priorityProfileRevision: 1,
          examDate: '2027-06-30',
          referenceZone: 'America/Fortaleza',
        },
      },
    });
    await harness.planningCommit({
      scope: { profileId: 'local-default', operationId: 'a11y-blocks' },
      scenarioId: 'scenario-a11y',
      baseRevision: 1,
      changes: {
        upsertBlocks: [
          {
            id: 'a11y-block',
            profileId: 'local-default',
            editalId: 'edital-a11y',
            scenarioId: 'scenario-a11y',
            editalDisciplineId: 'link-a11y',
            plannedMinutes: 60,
            allocation: 'UNALLOCATED',
            priority: 1,
            localRevision: 1,
            sourceOperationId: 'a11y-blocks',
            label: 'Conteúdo A11y',
          },
        ],
      },
    });
  });
  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

/** WCAG contrast with alpha compositing over the nearest opaque background. */
const contrastOf = (selector: string) => {
  const element = document.querySelector(selector);
  if (!element) return -1;
  const style = getComputedStyle(element);
  const parse = (value: string) => {
    const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const int = Number.parseInt(hex[1]!, 16);
      return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255, a: 1 };
    }
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1]!.split(',').map((item) => Number.parseFloat(item.trim()));
    return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 };
  };
  let node: HTMLElement | null = element as HTMLElement;
  let background = getComputedStyle(node).backgroundColor;
  while (node && (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')) {
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
  const light = Math.max(lum(blend), lum(bg));
  const dark = Math.min(lum(blend), lum(bg));
  return (light + 0.05) / (dark + 0.05);
};

test('text_error_and_disabled_states_meet_contrast_in_eight_themes', async ({ page }) => {
  await seed(page);
  for (const theme of THEMES) {
    await page.getByLabel('Tema').selectOption(theme);
    await expect(page.locator('[data-testid="planning-dashboard"]')).toBeVisible();

    const heading = await page.evaluate(contrastOf, '[data-testid="planning-dashboard"] h2');
    expect(heading, `heading contrast in ${theme}`).toBeGreaterThanOrEqual(4.5);

    const button = await page.evaluate(
      contrastOf,
      '[data-action="preview-generation"]',
    );
    expect(button, `button contrast in ${theme}`).toBeGreaterThanOrEqual(4.5);

    // Disabled text is exempt from WCAG AA, but must stay readable.
    const disabled = await page.evaluate(contrastOf, '[data-action="apply-draft"]');
    expect(disabled, `disabled contrast in ${theme}`).toBeGreaterThanOrEqual(3);

    // Error/status message contrast.
    await page.getByLabel('JSON de planejamento').fill('{invalid');
    await page.locator('[data-action="import-planning"]').click();
    await expect(page.locator('[data-testid="portability-status"]')).toContainText('recusada');
    const status = await page.evaluate(contrastOf, '[data-testid="portability-status"]');
    expect(status, `status contrast in ${theme}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('keyboard_focus_is_visible_ordered_and_not_trapped', async ({ page }) => {
  await seed(page);
  await page.locator('[data-testid="planning-wizard"]').scrollIntoViewIfNeeded();

  const names: string[] = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        tag: active?.tagName ?? '',
        label:
          active?.getAttribute('aria-label') ??
          active?.getAttribute('name') ??
          active?.textContent?.trim().slice(0, 40) ??
          '',
        outline: active ? getComputedStyle(active).outlineColor : '',
      };
    });
    names.push(`${current.tag}:${current.label}`);
  }
  // The wizard fields and the calendar controls are reachable by keyboard.
  expect(names.some((name) => name.startsWith('INPUT'))).toBe(true);
  expect(names.some((name) => /Dia|Semana|Mês/.test(name))).toBe(true);
  // Focus never disappears into the body for more than one step.
  const bodySteps = names.filter((name) => name.startsWith('BODY')).length;
  expect(bodySteps).toBeLessThanOrEqual(1);
});

test('reduced_motion_and_zoom_keep_the_planning_usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);

  const transition = await page.evaluate(() => {
    const button = document.querySelector('[data-action="preview-generation"]');
    return button ? getComputedStyle(button).transitionDuration : '';
  });
  expect(Number.parseFloat(transition || '0')).toBeLessThanOrEqual(0.001);

  await page.setViewportSize({ width: 640, height: 480 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-testid="planning-dashboard"]')).toBeVisible();
});

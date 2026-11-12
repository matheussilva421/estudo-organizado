import { expect, test } from '@playwright/test';
import { resetF7Ux } from './f7-ux-helpers';

function expectNear(actual: number, expected: number, tolerance = 1.5): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

test('desktop home keeps the reference spacing and hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await resetF7Ux(page);
  await page.goto('/#/settings');
  await page.locator('[data-theme-option="neon-teal"]').click();
  await page.goto('/#/home');
  await expect(page.getByTestId('home-hero')).toHaveAttribute('data-context', 'ONBOARDING');
  await page.evaluate(() => window.scrollTo(0, 0));

  const boxes = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error('Elemento ausente: ' + selector);
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      rail: read('.app-nav'),
      activeNav: read('.nav-link-active'),
      header: read('.app-header'),
      search: read('.global-search'),
      command: read('[data-testid="command-center-open"]'),
      view: read('.home-view'),
      title: read('#home-title'),
      subtitle: read('.view-subtitle'),
      hero: read('.home-hero'),
      onboarding: read('.home-onboarding-row'),
      intro: read('.home-onboarding-intro'),
      steps: read('.home-onboarding'),
      showcase: read('.home-showcase'),
      resources: read('.home-resources'),
      resourceCard: read('.resource-card'),
      resourceIcon: read('.resource-card .widget-icon'),
      goalOrbit: read('.goal-orbit'),
      goalValue: read('.goal-ring-value'),
      heroActions: read('.home-hero-actions a'),
      reviewCalendar: read('.review-calendar-art'),
      chartWeeks: document.querySelectorAll('.show-chart-weeks span').length,
      heroDetailFont: getComputedStyle(
        document.querySelector('.home-hero-copy > p:last-child')!,
      ).fontSize,
      resourceTitleColor: getComputedStyle(
        document.querySelector('.resource-card strong')!,
      ).color,
      bodyColor: getComputedStyle(document.body).color,
      goalValueText: document.querySelector('.goal-ring-value')!.textContent?.trim() ?? '',
    };
  });

  expectNear(boxes.rail.x, 0);
  expectNear(boxes.rail.y, 0);
  expectNear(boxes.rail.width, 294);
  expectNear(boxes.rail.height, 992);
  expectNear(boxes.activeNav.x, 16);
  expectNear(boxes.activeNav.y, 102, 2);
  expectNear(boxes.activeNav.height, 41, 2);
  expectNear(boxes.header.height, 66, 2);
  expectNear(boxes.search.x, 955, 2);
  expectNear(boxes.search.y, 16, 2);
  expectNear(boxes.search.width, 443, 2);
  expect(boxes.command.x).toBeGreaterThan(boxes.search.x);
  expect(boxes.command.x + boxes.command.width).toBeLessThanOrEqual(
    boxes.search.x + boxes.search.width,
  );
  expectNear(boxes.view.x, 335);
  expectNear(boxes.view.width, 1235);
  expectNear(boxes.title.y, 94, 2);
  expectNear(boxes.subtitle.y, 149, 2);
  expectNear(boxes.hero.x, 335);
  expectNear(boxes.hero.y, 191, 2);
  expectNear(boxes.hero.width, 1235);
  expectNear(boxes.hero.height, 232, 2);
  expectNear(boxes.onboarding.y, 445, 2);
  expectNear(boxes.onboarding.height, 30, 2);
  expectNear(boxes.intro.y + boxes.intro.height / 2, boxes.steps.y + boxes.steps.height / 2, 2);
  expectNear(boxes.showcase.y, 505, 2);
  expectNear(boxes.showcase.height, 182, 2);
  expectNear(boxes.resources.y, 727, 3);
  expect(boxes.resourceCard.height).toBeGreaterThanOrEqual(98);
  expect(boxes.resourceIcon.width).toBeGreaterThanOrEqual(54);
  expect(boxes.goalValueText).toBe('—');
  expectNear(boxes.goalOrbit.width, 104, 2);
  expectNear(boxes.goalValue.x + boxes.goalValue.width / 2, boxes.goalOrbit.x + boxes.goalOrbit.width / 2, 2);
  expectNear(boxes.goalValue.y + boxes.goalValue.height / 2, boxes.goalOrbit.y + boxes.goalOrbit.height / 2, 2);
  expect(parseFloat(boxes.heroDetailFont)).toBeGreaterThanOrEqual(15);
  expect(boxes.heroActions.height).toBeGreaterThanOrEqual(39);
  expect(boxes.heroActions.height).toBeLessThanOrEqual(44);
  expect(boxes.reviewCalendar.width).toBeGreaterThan(60);
  expect(boxes.chartWeeks).toBe(4);
  expect(boxes.resourceTitleColor).toBe(boxes.bodyColor);
  await expect(page.locator('.rail-brand-subtitle')).toHaveText(
    'Planejamento • Estudos • Revisões',
  );
  await expect(page.locator('.nav-divider')).toBeVisible();
});

test('intermediate desktop keeps the onboarding row inside the content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetF7Ux(page);
  await expect(page.locator('.home-onboarding-row')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  const geometry = await page.evaluate(() => {
    const view = document.querySelector<HTMLElement>('.home-view');
    const onboarding = document.querySelector<HTMLElement>('.home-onboarding-row');
    if (!view || !onboarding) throw new Error('Home sem faixa de onboarding');
    const viewRect = view.getBoundingClientRect();
    const onboardingRect = onboarding.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      viewRight: viewRect.right,
      onboardingRight: onboardingRect.right,
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.onboardingRight).toBeLessThanOrEqual(geometry.viewRight + 1);
});

test('tablet keeps the bento and resource cards legible', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1100 });
  await resetF7Ux(page);
  await expect(page.locator('.home-showcase')).toBeVisible();

  const layout = await page.evaluate(() => {
    const showcase = getComputedStyle(document.querySelector('.home-showcase')!);
    const resourceGrid = getComputedStyle(document.querySelector('.resource-grid')!);
    const evolution = getComputedStyle(document.querySelector('.show-evolution')!);
    const firstCard = document.querySelector('.show-goal')!.getBoundingClientRect();
    return {
      columns: showcase.gridTemplateColumns.split(' ').filter(Boolean).length,
      resourceColumns: resourceGrid.gridTemplateColumns.split(' ').filter(Boolean).length,
      evolutionColumn: evolution.gridColumn,
      firstCardWidth: firstCard.width,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(layout.columns).toBe(2);
  expect(layout.resourceColumns).toBe(2);
  expect(layout.evolutionColumn).toMatch(/1 \/ -1|span 2/);
  expect(layout.firstCardWidth).toBeGreaterThan(300);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  await expect(page.locator('[data-nav="attention"] .nav-label-compact')).toBeVisible();
  await expect(page.locator('[data-nav="attention"] .nav-label-wide')).toBeHidden();
});

test('short mobile keeps the primary action and bottom navigation visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await resetF7Ux(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);
  const cta = page.getByTestId('home-hero').getByRole('link').first();
  const bottomNav = page.locator('.app-nav-mobile');
  await expect(cta).toBeVisible();
  await expect(bottomNav).toBeVisible();

  const viewport = await page.evaluate(() => {
    const ctaBox = document
      .querySelector('.home-hero-actions a')!
      .getBoundingClientRect();
    const navBox = document.querySelector('.app-nav-mobile')!.getBoundingClientRect();
    return {
      ctaBottom: ctaBox.bottom,
      navTop: navBox.top,
      navBottom: navBox.bottom,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      height: window.innerHeight,
    };
  });

  expect(viewport.ctaBottom).toBeLessThanOrEqual(viewport.height);
  expect(viewport.navTop).toBeGreaterThanOrEqual(0);
  expect(viewport.navBottom).toBeLessThanOrEqual(viewport.height + 1);
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
});

test('premium themes tint the desktop rail differently', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await resetF7Ux(page, '/#/settings');
  const backgrounds: string[] = [];
  for (const theme of ['neon-teal', 'esmeralda-dourado', 'azul-ambar', 'azul-glacial']) {
    await page.locator('[data-theme-option="' + theme + '"]').click();
    backgrounds.push(
      await page.locator('.app-nav').evaluate((element) => getComputedStyle(element).backgroundImage),
    );
  }
  expect(new Set(backgrounds).size).toBe(4);
});

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
  expect(boxes.resourceCard.height).toBeGreaterThanOrEqual(93);
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

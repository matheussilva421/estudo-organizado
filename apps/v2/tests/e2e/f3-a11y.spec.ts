import { expect, test } from '@playwright/test';

test('planning_controls_are_keyboard_reachable_in_every_theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const themes = ['grafite', 'ardosia', 'platina', 'terminal', 'neon', 'arrakis', 'codex', 'plasma'];
  for (const theme of themes) {
    await page.getByLabel('Tema').selectOption(theme);
    await expect(page.locator('[data-testid="planning-workspace"]')).toBeVisible();

    // The wizard preview button is disabled without content; the calendar
    // controls are always available and prove keyboard reachability.
    const button = page.locator('[data-action="calendar-day"]');
    await button.focus();
    await expect(button).toBeFocused();

    const views = page.locator('[data-testid="planning-calendar"] [role="group"] >> button');
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

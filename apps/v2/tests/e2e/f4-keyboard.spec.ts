import { expect, test } from '@playwright/test';

test('f4 keyboard reaches the session controls without a trap', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const reached = new Set<string>();
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press('Tab');
    const testId = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return element?.getAttribute('data-testid') ?? '';
    });
    if (testId) reached.add(testId);
    if (reached.has('session-start') && reached.has('session-manual-submit')) break;
  }
  expect(reached.has('session-start')).toBe(true);
  expect(reached.has('session-manual-submit')).toBe(true);

  const insideWorkspace = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return Boolean(element?.closest('[data-testid="session-workspace"]'));
  });
  expect(insideWorkspace).toBe(true);
});

test('f4 every button and link has an accessible name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const unnamed = await page.evaluate(() => {
    const workspace = document.querySelector('[data-testid="session-workspace"]');
    if (!workspace) return ['missing workspace'];
    return Array.from(workspace.querySelectorAll('button, a, select, input'))
      .filter((element) => {
        const aria = element.getAttribute('aria-label')?.trim();
        const text = (element.textContent ?? '').trim();
        if (aria || text) return false;
        if (element.tagName === 'INPUT') {
          return !element.closest('label') && !element.getAttribute('aria-label');
        }
        return true;
      })
      .map((element) => element.outerHTML.slice(0, 80));
  });
  expect(unnamed).toEqual([]);
});

test('f4 heading hierarchy has no skipped level', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const levels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading) =>
      Number(heading.tagName.slice(1)),
    ),
  );
  expect(levels[0]).toBe(1);
  let previous = levels[0] ?? 1;
  for (const level of levels.slice(1)) {
    expect(level).toBeLessThanOrEqual(previous + 1);
    previous = level;
  }
});


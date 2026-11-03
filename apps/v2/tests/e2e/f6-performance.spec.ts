import { expect, test } from '@playwright/test';

test('f6 performance snapshot for load route and heap', async ({ page }) => {
  const started = Date.now();
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const initialMs = Date.now() - started;

  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const memory = (performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }).memory;
    return {
      domContentLoadedMs: entry?.domContentLoadedEventEnd ?? 0,
      loadMs: entry?.loadEventEnd ?? 0,
      domNodes: document.querySelectorAll('*').length,
      heapBytes: memory?.usedJSHeapSize ?? null,
    };
  });

  const routeStarted = Date.now();
  await page.goto('/#/analytics');
  await expect(page.getByTestId('f6-analytics')).toBeVisible();
  const routeMs = Date.now() - routeStarted;

  console.log('F6_PERFORMANCE', JSON.stringify({ initialMs, routeMs, ...navigation }));
  expect(navigation.loadMs).toBeGreaterThan(0);
  expect(initialMs).toBeLessThan(10000);
  expect(routeMs).toBeLessThan(10000);
});


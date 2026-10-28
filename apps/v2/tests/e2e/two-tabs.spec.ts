import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

test('two_real_tabs_share_one_flush_lock', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  for (const page of [first, second]) {
    await page.goto('/');
    await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  }

  await first.evaluate(() => {
    (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E.clearRemote('local-default');
  });

  const run = (page: import('@playwright/test').Page) =>
    page.evaluate(() =>
      (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E.flushOnceShared(
        'local-default',
        'op-shared',
      ),
    );

  const [left, right] = await Promise.all([run(first), run(second)]);
  expect(left.kind).toBe('EXECUTED');
  expect(right.kind).toBe('EXECUTED');

  const remote = await first.evaluate(() =>
    (window as unknown as Window & { __v2E2E: V2E2EHarness }).__v2E2E.readRemote('local-default'),
  );
  expect(remote.effects).toBe(1);
  expect(remote.applied).toEqual(['op-shared']);
});


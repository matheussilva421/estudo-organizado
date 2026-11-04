import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };
const profileId = 'local-default';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f7_two_tabs_do_not_double_apply', async ({ context }) => {
  const first = await context.newPage();
  await ready(first);
  await first.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  const second = await context.newPage();
  await ready(second);
  await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.clearRemote(profile),
  profileId);

  const results = await Promise.all([
    first.evaluate((profile) =>
      (window as unknown as HarnessWindow).__v2E2E.flushOnceShared(profile, 'op-shared'),
    profileId),
    second.evaluate((profile) =>
      (window as unknown as HarnessWindow).__v2E2E.flushOnceShared(profile, 'op-shared'),
    profileId),
  ]);
  expect(results.every((result) => result.kind === 'EXECUTED' || result.kind === 'BLOCKED')).toBe(true);
  const remote = await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.readRemote(profile),
  profileId);
  expect(remote.applied).toEqual(['op-shared']);
  expect(remote.effects).toBe(1);
});

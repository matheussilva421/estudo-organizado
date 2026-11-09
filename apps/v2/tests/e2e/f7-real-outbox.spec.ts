import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };
const profileId = 'local-default';

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('f7 two real tabs flush one durable outbox operation with Web Locks', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([boot(first), boot(second)]);

  await first.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedDeliverableOutbox(
        profile,
        'op-real-outbox',
        'subject-real-outbox',
        'Outbox real',
      ),
    profileId,
  );

  const [left, right] = await Promise.all([
    first.evaluate(
      (profile) => (window as unknown as HarnessWindow).__v2E2E.flushReal(profile),
      profileId,
    ),
    second.evaluate(
      (profile) => (window as unknown as HarnessWindow).__v2E2E.flushReal(profile),
      profileId,
    ),
  ]);

  expect(left.effects).toBe(1);
  expect(right.effects).toBe(1);
  await expect(
    first.evaluate(
      (profile) =>
        (window as unknown as HarnessWindow).__v2E2E.outboxStatus(profile, 'op-real-outbox'),
      profileId,
    ),
  ).resolves.toBe('CONFIRMED');
  await context.close();
});

test('f7 lost ACK after remote apply is recovered by lookup', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await boot(page);
  await page.evaluate(
    (profile) =>
      (window as unknown as HarnessWindow).__v2E2E.seedDeliverableOutbox(
        profile,
        'op-lost-ack',
        'subject-lost-ack',
        'ACK perdido',
      ),
    profileId,
  );
  const result = await page.evaluate(
    (profile) => (window as unknown as HarnessWindow).__v2E2E.flushReal(profile, true),
    profileId,
  );
  expect(result.effects).toBe(1);
  await expect(
    page.evaluate(
      (profile) =>
        (window as unknown as HarnessWindow).__v2E2E.outboxStatus(profile, 'op-lost-ack'),
      profileId,
    ),
  ).resolves.toBe('CONFIRMED');
  await context.close();
});

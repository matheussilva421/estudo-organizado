import { expect, test, type Page } from '@playwright/test';
import type { ContentCommand } from '../../src/application/content-commands';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

function edital(id: string): ContentCommand {
  return {
    type: 'CREATE_EDITAL',
    operationId: `op-${id}`,
    profileId,
    editalId: id,
    title: id,
  };
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('concurrent_primary_switch_never_creates_two_primaries', async ({ context }) => {
  const first = await context.newPage();
  await ready(first);

  await first.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  for (const id of ['edital-a', 'edital-b', 'edital-c']) {
    const result = await first.evaluate((command) =>
      (window as unknown as HarnessWindow).__v2E2E.executeContent(command),
    edital(id));
    expect(result).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  }

  const base = await first.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.setPrimary({ profileId: 'local-default', editalId: 'edital-a', operationId: 'op-primary-a' });
    return (await harness.getProfile('local-default')).localRevision;
  });

  const second = await context.newPage();
  await ready(second);

  const switchTo = (page: Page, editalId: string, operationId: string) =>
    page.evaluate(
      ({ editalId: target, operationId: op, baseRevision }) =>
        (window as unknown as HarnessWindow).__v2E2E.setPrimary({
          profileId: 'local-default',
          editalId: target,
          operationId: op,
          baseRevision,
        }),
      { editalId, operationId, baseRevision: base },
    );

  const [left, right] = await Promise.all([
    switchTo(first, 'edital-b', 'op-primary-b'),
    switchTo(second, 'edital-c', 'op-primary-c'),
  ]);

  expect([left.kind, right.kind].sort()).toEqual(['CONFLICT', 'LOCAL_COMMITTED']);

  const stored = await second.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.getProfile(profile),
  profileId);
  expect(['edital-b', 'edital-c']).toContain(stored.primaryEditalId);

  await first.reload();
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();
  const readBack = await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.getProfile(profile),
  profileId);
  expect(readBack.primaryEditalId).toBe(stored.primaryEditalId);
  expect(readBack.localRevision).toBe(stored.localRevision);
});

test('archiving_primary_without_a_decision_is_refused_in_the_browser', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await page.evaluate((command) =>
    (window as unknown as HarnessWindow).__v2E2E.executeContent(command),
  edital('edital-a'));
  await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.setPrimary({
      profileId: 'local-default',
      editalId: 'edital-a',
      operationId: 'op-primary-a',
    }),
  );

  const refused = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.archiveEdital({
      profileId: 'local-default',
      editalId: 'edital-a',
      operationId: 'op-archive-undecided',
    }),
  );
  expect(refused).toEqual({ kind: 'INVALID', code: 'PRIMARY_REQUIRED' });

  const content = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(content.editais[0]).toMatchObject({ id: 'edital-a', status: 'ACTIVE' });
  expect(
    await page.evaluate((profile) =>
      (window as unknown as HarnessWindow).__v2E2E.getProfile(profile),
    profileId),
  ).toMatchObject({ primaryEditalId: 'edital-a' });
});

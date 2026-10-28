import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const F2_STORES = [
  'assuntos',
  'aulas',
  'edital_disciplines',
  'editais',
  'import_receipts',
  'lesson_topic_links',
  'quarantine',
  'tombstones',
];

test('upgrade_f1_preserves_subject_operations_outbox', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.seedLegacyV1());
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.releaseLegacyV1());

  const opened = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.openDb(),
  );
  expect(opened.version).toBe(2);
  expect(opened.stores).toEqual(expect.arrayContaining(F2_STORES));
  expect(opened.stores).toEqual(
    expect.arrayContaining(['subjects', 'operations', 'outbox', 'profiles', 'meta', 'conflicts']),
  );

  const counts = await page.evaluate(async () => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return {
      subjects: await harness.countStore('subjects'),
      operations: await harness.countStore('operations'),
      outbox: await harness.countStore('outbox'),
    };
  });
  expect(counts).toEqual({ subjects: 1, operations: 1, outbox: 1 });

  const preserved = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.list('local-default'),
  );
  expect(preserved).toEqual([
    {
      id: 'subject-legacy',
      profileId: 'local-default',
      title: 'Legado preservado',
      localRevision: 4,
    },
  ]);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await expect(page.locator('[data-db-upgrade="READY"]')).toHaveAttribute('data-db-ready', 'true');
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.countStore('subjects'))).toBe(1);
});

test('blocked_upgrade_never_deletes_existing_database', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.seedLegacyV1());

  const opening = page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.openDb(),
  );

  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as HarnessWindow).__v2E2E.upgradeState().kind,
      ),
    )
    .toBe('BLOCKED_UPGRADE');

  const blocked = await page.evaluate(() =>
    (window as unknown as HarnessWindow).__v2E2E.legacySnapshot(),
  );
  expect(blocked.stores).toEqual([
    'conflicts',
    'meta',
    'operations',
    'outbox',
    'profiles',
    'subjects',
  ]);
  expect(blocked.subjects).toBe(1);
  expect(blocked.operations).toBe(1);
  expect(blocked.outbox).toBe(1);

  await expect(page.getByRole('alert')).toContainText('outra aba');

  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.releaseLegacyV1());
  const upgraded = await opening;
  expect(upgraded.version).toBe(2);
  expect(upgraded.stores).toEqual(expect.arrayContaining(F2_STORES));
  expect(
    await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.countStore('subjects')),
  ).toBe(1);

  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as HarnessWindow).__v2E2E.upgradeState().kind,
      ),
    )
    .toBe('READY');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

import { expect, test } from '@playwright/test';
import type { ContentCommand } from '../../src/application/content-commands';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

function createCommand(overrides: Partial<ContentCommand> = {}): ContentCommand {
  return {
    type: 'CREATE_EDITAL',
    operationId: 'op-e2e-edital-1',
    profileId,
    editalId: 'edital-e2e-1',
    title: 'TJPB 2026',
    ...overrides,
  };
}

test('browser_abort_never_reports_saved_content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const aborted = await page.evaluate((command) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return harness.executeContent(command, 'abort');
  }, createCommand());
  expect(aborted).toEqual({ kind: 'FAILED', reason: 'ABORT' });

  const counts = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.contentCounts(profile),
  profileId);
  expect(counts).toEqual({ editais: 0, links: 0, operations: 0, outbox: 0 });

  const quota = await page.evaluate((command) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return harness.executeContent(
      { ...command, operationId: 'op-e2e-quota' } as ContentCommand,
      'quota',
    );
  }, createCommand());
  expect(quota).toEqual({ kind: 'FAILED', reason: 'QUOTA' });

  const stillEmpty = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.contentCounts(profile),
  profileId);
  expect(stillEmpty).toEqual({ editais: 0, links: 0, operations: 0, outbox: 0 });
});

test('browser_commit_persists_after_reload_and_invalid_title_is_explicit', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const invalid = await page.evaluate((command) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return harness.executeContent({
      ...command,
      operationId: 'op-e2e-long',
      editalId: 'edital-e2e-long',
      title: 'x'.repeat(121),
    } as ContentCommand);
  }, createCommand());
  expect(invalid).toEqual({ kind: 'INVALID', code: 'TITLE_TOO_LONG' });

  const committed = await page.evaluate((command) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    return harness.executeContent(command);
  }, createCommand());
  expect(committed).toMatchObject({ kind: 'LOCAL_COMMITTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const content = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(content.editais).toHaveLength(1);
  expect(content.editais[0]).toMatchObject({
    id: 'edital-e2e-1',
    title: 'TJPB 2026',
    localRevision: 1,
    status: 'ACTIVE',
  });
  expect(await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.contentCounts(profile),
  profileId)).toEqual({ editais: 1, links: 0, operations: 1, outbox: 1 });
});

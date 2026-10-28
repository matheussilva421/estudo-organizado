import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

test('f1_subjects_stay_unassigned_until_an_explicit_decision', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const seeded = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    for (const [index, title] of ['Direito Constitucional', 'Portugues'].entries()) {
      await harness.execute({
        operationId: `op-subject-${index}`,
        profileId: profile,
        subjectId: `subject-${index}`,
        type: 'create',
        title,
      });
    }
    return harness.listUnassigned(profile);
  }, profileId);
  expect(seeded.map((subject) => subject.id)).toEqual(['subject-0', 'subject-1']);

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  // Reopening the F2 schema still links nothing by itself.
  const countsBefore = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.contentCounts(profile),
  profileId);
  expect(countsBefore.links).toBe(0);

  const adopted = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital-a',
      profileId: profile,
      editalId: 'edital-a',
      title: 'TJPB 2026',
    });
    return harness.adoptSubjects(profile, 'op-adoption', [
      { subjectId: 'subject-0', decision: 'LINK_EXISTING', editalId: 'edital-a' },
      { subjectId: 'subject-1', decision: 'LEAVE_UNASSIGNED' },
    ]);
  }, profileId);
  expect(adopted).toMatchObject({ kind: 'LOCAL_COMMITTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const remaining = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.listUnassigned(profile),
  profileId);
  expect(remaining.map((subject) => subject.id)).toEqual(['subject-1']);

  const content = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(content.links.map((link) => link.subjectId)).toEqual(['subject-0']);
  expect(content.subjects.map((subject) => subject.id).sort()).toEqual([
    'subject-0',
    'subject-1',
  ]);
});

test('browser_adoption_rolls_back_when_a_decision_is_invalid', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const result = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'op-subject',
      profileId: profile,
      subjectId: 'subject-0',
      type: 'create',
      title: 'Direito Constitucional',
    });
    return harness.adoptSubjects(profile, 'op-adoption-bad', [
      { subjectId: 'subject-0', decision: 'LINK_EXISTING', editalId: 'edital-ghost' },
    ]);
  }, profileId);

  expect(result).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
  const content = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(content.links).toEqual([]);
  expect(content.editais).toEqual([]);
});

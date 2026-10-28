import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

test('browser_archive_keeps_tree_and_never_reports_progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const archived = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'op-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'TJPB 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'op-link',
      profileId: profile,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto',
      profileId: profile,
      value: {
        id: 'assunto-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        parentId: null,
        parentKey: '',
        title: 'Assunto',
        orderKey: '000010',
        localRevision: 0,
      },
    });
    return harness.executeContent({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive',
      profileId: profile,
      editalId: 'edital-1',
    });
  }, profileId);
  expect(archived).toMatchObject({ kind: 'LOCAL_COMMITTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const snapshot = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(snapshot.editais[0]).toMatchObject({ status: 'ARCHIVED', localRevision: 2 });
  expect(snapshot.links).toHaveLength(1);
  expect(snapshot.assuntos).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain('progress');
  expect(JSON.stringify(snapshot)).not.toContain('sessions');
});

test('browser_soft_delete_blocks_resurrection_until_explicit_restore', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const outcome = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'op-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'TJPB 2026',
    });
    await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'op-link',
      profileId: profile,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
    const created = await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId: profile,
      value: {
        id: 'aula-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        title: 'Aula 1',
        orderKey: '000010',
        localRevision: 0,
      },
    });
    const deleted = await harness.executeContent({
      type: 'SOFT_DELETE',
      operationId: 'op-delete',
      profileId: profile,
      entityType: 'aula',
      entityId: 'aula-1',
    });
    const resurrect = await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'op-aula-again',
      profileId: profile,
      value: {
        id: 'aula-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        title: 'Aula 1',
        orderKey: '000010',
        localRevision: 1,
      },
    });
    const restored = await harness.executeContent({
      type: 'RESTORE_ENTITY',
      operationId: 'op-restore',
      profileId: profile,
      entityType: 'aula',
      entityId: 'aula-1',
    });
    return { created, deleted, resurrect, restored };
  }, profileId);

  expect(outcome.created).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(outcome.deleted).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(outcome.resurrect).toEqual({ kind: 'INVALID', code: 'DELETED_ENTITY' });
  expect(outcome.restored).toMatchObject({ kind: 'LOCAL_COMMITTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  const snapshot = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(snapshot.aulas).toHaveLength(1);
  expect(snapshot.aulas[0]).toMatchObject({ id: 'aula-1', localRevision: 2 });
});

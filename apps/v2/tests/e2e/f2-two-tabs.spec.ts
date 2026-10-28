import { expect, test, type Page } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
}

test('two_tabs_edit_same_entity_without_lost_update', async ({ context }) => {
  const first = await context.newPage();
  await ready(first);
  await first.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const seeded = await first.evaluate(async (profile) => {
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
    return harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto',
      profileId: profile,
      value: {
        id: 'assunto-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        parentId: null,
        parentKey: '',
        title: 'Original',
        orderKey: '000010',
        localRevision: 0,
      },
    });
  }, profileId);
  expect(seeded).toMatchObject({ kind: 'LOCAL_COMMITTED' });

  const second = await context.newPage();
  await ready(second);

  const rename = (page: Page, title: string, operationId: string) =>
    page.evaluate(
      ({ nextTitle, op, profile }) =>
        (window as unknown as HarnessWindow).__v2E2E.executeContent({
          type: 'UPSERT_ASSUNTO',
          operationId: op,
          profileId: profile,
          baseRevision: 1,
          value: {
            id: 'assunto-1',
            profileId: profile,
            editalDisciplineId: 'link-1',
            parentId: null,
            parentKey: '',
            title: nextTitle,
            orderKey: '000010',
            localRevision: 1,
          },
        }),
      { nextTitle: title, op: operationId, profile: profileId },
    );

  const [left, right] = await Promise.all([
    rename(first, 'Aba A', 'op-rename-a'),
    rename(second, 'Aba B', 'op-rename-b'),
  ]);

  expect([left.kind, right.kind].sort()).toEqual(['CONFLICT', 'LOCAL_COMMITTED']);

  await first.reload();
  await expect(first.locator('[data-db-ready="true"]')).toBeVisible();
  const snapshot = await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(snapshot.assuntos).toHaveLength(1);
  expect(snapshot.assuntos[0]).toMatchObject({ id: 'assunto-1', localRevision: 2 });
  expect(['Aba A', 'Aba B']).toContain(snapshot.assuntos[0]?.title);
});

test('independent_entities_from_two_tabs_both_commit', async ({ context }) => {
  const first = await context.newPage();
  await ready(first);
  await first.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());
  await first.evaluate(async (profile) => {
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
  }, profileId);

  const second = await context.newPage();
  await ready(second);

  const create = (page: Page, id: string, orderKey: string) =>
    page.evaluate(
      ({ entityId, order, profile }) =>
        (window as unknown as HarnessWindow).__v2E2E.executeContent({
          type: 'UPSERT_ASSUNTO',
          operationId: `op-${entityId}`,
          profileId: profile,
          value: {
            id: entityId,
            profileId: profile,
            editalDisciplineId: 'link-1',
            parentId: null,
            parentKey: '',
            title: entityId,
            orderKey: order,
            localRevision: 0,
          },
        }),
      { entityId: id, order: orderKey, profile: profileId },
    );

  const [left, right] = await Promise.all([
    create(first, 'assunto-a', '000010'),
    create(second, 'assunto-b', '000020'),
  ]);
  expect(left.kind).toBe('LOCAL_COMMITTED');
  expect(right.kind).toBe('LOCAL_COMMITTED');

  const snapshot = await first.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(snapshot.assuntos.map((item) => item.id)).toEqual(['assunto-a', 'assunto-b']);
});

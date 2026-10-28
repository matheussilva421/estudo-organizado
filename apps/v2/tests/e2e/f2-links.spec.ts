import { expect, test } from '@playwright/test';
import type { V2E2EHarness } from '../../src/platform/e2e-harness';

type HarnessWindow = Window & { __v2E2E: V2E2EHarness };

const profileId = 'local-default';

test('browser_vertical_tree_and_lesson_links_survive_reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const results = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    const subject = await harness.execute({
      operationId: 'op-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    const edital = await harness.executeContent({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital',
      profileId: profile,
      editalId: 'edital-1',
      title: 'TJPB 2026',
    });
    const link = await harness.executeContent({
      type: 'LINK_SUBJECT',
      operationId: 'op-link',
      profileId: profile,
      editalId: 'edital-1',
      subjectId: 'subject-1',
      linkId: 'link-1',
    });
    const roots = await Promise.all(
      ['assunto-1', 'assunto-2'].map((id, index) =>
        harness.executeContent({
          type: 'UPSERT_ASSUNTO',
          operationId: `op-${id}`,
          profileId: profile,
          value: {
            id,
            profileId: profile,
            editalDisciplineId: 'link-1',
            parentId: null,
            parentKey: '',
            title: `Assunto ${index + 1}`,
            orderKey: `0000${(index + 1) * 10}`,
            localRevision: 0,
          },
        }),
      ),
    );
    const child = await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-child',
      profileId: profile,
      value: {
        id: 'assunto-child',
        profileId: profile,
        editalDisciplineId: 'link-1',
        parentId: 'assunto-1',
        parentKey: 'assunto-1',
        title: 'Subassunto',
        orderKey: '000010',
        localRevision: 0,
      },
    });
    const lesson = await harness.executeContent({
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
    const topics = await Promise.all(
      ['assunto-1', 'assunto-child'].map((assuntoId, index) =>
        harness.executeContent({
          type: 'LINK_LESSON_TOPIC',
          operationId: `op-topic-${index}`,
          profileId: profile,
          link: {
            id: `topic-${index}`,
            profileId: profile,
            aulaId: 'aula-1',
            assuntoId,
            localRevision: 0,
          },
        }),
      ),
    );
    const cycle = await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-cycle',
      profileId: profile,
      value: {
        id: 'assunto-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        parentId: 'assunto-child',
        parentKey: 'assunto-child',
        title: 'Assunto 1',
        orderKey: '000010',
        localRevision: 1,
      },
    });
    return { subject, edital, link, roots, child, lesson, topics, cycle };
  }, profileId);

  expect(results.subject).toMatchObject({ id: 'subject-1' });
  expect(results.edital).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(results.link).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(results.roots.every((item) => item.kind === 'LOCAL_COMMITTED')).toBe(true);
  expect(results.child).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(results.lesson).toMatchObject({ kind: 'LOCAL_COMMITTED' });
  expect(results.topics.every((item) => item.kind === 'LOCAL_COMMITTED')).toBe(true);
  expect(results.cycle).toEqual({ kind: 'INVALID', code: 'CYCLE_DETECTED' });

  await page.reload();
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();

  const snapshot = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);

  expect(snapshot.editais.map((item) => item.id)).toEqual(['edital-1']);
  expect(snapshot.links.map((item) => item.subjectId)).toEqual(['subject-1']);
  expect(snapshot.assuntos.map((item) => item.id)).toEqual([
    'assunto-1',
    'assunto-2',
    'assunto-child',
  ]);
  expect(snapshot.assuntos.find((item) => item.id === 'assunto-child')).toMatchObject({
    parentId: 'assunto-1',
    parentKey: 'assunto-1',
    localRevision: 1,
  });
  expect(snapshot.lessonTopics.map((item) => item.assuntoId).sort()).toEqual([
    'assunto-1',
    'assunto-child',
  ]);
  expect(snapshot.aulas.map((item) => item.id)).toEqual(['aula-1']);
});

test('browser_cross_edital_lesson_link_is_refused', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-db-ready="true"]')).toBeVisible();
  await page.evaluate(() => (window as unknown as HarnessWindow).__v2E2E.resetDb());

  const result = await page.evaluate(async (profile) => {
    const harness = (window as unknown as HarnessWindow).__v2E2E;
    await harness.execute({
      operationId: 'op-subject',
      profileId: profile,
      subjectId: 'subject-1',
      type: 'create',
      title: 'Direito Constitucional',
    });
    for (const [index, editalId] of ['edital-1', 'edital-2'].entries()) {
      await harness.executeContent({
        type: 'CREATE_EDITAL',
        operationId: `op-${editalId}`,
        profileId: profile,
        editalId,
        title: `Edital ${index + 1}`,
      });
      await harness.executeContent({
        type: 'LINK_SUBJECT',
        operationId: `op-link-${editalId}`,
        profileId: profile,
        editalId,
        subjectId: 'subject-1',
        linkId: `link-${index + 1}`,
      });
    }
    await harness.executeContent({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId: profile,
      value: {
        id: 'aula-1',
        profileId: profile,
        editalDisciplineId: 'link-1',
        title: 'Aula do edital 1',
        orderKey: '000010',
        localRevision: 0,
      },
    });
    await harness.executeContent({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-2',
      profileId: profile,
      value: {
        id: 'assunto-2',
        profileId: profile,
        editalDisciplineId: 'link-2',
        parentId: null,
        parentKey: '',
        title: 'Assunto do edital 2',
        orderKey: '000010',
        localRevision: 0,
      },
    });
    return harness.executeContent({
      type: 'LINK_LESSON_TOPIC',
      operationId: 'op-cross-link',
      profileId: profile,
      link: {
        id: 'topic-cross',
        profileId: profile,
        aulaId: 'aula-1',
        assuntoId: 'assunto-2',
        localRevision: 0,
      },
    });
  }, profileId);

  expect(result).toEqual({ kind: 'INVALID', code: 'CROSS_SCOPE_LINK' });
  const snapshot = await page.evaluate((profile) =>
    (window as unknown as HarnessWindow).__v2E2E.loadContent(profile),
  profileId);
  expect(snapshot.lessonTopics).toEqual([]);
});

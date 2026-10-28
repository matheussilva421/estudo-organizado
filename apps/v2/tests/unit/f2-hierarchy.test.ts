import { beforeEach, describe, expect, it } from 'vitest';
import type { Assunto, Aula, LessonTopicLink } from '../../src/domain/content';
import { deleteV2DatabaseForTests } from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';

const profileId = 'profile-local';

function assunto(id: string, overrides: Partial<Assunto> = {}): Assunto {
  return {
    id,
    profileId,
    editalDisciplineId: 'link-1',
    parentId: null,
    parentKey: '',
    title: id,
    orderKey: '',
    localRevision: 0,
    ...overrides,
  };
}

function aula(id: string, overrides: Partial<Aula> = {}): Aula {
  return {
    id,
    profileId,
    editalDisciplineId: 'link-1',
    title: id,
    orderKey: '',
    localRevision: 0,
    ...overrides,
  };
}

function topicLink(id: string, aulaId: string, assuntoId: string): LessonTopicLink {
  return { id, profileId, aulaId, assuntoId, localRevision: 0 };
}

type Seed = { content: LocalContentRepository };

async function seedEditalWithDiscipline(): Promise<Seed> {
  const content = new LocalContentRepository();
  const subjects = new LocalSubjectRepository();
  await subjects.execute({
    operationId: 'op-subject-1',
    profileId,
    subjectId: 'subject-1',
    type: 'create',
    title: 'Direito Constitucional',
  });
  await content.execute({
    type: 'CREATE_EDITAL',
    operationId: 'op-edital-1',
    profileId,
    editalId: 'edital-1',
    title: 'TJPB 2026',
  });
  const linked = await content.execute({
    type: 'LINK_SUBJECT',
    operationId: 'op-link-1',
    profileId,
    editalId: 'edital-1',
    subjectId: 'subject-1',
    linkId: 'link-1',
  });
  expect(linked.kind).toBe('LOCAL_COMMITTED');
  return { content };
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 content hierarchy', () => {
  it('invalid_parent_or_cycle_is_rejected', async () => {
    const { content } = await seedEditalWithDiscipline();

    const missing = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-root-missing-parent',
      profileId,
      value: assunto('assunto-x', { parentId: 'assunto-ghost' }),
    });
    expect(missing).toEqual({ kind: 'INVALID', code: 'INVALID_PARENT' });

    const root = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-root',
      profileId,
      value: assunto('assunto-root', { orderKey: '000010' }),
    });
    expect(root.kind).toBe('LOCAL_COMMITTED');

    const child = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-child',
      profileId,
      value: assunto('assunto-child', {
        parentId: 'assunto-root',
        parentKey: 'assunto-root',
        orderKey: '000010',
      }),
    });
    expect(child.kind).toBe('LOCAL_COMMITTED');

    const selfParent = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-self-parent',
      profileId,
      value: assunto('assunto-root', { parentId: 'assunto-root' }),
    });
    expect(selfParent).toEqual({ kind: 'INVALID', code: 'INVALID_PARENT' });

    const cycle = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-cycle',
      profileId,
      value: assunto('assunto-root', {
        parentId: 'assunto-child',
        parentKey: 'assunto-child',
      }),
    });
    expect(cycle).toEqual({ kind: 'INVALID', code: 'CYCLE_DETECTED' });

    // Nothing leaked from the refused commands.
    const snapshot = await content.loadContent(profileId);
    expect(snapshot.assuntos).toHaveLength(2);
    expect(snapshot.assuntos.find((item) => item.id === 'assunto-root')).toMatchObject({
      parentId: null,
      parentKey: '',
      localRevision: 1,
    });
  });

  it('parent_from_another_edital_discipline_is_rejected', async () => {
    const { content } = await seedEditalWithDiscipline();
    await content.execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital-2',
      profileId,
      editalId: 'edital-2',
      title: 'TJRO 2026',
    });
    await content.execute({
      type: 'LINK_SUBJECT',
      operationId: 'op-link-2',
      profileId,
      editalId: 'edital-2',
      subjectId: 'subject-1',
      linkId: 'link-2',
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-root-1',
      profileId,
      value: assunto('assunto-root', { orderKey: '000010' }),
    });

    const crossScope = await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-cross-parent',
      profileId,
      value: assunto('assunto-other', {
        editalDisciplineId: 'link-2',
        parentId: 'assunto-root',
        parentKey: 'assunto-root',
      }),
    });
    expect(crossScope).toEqual({ kind: 'INVALID', code: 'INVALID_PARENT' });
  });

  it('lesson_can_have_many_topics_but_no_cross_edital_link', async () => {
    const { content } = await seedEditalWithDiscipline();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-topic-1',
      profileId,
      value: assunto('assunto-1', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-topic-2',
      profileId,
      value: assunto('assunto-2', { orderKey: '000020' }),
    });
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula-1',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });

    expect(
      await content.execute({
        type: 'LINK_LESSON_TOPIC',
        operationId: 'op-topic-link-1',
        profileId,
        link: topicLink('topic-1', 'aula-1', 'assunto-1'),
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    expect(
      await content.execute({
        type: 'LINK_LESSON_TOPIC',
        operationId: 'op-topic-link-2',
        profileId,
        link: topicLink('topic-2', 'aula-1', 'assunto-2'),
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const duplicate = await content.execute({
      type: 'LINK_LESSON_TOPIC',
      operationId: 'op-topic-link-dup',
      profileId,
      link: topicLink('topic-3', 'aula-1', 'assunto-1'),
    });
    expect(duplicate).toEqual({ kind: 'INVALID', code: 'LINK_DUPLICATE' });

    // Same subject in a second edital discipline cannot be linked across scopes.
    await content.execute({
      type: 'CREATE_EDITAL',
      operationId: 'op-edital-2',
      profileId,
      editalId: 'edital-2',
      title: 'TJRO 2026',
    });
    await content.execute({
      type: 'LINK_SUBJECT',
      operationId: 'op-link-2',
      profileId,
      editalId: 'edital-2',
      subjectId: 'subject-1',
      linkId: 'link-2',
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-topic-other',
      profileId,
      value: assunto('assunto-other', {
        editalDisciplineId: 'link-2',
        orderKey: '000010',
      }),
    });
    const crossScope = await content.execute({
      type: 'LINK_LESSON_TOPIC',
      operationId: 'op-topic-link-cross',
      profileId,
      link: topicLink('topic-4', 'aula-1', 'assunto-other'),
    });
    expect(crossScope).toEqual({ kind: 'INVALID', code: 'CROSS_SCOPE_LINK' });

    // Removing a link keeps the lesson and both topics.
    expect(
      await content.execute({
        type: 'UNLINK_LESSON_TOPIC',
        operationId: 'op-topic-unlink',
        profileId,
        linkId: 'topic-2',
        baseRevision: 1,
      }),
    ).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.lessonTopics.map((item) => item.id)).toEqual(['topic-1']);
    expect(snapshot.aulas.map((item) => item.id)).toEqual(['aula-1']);
    expect(snapshot.assuntos.map((item) => item.id).sort()).toEqual([
      'assunto-1',
      'assunto-2',
      'assunto-other',
    ]);
  });

  it('concurrent_sibling_reorder_conflicts', async () => {
    const { content } = await seedEditalWithDiscipline();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-first',
      profileId,
      value: assunto('assunto-a', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-second',
      profileId,
      value: assunto('assunto-b', { orderKey: '000020' }),
    });

    const moved = await content.reorderSibling({
      profileId,
      operationId: 'op-reorder-b',
      entityType: 'assunto',
      entityId: 'assunto-b',
      orderKey: '000005',
      baseRevision: 1,
    });
    expect(moved.kind).toBe('LOCAL_COMMITTED');

    const stale = await content.reorderSibling({
      profileId,
      operationId: 'op-reorder-stale',
      entityType: 'assunto',
      entityId: 'assunto-b',
      orderKey: '000030',
      baseRevision: 1,
    });
    expect(stale.kind).toBe('CONFLICT');

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.assuntos.map((item) => item.id)).toEqual(['assunto-b', 'assunto-a']);
    expect(snapshot.assuntos[0]).toMatchObject({ orderKey: '000005', localRevision: 2 });
  });

  it('reorder_rejects_unknown_entities_and_keeps_deterministic_ties', async () => {
    const { content } = await seedEditalWithDiscipline();
    expect(
      await content.reorderSibling({
        profileId,
        operationId: 'op-missing',
        entityType: 'aula',
        entityId: 'aula-ghost',
        orderKey: '000010',
      }),
    ).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });

    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula-a',
      profileId,
      value: aula('aula-a', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula-b',
      profileId,
      value: aula('aula-b', { orderKey: '000010' }),
    });
    const snapshot = await content.loadContent(profileId);
    expect(snapshot.aulas.map((item) => item.id)).toEqual(['aula-a', 'aula-b']);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import type { Assunto, Aula } from '../../src/domain/content';
import type { LogicalTombstone } from '../../src/domain/delete';
import {
  deleteV2DatabaseForTests,
  getPendingOutbox,
  openV2Database,
  requestResult,
  STORES,
} from '../../src/platform/indexeddb';
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

async function seed(): Promise<LocalContentRepository> {
  const subjects = new LocalSubjectRepository();
  await subjects.execute({
    operationId: 'op-subject-1',
    profileId,
    subjectId: 'subject-1',
    type: 'create',
    title: 'Direito Constitucional',
  });
  const content = new LocalContentRepository();
  await content.execute({
    type: 'CREATE_EDITAL',
    operationId: 'op-edital-1',
    profileId,
    editalId: 'edital-1',
    title: 'TJPB 2026',
  });
  await content.execute({
    type: 'LINK_SUBJECT',
    operationId: 'op-link-1',
    profileId,
    editalId: 'edital-1',
    subjectId: 'subject-1',
    linkId: 'link-1',
  });
  return content;
}

async function readTombstone(
  entityType: LogicalTombstone['entityType'],
  entityId: string,
): Promise<LogicalTombstone | undefined> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.tombstones, 'readonly');
  return (await requestResult(
    transaction.objectStore(STORES.tombstones).get([profileId, entityType, entityId]),
  )) as LogicalTombstone | undefined;
}

async function readEpoch(): Promise<number> {
  const database = await openV2Database(profileId);
  const transaction = database.transaction(STORES.meta, 'readonly');
  const record = (await requestResult(
    transaction.objectStore(STORES.meta).get(`epoch:${profileId}`),
  )) as { epoch?: number } | undefined;
  return record?.epoch ?? 0;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 archive, soft delete and tombstones', () => {
  it('archive_reactivate_keeps_data', async () => {
    const content = await seed();

    const archived = await content.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive',
      profileId,
      editalId: 'edital-1',
      baseRevision: 1,
    });
    expect(archived).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const afterArchive = await content.loadContent(profileId);
    expect(afterArchive.editais[0]).toMatchObject({ status: 'ARCHIVED', localRevision: 2 });
    expect(afterArchive.links).toHaveLength(1);

    const restored = await content.execute({
      type: 'RESTORE_ENTITY',
      operationId: 'op-restore',
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      baseRevision: 2,
    });
    expect(restored).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const afterRestore = await content.loadContent(profileId);
    expect(afterRestore.editais[0]).toMatchObject({ status: 'ACTIVE', localRevision: 3 });
    expect(afterRestore.links).toHaveLength(1);
    expect(await readTombstone('edital', 'edital-1')).toBeUndefined();
  });

  it('delete_parent_with_dependents_is_blocked_or_quarantined', async () => {
    const content = await seed();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-root',
      profileId,
      value: assunto('assunto-root', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-child',
      profileId,
      value: assunto('assunto-child', {
        parentId: 'assunto-root',
        parentKey: 'assunto-root',
        orderKey: '000010',
      }),
    });

    const blocked = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-parent',
      profileId,
      entityType: 'assunto',
      entityId: 'assunto-root',
      baseRevision: 1,
    });
    expect(blocked.kind).toBe('CONFLICT');
    expect((blocked as { current: { code: string } }).current.code).toBe('DEPENDENT_CONTENT');

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.assuntos.map((item) => item.id)).toEqual(['assunto-root', 'assunto-child']);
    expect(await readTombstone('assunto', 'assunto-root')).toBeUndefined();

    // Deleting an edital with links is equally refused.
    const editalBlocked = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-edital',
      profileId,
      entityType: 'edital',
      entityId: 'edital-1',
      baseRevision: 1,
    });
    expect(editalBlocked.kind).toBe('CONFLICT');
    expect(await readEpoch()).toBe(0);
  });

  it('delete_never_synced_creates_tombstone_and_requires_restore', async () => {
    const content = await seed();
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });

    const deleted = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-aula',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
      baseRevision: 1,
    });
    expect(deleted).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const tombstone = await readTombstone('aula', 'aula-1');
    expect(tombstone).toMatchObject({
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
      baseRevision: 1,
      epoch: 1,
      deleted: true,
    });
    expect((await content.loadContent(profileId)).aulas).toEqual([]);

    const deleteOperation = (await getPendingOutbox(profileId)).find(
      (operation) => operation.operationId === 'op-delete-aula',
    );
    expect(deleteOperation).toMatchObject({ kind: 'delete', entityType: 'aula' });

    // An upsert never resurrects a tombstoned entity.
    const resurrect = await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula-again',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });
    expect(resurrect).toEqual({ kind: 'CONFLICT', current: { code: 'DELETED_ENTITY' } });
    expect((await content.loadContent(profileId)).aulas).toEqual([]);

    const restored = await content.execute({
      type: 'RESTORE_ENTITY',
      operationId: 'op-restore-aula',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
    });
    expect(restored).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    expect(await readTombstone('aula', 'aula-1')).toBeUndefined();
    const restoredAula = (await content.loadContent(profileId)).aulas[0];
    expect(restoredAula).toMatchObject({ id: 'aula-1', localRevision: 2 });
    expect(await readEpoch()).toBe(2);
  });

  it('tombstones_are_profile_scoped', async () => {
    const content = await seed();
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-aula',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
      baseRevision: 1,
    });

    const otherProfile = await content.execute({
      type: 'RESTORE_ENTITY',
      operationId: 'op-restore-other',
      profileId: 'other-profile',
      entityType: 'aula',
      entityId: 'aula-1',
    });
    expect(otherProfile).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
    expect((await content.loadContent(profileId)).aulas).toEqual([]);
  });

  it('archive_never_invents_f4_progress_or_erases_future_history', async () => {
    const content = await seed();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-root',
      profileId,
      value: assunto('assunto-root', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });
    await content.execute({
      type: 'LINK_LESSON_TOPIC',
      operationId: 'op-topic',
      profileId,
      link: {
        id: 'topic-1',
        profileId,
        aulaId: 'aula-1',
        assuntoId: 'assunto-root',
        localRevision: 0,
      },
    });

    await content.execute({
      type: 'ARCHIVE_EDITAL',
      operationId: 'op-archive',
      profileId,
      editalId: 'edital-1',
    });

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.links).toHaveLength(1);
    expect(snapshot.assuntos).toHaveLength(1);
    expect(snapshot.aulas).toHaveLength(1);
    expect(snapshot.lessonTopics).toHaveLength(1);
    for (const record of [...snapshot.assuntos, ...snapshot.aulas, ...snapshot.links]) {
      expect(record).not.toHaveProperty('progress');
      expect(record).not.toHaveProperty('sessions');
    }
    expect(snapshot).not.toHaveProperty('progress');
    expect(snapshot).not.toHaveProperty('sessions');
  });

  it('restore_refuses_orphans_and_delete_requires_a_base_revision', async () => {
    const content = await seed();
    await content.execute({
      type: 'UPSERT_AULA',
      operationId: 'op-aula',
      profileId,
      value: aula('aula-1', { orderKey: '000010' }),
    });

    // Deleting without a known base could discard a concurrent edit.
    const noBase = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-no-base',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
    });
    expect(noBase).toEqual({ kind: 'INVALID', code: 'BASE_REVISION_STALE' });

    const stale = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-stale',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
      baseRevision: 0,
    });
    expect(stale.kind).toBe('CONFLICT');
    expect((await content.loadContent(profileId)).aulas).toHaveLength(1);

    const deleted = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-aula',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
      baseRevision: 1,
    });
    expect(deleted).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    // Removing the parent link leaves the tombstoned lesson orphaned.
    const unlinked = await content.execute({
      type: 'SOFT_DELETE',
      operationId: 'op-delete-link',
      profileId,
      entityType: 'edital-discipline',
      entityId: 'link-1',
      baseRevision: 1,
    });
    expect(unlinked).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const orphanRestore = await content.execute({
      type: 'RESTORE_ENTITY',
      operationId: 'op-restore-orphan',
      profileId,
      entityType: 'aula',
      entityId: 'aula-1',
    });
    expect(orphanRestore).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
    expect((await content.loadContent(profileId)).aulas).toEqual([]);
  });
});

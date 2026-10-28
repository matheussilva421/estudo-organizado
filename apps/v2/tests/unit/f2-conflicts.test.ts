import { beforeEach, describe, expect, it } from 'vitest';
import type { Assunto } from '../../src/domain/content';
import { deleteV2DatabaseForTests, getPendingOutbox } from '../../src/platform/indexeddb';
import { LocalContentRepository } from '../../src/platform/local-content-repository';
import { LocalSubjectRepository } from '../../src/platform/local-subject-repository';
import { FakeRemotePort } from '../../src/platform/sync/fake-remote';
import { flushPending } from '../../src/platform/sync/flush';
import { markConflict } from '../../src/platform/indexeddb';
import { LocalConflictService } from '../../src/application/conflict-service';

const profileId = 'profile-local';

function assunto(id: string, title: string, overrides: Partial<Assunto> = {}): Assunto {
  return {
    id,
    profileId,
    editalDisciplineId: 'link-1',
    parentId: null,
    parentKey: '',
    title,
    orderKey: '000010',
    localRevision: 0,
    ...overrides,
  };
}

async function seedEdital(): Promise<LocalContentRepository> {
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

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F2 conflict handling', () => {
  it('independent_entities_converge_with_fake_port', async () => {
    const content = await seedEdital();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-1',
      profileId,
      value: assunto('assunto-1', 'Assunto 1'),
    });
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-2',
      profileId,
      value: assunto('assunto-2', 'Assunto 2', { orderKey: '000020' }),
    });

    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    const pending = await getPendingOutbox(profileId);
    const flush = await flushPending(pending, remote);

    expect(flush.conflicts).toEqual([]);
    expect(flush.pending).toEqual([]);
    expect(flush.confirmedIds).toHaveLength(pending.length);
    // Simulated only: the fake proves contract shape, not Firestore.
    expect(remote.appliedCount()).toBe(pending.length);
  });

  it('resolve_remote_conflict_preserves_both_versions_until_choice', async () => {
    const content = await seedEdital();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-local',
      profileId,
      value: assunto('assunto-1', 'Versao local'),
    });

    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    // A second device already wrote this entity at revision 1.
    remote.seed('assunto-1', assunto('assunto-1', 'Versao remota'), 1);

    const pending = (await getPendingOutbox(profileId)).filter(
      (operation) => operation.entityId === 'assunto-1',
    );
    const flush = await flushPending(pending, remote);
    expect(flush.conflicts).toEqual(['op-assunto-local']);

    const conflicted = pending[0];
    expect(conflicted).toBeDefined();
    await markConflict(profileId, conflicted!, flush.conflictRevisions['op-assunto-local']!, {
      payload: remote.readEntity('assunto-1'),
      deleted: false,
    });

    const conflicts = new LocalConflictService().listConflicts(profileId);
    const [record] = await conflicts;
    expect(record).toMatchObject({
      entityType: 'assunto',
      entityId: 'assunto-1',
      status: 'OPEN',
      deleted: false,
      remoteRevision: 1,
    });
    expect(record?.localPayload).toMatchObject({ title: 'Versao local' });
    expect(record?.remotePayload).toMatchObject({ title: 'Versao remota' });
  });

  it('keep_local_resolution_creates_a_new_explicit_operation', async () => {
    const content = await seedEdital();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-local',
      profileId,
      value: assunto('assunto-1', 'Versao local'),
    });
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    remote.seed('assunto-1', assunto('assunto-1', 'Versao remota'), 1);

    const pending = (await getPendingOutbox(profileId)).filter(
      (operation) => operation.entityId === 'assunto-1',
    );
    const flush = await flushPending(pending, remote);
    await markConflict(profileId, pending[0]!, flush.conflictRevisions['op-assunto-local']!, {
      payload: remote.readEntity('assunto-1'),
      deleted: false,
    });

    const service = new LocalConflictService();
    const resolved = await service.resolveConflict(
      profileId,
      'op-assunto-local',
      'KEEP_LOCAL',
      'op-assunto-resolved',
    );
    expect(resolved).toMatchObject({ kind: 'LOCAL_COMMITTED' });

    const conflicts = await service.listConflicts(profileId);
    expect(conflicts[0]).toMatchObject({
      status: 'RESOLVED',
      resolution: 'LOCAL',
      resolvedByOperationId: 'op-assunto-resolved',
    });
    // Both versions stay readable after the decision.
    expect(conflicts[0]?.remotePayload).toMatchObject({ title: 'Versao remota' });

    const newOperation = (await getPendingOutbox(profileId)).find(
      (operation) => operation.operationId === 'op-assunto-resolved',
    );
    expect(newOperation).toMatchObject({ entityId: 'assunto-1', kind: 'upsert' });
    // Local CAS keeps the previous local revision; the remote CAS target is
    // recorded separately in `remoteBaseRevision` (delivery metadata).
    expect(newOperation?.baseRevision).toBe(1);
    expect(newOperation?.remoteBaseRevision).toBe(1);
  });

  it('accept_remote_resolution_does_not_push_the_local_version_back', async () => {
    const content = await seedEdital();
    await content.execute({
      type: 'UPSERT_ASSUNTO',
      operationId: 'op-assunto-local',
      profileId,
      value: assunto('assunto-1', 'Versao local'),
    });
    const remote = new FakeRemotePort({ uid: 'uid-a', profileId });
    remote.seed('assunto-1', assunto('assunto-1', 'Versao remota'), 1);

    const pending = (await getPendingOutbox(profileId)).filter(
      (operation) => operation.entityId === 'assunto-1',
    );
    const flush = await flushPending(pending, remote);
    await markConflict(profileId, pending[0]!, flush.conflictRevisions['op-assunto-local']!, {
      payload: remote.readEntity('assunto-1'),
      deleted: false,
    });

    const outgoingBefore = (await getPendingOutbox(profileId)).length;
    const service = new LocalConflictService();
    const resolved = await service.resolveConflict(
      profileId,
      'op-assunto-local',
      'ACCEPT_REMOTE',
      'op-assunto-accept',
    );
    expect(resolved).toMatchObject({ kind: 'LOCAL_COMMITTED' });
    expect((await getPendingOutbox(profileId)).length).toBe(outgoingBefore);

    const snapshot = await content.loadContent(profileId);
    expect(snapshot.assuntos.find((item) => item.id === 'assunto-1')?.title).toBe(
      'Versao remota',
    );
  });

  it('resolution_of_a_missing_or_already_resolved_conflict_is_invalid', async () => {
    const service = new LocalConflictService();
    expect(
      await service.resolveConflict(profileId, 'conflict-ghost', 'KEEP_LOCAL', 'op-x'),
    ).toEqual({ kind: 'INVALID', code: 'ENTITY_NOT_FOUND' });
  });
});

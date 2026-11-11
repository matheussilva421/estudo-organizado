import { beforeEach, describe, expect, it } from 'vitest';
import type { OutboxOperation, OutboxPayload } from '../../src/application/sync-types';
import type { ProfileRecord } from '../../src/application/profile-service';
import {
  reconcileRemoteEntity,
  resolveRemoteConflict,
} from '../../src/platform/sync/conflict-reconciliation';
import type { RemoteEntity } from '../../src/platform/sync/remote-schema';
import {
  deleteV2DatabaseForTests,
  getConflicts,
  getEligibleOutbox,
  markConflict,
  openV2Database,
  requestResult,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';
import { applyRemoteChange } from '../../src/platform/sync/apply-remote';

const profileId = 'profile-conflict';
const uid = 'uid-a';
const libraryId = 'library-a';

function remote(overrides: Partial<RemoteEntity> = {}): RemoteEntity {
  return {
    entityId: 'edital-1',
    entityType: 'edital',
    schemaVersion: 1,
    revision: 2,
    deleted: false,
    payload: { id: 'edital-1', profileId, title: 'B', status: 'ACTIVE', localRevision: 2 },
    epoch: 1,
    ...overrides,
  };
}

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    operationId: 'op-conflict',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: 1,
    payload: { id: 'edital-1', profileId, title: 'A', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: uid,
    remoteLibraryId: libraryId,
    ...overrides,
  };
}

async function seed(record: OutboxOperation): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction([STORES.profiles, STORES.outbox], 'readwrite');
  const profile: ProfileRecord = {
    profileId,
    uid,
    remoteLibraryId: libraryId,
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: null,
    localRevision: 1,
  };
  tx.objectStore(STORES.profiles).put(profile);
  tx.objectStore(STORES.outbox).put(record);
  await transactionDone(tx);
}

async function seedLocalRow(row: Record<string, unknown>): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.editais, 'readwrite');
  tx.objectStore(STORES.editais).put(row);
  await transactionDone(tx);
}

async function readOutbox(): Promise<OutboxOperation[]> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(STORES.outbox, 'readonly');
  return requestResult(tx.objectStore(STORES.outbox).getAll()) as Promise<OutboxOperation[]>;
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 sync conflicts', () => {
  it('f7_independent_entity_changes_merge', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    const result = reconcileRemoteEntity(
      local,
      remote({
        payload: {
          id: 'edital-1',
          profileId,
          title: 'A',
          status: 'ARCHIVED',
          localRevision: 1,
        },
      }),
      [],
    );
    expect(result).toEqual({
      kind: 'APPLY',
      next: { id: 'edital-1', profileId, title: 'A', localRevision: 1, status: 'ARCHIVED' },
    });
  });

  it('f7_local_revision_is_not_a_domain_conflict', () => {
    const local = {
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    } as OutboxPayload;
    const result = reconcileRemoteEntity(
      local,
      remote({
        payload: {
          id: 'edital-1',
          profileId,
          title: 'A',
          status: 'ACTIVE',
          note: 'nova',
          localRevision: 2,
        },
      }),
      [],
    );
    expect(result).toMatchObject({
      kind: 'APPLY',
      next: { title: 'A', status: 'ACTIVE', localRevision: 1, note: 'nova' },
    });
  });

  it('f7_same_field_offline_conflict_retains_both_versions', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    const result = reconcileRemoteEntity(local, remote(), []);
    expect(result.kind).toBe('CONFLICT');
    if (result.kind === 'CONFLICT') {
      expect(result.conflict.local).toEqual(local);
      expect(result.conflict.remote).toEqual(remote().payload);
      expect(result.conflict.reason).toContain('FIELD_CONFLICT');
    }
  });

  it('f7_delete_vs_edit_needs_decision', () => {
    const local = { id: 'edital-1', profileId, title: 'A', localRevision: 1 } as OutboxPayload;
    expect(reconcileRemoteEntity(local, remote({ deleted: true, payload: null }), []).kind).toBe(
      'CONFLICT',
    );
    expect(
      reconcileRemoteEntity(local, remote(), [operation({ kind: 'delete' })]).kind,
    ).toBe('CONFLICT');
  });

  it('f7_stale_resolution_rejected', async () => {
    const record = operation();
    await seed(record);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, record, 2, { payload: remote().payload, deleted: false });
    const [conflict] = await getConflicts(profileId);
    expect(conflict).toBeDefined();
    await expect(resolveRemoteConflict(conflict!.conflictId, 'LOCAL', 1)).resolves.toBe('STALE');
    await expect(resolveRemoteConflict(conflict!.conflictId, 'LOCAL', 2)).resolves.toBe(
      'LOCAL_COMMITTED',
    );
    await expect(resolveRemoteConflict(conflict!.conflictId, 'REMOTE', 2)).resolves.toBe('STALE');
  });

  it('f7_conflict_in_one_entity_does_not_block_other_entities', async () => {
    const first = operation();
    const second = operation({ operationId: 'op-2', entityId: 'edital-2' });
    await seed(first);
    await seed(second);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await seedLocalRow({
      id: 'edital-2',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, first, 2, { payload: remote().payload, deleted: false });
    await markConflict(profileId, second, 2, { payload: remote({ entityId: 'edital-2' }).payload, deleted: false });
    const conflicts = await getConflicts(profileId);
    expect(conflicts).toHaveLength(2);
    await resolveRemoteConflict(conflicts[0]!.conflictId, 'REMOTE', 2);
    expect((await getConflicts(profileId)).filter((item) => item.status === 'OPEN')).toHaveLength(1);
  });

  it('f7_remote_resolution_applies_the_remote_payload', async () => {
    const record = operation();
    await seed(record);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, record, 2, { payload: remote().payload, deleted: false });
    const [conflict] = await getConflicts(profileId);
    await expect(resolveRemoteConflict(conflict!.conflictId, 'REMOTE', 2)).resolves.toBe(
      'LOCAL_COMMITTED',
    );
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readonly');
    const row = await requestResult(tx.objectStore(STORES.editais).get([profileId, 'edital-1']));
    expect(row).toMatchObject({ title: 'B', localRevision: 2 });
  });

  it('f7_remote_delete_resolution_records_a_tombstone', async () => {
    const record = operation();
    await seed(record);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, record, 2, { payload: null, deleted: true }, 2);
    const [conflict] = await getConflicts(profileId);
    await expect(resolveRemoteConflict(conflict!.conflictId, 'REMOTE', 2)).resolves.toBe(
      'LOCAL_COMMITTED',
    );
    const db = await openV2Database(profileId);
    const tx = db.transaction([STORES.editais, STORES.tombstones], 'readonly');
    await expect(
      requestResult(tx.objectStore(STORES.editais).get([profileId, 'edital-1'])),
    ).resolves.toBeUndefined();
    const tombstones = (await requestResult(
      tx.objectStore(STORES.tombstones).getAll(),
    )) as Array<{ epoch?: number }>;
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]?.epoch).toBe(2);
  });

  it('f7_pull_conflict_blocks_every_pending_operation_of_the_entity', async () => {
    const first = operation({ operationId: 'op-a', baseRevision: 0 });
    const second = operation({ operationId: 'op-b', baseRevision: 1 });
    await seed(first);
    await seed(second);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });

    const outcome = await applyRemoteChange(
      profileId,
      { uid, libraryId },
      { sequence: 1, entityId: 'edital-1', revision: 2, deleted: false, epoch: 1 },
      {
        entityId: 'edital-1',
        entityType: 'edital',
        schemaVersion: 1,
        revision: 2,
        deleted: false,
        payload: {
          id: 'edital-1',
          profileId,
          title: 'B',
          status: 'ACTIVE',
          localRevision: 2,
        },
        epoch: 1,
      },
    );

    expect(outcome).toBe('CONFLICT');
    const rows = await readOutbox();
    expect(rows.find((row) => row.operationId === 'op-a')?.status).toBe('CONFLICT');
    expect(rows.find((row) => row.operationId === 'op-b')?.status).toBe('CONFLICT');
    await expect(getEligibleOutbox(profileId, Date.now())).resolves.toEqual([]);
  });

  it('f7_pull_conflict_for_a_local_delete_resolves_back_to_delete', async () => {
    const deletion = operation({
      operationId: 'op-delete',
      kind: 'delete',
      baseRevision: 1,
      payload: { id: 'edital-1', profileId, title: 'A', localRevision: 1 },
    });
    await seed(deletion);

    const outcome = await applyRemoteChange(
      profileId,
      { uid, libraryId },
      { sequence: 1, entityId: 'edital-1', revision: 2, deleted: false, epoch: 1 },
      {
        entityId: 'edital-1',
        entityType: 'edital',
        schemaVersion: 1,
        revision: 2,
        deleted: false,
        payload: {
          id: 'edital-1',
          profileId,
          title: 'B',
          status: 'ACTIVE',
          localRevision: 2,
        },
        epoch: 1,
      },
    );
    expect(outcome).toBe('CONFLICT');
    const [conflict] = await getConflicts(profileId);
    expect(conflict?.localPayload).toBeNull();

    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'LOCAL', conflict!.remoteRevision),
    ).resolves.toBe('LOCAL_COMMITTED');
    const rows = await readOutbox();
    const pending = rows.filter((row) => row.status === 'PENDING');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      kind: 'delete',
      entityId: 'edital-1',
      baseRevision: 2,
    });
  });

  it('f7_push_conflict_keeps_the_latest_local_payload', async () => {
    const first = operation({ operationId: 'op-1', baseRevision: 0 });
    const second = operation({
      operationId: 'op-2',
      baseRevision: 1,
      payload: {
        id: 'edital-1',
        profileId,
        title: 'LOCAL-LATEST',
        status: 'ACTIVE',
        localRevision: 2,
      },
    });
    await seed(first);
    await seed(second);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'LOCAL-LATEST',
      status: 'ACTIVE',
      localRevision: 2,
    });
    await markConflict(profileId, first, 2, {
      payload: remote().payload,
      deleted: false,
    });
    const [conflict] = await getConflicts(profileId);
    expect(conflict).toMatchObject({ localKind: 'upsert' });
    expect(conflict?.localPayload).toMatchObject({ title: 'LOCAL-LATEST', localRevision: 2 });
    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'LOCAL', conflict!.remoteRevision),
    ).resolves.toBe('LOCAL_COMMITTED');
    const pending = (await readOutbox()).filter((row) => row.status === 'PENDING');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      kind: 'upsert',
      payload: expect.objectContaining({ title: 'LOCAL-LATEST' }),
    });
  });

  it('f7_push_delete_conflict_resolves_back_to_delete', async () => {
    const deletion = operation({ operationId: 'op-del', kind: 'delete' });
    await seed(deletion);
    await markConflict(profileId, deletion, 2, {
      payload: remote().payload,
      deleted: false,
    });
    const [conflict] = await getConflicts(profileId);
    expect(conflict).toMatchObject({ localKind: 'delete', localPayload: null });
    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'LOCAL', conflict!.remoteRevision),
    ).resolves.toBe('LOCAL_COMMITTED');
    const pending = (await readOutbox()).filter((row) => row.status === 'PENDING');
    expect(pending[0]?.kind).toBe('delete');
  });

  it('f7_remote_resolution_rejects_a_later_local_edit', async () => {
    const record = operation();
    await seed(record);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, record, 2, {
      payload: remote().payload,
      deleted: false,
    });
    const [conflict] = await getConflicts(profileId);
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readwrite');
    tx.objectStore(STORES.editais).put({
      id: 'edital-1',
      profileId,
      title: 'LOCAL-NEWER',
      status: 'ACTIVE',
      localRevision: 2,
    });
    await transactionDone(tx);

    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'REMOTE', conflict!.remoteRevision),
    ).resolves.toBe('STALE');
    const check = db.transaction(STORES.editais, 'readonly');
    await expect(
      requestResult(check.objectStore(STORES.editais).get([profileId, 'edital-1'])),
    ).resolves.toMatchObject({ title: 'LOCAL-NEWER', localRevision: 2 });
  });

  it('f7_resolution_is_stale_when_another_tab_deletes_the_entity', async () => {
    const record = operation();
    await seed(record);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'A',
      status: 'ACTIVE',
      localRevision: 1,
    });
    await markConflict(profileId, record, 2, {
      payload: remote().payload,
      deleted: false,
    });
    const [conflict] = await getConflicts(profileId);
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readwrite');
    tx.objectStore(STORES.editais).delete([profileId, 'edital-1']);
    await transactionDone(tx);
    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'LOCAL', conflict!.remoteRevision),
    ).resolves.toBe('STALE');
    await expect(
      resolveRemoteConflict(conflict!.conflictId, 'REMOTE', conflict!.remoteRevision),
    ).resolves.toBe('STALE');
  });

  it('f7_pull_keeps_one_open_conflict_and_the_latest_remote_revision', async () => {
    const pending = operation({ operationId: 'op-pending' });
    await seed(pending);
    await seedLocalRow({
      id: 'edital-1',
      profileId,
      title: 'LOCAL',
      status: 'ACTIVE',
      localRevision: 1,
    });
    const first = await applyRemoteChange(
      profileId,
      { uid, libraryId },
      { sequence: 1, entityId: 'edital-1', revision: 2, deleted: false, epoch: 1 },
      {
        entityId: 'edital-1',
        entityType: 'edital',
        schemaVersion: 1,
        revision: 2,
        deleted: false,
        payload: {
          id: 'edital-1',
          profileId,
          title: 'REMOTE-2',
          status: 'ACTIVE',
          localRevision: 2,
        },
        epoch: 1,
      },
    );
    expect(first).toBe('CONFLICT');
    const second = await applyRemoteChange(
      profileId,
      { uid, libraryId },
      { sequence: 2, entityId: 'edital-1', revision: 3, deleted: false, epoch: 1 },
      {
        entityId: 'edital-1',
        entityType: 'edital',
        schemaVersion: 1,
        revision: 3,
        deleted: false,
        payload: {
          id: 'edital-1',
          profileId,
          title: 'REMOTE-3',
          status: 'ACTIVE',
          localRevision: 3,
        },
        epoch: 1,
      },
    );
    expect(second).toBe('CONFLICT');
    const conflicts = await getConflicts(profileId);
    expect(conflicts.filter((item) => item.status === 'OPEN')).toHaveLength(1);
    expect(conflicts[0]?.remoteRevision).toBe(3);
    await expect(
      resolveRemoteConflict(conflicts[0]!.conflictId, 'REMOTE', 3),
    ).resolves.toBe('LOCAL_COMMITTED');
    const db = await openV2Database(profileId);
    const tx = db.transaction(STORES.editais, 'readonly');
    await expect(
      requestResult(tx.objectStore(STORES.editais).get([profileId, 'edital-1'])),
    ).resolves.toMatchObject({ title: 'REMOTE-3', localRevision: 3 });
  });

  it('refuses an invalid remote session snapshot without overwriting the local facts', async () => {
    const db = await openV2Database(profileId);
    const tx = db.transaction(
      [STORES.conflicts, STORES.sessions, STORES.profiles, STORES.sessionAudit],
      'readwrite',
    );
    tx.objectStore(STORES.profiles).put({
      profileId, uid, remoteLibraryId: libraryId, syncEnabled: true, state: 'READY',
      primaryEditalId: null, localRevision: 1,
    });
    const local = {
      id: 'session-conflict', profileId, state: 'DRAFT', origin: 'TIMER',
      localRevision: 1, schemaVersion: 1, referenceZone: 'America/Fortaleza',
      planBlockIds: [], editalIds: [], intervals: [], note: 'LOCAL',
    };
    tx.objectStore(STORES.sessions).put(local);
    tx.objectStore(STORES.conflicts).put({
      conflictId: 'session-conflict-open', profileId, operationId: 'op-session',
      entityType: 'study-session', entityId: 'session-conflict',
      localPayload: local, localKind: 'upsert', localExisted: true,
      remotePayload: { id: 'session-conflict', profileId, state: 'DRAFT', note: 'BROKEN' },
      baseRevision: 1, remoteRevision: 2, remoteEpoch: 1, deleted: false,
      status: 'OPEN', createdAt: new Date().toISOString(),
    });
    await transactionDone(tx);

    await expect(
      resolveRemoteConflict('session-conflict-open', 'REMOTE', 2),
    ).resolves.toBe('STALE');
    const read = await openV2Database(profileId);
    const session = await requestResult(
      read.transaction(STORES.sessions, 'readonly').objectStore(STORES.sessions).get([profileId, 'session-conflict']),
    );
    expect(session).toMatchObject({ note: 'LOCAL', state: 'DRAFT' });
    const conflicts = await getConflicts(profileId);
    expect(conflicts.find((item) => item.conflictId === 'session-conflict-open')?.status).toBe('OPEN');
  });

  it('applies only a validated remote session and records the audit trail', async () => {
    const db = await openV2Database(profileId);
    const tx = db.transaction(
      [STORES.conflicts, STORES.sessions, STORES.profiles],
      'readwrite',
    );
    tx.objectStore(STORES.profiles).put({
      profileId, uid, remoteLibraryId: libraryId, syncEnabled: true, state: 'READY',
      primaryEditalId: null, localRevision: 1,
    });
    const local = {
      id: 'session-conflict', profileId, state: 'DRAFT', origin: 'TIMER',
      localRevision: 1, schemaVersion: 1, referenceZone: 'America/Fortaleza',
      planBlockIds: [], editalIds: [], intervals: [], note: 'LOCAL',
    };
    tx.objectStore(STORES.sessions).put(local);
    tx.objectStore(STORES.conflicts).put({
      conflictId: 'session-conflict-valid', profileId, operationId: 'op-session',
      entityType: 'study-session', entityId: 'session-conflict',
      localPayload: local, localKind: 'upsert', localExisted: true,
      remotePayload: { ...local, localRevision: 2, note: 'REMOTE' },
      baseRevision: 1, remoteRevision: 2, remoteEpoch: 1, deleted: false,
      status: 'OPEN', createdAt: new Date().toISOString(),
    });
    await transactionDone(tx);

    await expect(
      resolveRemoteConflict('session-conflict-valid', 'REMOTE', 2),
    ).resolves.toBe('LOCAL_COMMITTED');
    const read = await openV2Database(profileId);
    const session = await requestResult(
      read.transaction(STORES.sessions, 'readonly').objectStore(STORES.sessions).get([profileId, 'session-conflict']),
    );
    expect(session).toMatchObject({ note: 'REMOTE', localRevision: 2 });
    const audit = await requestResult(
      read.transaction(STORES.sessionAudit, 'readonly').objectStore(STORES.sessionAudit).getAll(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ reason: 'SYNC_REMOTE_RESOLUTION', mutationKind: 'EDIT_FACTS' });
  });
});

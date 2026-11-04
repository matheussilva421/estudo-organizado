import { beforeEach, describe, expect, it } from 'vitest';
import { collectF7Backup } from '../../src/platform/backup/collect';
import { inspectF7Backup } from '../../src/platform/backup/f7-format';
import { digestPayload } from '../../src/platform/sync/firebase-remote';
import {
  deleteV2DatabaseForTests,
  openV2Database,
  STORES,
  transactionDone,
} from '../../src/platform/indexeddb';

const profileId = 'profile-backup';

async function seed(): Promise<void> {
  const db = await openV2Database(profileId);
  const tx = db.transaction(
    [
      STORES.profiles,
      STORES.editais,
      STORES.planningScenarios,
      STORES.planningDrafts,
      STORES.sessions,
      STORES.sessionAudit,
      STORES.reviewTopics,
      STORES.outbox,
      STORES.tombstones,
      STORES.conflicts,
      STORES.meta,
    ],
    'readwrite',
  );
  tx.objectStore(STORES.profiles).put({
    profileId,
    uid: 'uid-secret',
    remoteLibraryId: 'library-secret',
    syncEnabled: true,
    state: 'READY',
    primaryEditalId: 'edital-1',
    localRevision: 1,
  });
  tx.objectStore(STORES.editais).put({
    profileId,
    id: 'edital-1',
    title: 'TJPB',
    status: 'ACTIVE',
    localRevision: 1,
  });
  tx.objectStore(STORES.planningScenarios).put({ profileId, id: 'scenario-1', editalId: 'edital-1' });
  tx.objectStore(STORES.planningDrafts).put({ profileId, scenarioId: 'scenario-1', draft: { title: 'rascunho' } });
  tx.objectStore(STORES.sessions).put({ profileId, id: 'session-1', seconds: 120 });
  tx.objectStore(STORES.sessionAudit).put({ profileId, id: 'audit-1', sessionId: 'session-1' });
  tx.objectStore(STORES.reviewTopics).put({ profileId, id: 'topic-1', title: 'Revisão' });
  tx.objectStore(STORES.outbox).put({
    operationId: 'op-backup',
    profileId,
    entityType: 'edital',
    entityId: 'edital-1',
    kind: 'upsert',
    baseRevision: 0,
    payload: { id: 'edital-1', profileId, title: 'TJPB', status: 'ACTIVE', localRevision: 1 },
    schemaVersion: 1,
    status: 'PENDING',
    deliveryUid: 'uid-secret',
    remoteLibraryId: 'library-secret',
  });
  tx.objectStore(STORES.tombstones).put({
    profileId,
    entityType: 'edital',
    entityId: 'edital-deleted',
    operationId: 'op-delete',
    baseRevision: 1,
    epoch: 2,
    deleted: true,
    deletedAt: new Date().toISOString(),
    snapshot: { title: 'apagado' },
  });
  tx.objectStore(STORES.conflicts).put({
    conflictId: 'conflict-1',
    profileId,
    operationId: 'op-conflict',
    entityType: 'edital',
    entityId: 'edital-1',
    localPayload: { title: 'A' },
    remotePayload: { title: 'B' },
    baseRevision: 1,
    remoteRevision: 2,
    deleted: false,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  });
  tx.objectStore(STORES.meta).put({ key: `epoch:${profileId}`, epoch: 2 });
  await transactionDone(tx);
}

beforeEach(async () => {
  await deleteV2DatabaseForTests();
});

describe('F7 backup coverage', () => {
  it('f7_backup_covers_all_persistent_stores_f2_to_f6', async () => {
    await seed();
    const snapshot = await collectF7Backup(profileId);
    expect(snapshot.payload[STORES.editais]).toHaveLength(1);
    expect(snapshot.payload[STORES.planningScenarios]).toHaveLength(1);
    expect(snapshot.payload[STORES.sessions]).toHaveLength(1);
    expect(snapshot.payload[STORES.reviewTopics]).toHaveLength(1);
    expect(snapshot.manifest.recordCount).toBeGreaterThanOrEqual(8);
  });

  it('f7_snapshot_includes_pending_ops_drafts_journal_tombstones_conflicts', async () => {
    await seed();
    const snapshot = await collectF7Backup(profileId);
    expect(snapshot.payload[STORES.outbox]).toHaveLength(1);
    expect(snapshot.payload[STORES.planningDrafts]).toHaveLength(1);
    expect(snapshot.payload[STORES.sessionAudit]).toHaveLength(1);
    expect(snapshot.payload[STORES.tombstones]).toHaveLength(1);
    expect(snapshot.payload[STORES.conflicts]).toHaveLength(1);
  });

  it('f7_credentials_removed_without_dropping_academic_data', async () => {
    await seed();
    const snapshot = await collectF7Backup(profileId);
    const profile = (snapshot.payload[STORES.profiles] as Array<Record<string, unknown>>)[0];
    expect(profile?.uid).toBeNull();
    expect(profile?.remoteLibraryId).toBeNull();
    expect(snapshot.payload[STORES.editais]).toHaveLength(1);
    const outbox = (snapshot.payload[STORES.outbox] as Array<Record<string, unknown>>)[0];
    expect(outbox?.deliveryUid).toBeNull();
    expect(outbox?.remoteLibraryId).toBeNull();
  });

  it('f7_manifest_checksum_and_count_match', async () => {
    await seed();
    const snapshot = await collectF7Backup(profileId);
    await expect(inspectF7Backup(snapshot)).resolves.toMatchObject({ kind: 'VALID' });
    const tampered = {
      ...snapshot,
      manifest: { ...snapshot.manifest, checksum: '0'.repeat(64) },
    };
    await expect(inspectF7Backup(tampered)).resolves.toMatchObject({ kind: 'INVALID' });
  });

  it('f7_unknown_schema_preserved_or_rejected_without_loss', async () => {
    await seed();
    const snapshot = await collectF7Backup(profileId);
    const payload = {
      ...snapshot.payload,
      future_store: [{ profileId, id: 'future-1', value: 'preservado' }],
    };
    const manifest = {
      ...snapshot.manifest,
      recordCount: snapshot.manifest.recordCount + 1,
      checksum: await digestPayload(payload),
    };
    const result = await inspectF7Backup({ manifest, payload });
    expect(result.kind).toBe('VALID');
    if (result.kind === 'VALID') {
      expect(result.snapshot.payload.future_store).toEqual(payload.future_store);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createBackupSnapshot } from '../../src/platform/backup/format';
import {
  exportF2Snapshot,
  F2_BACKUP_FORMAT_VERSION,
  previewF1OrF2Backup,
} from '../../src/platform/backup/f2-format';
import type { LogicalTombstone } from '../../src/domain/delete';

const profileId = 'profile-local';

function tombstone(overrides: Partial<LogicalTombstone> = {}): LogicalTombstone {
  return {
    profileId,
    entityType: 'aula',
    entityId: 'aula-1',
    operationId: 'op-delete',
    baseRevision: 1,
    epoch: 1,
    deleted: true,
    deletedAt: '2026-10-28T00:00:00.000Z',
    snapshot: { id: 'aula-1', profileId, title: 'Aula' },
    ...overrides,
  };
}

describe('F2 backup format', () => {
  it('old_backup_with_tombstones_requires_safe_rebaseline', async () => {
    const snapshot = await exportF2Snapshot({
      aulas: [{ id: 'aula-2', profileId, title: 'Aula viva', localRevision: 2 }],
      tombstones: [tombstone()],
      epoch: 1,
    });
    expect(snapshot.manifest.formatVersion).toBe(F2_BACKUP_FORMAT_VERSION);
    expect(snapshot.manifest.recordCount).toBe(2);

    expect(await previewF1OrF2Backup(snapshot, 1)).toMatchObject({ kind: 'SAFE', format: 2 });
    expect(await previewF1OrF2Backup(snapshot, 2)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      format: 2,
      reason: 'BACKUP_EPOCH_STALE',
    });
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'BACKUP_EPOCH_IN_FUTURE',
    });

    const tampered = structuredClone(snapshot);
    tampered.payload.aulas.push({ id: 'aula-3', profileId, title: 'Injetada', localRevision: 1 });
    expect(await previewF1OrF2Backup(tampered, 1)).toMatchObject({
      kind: 'INVALID',
      reason: 'CHECKSUM_MISMATCH',
    });
  });

  it('f1_backup_readback_and_subject_tombstone_collision_rejected', async () => {
    const f1 = await createBackupSnapshot({
      subjects: [{ id: 'subject-1', profileId, title: 'Direito', localRevision: 1 }],
      tombstones: [],
    });
    // An F1 backup can never be SAFE for an F2 database.
    expect(await previewF1OrF2Backup(f1, 0)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      format: 1,
      reason: 'F1_BACKUP_REQUIRES_REBASELINE',
    });

    const invalidF1 = structuredClone(f1);
    invalidF1.manifest.checksum = 'a'.repeat(64);
    expect(await previewF1OrF2Backup(invalidF1, 0)).toMatchObject({
      kind: 'INVALID',
      format: 1,
    });

    const collision = await exportF2Snapshot({
      subjects: [{ id: 'subject-1', profileId, title: 'Direito', localRevision: 1 }],
      tombstones: [tombstone({ entityId: 'subject-1', entityType: 'edital' })],
      epoch: 1,
    });
    expect(await previewF1OrF2Backup(collision, 1)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'SUBJECT_TOMBSTONE_COLLISION',
    });
  });

  it('export_strips_tokens_and_marks_incomplete_history', async () => {
    const snapshot = await exportF2Snapshot({
      subjects: [
        { id: 'subject-1', profileId, title: 'Direito', localRevision: 1, token: 'secret' },
      ],
      deletionHistoryComplete: false,
      epoch: 0,
    });
    expect(snapshot.payload.subjects[0]).not.toHaveProperty('token');
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'DELETION_HISTORY_MISSING',
    });
  });

  it('rejects_unknown_versions_and_malformed_payloads', async () => {
    expect(await previewF1OrF2Backup('{', 0)).toMatchObject({ kind: 'INVALID' });
    expect(await previewF1OrF2Backup({ manifest: { formatVersion: 9 } }, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'UNSUPPORTED_FORMAT_VERSION',
    });
    const snapshot = await exportF2Snapshot({ epoch: 0 });
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({ kind: 'SAFE' });
    const wrongSchema = structuredClone(snapshot);
    wrongSchema.manifest.domainSchemaVersion = 99;
    expect(await previewF1OrF2Backup(wrongSchema, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION',
    });
  });
});

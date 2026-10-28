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
      deletionHistoryComplete: true,
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
      tombstones: [
        tombstone({
          entityId: 'subject-1',
          entityType: 'subject' as never,
          snapshot: { id: 'subject-1', profileId, title: 'Direito' },
        }),
      ],
      epoch: 1,
      deletionHistoryComplete: true,
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
    const snapshot = await exportF2Snapshot({ epoch: 0, deletionHistoryComplete: true });
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({ kind: 'SAFE' });
    const wrongSchema = structuredClone(snapshot);
    wrongSchema.manifest.domainSchemaVersion = 99;
    expect(await previewF1OrF2Backup(wrongSchema, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION',
    });
  });

  it('manifest_record_count_must_match_the_payload', async () => {
    const snapshot = await exportF2Snapshot({
      editais: [{ id: 'edital-1', profileId, title: 'TJPB', localRevision: 1 }],
      epoch: 0,
      deletionHistoryComplete: true,
    });
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({ kind: 'SAFE' });

    const forged = structuredClone(snapshot);
    forged.manifest.recordCount = 7;
    expect(await previewF1OrF2Backup(forged, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'RECORD_COUNT_MISMATCH',
    });
  });

  it('partial_export_never_claims_complete_deletion_history', async () => {
    const snapshot = await exportF2Snapshot({ epoch: 0 });
    expect(snapshot.manifest.deletionHistoryComplete).toBe(false);
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'DELETION_HISTORY_MISSING',
    });
  });

  it('epoch_without_tombstones_is_never_safe', async () => {
    const snapshot = await exportF2Snapshot({
      subjects: [{ id: 'subject-1', profileId, title: 'Direito', localRevision: 1 }],
      epoch: 3,
      deletionHistoryComplete: true,
    });
    expect(await previewF1OrF2Backup(snapshot, 3)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'NO_DELETION_HISTORY_EPOCH',
    });
    expect(await previewF1OrF2Backup(snapshot, 0)).toMatchObject({ kind: 'REBASELINE_REQUIRED' });
  });

  it('current_epoch_must_be_a_non_negative_integer', async () => {
    const snapshot = await exportF2Snapshot({
      tombstones: [tombstone()],
      epoch: 1,
      deletionHistoryComplete: true,
    });
    expect(await previewF1OrF2Backup(snapshot, Number.NaN)).toMatchObject({
      kind: 'INVALID',
      reason: 'CURRENT_EPOCH_INVALID',
    });
    expect(await previewF1OrF2Backup(snapshot, -1)).toMatchObject({
      kind: 'INVALID',
      reason: 'CURRENT_EPOCH_INVALID',
    });
  });

  it('collision_also_covers_assunto_aula_edital_and_link', async () => {
    const snapshot = await exportF2Snapshot({
      assuntos: [
        {
          id: 'assunto-1',
          profileId,
          editalDisciplineId: 'link-1',
          parentId: null,
          parentKey: '',
          title: 'Vivo',
          orderKey: '000010',
          localRevision: 1,
        },
      ],
      tombstones: [
        tombstone({
          entityId: 'assunto-1',
          entityType: 'assunto',
          snapshot: { id: 'assunto-1', profileId, title: 'Vivo' },
        }),
      ],
      epoch: 1,
      deletionHistoryComplete: true,
    });
    expect(await previewF1OrF2Backup(snapshot, 1)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'SUBJECT_TOMBSTONE_COLLISION',
    });
  });

  it('manifest_epoch_must_match_the_max_tombstone_epoch', async () => {
    const snapshot = await exportF2Snapshot({
      tombstones: [tombstone({ epoch: 1 })],
      epoch: 1,
      deletionHistoryComplete: true,
    });
    const forged = structuredClone(snapshot);
    forged.manifest.epoch = 2;
    expect(await previewF1OrF2Backup(forged, 2)).toMatchObject({
      kind: 'REBASELINE_REQUIRED',
      reason: 'EPOCH_WITHOUT_TOMBSTONE',
    });
  });

  it('f1_shaped_payload_with_f2_header_is_rejected', async () => {
    const f1 = await createBackupSnapshot({
      subjects: [{ id: 'subject-1', profileId, title: 'Direito', localRevision: 1 }],
      tombstones: [],
    });
    const disguised = {
      manifest: {
        ...f1.manifest,
        formatVersion: 2,
        epoch: 0,
        deletionHistoryComplete: true,
      },
      payload: f1.payload,
    };
    expect(await previewF1OrF2Backup(disguised, 0)).toMatchObject({
      kind: 'INVALID',
      reason: 'INVALID_PAYLOAD_SHAPE',
    });
  });

  it('tokens_inside_tombstone_snapshot_are_stripped_on_export', async () => {
    const snapshot = await exportF2Snapshot({
      tombstones: [
        tombstone({
          snapshot: { id: 'aula-1', profileId, title: 'Aula', accessToken: 'segredo' },
        }),
      ],
      epoch: 1,
      deletionHistoryComplete: true,
    });
    expect(JSON.stringify(snapshot.payload)).not.toContain('segredo');
  });
});

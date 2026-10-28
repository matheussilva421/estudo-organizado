import type { LogicalTombstone } from '../../domain/delete';
import { DOMAIN_SCHEMA_VERSION } from '../../domain/versions';
import {
  computeChecksum,
  inspectBackup,
  stripSensitiveData,
  type BackupRecord,
} from './format';

/** F2 keeps its own format version; F1 stays readable through a v1 reader. */
export const F2_BACKUP_FORMAT_VERSION = 2;

export type BackupManifestF2 = {
  formatVersion: number;
  domainSchemaVersion: number;
  recordCount: number;
  checksum: string;
  epoch: number;
  hasDeletionHistory: boolean;
  deletionHistoryComplete: boolean;
};

export type BackupPayloadF2 = {
  subjects: BackupRecord[];
  editais: BackupRecord[];
  links: BackupRecord[];
  assuntos: BackupRecord[];
  aulas: BackupRecord[];
  lessonTopics: BackupRecord[];
  tombstones: LogicalTombstone[];
};

export type BackupSnapshotF2 = {
  manifest: BackupManifestF2;
  payload: BackupPayloadF2;
};

export type BackupSnapshotF2Input = {
  subjects?: readonly unknown[];
  editais?: readonly unknown[];
  links?: readonly unknown[];
  assuntos?: readonly unknown[];
  aulas?: readonly unknown[];
  lessonTopics?: readonly unknown[];
  tombstones?: readonly LogicalTombstone[];
  epoch?: number;
  deletionHistoryComplete?: boolean;
};

export type BackupPreviewF2 =
  | { kind: 'SAFE'; format: 1 | 2; reason?: string }
  | { kind: 'INVALID'; format: 1 | 2; reason: string }
  | { kind: 'REBASELINE_REQUIRED'; format: 1 | 2; reason: string };

function asRecords(value: readonly unknown[] | undefined, field: string): BackupRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`INVALID_${field}`);
  return value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`INVALID_${field}`);
    }
    return stripSensitiveData<BackupRecord>(item as BackupRecord);
  });
}

function asTombstones(value: readonly LogicalTombstone[] | undefined): LogicalTombstone[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('INVALID_TOMBSTONES');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || item.deleted !== true) {
      throw new Error('INVALID_TOMBSTONES');
    }
    if (typeof item.profileId !== 'string' || typeof item.entityId !== 'string') {
      throw new Error('INVALID_TOMBSTONES');
    }
    if (!Number.isInteger(item.epoch) || item.epoch < 0) {
      throw new Error('INVALID_TOMBSTONES');
    }
    return item;
  });
}

export async function exportF2Snapshot(
  input: BackupSnapshotF2Input,
): Promise<BackupSnapshotF2> {
  const payload: BackupPayloadF2 = {
    subjects: asRecords(input.subjects, 'SUBJECTS'),
    editais: asRecords(input.editais, 'EDITAIS'),
    links: asRecords(input.links, 'LINKS'),
    assuntos: asRecords(input.assuntos, 'ASSUNTOS'),
    aulas: asRecords(input.aulas, 'AULAS'),
    lessonTopics: asRecords(input.lessonTopics, 'LESSON_TOPICS'),
    tombstones: asTombstones(input.tombstones),
  };
  const epoch = Number.isInteger(input.epoch) && (input.epoch ?? 0) >= 0 ? (input.epoch as number) : 0;
  const recordCount =
    payload.subjects.length +
    payload.editais.length +
    payload.links.length +
    payload.assuntos.length +
    payload.aulas.length +
    payload.lessonTopics.length +
    payload.tombstones.length;

  return {
    manifest: {
      formatVersion: F2_BACKUP_FORMAT_VERSION,
      domainSchemaVersion: DOMAIN_SCHEMA_VERSION,
      recordCount,
      checksum: await computeChecksum(payload),
      epoch,
      hasDeletionHistory: payload.tombstones.length > 0,
      deletionHistoryComplete: input.deletionHistoryComplete ?? true,
    },
    payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Explicit dual reader. An F1 backup is never `SAFE` for an F2 database: it
 * cannot prove F2 tombstones, so restoring it would resurrect deleted content.
 */
export async function previewF1OrF2Backup(
  input: unknown,
  currentEpoch: number,
): Promise<BackupPreviewF2> {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { kind: 'INVALID', format: 2, reason: 'TRUNCATED_OR_MALFORMED' };
    }
  }
  if (!isRecord(value)) return { kind: 'INVALID', format: 2, reason: 'MISSING_MANIFEST' };

  const manifest = isRecord(value.manifest) ? value.manifest : null;
  if (!manifest) return { kind: 'INVALID', format: 2, reason: 'MISSING_MANIFEST' };

  if (manifest.formatVersion === 1) {
    // Explicit F1 reader: validates the F1 envelope, then refuses to treat it
    // as a safe F2 restore.
    const inspected = await inspectBackup(value);
    if (!inspected.ok) return { kind: 'INVALID', format: 1, reason: inspected.reason };
    return { kind: 'REBASELINE_REQUIRED', format: 1, reason: 'F1_BACKUP_REQUIRES_REBASELINE' };
  }

  if (manifest.formatVersion !== F2_BACKUP_FORMAT_VERSION) {
    return { kind: 'INVALID', format: 2, reason: 'UNSUPPORTED_FORMAT_VERSION' };
  }
  if (manifest.domainSchemaVersion !== DOMAIN_SCHEMA_VERSION) {
    return { kind: 'INVALID', format: 2, reason: 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION' };
  }
  if (typeof manifest.deletionHistoryComplete !== 'boolean') {
    return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'DELETION_HISTORY_UNDECLARED' };
  }
  if (!manifest.deletionHistoryComplete) {
    return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'DELETION_HISTORY_MISSING' };
  }
  if (typeof manifest.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.checksum.toLowerCase())) {
    return { kind: 'INVALID', format: 2, reason: 'INVALID_MANIFEST' };
  }
  if (!Number.isInteger(manifest.epoch) || (manifest.epoch as number) < 0) {
    return { kind: 'INVALID', format: 2, reason: 'INVALID_MANIFEST' };
  }
  if (
    typeof manifest.recordCount !== 'number' ||
    !Number.isInteger(manifest.recordCount) ||
    manifest.recordCount < 0
  ) {
    return { kind: 'INVALID', format: 2, reason: 'INVALID_MANIFEST' };
  }
  if (!isRecord(value.payload)) return { kind: 'INVALID', format: 2, reason: 'MISSING_PAYLOAD' };

  let computed: string;
  try {
    computed = await computeChecksum(value.payload);
  } catch {
    return { kind: 'INVALID', format: 2, reason: 'INVALID_PAYLOAD' };
  }
  if (computed !== manifest.checksum.toLowerCase()) {
    return { kind: 'INVALID', format: 2, reason: 'CHECKSUM_MISMATCH' };
  }

  const payload = value.payload as Record<string, unknown>;
  const subjects = Array.isArray(payload.subjects) ? payload.subjects : [];
  const tombstones = Array.isArray(payload.tombstones) ? payload.tombstones : [];
  const counted = [
    'subjects',
    'editais',
    'links',
    'assuntos',
    'aulas',
    'lessonTopics',
    'tombstones',
  ].reduce((total, key) => {
    const list = payload[key];
    return total + (Array.isArray(list) ? list.length : 0);
  }, 0);
  if (counted !== (manifest.recordCount as number)) {
    return { kind: 'INVALID', format: 2, reason: 'RECORD_COUNT_MISMATCH' };
  }
  const tombstonedIds = new Set(
    tombstones
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((item) => `${String(item.profileId)}:${String(item.entityId)}`),
  );
  const collision = subjects.some((item) =>
    isRecord(item)
      ? tombstonedIds.has(`${String(item.profileId)}:${String(item.id)}`)
      : false,
  );
  if (collision) {
    return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'SUBJECT_TOMBSTONE_COLLISION' };
  }

  const backupEpoch = manifest.epoch as number;
  if (backupEpoch > currentEpoch) {
    return { kind: 'INVALID', format: 2, reason: 'BACKUP_EPOCH_IN_FUTURE' };
  }
  if (backupEpoch < currentEpoch) {
    return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'BACKUP_EPOCH_STALE' };
  }
  if (manifest.hasDeletionHistory !== tombstones.length > 0) {
    return { kind: 'INVALID', format: 2, reason: 'DELETION_HISTORY_INCONSISTENT' };
  }
  return { kind: 'SAFE', format: 2 };
}

import type { LogicalTombstone } from '../../domain/delete';
import { DOMAIN_SCHEMA_VERSION } from '../../domain/versions';
import {
  computeChecksum,
  containsSensitiveData,
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
  if (!Array.isArray(value)) throw new Error('INVALID_' + field);
  return value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('INVALID_' + field);
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
    if (typeof item.operationId !== 'string' || item.operationId.trim() === '') {
      throw new Error('INVALID_TOMBSTONES');
    }
    if (!Number.isInteger(item.epoch) || item.epoch < 0) {
      throw new Error('INVALID_TOMBSTONES');
    }
    return stripSensitiveData<LogicalTombstone>(item);
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
      // History is only complete when the exporter explicitly says so.
      deletionHistoryComplete: input.deletionHistoryComplete === true,
    },
    payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const F2_COLLECTIONS: { key: keyof BackupPayloadF2; entityType: string }[] = [
  { key: 'subjects', entityType: 'subject' },
  { key: 'editais', entityType: 'edital' },
  { key: 'links', entityType: 'edital-discipline' },
  { key: 'assuntos', entityType: 'assunto' },
  { key: 'aulas', entityType: 'aula' },
  { key: 'lessonTopics', entityType: 'lesson-topic-link' },
];

const REQUIRED_PAYLOAD_KEYS: (keyof BackupPayloadF2)[] = [
  ...F2_COLLECTIONS.map((item) => item.key),
  'tombstones',
];

/**
 * Explicit dual reader. An F1 backup is never SAFE for an F2 database: it
 * cannot prove F2 tombstones, so restoring it would resurrect deleted content.
 *
 * A snapshot is only SAFE when it proves causal deletion history: declared
 * complete, epoch compatible with the current one, and no live record that
 * collides with a tombstone of the same profile/type/id.
 */
export async function previewF1OrF2Backup(
  input: unknown,
  currentEpoch: number,
): Promise<BackupPreviewF2> {
  if (!Number.isInteger(currentEpoch) || currentEpoch < 0) {
    return { kind: 'INVALID', format: 2, reason: 'CURRENT_EPOCH_INVALID' };
  }

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
  if (
    typeof manifest.checksum !== 'string' ||
    !/^[0-9a-f]{64}$/.test(manifest.checksum.toLowerCase())
  ) {
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

  const payload = value.payload as Record<string, unknown>;
  for (const key of REQUIRED_PAYLOAD_KEYS) {
    if (!Array.isArray(payload[key])) {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_PAYLOAD_SHAPE' };
    }
  }

  let computed: string;
  try {
    computed = await computeChecksum(value.payload);
  } catch {
    return { kind: 'INVALID', format: 2, reason: 'INVALID_PAYLOAD' };
  }
  if (computed !== manifest.checksum.toLowerCase()) {
    return { kind: 'INVALID', format: 2, reason: 'CHECKSUM_MISMATCH' };
  }
  if (containsSensitiveData(payload, new Set())) {
    return { kind: 'INVALID', format: 2, reason: 'SENSITIVE_DATA_PRESENT' };
  }

  const counted = REQUIRED_PAYLOAD_KEYS.reduce((total, key) => {
    const list = payload[key] as unknown[];
    return total + list.length;
  }, 0);
  if (counted !== (manifest.recordCount as number)) {
    return { kind: 'INVALID', format: 2, reason: 'RECORD_COUNT_MISMATCH' };
  }

  const tombstones = payload.tombstones as unknown[];
  const tombstoneKeys = new Set<string>();
  let maxTombstoneEpoch = 0;
  for (const raw of tombstones) {
    if (!isRecord(raw)) return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    if (typeof raw.profileId !== 'string' || typeof raw.entityId !== 'string') {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    }
    if (typeof raw.operationId !== 'string' || raw.operationId.trim() === '') {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    }
    if (raw.baseRevision !== null && !Number.isInteger(raw.baseRevision)) {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    }
    if (!Number.isInteger(raw.epoch) || (raw.epoch as number) < 0) {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    }
    if (raw.deleted !== true) {
      return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
    }
    const snapshot = raw.snapshot;
    if (isRecord(snapshot)) {
      if (snapshot.profileId !== raw.profileId || snapshot.id !== raw.entityId) {
        return { kind: 'INVALID', format: 2, reason: 'INVALID_TOMBSTONE' };
      }
    }
    const entityType = typeof raw.entityType === 'string' ? raw.entityType : 'subject';
    tombstoneKeys.add(raw.profileId + '|' + entityType + '|' + raw.entityId);
    maxTombstoneEpoch = Math.max(maxTombstoneEpoch, raw.epoch as number);
  }

  for (const collection of F2_COLLECTIONS) {
    const items = payload[collection.key] as unknown[];
    for (const item of items) {
      if (!isRecord(item)) return { kind: 'INVALID', format: 2, reason: 'INVALID_PAYLOAD' };
      const key =
        String(item.profileId) + '|' + collection.entityType + '|' + String(item.id);
      if (tombstoneKeys.has(key)) {
        return {
          kind: 'REBASELINE_REQUIRED',
          format: 2,
          reason: 'SUBJECT_TOMBSTONE_COLLISION',
        };
      }
    }
  }

  const backupEpoch = manifest.epoch as number;
  if (manifest.hasDeletionHistory !== tombstones.length > 0) {
    return { kind: 'INVALID', format: 2, reason: 'DELETION_HISTORY_INCONSISTENT' };
  }
  if (tombstones.length === 0) {
    // Without a single tombstone the epoch cannot be proven for any deletion.
    if (backupEpoch !== 0 || currentEpoch !== 0) {
      return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'NO_DELETION_HISTORY_EPOCH' };
    }
  } else {
    if (maxTombstoneEpoch > backupEpoch) {
      return { kind: 'INVALID', format: 2, reason: 'EPOCH_MISMATCH' };
    }
    if (backupEpoch > maxTombstoneEpoch) {
      // The manifest claims deletions newer than any tombstone it carries.
      return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'EPOCH_WITHOUT_TOMBSTONE' };
    }
  }
  if (backupEpoch > currentEpoch) {
    return { kind: 'INVALID', format: 2, reason: 'BACKUP_EPOCH_IN_FUTURE' };
  }
  if (backupEpoch < currentEpoch) {
    return { kind: 'REBASELINE_REQUIRED', format: 2, reason: 'BACKUP_EPOCH_STALE' };
  }
  return { kind: 'SAFE', format: 2 };
}

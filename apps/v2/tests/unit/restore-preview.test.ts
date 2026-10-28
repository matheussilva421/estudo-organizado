import { describe, expect, it, vi } from 'vitest';
import { BACKUP_FORMAT_VERSION, DOMAIN_SCHEMA_VERSION } from '../../src/domain/versions';
import {
  computeChecksum,
  createBackupSnapshot,
  type BackupSnapshot,
  type LogicalTombstone,
} from '../../src/platform/backup/format';
import { previewRestore } from '../../src/platform/backup/restore';

const EPOCH = 11;

const TOMBSTONE: LogicalTombstone = {
  profileId: 'profile-a',
  entityId: 'subject-1',
  operationId: 'operation-1',
  baseRevision: 2,
  epoch: EPOCH,
};

function subject(): Record<string, unknown> {
  return {
    id: 'subject-1',
    profileId: 'profile-a',
    title: 'Direito Administrativo',
    localRevision: 2,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function makeSnapshot(options: {
  subjects?: unknown[];
  tombstones?: LogicalTombstone[];
} = {}): Promise<BackupSnapshot> {
  return createBackupSnapshot({
    subjects: options.subjects ?? [subject()],
    tombstones: options.tombstones ?? [TOMBSTONE],
    versions: {
      formatVersion: BACKUP_FORMAT_VERSION,
      domainSchemaVersion: DOMAIN_SCHEMA_VERSION,
    },
  });
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('markers', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putMarker(db: IDBDatabase, marker: { id: string; value: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('markers', 'readwrite');
    transaction.objectStore('markers').put(marker);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readMarkers(db: IDBDatabase): Promise<Array<{ id: string; value: string }>> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('markers', 'readonly');
    const request = transaction.objectStore('markers').getAll();
    request.onsuccess = () => resolve(request.result as Array<{ id: string; value: string }>);
    request.onerror = () => reject(request.error);
  });
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('restore preview', () => {
  it('stale_backup_requires_rebaseline', async () => {
    const stale = await makeSnapshot({
      tombstones: [{ ...TOMBSTONE, epoch: EPOCH - 1 }],
    });
    const stalePreview = await previewRestore(stale, EPOCH);
    expect(stalePreview.kind).toBe('REBASELINE_REQUIRED');
    expect(stalePreview.reason).toContain('EPOCH');

    const current = await makeSnapshot();
    expect(await previewRestore(current, EPOCH)).toEqual({ kind: 'SAFE' });
  });

  it('missing_deletion_history_requires_rebaseline', async () => {
    const snapshot = await makeSnapshot({ tombstones: [] });
    expect(snapshot.manifest.hasDeletionHistory).toBe(false);

    const preview = await previewRestore(snapshot, EPOCH);
    expect(preview.kind).toBe('REBASELINE_REQUIRED');
    expect(preview.reason).toContain('DELETION_HISTORY');
  });

  it('invalid_format_or_version_is_invalid', async () => {
    const snapshot = await makeSnapshot();

    const wrongFormat = clone(snapshot);
    wrongFormat.manifest.formatVersion = BACKUP_FORMAT_VERSION + 1;
    expect(await previewRestore(wrongFormat, EPOCH)).toMatchObject({
      kind: 'INVALID',
      reason: 'UNSUPPORTED_FORMAT_VERSION',
    });

    const wrongSchema = clone(snapshot);
    wrongSchema.manifest.domainSchemaVersion = DOMAIN_SCHEMA_VERSION + 1;
    expect(await previewRestore(wrongSchema, EPOCH)).toMatchObject({
      kind: 'INVALID',
      reason: 'UNSUPPORTED_DOMAIN_SCHEMA_VERSION',
    });

    expect((await previewRestore(snapshot, Number.NaN)).kind).toBe('INVALID');
    expect((await previewRestore({ payload: snapshot.payload }, EPOCH)).kind).toBe('INVALID');
  });

  it('checksum_mismatch_is_invalid', async () => {
    const snapshot = await makeSnapshot();
    const tampered = clone(snapshot);
    const firstSubject = tampered.payload.subjects[0];
    if (!firstSubject) throw new Error('subject fixture is missing');
    firstSubject.title = 'Tampered after export';

    expect(await previewRestore(tampered, EPOCH)).toMatchObject({
      kind: 'INVALID',
      reason: 'CHECKSUM_MISMATCH',
    });

    const truncated = JSON.stringify(snapshot).slice(0, 20);
    expect((await previewRestore(truncated, EPOCH)).kind).toBe('INVALID');
  });

  it('sensitive_payload_is_invalid_even_with_valid_checksum', async () => {
    const snapshot = await makeSnapshot();
    const tampered = clone(snapshot);
    const firstSubject = tampered.payload.subjects[0];
    if (!firstSubject) throw new Error('subject fixture is missing');
    firstSubject.accessToken = 'leaked-access-token';
    tampered.manifest.checksum = await computeChecksum(tampered.payload);

    expect(await previewRestore(tampered, EPOCH)).toMatchObject({
      kind: 'INVALID',
      reason: 'SENSITIVE_DATA_PRESENT',
    });
  });

  it('record_count_mismatch_is_invalid', async () => {
    const snapshot = await makeSnapshot();
    const tampered = clone(snapshot);
    tampered.manifest.recordCount += 1;

    expect(await previewRestore(tampered, EPOCH)).toMatchObject({
      kind: 'INVALID',
      reason: 'RECORD_COUNT_MISMATCH',
    });
  });

  it('future_epoch_is_not_safe', async () => {
    const future = await makeSnapshot({
      tombstones: [{ ...TOMBSTONE, epoch: EPOCH + 1 }],
    });
    const preview = await previewRestore(future, EPOCH);
    expect(preview.kind).toBe('INVALID');
    expect(preview.reason).toContain('FUTURE');
  });

  it('empty_backup_cannot_be_marked_safe_by_manifest_flag', async () => {
    const snapshot = await makeSnapshot({ tombstones: [] });
    const tampered = clone(snapshot);
    tampered.manifest.hasDeletionHistory = true;

    const preview = await previewRestore(tampered, EPOCH);
    expect(preview.kind).not.toBe('SAFE');
  });

  it('preview_does_not_write_database', async () => {
    const name = `preview-guard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const db = await openDatabase(name);
    try {
      await putMarker(db, { id: 'keep', value: 'original' });
      const before = await readMarkers(db);
      const snapshot = await makeSnapshot();

      const openSpy = vi.spyOn(indexedDB, 'open');
      let safePreview;
      let invalidPreview;
      try {
        safePreview = await previewRestore(snapshot, EPOCH);
        invalidPreview = await previewRestore('{not-json', EPOCH);
      } finally {
        openSpy.mockRestore();
      }

      expect(openSpy).not.toHaveBeenCalled();
      expect(safePreview).toEqual({ kind: 'SAFE' });
      expect(invalidPreview.kind).toBe('INVALID');
      expect(await readMarkers(db)).toEqual(before);
    } finally {
      db.close();
      await deleteDatabase(name);
    }
  });
});

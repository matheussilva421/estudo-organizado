import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT_VERSION, DOMAIN_SCHEMA_VERSION } from '../../src/domain/versions';
import {
  canonicalJson,
  computeChecksum,
  createBackupSnapshot,
  sha256Hex,
  verifyBackup,
  type LogicalTombstone,
} from '../../src/platform/backup/format';
import { previewRestore } from '../../src/platform/backup/restore';

const VERSIONS = {
  formatVersion: BACKUP_FORMAT_VERSION,
  domainSchemaVersion: DOMAIN_SCHEMA_VERSION,
};

const TOMBSTONE: LogicalTombstone = {
  profileId: 'profile-a',
  entityId: 'subject-1',
  operationId: 'operation-1',
  baseRevision: 2,
  epoch: 5,
};

function subject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'subject-1',
    profileId: 'profile-a',
    title: 'Direito Constitucional',
    localRevision: 2,
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('versioned backup format', () => {
  it('backup_excludes_tokens', async () => {
    const dirtySubject = subject({
      token: 'root-token-value',
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      idToken: 'id-token-value',
      password: 'password-value',
      secret: 'secret-value',
      apiKey: 'api-key-value',
      cache: { entries: ['cache-value'] },
      metadata: {
        access_token: 'snake-access-token-value',
        nested: { refreshToken: 'deep-refresh-token-value', safe: 'preserved' },
      },
      history: [{ password: 'history-password-value', note: 'kept' }],
    });
    const dirtyTombstone = {
      ...TOMBSTONE,
      token: 'tombstone-token-value',
      note: 'causal-note',
    };

    const snapshot = await createBackupSnapshot({
      subjects: [dirtySubject],
      tombstones: [dirtyTombstone],
      versions: VERSIONS,
    });

    const serialized = JSON.stringify(snapshot);
    for (const leaked of [
      'root-token-value',
      'access-token-value',
      'refresh-token-value',
      'id-token-value',
      'password-value',
      'secret-value',
      'api-key-value',
      'cache-value',
      'snake-access-token-value',
      'deep-refresh-token-value',
      'history-password-value',
      'tombstone-token-value',
    ]) {
      expect(serialized).not.toContain(leaked);
    }
    expect(serialized).not.toMatch(
      /"(?:token|accessToken|refreshToken|idToken|password|secret|apiKey|cache)"/,
    );

    const exportedSubject = snapshot.payload.subjects[0];
    expect(exportedSubject).toMatchObject({
      id: 'subject-1',
      profileId: 'profile-a',
      title: 'Direito Constitucional',
      metadata: { nested: { safe: 'preserved' } },
      history: [{ note: 'kept' }],
    });
    expect(exportedSubject).not.toHaveProperty('token');
    expect(exportedSubject).not.toHaveProperty('accessToken');
    expect(exportedSubject).not.toHaveProperty('password');
    expect(exportedSubject).not.toHaveProperty('cache');

    expect(snapshot.payload.tombstones[0]).toMatchObject({
      ...TOMBSTONE,
      note: 'causal-note',
    });
    expect(snapshot.payload.tombstones[0]).not.toHaveProperty('token');
  });

  it('checksum_detects_truncation', async () => {
    const snapshot = await createBackupSnapshot({
      subjects: [subject()],
      tombstones: [TOMBSTONE],
      versions: VERSIONS,
    });
    const serialized = JSON.stringify(snapshot);
    const truncated = serialized.slice(0, Math.floor(serialized.length / 2));

    expect(await verifyBackup(truncated)).toBe(false);
    expect((await previewRestore(truncated, TOMBSTONE.epoch)).kind).toBe('INVALID');

    const tampered = clone(snapshot);
    const firstSubject = tampered.payload.subjects[0];
    if (!firstSubject) throw new Error('subject fixture is missing');
    firstSubject.title = 'Changed after export';

    expect(await verifyBackup(tampered)).toBe(false);
    const tamperedPreview = await previewRestore(tampered, TOMBSTONE.epoch);
    expect(tamperedPreview.kind).toBe('INVALID');
    expect(tamperedPreview.reason).toContain('CHECKSUM');
  });

  it('deletion_history_survives_export', async () => {
    const tombstones: LogicalTombstone[] = [
      {
        ...TOMBSTONE,
        entityId: 'subject-a',
        operationId: 'operation-a',
        baseRevision: 1,
        provenance: 'device-a',
      },
      {
        ...TOMBSTONE,
        entityId: 'subject-b',
        operationId: 'operation-b',
        baseRevision: 3,
      },
    ];
    const snapshot = await createBackupSnapshot({
      subjects: [subject()],
      tombstones,
      versions: VERSIONS,
    });

    expect(snapshot.manifest.hasDeletionHistory).toBe(true);
    expect(snapshot.manifest.recordCount).toBe(3);
    expect(snapshot.payload.tombstones).toEqual(tombstones);

    const roundTrip = clone(snapshot);
    expect(roundTrip.payload.tombstones).toEqual(tombstones);
    expect(await verifyBackup(roundTrip)).toBe(true);
    expect(await previewRestore(roundTrip, TOMBSTONE.epoch)).toEqual({ kind: 'SAFE' });
  });

  it('canonical_checksum_is_stable_sha256', async () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(await computeChecksum({ b: 1, a: 2 })).toBe(await computeChecksum({ a: 2, b: 1 }));
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');

    const snapshot = await createBackupSnapshot({
      subjects: [subject()],
      tombstones: [TOMBSTONE],
      versions: VERSIONS,
    });
    expect(snapshot.manifest.checksum).toBe(await computeChecksum(snapshot.payload));
    expect(snapshot.manifest.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.manifest).not.toHaveProperty('signature');
    expect(snapshot.manifest.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(snapshot.manifest.domainSchemaVersion).toBe(DOMAIN_SCHEMA_VERSION);
    expect(snapshot.manifest.recordCount).toBe(2);
  });
});


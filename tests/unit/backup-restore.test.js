import { describe, expect, it } from 'vitest';

import { previewRestoreImpact, validateBackupPayload } from '../../src/js/backup-restore.js';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

describe('backup-restore.js', () => {
  it('validates a safe state backup without runtime credentials', () => {
    const backup = createBaseState({
      schemaVersion: 9,
      eventos: [createEvento({ id: 'ev_1' })],
      config: { firestoreSync: { enabled: false } },
    });

    const result = validateBackupPayload(backup);

    expect(result.ok).toBe(true);
    expect(result.schemaVersion).toBe(9);
    expect(result.errors).toEqual([]);
  });

  it('rejects malformed backups and exported credentials', () => {
    const result = validateBackupPayload({
      schemaVersion: 9,
      eventos: 'not-array',
      config: {
        cfToken: 'secret',
        firestoreSync: { enabled: true },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('eventos must be an array');
    expect(result.errors).toContain('backup must not include Cloudflare token');
    expect(result.errors).toContain('backup must not include enabled Firestore runtime sync');
  });

  it('previews restore impact before applying data', () => {
    const current = createBaseState({
      eventos: [
        createEvento({ id: 'ev_keep', titulo: 'Mesmo' }),
        createEvento({ id: 'ev_change', titulo: 'Antigo' }),
        createEvento({ id: 'ev_remove', titulo: 'Remover' }),
      ],
    });
    const incoming = createBaseState({
      eventos: [
        createEvento({ id: 'ev_keep', titulo: 'Mesmo' }),
        createEvento({ id: 'ev_change', titulo: 'Novo' }),
        createEvento({ id: 'ev_add', titulo: 'Adicionar' }),
      ],
    });

    const impact = previewRestoreImpact(current, incoming);

    expect(impact.collections.eventos).toMatchObject({
      current: 3,
      incoming: 3,
      added: 1,
      removed: 1,
      kept: 1,
      changed: 1,
    });
    expect(impact.byCollection.eventos.changed).toBe(1);
    expect(impact.totals).toMatchObject({ added: 1, removed: 1, changed: 1, preserved: 1 });
    expect(impact.destructive).toBe(true);
  });

  it('rejects remote identifiers that should not travel inside backup JSON', () => {
    const result = validateBackupPayload({
      schemaVersion: 9,
      eventos: [],
      driveFileId: 'drive-secret-file',
      lastSync: '2026-05-01T10:00:00.000Z',
      config: {
        firestoreSync: { enabled: false, uid: 'firebase-user', remoteUpdatedAt: 'remote' },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('backup must not include Google Drive file id');
    expect(result.errors).toContain('backup must not include remote sync timestamps');
    expect(result.errors).toContain('backup must not include Firestore uid');
  });
});

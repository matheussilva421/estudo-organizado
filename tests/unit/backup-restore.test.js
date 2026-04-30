import { describe, expect, it } from 'vitest';

import {
  previewRestoreImpact,
  validateBackupPayload,
} from '../../src/js/backup-restore.js';
import { createBaseState, createEvento } from '../helpers/state-builders.js';

describe('backup-restore.js', () => {
  it('validates a safe state backup without runtime credentials', () => {
    const backup = createBaseState({
      schemaVersion: 9,
      eventos: [createEvento({ id: 'ev_1' })],
      config: { firestoreSync: { enabled: false }, entitySync: { enabled: false, mode: 'off' } },
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
      eventos: [createEvento({ id: 'ev_keep' }), createEvento({ id: 'ev_remove' })],
    });
    const incoming = createBaseState({
      eventos: [createEvento({ id: 'ev_keep' }), createEvento({ id: 'ev_add' })],
    });

    const impact = previewRestoreImpact(current, incoming);

    expect(impact.collections.eventos).toMatchObject({
      current: 2,
      incoming: 2,
      added: 1,
      removed: 1,
      kept: 1,
    });
    expect(impact.destructive).toBe(true);
  });
});

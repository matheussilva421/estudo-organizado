import { describe, expect, it } from 'vitest';

const syncCenter = await import('../../src/js/sync/sync-center.js?v=8.26');

describe('sync-center.js', () => {
  it('blocks automatic Firestore flushes while a conflict needs a user decision', () => {
    const now = new Date('2026-04-26T12:00:00.000Z').getTime();

    expect(syncCenter.canAutoSyncFirestore({
      enabled: true,
      mode: 'primary',
      hasPendingWrites: true,
      conflict: { detectedAt: '2026-04-26T11:59:00.000Z' }
    }, { status: 'pending' }, now)).toBe(false);
  });

  it('honors Firestore outbox backoff before retrying automatic sync', () => {
    const now = new Date('2026-04-26T12:00:00.000Z').getTime();

    expect(syncCenter.canAutoSyncFirestore({
      enabled: true,
      mode: 'primary',
      hasPendingWrites: true,
      conflict: null
    }, {
      status: 'pending',
      nextAttemptAt: '2026-04-26T12:02:00.000Z'
    }, now)).toBe(false);

    expect(syncCenter.canAutoSyncFirestore({
      enabled: true,
      mode: 'primary',
      hasPendingWrites: true,
      conflict: null
    }, {
      status: 'pending',
      nextAttemptAt: '2026-04-26T11:59:00.000Z'
    }, now)).toBe(true);
  });

  it('keeps shadow mode out of automatic Firestore sync', () => {
    expect(syncCenter.canAutoSyncFirestore({
      enabled: true,
      mode: 'shadow',
      hasPendingWrites: false,
      conflict: null
    }, null)).toBe(false);
  });

  it('records same-id merge collisions instead of hiding them', () => {
    const merged = syncCenter.mergeStudyStates({
      config: {},
      editais: [{ id: 'ed-1', nome: 'Local' }]
    }, {
      config: {},
      editais: [{ id: 'ed-1', nome: 'Remoto' }]
    });

    expect(merged.editais).toEqual([{ id: 'ed-1', nome: 'Local' }]);
    expect(merged.config.syncMergeConflicts).toMatchObject({
      total: 1,
      items: [{ collection: 'editais', id: 'ed-1', localRevision: null, remoteRevision: null }]
    });
  });

  it('uses entity revision metadata when merging same-id records', () => {
    const merged = syncCenter.mergeStudyStates({
      config: {},
      editais: [{
        id: 'ed-1',
        nome: 'Local',
        _sync: { revision: 1, updatedAt: '2026-04-28T10:00:00.000Z' }
      }]
    }, {
      config: {},
      editais: [{
        id: 'ed-1',
        nome: 'Remoto',
        _sync: { revision: 2, updatedAt: '2026-04-29T10:00:00.000Z' }
      }]
    });

    expect(merged.editais[0].nome).toBe('Remoto');
    expect(merged.config.syncMergeConflicts).toBeUndefined();
  });

  it('builds one dashboard model for local, Firebase, Cloudflare and Drive status', () => {
    const model = syncCenter.buildSyncCenterModel({
      state: {
        config: {
          localBackupAt: '2026-04-26T12:00:00.000Z',
          firestoreSync: {
            enabled: true,
            mode: 'shadow',
            signedIn: true,
            hasPendingWrites: true,
            lastPullAt: '2026-04-26T11:00:00.000Z',
            lastPushAt: null,
            remoteUpdatedAt: '2026-04-26T10:00:00.000Z',
            conflict: { detectedAt: '2026-04-26T12:01:00.000Z' }
          },
          cfSyncEnabled: true,
          cfTokenSaved: true,
          cfLastSyncAt: '2026-04-26T09:00:00.000Z',
          cfRemoteUpdatedAt: '2026-04-26T09:00:00.000Z'
        },
        driveFileId: 'drive-file-1',
        lastSync: '2026-04-26T08:00:00.000Z'
      },
      firestoreStatus: {
        configured: true,
        signedIn: true,
        enabled: true,
        mode: 'shadow',
        hasPendingWrites: true,
        conflict: { detectedAt: '2026-04-26T12:01:00.000Z' }
      }
    });

    expect(model.sources.map(source => source.id)).toEqual(['local', 'firebase', 'cloudflare', 'drive']);
    expect(model.sources.find(source => source.id === 'firebase')).toMatchObject({
      health: 'conflict',
      pending: true,
      primary: true
    });
    expect(model.sources.find(source => source.id === 'local')).toMatchObject({
      health: 'ok',
      primary: false
    });
    expect(model.needsAttention).toBe(true);
  });
});

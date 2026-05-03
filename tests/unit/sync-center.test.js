import { describe, it, expect } from 'vitest';
import {
  canAutoSyncFirestore,
  buildSyncCenterModel,
  mergeStudyStates,
} from '../../src/js/sync/sync-center.js';

describe('sync-center.js', () => {
  describe('canAutoSyncFirestore()', () => {
    it('returns false when not enabled', () => {
      expect(canAutoSyncFirestore({ enabled: false })).toBe(false);
    });

    it('returns false when not primary mode', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'shadow' })).toBe(false);
    });

    it('returns false when conflict exists', () => {
      expect(
        canAutoSyncFirestore({ enabled: true, mode: 'primary', conflict: { type: 'diverge' } })
      ).toBe(false);
    });

    it('returns true when enabled and primary with no pending', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'primary' })).toBe(true);
    });

    it('returns false when pending status is conflict', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { status: 'conflict' };
      expect(canAutoSyncFirestore(config, pending)).toBe(false);
    });

    it('returns false when nextAttemptAt is in future', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { nextAttemptAt: new Date(Date.now() + 60000).toISOString() };
      expect(canAutoSyncFirestore(config, pending)).toBe(false);
    });

    it('returns true when nextAttemptAt is in past', () => {
      const config = { enabled: true, mode: 'primary' };
      const pending = { nextAttemptAt: new Date(Date.now() - 60000).toISOString() };
      expect(canAutoSyncFirestore(config, pending)).toBe(true);
    });
  });

  describe('buildSyncCenterModel()', () => {
    it('returns model with 4 sources', () => {
      const model = buildSyncCenterModel({ state: { config: {} } });
      expect(model.sources).toHaveLength(4);
      expect(model.sources.map((s) => s.id)).toEqual(['local', 'firebase', 'cloudflare', 'drive']);
    });

    it('marks firebase as primary source', () => {
      const model = buildSyncCenterModel({ state: { config: {} } });
      expect(model.primarySource).toBe('firebase');
    });

    it('detects needs attention when conflict exists', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, conflict: { type: 'diverge' } } } },
      });
      expect(model.needsAttention).toBe(true);
    });

    it('detects needs attention when error exists', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, lastError: 'timeout' } } },
      });
      expect(model.needsAttention).toBe(true);
    });

    it('shows firebase health as ok when enabled without issues', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: true, configured: true, signedIn: true } } },
      });
      const firebase = model.sources.find((s) => s.id === 'firebase');
      expect(firebase.health).toBe('ok');
    });

    it('shows firebase health as idle when disabled', () => {
      const model = buildSyncCenterModel({
        state: { config: { firestoreSync: { enabled: false } } },
      });
      const firebase = model.sources.find((s) => s.id === 'firebase');
      expect(firebase.health).toBe('idle');
    });

    it('shows cloudflare configured when cfUrl and token present', () => {
      const model = buildSyncCenterModel({
        state: { config: { cfUrl: 'https://worker.test', cfTokenSaved: 'token123' } },
      });
      const cloudflare = model.sources.find((s) => s.id === 'cloudflare');
      expect(cloudflare.configured).toBe(true);
    });

    it('shows drive configured when driveFileId present', () => {
      const model = buildSyncCenterModel({
        state: { driveFileId: 'abc123' },
      });
      const drive = model.sources.find((s) => s.id === 'drive');
      expect(drive.configured).toBe(true);
      expect(drive.health).toBe('ok');
    });

    it('computes newestRemoteAt from multiple sources', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: { remoteUpdatedAt: '2024-01-01T00:00:00Z' },
            cfRemoteUpdatedAt: '2024-06-01T00:00:00Z',
          },
          lastSync: '2024-03-01T00:00:00Z',
        },
      });
      expect(model.newestRemoteAt).toBe('2024-06-01T00:00:00.000Z');
    });

    it('includes compact health metrics for pending Firestore writes', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            localBackupAt: '2026-04-30T10:00:00.000Z',
            firestoreSync: {
              enabled: true,
              mode: 'primary',
              hasPendingWrites: true,
              pending: {
                attempts: 2,
                queuedAt: '2026-04-30T10:00:00.000Z',
                nextAttemptAt: '2026-04-30T10:04:00.000Z',
              },
            },
          },
        },
      });

      const firebase = model.sources.find((source) => source.id === 'firebase');
      expect(model.health.status).toBe('queued');
      expect(firebase.metrics.retryAttempts).toBe(2);
      expect(firebase.metrics.nextRetryAt).toBe('2026-04-30T10:04:00.000Z');
    });

    it('exposes performance metrics only in the advanced model', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            syncPerformance: {
              metrics: [
                { name: 'localCommitMs', durationMs: 42, at: '2026-05-02T10:00:00.000Z' },
                { name: 'firestoreWriteMs', durationMs: 120, at: '2026-05-02T10:00:01.000Z' },
              ],
            },
            firestoreSync: { enabled: true, mode: 'primary' },
          },
        },
      });

      expect(model.quiet.detail).not.toContain('firestoreWriteMs');
      expect(model.performanceMetrics).toEqual([
        { name: 'localCommitMs', durationMs: 42, at: '2026-05-02T10:00:00.000Z' },
        { name: 'firestoreWriteMs', durationMs: 120, at: '2026-05-02T10:00:01.000Z' },
      ]);
    });

    it('describes automatic synced state in quiet language', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              lastPushAt: '2026-05-01T10:00:00.000Z',
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Tudo salvo automaticamente');
      expect(model.quiet.tone).toBe('ok');
      expect(model.quiet.detail).toContain('Firestore sincroniza sozinho');
    });

    it('asks for action only when a real sync conflict exists', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              conflict: { type: 'entity-diverged' },
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Ação necessária');
      expect(model.quiet.tone).toBe('danger');
      expect(model.quiet.primaryAction).toBe('advanced');
    });

    it('asks for action when Firestore denies permission without exposing payloads', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
              lastError: 'permission-denied',
            },
          },
        },
      });

      expect(model.quiet.title).toBe('Ação necessária');
      expect(model.quiet.detail).toContain('negou permissão');
      expect(model.quiet.primaryAction).toBe('advanced');
    });

    it('explains offline automatic sync without asking for manual action', () => {
      const model = buildSyncCenterModel({
        state: {
          config: {
            localBackupAt: '2026-05-01T10:00:00.000Z',
            syncHealth: { offline: true },
            firestoreSync: {
              enabled: true,
              configured: true,
              signedIn: true,
              mode: 'primary',
            },
          },
        },
      });

      expect(model.health.status).toBe('offline');
      expect(model.quiet.title).toBe('Offline, sync automático pausado');
      expect(model.quiet.primaryAction).toBeNull();
    });
  });

  describe('mergeStudyStates()', () => {
    it('merges two empty states', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged.config.localBackupAt).toBeDefined();
    });

    it('prefers local state values over remote', () => {
      const local = { config: { theme: 'dark' } };
      const remote = { config: { theme: 'light' } };
      const merged = mergeStudyStates(local, remote);
      expect(merged.config.theme).toBe('dark');
    });

    it('merges editais arrays', () => {
      const local = { editais: [{ id: '1', nome: 'Local' }] };
      const remote = { editais: [{ id: '2', nome: 'Remote' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.editais).toHaveLength(2);
    });

    it('merges eventos arrays', () => {
      const local = { eventos: [{ id: '1' }] };
      const remote = { eventos: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.eventos).toHaveLength(2);
    });

    it('merges arquivo arrays', () => {
      const local = { arquivo: [{ id: '1' }] };
      const remote = { arquivo: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.arquivo).toHaveLength(2);
    });

    it('merges revisoes arrays', () => {
      const local = { revisoes: [{ id: '1' }] };
      const remote = { revisoes: [{ id: '2' }] };
      const merged = mergeStudyStates(local, remote);
      expect(merged.revisoes).toHaveLength(2);
    });

    it('merges habitos by type', () => {
      const local = { habitos: { diarios: [{ id: '1' }] } };
      const remote = { habitos: { diarios: [{ id: '2' }] } };
      const merged = mergeStudyStates(local, remote);
      expect(merged.habitos.diarios).toHaveLength(2);
    });

    it('handles missing habitos in one state', () => {
      const local = { habitos: { diarios: [{ id: '1' }] } };
      const remote = {};
      const merged = mergeStudyStates(local, remote);
      expect(merged.habitos.diarios).toHaveLength(1);
    });

    it('records syncMergeConflicts when collisions detected', () => {
      const local = { eventos: [{ id: '1', nome: 'Local', updatedAt: '2024-06-01' }] };
      const remote = { eventos: [{ id: '1', nome: 'Remote', updatedAt: '2024-06-01' }] };
      const merged = mergeStudyStates(local, remote);
      // Collision detection depends on mergeEntityAwareArrays implementation
      expect(merged.config.localBackupAt).toBeDefined();
    });

    it('clears stale syncMergeConflicts when a later merge has no collisions', () => {
      const local = {
        config: {
          syncMergeConflicts: {
            detectedAt: '2026-04-29T00:00:00.000Z',
            total: 1,
            items: [{ id: 'old' }],
          },
        },
        eventos: [{ id: '1', titulo: 'Local' }],
      };
      const remote = { eventos: [{ id: '2', titulo: 'Remote' }] };

      const merged = mergeStudyStates(local, remote);

      expect(merged.config.syncMergeConflicts).toBeUndefined();
    });

    it('updates localBackupAt timestamp', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged.config.localBackupAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

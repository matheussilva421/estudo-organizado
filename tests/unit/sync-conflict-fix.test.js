import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canAutoSyncFirestore } from '../../src/js/sync/sync-center.js';

describe('sync conflict fixes', () => {
  describe('canAutoSyncFirestore - entity-conflict only blocking', () => {
    it('returns false when entity-conflict exists', () => {
      expect(
        canAutoSyncFirestore({ enabled: true, mode: 'primary', conflict: { type: 'entity-conflict' } })
      ).toBe(false);
    });

    it('returns true when non-entity conflict exists (snapshot conflict allows retry)', () => {
      expect(
        canAutoSyncFirestore({ enabled: true, mode: 'primary', conflict: { type: 'diverge' } })
      ).toBe(true);
    });

    it('returns true when conflict is a stale snapshot conflict', () => {
      expect(
        canAutoSyncFirestore({
          enabled: true,
          mode: 'primary',
          conflict: { detectedAt: '2024-01-01T00:00:00Z', remoteUpdatedAt: '2024-01-01T00:00:00Z' },
        })
      ).toBe(true);
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

    it('returns true when no conflict and no pending', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'primary' })).toBe(true);
    });

    it('returns false when not enabled', () => {
      expect(canAutoSyncFirestore({ enabled: false })).toBe(false);
    });

    it('returns false when not primary mode', () => {
      expect(canAutoSyncFirestore({ enabled: true, mode: 'shadow' })).toBe(false);
    });
  });
});

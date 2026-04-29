import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('firestore-schema.js', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  describe('getFirestoreDeviceId()', () => {
    it('generates new device id when not stored', async () => {
      const { getFirestoreDeviceId } = await import('../../src/js/sync/firestore-schema.js');
      const id = getFirestoreDeviceId();
      expect(id).toMatch(/^web-[a-z0-9]{8}$/);
    });

    it('returns stored device id', async () => {
      localStorage.setItem('estudo_firestore_device_id', 'web-stored123');
      const { getFirestoreDeviceId } = await import('../../src/js/sync/firestore-schema.js');
      expect(getFirestoreDeviceId()).toBe('web-stored123');
    });
  });

  describe('toIsoTimestamp()', () => {
    it('returns current time for null input', async () => {
      const { toIsoTimestamp } = await import('../../src/js/sync/firestore-schema.js');
      const result = toIsoTimestamp(null);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('converts number to ISO string', async () => {
      const { toIsoTimestamp } = await import('../../src/js/sync/firestore-schema.js');
      const ts = 1700000000000;
      expect(toIsoTimestamp(ts)).toBe(new Date(ts).toISOString());
    });

    it('converts date string to ISO string', async () => {
      const { toIsoTimestamp } = await import('../../src/js/sync/firestore-schema.js');
      const dateStr = '2024-01-15T10:30:00Z';
      expect(toIsoTimestamp(dateStr)).toBe(new Date(dateStr).toISOString());
    });

    it('returns current time for invalid date', async () => {
      const { toIsoTimestamp } = await import('../../src/js/sync/firestore-schema.js');
      const result = toIsoTimestamp('invalid');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('getLocalContentUpdatedAt()', () => {
    it('returns null for empty state', async () => {
      const { getLocalContentUpdatedAt } = await import('../../src/js/sync/firestore-schema.js');
      expect(getLocalContentUpdatedAt({})).toBeNull();
    });

    it('returns max of _lastUpdated and localBackupAt', async () => {
      const { getLocalContentUpdatedAt } = await import('../../src/js/sync/firestore-schema.js');
      const state = {
        config: {
          _lastUpdated: '2024-01-01T00:00:00Z',
          localBackupAt: '2024-06-01T00:00:00Z',
        },
      };
      expect(getLocalContentUpdatedAt(state)).toBe('2024-06-01T00:00:00.000Z');
    });
  });

  describe('getFirestoreSyncConfig()', () => {
    it('returns empty object when config missing', async () => {
      const { getFirestoreSyncConfig } = await import('../../src/js/sync/firestore-schema.js');
      expect(getFirestoreSyncConfig({})).toEqual({});
    });

    it('returns firestoreSync config', async () => {
      const { getFirestoreSyncConfig } = await import('../../src/js/sync/firestore-schema.js');
      const state = { config: { firestoreSync: { enabled: true } } };
      expect(getFirestoreSyncConfig(state)).toEqual({ enabled: true });
    });
  });

  describe('createDefaultFirestoreSyncConfig()', () => {
    it('returns default config', async () => {
      const { createDefaultFirestoreSyncConfig } = await import('../../src/js/sync/firestore-schema.js');
      const config = createDefaultFirestoreSyncConfig();
      expect(config.enabled).toBe(false);
      expect(config.mode).toBe('shadow');
      expect(config.uid).toBeNull();
    });

    it('applies overrides', async () => {
      const { createDefaultFirestoreSyncConfig } = await import('../../src/js/sync/firestore-schema.js');
      const config = createDefaultFirestoreSyncConfig({ enabled: true, mode: 'mirror' });
      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('mirror');
    });
  });

  describe('isFirestoreSnapshotEnvelope()', () => {
    it('returns false for null', async () => {
      const { isFirestoreSnapshotEnvelope } = await import('../../src/js/sync/firestore-schema.js');
      expect(isFirestoreSnapshotEnvelope(null)).toBe(false);
    });

    it('returns false for non-object', async () => {
      const { isFirestoreSnapshotEnvelope } = await import('../../src/js/sync/firestore-schema.js');
      expect(isFirestoreSnapshotEnvelope('string')).toBe(false);
    });

    it('returns false for wrong version', async () => {
      const { isFirestoreSnapshotEnvelope } = await import('../../src/js/sync/firestore-schema.js');
      expect(isFirestoreSnapshotEnvelope({ version: 999, payload: {} })).toBe(false);
    });

    it('returns false when payload missing', async () => {
      const { isFirestoreSnapshotEnvelope } = await import('../../src/js/sync/firestore-schema.js');
      expect(isFirestoreSnapshotEnvelope({ version: 1 })).toBe(false);
    });

    it('returns true for valid envelope', async () => {
      const { isFirestoreSnapshotEnvelope } = await import('../../src/js/sync/firestore-schema.js');
      expect(isFirestoreSnapshotEnvelope({ version: 1, payload: {} })).toBe(true);
    });
  });

  describe('getEnvelopeUpdatedAt()', () => {
    it('returns payloadUpdatedAt if present', async () => {
      const { getEnvelopeUpdatedAt } = await import('../../src/js/sync/firestore-schema.js');
      expect(getEnvelopeUpdatedAt({ payloadUpdatedAt: '2024-01-01' })).toBe('2024-01-01');
    });

    it('falls back to updatedAt', async () => {
      const { getEnvelopeUpdatedAt } = await import('../../src/js/sync/firestore-schema.js');
      expect(getEnvelopeUpdatedAt({ updatedAt: '2024-01-01' })).toBe('2024-01-01');
    });

    it('returns null for empty envelope', async () => {
      const { getEnvelopeUpdatedAt } = await import('../../src/js/sync/firestore-schema.js');
      expect(getEnvelopeUpdatedAt({})).toBeNull();
    });
  });

  describe('isRemoteNewer()', () => {
    it('returns true when remote is newer', async () => {
      const { isRemoteNewer } = await import('../../src/js/sync/firestore-schema.js');
      const remote = { payloadUpdatedAt: '2024-06-01T00:00:00Z' };
      const local = { config: { _lastUpdated: '2024-01-01T00:00:00Z' } };
      expect(isRemoteNewer(remote, local)).toBe(true);
    });

    it('returns false when local is newer', async () => {
      const { isRemoteNewer } = await import('../../src/js/sync/firestore-schema.js');
      const remote = { payloadUpdatedAt: '2024-01-01T00:00:00Z' };
      const local = { config: { _lastUpdated: '2024-06-01T00:00:00Z' } };
      expect(isRemoteNewer(remote, local)).toBe(false);
    });
  });

  describe('applyEnvelopeToLocalState()', () => {
    it('throws for invalid envelope', async () => {
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js');
      expect(() => applyEnvelopeToLocalState({})).toThrow('Envelope Firestore invalido.');
    });

    it('applies envelope payload to local state', async () => {
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js');
      const envelope = {
        version: 1,
        payload: { config: {}, eventos: [{ id: '1' }] },
        payloadUpdatedAt: '2024-01-01T00:00:00Z',
      };
      const result = applyEnvelopeToLocalState(envelope);
      expect(result.eventos).toHaveLength(1);
      expect(result.config.firestoreSync.enabled).toBe(true);
      expect(result.config.localBackupAt).toBe('2024-01-01T00:00:00Z');
    });

    it('preserves previous sync config mode', async () => {
      const { applyEnvelopeToLocalState } = await import('../../src/js/sync/firestore-schema.js');
      const envelope = {
        version: 1,
        payload: { config: {} },
        payloadUpdatedAt: '2024-01-01T00:00:00Z',
      };
      const result = applyEnvelopeToLocalState(envelope, { mode: 'mirror' });
      expect(result.config.firestoreSync.mode).toBe('mirror');
    });
  });
});

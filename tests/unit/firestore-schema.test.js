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

  describe('createFirestoreSnapshotEnvelope() reta final descriptor', () => {
    const descriptor = {
      schema: 2,
      planId: 'plan-1',
      lineageId: 'plan-1',
      generation: 1,
      revision: 4,
      baseRevision: 3,
      baseRemoteUpdatedAt: '2026-10-20T11:00:00.000Z',
      digest: 'a'.repeat(32),
      deviceId: 'web-device1',
      capabilities: { schema: 2, granularMerge: true, guards: { envelope: 'rules-v2', probe: 1 } },
    };

    it('keeps version 1 and omits retaFinalSync when no descriptor is provided', async () => {
      const { createFirestoreSnapshotEnvelope } = await import(
        '../../src/js/sync/firestore-schema.js'
      );
      const envelope = createFirestoreSnapshotEnvelope({ config: {}, eventos: [] });
      expect(envelope.version).toBe(1);
      expect(envelope).not.toHaveProperty('retaFinalSync');
    });

    it('includes the supplied descriptor at the top level without changing the envelope version', async () => {
      const { createFirestoreSnapshotEnvelope } = await import(
        '../../src/js/sync/firestore-schema.js'
      );
      const envelope = createFirestoreSnapshotEnvelope(
        { config: {}, eventos: [] },
        { retaFinalSync: descriptor, deviceId: 'web-device1' }
      );
      expect(envelope.version).toBe(1);
      expect(envelope.retaFinalSync).toEqual(descriptor);
    });

    it('keeps v1 envelopes readable when the descriptor is present', async () => {
      const { createFirestoreSnapshotEnvelope, isFirestoreSnapshotEnvelope, applyEnvelopeToLocalState } =
        await import('../../src/js/sync/firestore-schema.js');
      const envelope = createFirestoreSnapshotEnvelope(
        { config: {}, eventos: [{ id: 'e1' }] },
        { retaFinalSync: descriptor }
      );
      expect(isFirestoreSnapshotEnvelope(envelope)).toBe(true);
      expect(applyEnvelopeToLocalState(envelope).eventos).toEqual([{ id: 'e1' }]);
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

describe('firestore-schema.js operational payload budget', () => {
  function largePlan() {
    return {
      ativo: true,
      tipo: 'reta_final',
      schemaVersionRetaFinal: 2,
      planId: 'rfplan_local',
      revision: 0,
      retaFinal: {
        dataFinal: '2027-02-28',
        blocos: Array.from({ length: 180 }, (_, index) => ({
          id: 'rf_' + String(index).padStart(3, '0'),
          discId: 'd' + (index % 3),
          topicos: [{ assId: 'a' + (index % 5), aulaId: null }],
          minutos: 60,
          dataPlanejada: '2026-10-26',
          ordem: index,
          notas: 'n'.repeat(120),
        })),
      },
    };
  }

  function largeConflict(plan) {
    return {
      type: 'reta-final-conflict',
      cause: 'merge-review',
      detectedAt: '2026-10-26T20:00:00.000Z',
      planId: plan.planId,
      localPlan: JSON.parse(JSON.stringify(plan)),
      remotePlan: JSON.parse(JSON.stringify(plan)),
      mergeConflicts: Array.from({ length: 30 }, () => ({ local: plan, remote: plan })),
      reason: 'conflict summary source',
    };
  }

  function largeState() {
    const plan = largePlan();
    const history = Array.from({ length: 20 }, (_, index) => ({
      at: '2026-10-26T20:' + String(index).padStart(2, '0') + ':00.000Z',
      trigger: 'test',
      firestore: 'conflict',
      conflicts: {
        firestore: index < 6 ? largeConflict(plan) : { type: 'reta-final-conflict', cause: 'small' },
      },
    }));
    return {
      schemaVersion: 12,
      planejamento: plan,
      eventos: Array.from({ length: 389 }, (_, index) => ({
        id: 'ev_' + index,
        discId: 'd' + (index % 3),
        status: 'estudei',
        tempo: 30,
        notas: 'e'.repeat(420),
      })),
      editais: Array.from({ length: 4 }, (_, index) => ({
        id: 'ed_' + index,
        nome: 'Edital ' + index,
        conteudo: 'x'.repeat(130000),
      })),
      habitos: {
        questoes: Array.from({ length: 82 }, (_, index) => ({
          id: 'q_' + index,
          total: 20,
          notas: 'q'.repeat(300),
        })),
      },
      config: {
        manualSyncHistory: history,
        lastManualSyncResults: history[history.length - 1],
        localBackupAt: '2026-10-26T20:00:00.000Z',
      },
    };
  }

  it('keeps operational history local and keeps the academic snapshot under the Firestore budget', async () => {
    const {
      createFirestoreSnapshotEnvelope,
      getFirestoreEnvelopeSizeBytes,
      FIRESTORE_ENVELOPE_MAX_BYTES,
    } = await import('../../src/js/sync/firestore-schema.js');
    const state = largeState();
    const historyReference = state.config.manualSyncHistory;
    const envelope = createFirestoreSnapshotEnvelope(state, {
      deviceId: 'web-test',
      sentAt: '2026-10-26T20:00:00.000Z',
    });

    expect(envelope.payload.config).not.toHaveProperty('manualSyncHistory');
    expect(envelope.payload.config).not.toHaveProperty('lastManualSyncResults');
    expect(envelope.payload.planejamento.retaFinal.blocos).toHaveLength(180);
    expect(envelope.payload.eventos).toHaveLength(389);
    expect(envelope.payload.editais).toHaveLength(4);
    expect(state.config.manualSyncHistory).toBe(historyReference);
    expect(getFirestoreEnvelopeSizeBytes(envelope)).toBeLessThan(
      FIRESTORE_ENVELOPE_MAX_BYTES,
    );

    const withHistory = JSON.parse(JSON.stringify(envelope));
    withHistory.payload.config.manualSyncHistory = state.config.manualSyncHistory;
    withHistory.payload.config.lastManualSyncResults =
      state.config.lastManualSyncResults;
    expect(getFirestoreEnvelopeSizeBytes(withHistory)).toBeGreaterThan(
      FIRESTORE_ENVELOPE_MAX_BYTES,
    );
  });
});

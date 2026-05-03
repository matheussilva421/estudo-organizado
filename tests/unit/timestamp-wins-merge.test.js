import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';

describe('timestamp-wins-merge (TDD - RED phase)', () => {
  let isRemoteStateNewer;
  let isEmptyState;
  let resolveConflict;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../src/js/store.js?v=8.34', () => ({
      state: createBaseState(),
      setState: vi.fn(),
      saveStateToDB: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/sync/firestore-schema.js?v=8.34', () => ({
      getEnvelopeUpdatedAt: vi.fn((env) => env?.payloadUpdatedAt),
      getLocalContentUpdatedAt: vi.fn((state) => state?.config?.localBackupAt || null),
      applyEnvelopeToLocalState: vi.fn(() => ({
        config: { localBackupAt: '2026-01-02T00:00:00.000Z' },
        eventos: [],
        editais: [],
      })),
    }));

    const module = await import('../../src/js/sync/sync-center.js?v=8.34');
    isRemoteStateNewer = module.isRemoteStateNewer;
    isEmptyState = module.isEmptyState;
    resolveConflict = module.resolveConflict;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('isEmptyState()', () => {
    it('returns true for state with only default/empty values', () => {
      const emptyState = createBaseState();
      expect(isEmptyState(emptyState)).toBe(true);
    });

    it('returns true for state with empty arrays', () => {
      const emptyState = {
        config: {},
        eventos: [],
        editais: [],
        disciplinas: [],
        arquivo: [],
        revisoes: [],
        habitos: {},
      };
      expect(isEmptyState(emptyState)).toBe(true);
    });

    it('returns false for state with eventos', () => {
      const stateWithData = createBaseState({
        eventos: [{ id: 'ev_1', titulo: 'Estudo' }],
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });

    it('returns false for state with editais', () => {
      const stateWithData = createBaseState({
        editais: [{ id: 'ed_1', nome: 'Edital PF' }],
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });

    it('returns false for state with disciplinas', () => {
      const stateWithData = createBaseState({
        disciplinas: [{ id: 'disc_1', nome: 'Portugues' }],
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });

    it('returns false for state with habitos', () => {
      const stateWithData = createBaseState({
        habitos: { questoes: [{ id: 'h_1', tipo: 'questoes' }] },
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });

    it('returns false for state with revisoes', () => {
      const stateWithData = createBaseState({
        revisoes: [{ id: 'rev_1', assunto: 'Crase' }],
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });

    it('returns false for state with arquivo', () => {
      const stateWithData = createBaseState({
        arquivo: [{ id: 'arq_1', titulo: 'Evento arquivado' }],
      });
      expect(isEmptyState(stateWithData)).toBe(false);
    });
  });

  describe('isRemoteStateNewer()', () => {
    it('returns true when remote timestamp is newer than local', () => {
      const remoteEnvelope = { payloadUpdatedAt: '2026-01-02T00:00:00.000Z' };
      const localState = { config: { localBackupAt: '2026-01-01T00:00:00.000Z' } };
      expect(isRemoteStateNewer(remoteEnvelope, localState)).toBe(true);
    });

    it('returns false when local timestamp is newer than remote', () => {
      const remoteEnvelope = { payloadUpdatedAt: '2026-01-01T00:00:00.000Z' };
      const localState = { config: { localBackupAt: '2026-01-02T00:00:00.000Z' } };
      expect(isRemoteStateNewer(remoteEnvelope, localState)).toBe(false);
    });

    it('returns false when timestamps are equal', () => {
      const remoteEnvelope = { payloadUpdatedAt: '2026-01-01T00:00:00.000Z' };
      const localState = { config: { localBackupAt: '2026-01-01T00:00:00.000Z' } };
      expect(isRemoteStateNewer(remoteEnvelope, localState)).toBe(false);
    });

    it('returns false when remote is newer BUT remote state is empty (empty-state guard)', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: createBaseState(), // empty state
      };
      const localState = createBaseState({
        eventos: [{ id: 'ev_1', titulo: 'Estudo' }],
        config: { localBackupAt: '2026-01-01T00:00:00.000Z' },
      });
      // Remote is newer but empty, should NOT be considered "newer" for merge purposes
      expect(isRemoteStateNewer(remoteEnvelope, localState)).toBe(false);
    });

    it('returns true when remote is newer AND remote has meaningful data', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: createBaseState({
          eventos: [{ id: 'remote_ev', titulo: 'Remote Study' }],
        }),
      };
      const localState = createBaseState({
        eventos: [{ id: 'local_ev', titulo: 'Local Study' }],
        config: { localBackupAt: '2026-01-01T00:00:00.000Z' },
      });
      expect(isRemoteStateNewer(remoteEnvelope, localState)).toBe(true);
    });
  });

  describe('resolveConflict()', () => {
    it('returns "remote" when remote is newer and not empty', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: createBaseState({ eventos: [{ id: 'remote_ev' }] }),
      };
      const localState = createBaseState({
        eventos: [{ id: 'local_ev' }],
        config: { localBackupAt: '2026-01-01T00:00:00.000Z' },
      });
      const result = resolveConflict(remoteEnvelope, localState);
      expect(result.decision).toBe('remote');
    });

    it('returns "local" when local is newer', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-01T00:00:00.000Z',
        payload: createBaseState({ eventos: [{ id: 'remote_ev' }] }),
      };
      const localState = createBaseState({
        eventos: [{ id: 'local_ev' }],
        config: { localBackupAt: '2026-01-02T00:00:00.000Z' },
      });
      const result = resolveConflict(remoteEnvelope, localState);
      expect(result.decision).toBe('local');
    });

    it('returns "local" when remote is newer BUT remote is empty (empty-state guard)', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: createBaseState(), // empty!
      };
      const localState = createBaseState({
        eventos: [{ id: 'local_ev', titulo: 'Important Study' }],
        config: { localBackupAt: '2026-01-01T00:00:00.000Z' },
      });
      const result = resolveConflict(remoteEnvelope, localState);
      expect(result.decision).toBe('local');
      expect(result.reason).toContain('empty');
    });

    it('returns "noop" when timestamps are equal', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-01T00:00:00.000Z',
        payload: createBaseState(),
      };
      const localState = createBaseState({
        config: { localBackupAt: '2026-01-01T00:00:00.000Z' },
      });
      const result = resolveConflict(remoteEnvelope, localState);
      expect(result.decision).toBe('noop');
    });

    it('returns "remote" when local is empty and remote has data', () => {
      const remoteEnvelope = {
        payloadUpdatedAt: '2026-01-02T00:00:00.000Z',
        payload: createBaseState({ eventos: [{ id: 'remote_ev' }] }),
      };
      const localState = createBaseState(); // empty local
      const result = resolveConflict(remoteEnvelope, localState);
      expect(result.decision).toBe('remote');
    });
  });
});

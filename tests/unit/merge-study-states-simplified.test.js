import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('merge-study-states-simplified (TDD - RED phase)', () => {
  let mergeStudyStates;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../src/js/store.js?v=8.36', () => ({
      state: {
        config: {},
        eventos: [],
        editais: [],
        disciplinas: [],
        arquivo: [],
        revisoes: [],
        habitos: {},
      },
      setState: vi.fn(),
      saveStateToDB: vi.fn(() => Promise.resolve()),
    }));

    vi.doMock('../../src/js/sync/firestore-schema.js?v=8.36', () => ({
      getEnvelopeUpdatedAt: vi.fn((env) => env?.payloadUpdatedAt),
      getLocalContentUpdatedAt: vi.fn((state) => state?.config?.localBackupAt || null),
    }));

    const module = await import('../../src/js/sync/sync-center.js?v=8.36');
    mergeStudyStates = module.mergeStudyStates;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('mergeStudyStates() - simplified ID-based merge', () => {
    it('merges two empty states without errors', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged).toBeDefined();
      expect(merged.config).toBeDefined();
    });

    it('merges arrays by ID — items in both sides keep newer', () => {
      const local = {
        eventos: [
          { id: 'ev_1', titulo: 'Local Event', updatedAt: '2026-01-02T00:00:00.000Z' },
          { id: 'ev_2', titulo: 'Local Only', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      };
      const remote = {
        eventos: [
          { id: 'ev_1', titulo: 'Remote Event', updatedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'ev_3', titulo: 'Remote Only', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      };

      const merged = mergeStudyStates(local, remote);

      expect(merged.eventos).toHaveLength(3);
      const ev1 = merged.eventos.find((e) => e.id === 'ev_1');
      expect(ev1.titulo).toBe('Local Event'); // local is newer
    });

    it('remote newer item wins in array merge', () => {
      const local = {
        eventos: [{ id: 'ev_1', titulo: 'Old Local', updatedAt: '2026-01-01T00:00:00.000Z' }],
      };
      const remote = {
        eventos: [{ id: 'ev_1', titulo: 'New Remote', updatedAt: '2026-01-02T00:00:00.000Z' }],
      };

      const merged = mergeStudyStates(local, remote);

      const ev1 = merged.eventos.find((e) => e.id === 'ev_1');
      expect(ev1.titulo).toBe('New Remote');
    });

    it('local newer item wins in array merge', () => {
      const local = {
        eventos: [{ id: 'ev_1', titulo: 'New Local', updatedAt: '2026-01-02T00:00:00.000Z' }],
      };
      const remote = {
        eventos: [{ id: 'ev_1', titulo: 'Old Remote', updatedAt: '2026-01-01T00:00:00.000Z' }],
      };

      const merged = mergeStudyStates(local, remote);

      const ev1 = merged.eventos.find((e) => e.id === 'ev_1');
      expect(ev1.titulo).toBe('New Local');
    });

    it('items only in remote are kept in merge', () => {
      const local = { eventos: [{ id: 'ev_1' }] };
      const remote = { eventos: [{ id: 'ev_2' }] };

      const merged = mergeStudyStates(local, remote);

      expect(merged.eventos).toHaveLength(2);
      expect(merged.eventos.some((e) => e.id === 'ev_1')).toBe(true);
      expect(merged.eventos.some((e) => e.id === 'ev_2')).toBe(true);
    });

    it('items only in local are kept in merge', () => {
      const local = { eventos: [{ id: 'ev_1' }, { id: 'ev_3' }] };
      const remote = { eventos: [{ id: 'ev_2' }] };

      const merged = mergeStudyStates(local, remote);

      expect(merged.eventos).toHaveLength(3);
    });

    it('merges editais arrays by ID', () => {
      const local = {
        editais: [
          { id: 'ed_1', nome: 'Local Edital', updatedAt: '2026-01-02T00:00:00.000Z' },
        ],
      };
      const remote = {
        editais: [
          { id: 'ed_1', nome: 'Remote Edital', updatedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'ed_2', nome: 'New Edital', updatedAt: '2026-01-01T00:00:00.000Z' },
        ],
      };

      const merged = mergeStudyStates(local, remote);

      expect(merged.editais).toHaveLength(2);
      const ed1 = merged.editais.find((e) => e.id === 'ed_1');
      expect(ed1.nome).toBe('Local Edital');
    });

    it('merges config — local overrides remote', () => {
      const local = { config: { theme: 'dark', metaSemanal: 40 } };
      const remote = { config: { theme: 'light', metaSemanal: 30, otherKey: 'value' } };

      const merged = mergeStudyStates(local, remote);

      expect(merged.config.theme).toBe('dark');
      expect(merged.config.metaSemanal).toBe(40);
      expect(merged.config.otherKey).toBe('value');
    });

    it('handles missing arrays in one state', () => {
      const local = { eventos: [{ id: 'ev_1' }] };
      const remote = {};

      const merged = mergeStudyStates(local, remote);

      expect(merged.eventos).toHaveLength(1);
    });

    it('handles empty/undefined arrays without errors', () => {
      const local = { eventos: undefined };
      const remote = { eventos: null };

      expect(() => mergeStudyStates(local, remote)).not.toThrow();
    });

    it('updates localBackupAt timestamp after merge', () => {
      const merged = mergeStudyStates({}, {});
      expect(merged.config.localBackupAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('merges habitos by type', () => {
      const local = { habitos: { questoes: [{ id: 'h_1', updatedAt: '2026-01-02T00:00:00.000Z' }] } };
      const remote = { habitos: { questoes: [{ id: 'h_2', updatedAt: '2026-01-01T00:00:00.000Z' }] } };

      const merged = mergeStudyStates(local, remote);

      expect(merged.habitos.questoes).toHaveLength(2);
    });

    it('handles missing habitos in one state', () => {
      const local = { habitos: { questoes: [{ id: 'h_1' }] } };
      const remote = {};

      const merged = mergeStudyStates(local, remote);

      expect(merged.habitos.questoes).toHaveLength(1);
    });
  });
});

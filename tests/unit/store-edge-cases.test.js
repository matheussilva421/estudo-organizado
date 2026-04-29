import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseState } from '../helpers/state-builders.js';
import { loadAppModules } from '../helpers/module-loader.js';

let store;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  global.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  global.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  ({ store } = await loadAppModules());
  store.setState(createBaseState());
});

describe('store.js - edge cases', () => {
  describe('setState with extreme values', () => {
    it('handles very large state object', () => {
      const largeEventos = Array.from({ length: 10000 }, (_, i) => ({
        id: `ev_${i}`,
        titulo: `Event ${i}`,
        data: '2026-04-20',
        status: 'agendado',
      }));

      store.setState(createBaseState({ eventos: largeEventos }));
      expect(store.state.eventos).toHaveLength(10000);
    });

    it('handles deeply nested config', () => {
      store.setState(createBaseState({
        config: {
          nested: { deep: { very: { value: 'test' } } },
        },
      }));

      expect(store.state.config.nested.deep.very.value).toBe('test');
    });

    it('handles null values in state', () => {
      store.setState(createBaseState({
        eventos: null,
        editais: null,
        config: null,
      }));

      expect(store.state.eventos).toEqual([]);
      expect(store.state.editais).toEqual([]);
    });

    it('handles undefined values in state', () => {
      store.setState(createBaseState({
        eventos: undefined,
        editais: undefined,
      }));

      expect(store.state.eventos).toEqual([]);
      expect(store.state.editais).toEqual([]);
    });
  });

  describe('scheduleSave edge cases', () => {
    it('debounces multiple rapid saves', () => {
      store.scheduleSave();
      store.scheduleSave();
      store.scheduleSave();

      vi.advanceTimersByTime(2000);
    });

    it('handles save with empty state', () => {
      store.setState({});
      store.scheduleSave();

      vi.advanceTimersByTime(2000);
    });
  });

  describe('createExportableState edge cases', () => {
    it('handles state with circular references gracefully', () => {
      const stateWithRef = createBaseState();
      stateWithRef.config.selfRef = stateWithRef.config;
      store.setState(stateWithRef);

      expect(() => store.createExportableState()).not.toThrow();
    });

    it('strips all sync-related fields', () => {
      store.setState(createBaseState({
        config: {
          cfUrl: 'https://example.com',
          cfToken: 'secret',
          cfTokenSaved: true,
          cfConflict: {},
          cfRemoteUpdatedAt: '2026-01-01',
          cfLastSyncAt: '2026-01-01',
          _lastUpdated: Date.now(),
          entityTombstones: [],
        },
      }));

      const exportable = store.createExportableState();
      expect(exportable.config.cfUrl).toBeUndefined();
      expect(exportable.config.cfToken).toBeUndefined();
      expect(exportable.config.cfTokenSaved).toBeUndefined();
      expect(exportable.config.cfConflict).toBeUndefined();
    });
  });

  describe('clearData edge cases', () => {
    it('clears all state data', () => {
      store.setState(createBaseState({
        eventos: [{ id: 'ev_1' }],
        editais: [{ id: 'ed_1' }],
      }));

      store.clearData();

      expect(store.state.eventos).toEqual([]);
      expect(store.state.editais).toEqual([]);
    });
  });

  describe('state mutations', () => {
    it('replaces state when setState is called', () => {
      store.setState(createBaseState({
        eventos: [{ id: 'ev_1' }],
        config: { visualizacao: 'semana' },
      }));

      store.setState(createBaseState({ config: { visualizacao: 'mes' } }));

      expect(store.state.config.visualizacao).toBe('mes');
    });
  });
});

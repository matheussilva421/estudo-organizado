import { beforeEach, describe, expect, it, vi } from 'vitest';

let search;
let store;

function createMockState(overrides = {}) {
  return {
    eventos: [],
    editais: [],
    habitos: {
      questoes: [], revisao: [], discursiva: [], simulado: [],
      leitura: [], informativo: [], sumula: [], videoaula: [], paginas: [],
    },
    config: {},
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  const elements = {};
  global.document = {
    getElementById: vi.fn((id) => {
      if (!elements[id]) {
        elements[id] = {
          id,
          classList: { add: vi.fn(), remove: vi.fn() },
          setAttribute: vi.fn(),
          value: '',
          innerHTML: '',
        };
      }
      return elements[id];
    }),
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const modules = await import('../../src/js/store.js?v=8.29');
  store = modules;
  store.setState(createMockState());

  search = await import('../../src/js/ui/search.js?v=8.29');
});

describe('search.js', () => {
  describe('onSearch', () => {
    it('closes results when query is too short', () => {
      search.onSearch('a');
      const box = global.document.getElementById('search-results');
      expect(box.classList.remove).toHaveBeenCalledWith('open');
    });

    it('closes results when query is empty', () => {
      search.onSearch('');
      const box = global.document.getElementById('search-results');
      expect(box.classList.remove).toHaveBeenCalledWith('open');
    });

    it('shows empty message when no results', () => {
      search.onSearch('nonexistent');
      const box = global.document.getElementById('search-results');
      expect(box.innerHTML).toContain('Nenhum resultado');
    });
  });

  describe('clearSearch', () => {
    it('clears input value', () => {
      const input = global.document.getElementById('global-search');
      input.value = 'test';
      search.clearSearch();
      expect(input.value).toBe('');
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

let search;
let store;

function createMockState(overrides = {}) {
  return {
    eventos: [],
    editais: [],
    habitos: {
      questoes: [],
      revisao: [],
      discursiva: [],
      simulado: [],
      leitura: [],
      informativo: [],
      sumula: [],
      videoaula: [],
      paginas: [],
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
          classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
          setAttribute: vi.fn(),
          contains: vi.fn(() => false),
          value: '',
          innerHTML: '',
        };
      }
      return elements[id];
    }),
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    body: { style: {} },
  };

  const modules = await import('../../src/js/store.js?v=8.37');
  store = modules;
  store.setState(createMockState());

  search = await import('../../src/js/ui/search.js?v=8.37');
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

    it('escapa nome e ícone da disciplina nos resultados (sem HTML cru)', () => {
      store.setState(
        createMockState({
          editais: [
            {
              id: 'ed1',
              nome: 'Edital A',
              disciplinas: [
                {
                  id: 'd1',
                  nome: 'Matemática <img src=x onerror=alert(1)>',
                  icone: '<img src=y>',
                  assuntos: [],
                },
              ],
            },
          ],
          eventos: [{ id: 'e1', titulo: 'Estudar matemática', data: '2026-04-29', discId: 'd1' }],
        })
      );

      search.onSearch('matemática');

      const box = global.document.getElementById('search-results');
      expect(box.innerHTML).not.toContain('<img');
    });

    it('does not throw for long queries with regex metacharacters', () => {
      const query = `${'a'.repeat(101)}[`;
      store.setState(
        createMockState({
          eventos: [{ id: 'ev_regex', titulo: query, data: '2026-04-29' }],
        })
      );

      expect(() => search.onSearch(query)).not.toThrow();
    });
  });

  describe('clearSearch', () => {
    it('clears input value', () => {
      const input = global.document.getElementById('global-search');
      input.value = 'test';
      search.clearSearch();
      expect(input.value).toBe('');
    });

    it('descarta o markup de resultados antigos', () => {
      const box = global.document.getElementById('search-results');
      box.innerHTML = '<button class="search-item">resultado antigo</button>';
      search.clearSearch();
      expect(box.innerHTML).toBe('');
    });
  });

  describe('Escape sobre modal-confirm', () => {
    it('cancela a confirmação (limpa o callback) em vez de só fechar', async () => {
      const app = await import('../../src/js/app.js?v=8.37');
      app.showConfirm('Tem certeza?', vi.fn());
      expect(app._confirmCallback).not.toBeNull();

      // Escape com o modal-confirm como overlay aberto no topo
      global.document.querySelectorAll = vi.fn(() => [{ id: 'modal-confirm' }]);
      const keydown = global.document.addEventListener.mock.calls.find(
        (c) => c[0] === 'keydown'
      )[1];
      keydown({ key: 'Escape', target: { tagName: 'DIV' }, preventDefault: vi.fn() });

      expect(app._confirmCallback).toBeNull();
    });
  });
});

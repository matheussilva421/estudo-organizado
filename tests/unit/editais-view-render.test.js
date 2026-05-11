import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views/editais-view.js - render functions', () => {
  let storeModule;
  let editaisView;

  beforeEach(async () => {
    vi.resetModules();
    storeModule = {
      state: {
        config: {},
        editais: [],
        disciplinas: [],
        eventos: [],
      },
      scheduleSave: vi.fn(),
    };

    vi.doMock('../../src/js/store.js?v=8.37', () => storeModule);
    vi.doMock('../../src/js/app.js?v=8.37', () => ({
      showToast: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      showConfirm: vi.fn((msg, cb) => cb()),
    }));
    vi.doMock('../../src/js/components.js?v=8.37', () => ({ renderCurrentView: vi.fn() }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getDisciplinaById: vi.fn(),
      invalidateDiscCache: vi.fn(),
      calculateContentProgress: vi.fn((discOrDiscs) => {
        const discs = Array.isArray(discOrDiscs) ? discOrDiscs : [discOrDiscs].filter(Boolean);
        const topics = discs.flatMap((disc) => disc.assuntos || []);
        const lessons = discs.flatMap((disc) => disc.aulas || []);
        const make = (done, total) => ({ done, total, pct: total ? Math.round((done / total) * 100) : 0 });
        const topicAxis = make(topics.filter((item) => item.concluido).length, topics.length);
        const lessonAxis = make(lessons.filter((item) => item.estudada).length, lessons.length);
        return {
          topics: topicAxis,
          lessons: lessonAxis,
          overall: make(topicAxis.done + lessonAxis.done, topicAxis.total + lessonAxis.total),
        };
      }),
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
      addCleanupListener: vi.fn(),
      normalizeSearch: vi.fn((s) => String(s || '').toLowerCase()),
    }));
    vi.doMock('../../src/js/state/dashboard-context.js?v=8.37', () => ({
      getActiveDashboardDiscCtx: vi.fn(() => null),
    }));
    vi.doMock('../../src/js/ui/event-modals.js?v=8.37', () => ({
      openAddEventModal: vi.fn(),
      loadAssuntos: vi.fn(),
    }));

    editaisView = await import('../../src/js/views/editais-view.js?v=8.37');
  });

  describe('renderVertical()', () => {
    it('renders toolbar with search input', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderVertical(el);
      expect(el.innerHTML).toContain('vertical-toolbar');
      expect(el.innerHTML).toContain('vert-search');
    });

    it('renders edital filter dropdown', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [
        { id: 'ed_1', nome: 'Edital A', disciplinas: [] },
        { id: 'ed_2', nome: 'Edital B', disciplinas: [] },
      ];
      editaisView.renderVertical(el);
      expect(el.innerHTML).toContain('Todos os editais');
      expect(el.innerHTML).toContain('Edital A');
      expect(el.innerHTML).toContain('Edital B');
    });

    it('renders status filter chips', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderVertical(el);
      expect(el.innerHTML).toContain('Todos');
      expect(el.innerHTML).toContain('Pendentes');
      expect(el.innerHTML).toContain('Concluídos');
    });

    it('renders list container', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderVertical(el);
      expect(el.innerHTML).toContain('vert-list-container');
    });
  });

  describe('renderVerticalList()', () => {
    it('shows empty state when no editais', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML).toContain('Nenhum edital cadastrado');
    });

    it('shows no results when filters match nothing', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [],
            },
          ],
        },
      ];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML).toContain('Nenhum assunto encontrado');
    });

    it('renders progress card with stats', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [
                { id: 'ass_1', nome: 'Constitucional', concluido: true },
                { id: 'ass_2', nome: 'Civil', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML).toContain('PROGRESSO NO EDITAL');
      expect(container.innerHTML).toContain('50%');
    });

    it('groups items by discipline', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [
                { id: 'ass_1', nome: 'Constitucional', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('highlights search terms', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito Constitucional',
              arquivada: false,
              assuntos: [
                { id: 'ass_1', nome: 'Artigo 5', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.setVertSearch('direito');
      editaisView.renderVerticalList(container);
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders discipline progress bar', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [
                { id: 'ass_1', nome: 'Constitucional', concluido: true },
                { id: 'ass_2', nome: 'Civil', concluido: true },
                { id: 'ass_3', nome: 'Penal', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML).toContain('progress-track');
    });

    it('renders discipline name in list', () => {
      const container = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [
                { id: 'ass_1', nome: 'Constitucional', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.renderVerticalList(container);
      expect(container.innerHTML).toContain('Direito');
    });

    it('handles null container gracefully', () => {
      expect(() => editaisView.renderVerticalList(null)).not.toThrow();
    });
  });

  describe('renderEditais()', () => {
    it('renders editais view with header', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderEditais(el);
      expect(el.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders edital tree for each edital', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Concurso TRF',
          cor: '#ff0000',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              cor: '#00ff00',
              icone: '📚',
              arquivada: false,
              assuntos: [{ id: 'ass_1', nome: 'Constitucional', concluido: false }],
            },
          ],
        },
      ];
      editaisView.renderEditais(el);
      expect(el.innerHTML).toContain('Concurso TRF');
    });

    it('shows empty state when no editais', () => {
      const el = { innerHTML: '' };
      storeModule.state.editais = [];
      editaisView.renderEditais(el);
      expect(el.innerHTML).toContain('empty-state');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('views/editais-view.js', () => {
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
    }));
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: vi.fn((s) => s || ''),
      todayStr: vi.fn(() => '2026-04-29'),
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

  describe('state getters/setters', () => {
    it('getVertSearch returns default empty string', () => {
      expect(editaisView.getVertSearch()).toBe('');
    });

    it('setVertSearch updates search value', () => {
      editaisView.setVertSearch('direito');
      expect(editaisView.getVertSearch()).toBe('direito');
    });

    it('getVertFilterStatus returns default', () => {
      expect(editaisView.getVertFilterStatus()).toBe('todos');
    });

    it('setVertFilterStatus updates filter', () => {
      editaisView.setVertFilterStatus('ativas');
      expect(editaisView.getVertFilterStatus()).toBe('ativas');
    });

    it('getVertFilterEdital returns default empty string', () => {
      expect(editaisView.getVertFilterEdital()).toBe('');
    });

    it('setVertFilterEdital updates edital filter', () => {
      editaisView.setVertFilterEdital('ed_1');
      expect(editaisView.getVertFilterEdital()).toBe('ed_1');
    });

    it('getDiscFilterStatus returns default', () => {
      expect(editaisView.getDiscFilterStatus()).toBe('ativas');
    });

    it('setDiscFilterStatus updates disc filter', () => {
      editaisView.setDiscFilterStatus('arquivadas');
      expect(editaisView.getDiscFilterStatus()).toBe('arquivadas');
    });
  });

  describe('getFilteredVertItems()', () => {
    it('returns empty array when no editais', () => {
      storeModule.state.editais = [];
      const result = editaisView.getFilteredVertItems();
      expect(result).toEqual([]);
    });

    it('returns assuntos from editais', () => {
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
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(1);
      expect(result[0].ass.nome).toBe('Constitucional');
    });

    it('filters out archived disciplines', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: true,
              assuntos: [
                { id: 'ass_1', nome: 'Constitucional', concluido: false },
              ],
            },
          ],
        },
      ];
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(0);
    });

    it('filters by pending status', () => {
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
                { id: 'ass_2', nome: 'Civil', concluido: true },
              ],
            },
          ],
        },
      ];
      editaisView.setVertFilterStatus('pendentes');
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(1);
      expect(result[0].ass.id).toBe('ass_1');
    });

    it('filters by completed status', () => {
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
                { id: 'ass_2', nome: 'Civil', concluido: true },
              ],
            },
          ],
        },
      ];
      editaisView.setVertFilterStatus('concluidos');
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(1);
      expect(result[0].ass.id).toBe('ass_2');
    });

    it('filters by search term', () => {
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
                { id: 'ass_2', nome: 'Matemática', concluido: false },
              ],
            },
          ],
        },
      ];
      editaisView.setVertSearch('direito');
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(2);
    });

    it('filters by edital', () => {
      storeModule.state.editais = [
        {
          id: 'ed_1',
          nome: 'Edital A',
          disciplinas: [
            {
              id: 'disc_1',
              nome: 'Direito',
              arquivada: false,
              assuntos: [{ id: 'ass_1', nome: 'Constitucional', concluido: false }],
            },
          ],
        },
        {
          id: 'ed_2',
          nome: 'Edital B',
          disciplinas: [
            {
              id: 'disc_2',
              nome: 'Matemática',
              arquivada: false,
              assuntos: [{ id: 'ass_2', nome: 'Álgebra', concluido: false }],
            },
          ],
        },
      ];
      editaisView.setVertFilterEdital('ed_1');
      const result = editaisView.getFilteredVertItems();
      expect(result.length).toBe(1);
      expect(result[0].edital.id).toBe('ed_1');
    });
  });

  describe('toggleVertDisc()', () => {
    it('returns early when DOM elements not found', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      expect(() => editaisView.toggleVertDisc('disc_1')).not.toThrow();
    });

    it('toggles display when elements exist', () => {
      const body = { style: { display: 'none' } };
      const icon = { classList: { remove: vi.fn(), add: vi.fn() } };
      vi.spyOn(document, 'getElementById')
        .mockReturnValueOnce(body)
        .mockReturnValueOnce(icon);
      editaisView.toggleVertDisc('disc_1');
      expect(body.style.display).toBe('block');
      expect(icon.classList.add).toHaveBeenCalledWith('fa-chevron-up');
    });
  });
});

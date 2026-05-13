import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies used by step-renderers
vi.mock('../../src/js/utils.js?v=8.37', () => ({
  esc: (s) => String(s),
}));

vi.mock('../../src/js/logic.js?v=8.37', () => ({
  getActiveDisciplinas: vi.fn().mockReturnValue([]),
}));

describe('planejamento/step-renderers.js', () => {
  let module;
  let logic;

  function createDraft(overrides = {}) {
    const base = {
      tipo: null,
      disciplinas: [],
      relevancia: {},
      horarios: {
        horasSemanais: '',
        sessaoMin: 30,
        sessaoMax: 120,
        dataInicial: '',
        dataFinal: '',
        diasAtivos: [],
        horasPorDia: { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '' },
      },
    };
    return { ...base, ...overrides };
  }

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock the dependencies after reset
    vi.doMock('../../src/js/utils.js?v=8.37', () => ({
      esc: (s) => String(s),
    }));
    vi.doMock('../../src/js/logic.js?v=8.37', () => ({
      getActiveDisciplinas: vi.fn().mockReturnValue([]),
    }));

    module = await import('../../src/js/planejamento/step-renderers.js');
    logic = await import('../../src/js/logic.js?v=8.37');
  });

  describe('module exports', () => {
    const expectedExports = [
      'htmlStep1',
      'htmlStep2',
      'htmlStep3',
      'htmlStep4',
      'pwRenderWeightPreview',
      'getDisciplinasByEditalId',
      'getEditalGroupId',
      'groupDisciplinasByEdital',
    ];

    expectedExports.forEach((name) => {
      it(`exports ${name} as a function`, () => {
        expect(module[name]).toBeTypeOf('function');
      });
    });
  });

  describe('htmlStep1()', () => {
    it('returns HTML with strategy question', () => {
      const draft = createDraft();
      const html = module.htmlStep1(draft);
      expect(html).toContain('Qual é a sua estratégia de estudo?');
    });

    it('highlights selected tipo (ciclo)', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      const html = module.htmlStep1(draft);
      expect(html).toContain('data-tipo="ciclo"');
      expect(html).toContain('is-selected');
    });

    it('highlights selected tipo (semanal)', () => {
      const draft = createDraft({ tipo: 'semanal' });
      const html = module.htmlStep1(draft);
      expect(html).toContain('data-tipo="semanal"');
      expect(html).toContain('is-selected');
    });

    it('renders both options always', () => {
      const html = module.htmlStep1(createDraft());
      expect(html).toContain('Ciclo de Estudos');
      expect(html).toContain('Grade Semanal Fixa');
    });

    it('has data-action="pw-select-tipo" on option cards', () => {
      const html = module.htmlStep1(createDraft());
      const matches = html.match(/data-action="pw-select-tipo"/g);
      expect(matches).toHaveLength(2);
    });
  });

  describe('htmlStep2()', () => {
    it('returns empty state when no disciplinas exist', () => {
      logic.getActiveDisciplinas.mockReturnValue([]);
      const html = module.htmlStep2(createDraft());
      expect(html).toContain('Nenhuma disciplina encontrada');
    });

    it('returns search bar and edital groups when disciplinas exist', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Matemática' }, edital: { id: 'e1', nome: 'TRF', cor: '#0f0' } },
      ]);
      const html = module.htmlStep2(createDraft({ disciplinas: ['d1'] }));
      expect(html).toContain('data-action="pw-search-disc"');
      expect(html).toContain('pw-edital-group');
      expect(html).toContain('1 disciplinas selecionadas');
    });

    it('shows "Todas" and "Nenhuma" buttons', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Matemática' }, edital: {} },
      ]);
      const html = module.htmlStep2(createDraft());
      expect(html).toContain('data-action="pw-select-all-disc"');
      expect(html).toContain('data-action="pw-clear-disc"');
    });

    it('renders edital groups with correct structure', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Direito', icone: '⚖️' }, edital: { id: 'ed_1', nome: 'TCE', cor: '#0f766e' } },
        { disc: { id: 'd2', nome: 'Civil', icone: '📚' }, edital: { id: 'ed_2', nome: 'PGE', cor: '#1d4ed8' } },
      ]);
      const html = module.htmlStep2(createDraft({ disciplinas: ['d1'] }));
      expect(html).toContain('data-edital-id="ed_1"');
      expect(html).toContain('data-edital-id="ed_2"');
      expect(html).toContain('TCE');
      expect(html).toContain('PGE');
      expect(html).toContain('1/1 disciplinas selecionadas'); // d1 selected in ed_1
    });
  });

  describe('htmlStep3()', () => {
    it('renders relevance sliders for selected disciplinas', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Matemática', icone: '📐' }, edital: { cor: '#0f0' } },
        { disc: { id: 'd2', nome: 'Português', icone: '📖' }, edital: { cor: '#00f' } },
      ]);
      const draft = createDraft({
        disciplinas: ['d1', 'd2'],
        relevancia: {
          d1: { importancia: 4, conhecimento: 2 },
          d2: { importancia: 3, conhecimento: 3 },
        },
      });
      const html = module.htmlStep3(draft);
      expect(html).toContain('Matemática');
      expect(html).toContain('Português');
      expect(html).toContain('pw-update-relevancia');
      expect(html).toContain('Importância');
      expect(html).toContain('Conhecimento');
    });

    it('only renders selected disciplinas (filters out unselected)', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Matemática' }, edital: {} },
        { disc: { id: 'd2', nome: 'Português' }, edital: {} },
      ]);
      const draft = createDraft({ disciplinas: ['d1'] });
      const html = module.htmlStep3(draft);
      expect(html).toContain('Matemática');
      expect(html).not.toContain('Português');
    });

    it('includes weight preview container', () => {
      logic.getActiveDisciplinas.mockReturnValue([]);
      const html = module.htmlStep3(createDraft());
      expect(html).toContain('pw-weight-preview');
    });
  });

  describe('htmlStep4()', () => {
    it('renders session min/max and date fields', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      const html = module.htmlStep4(draft);
      expect(html).toContain('Sessão Mínima');
      expect(html).toContain('Sessão Máxima');
      expect(html).toContain('data-action="pw-update-hours"');
    });

    it('renders ciclo-specific fields when tipo is ciclo', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      const html = module.htmlStep4(draft);
      expect(html).toContain('Meta do Ciclo');
      expect(html).toContain('horasSemanais');
      expect(html).toContain('data-action="pw-toggle-day"');
    });

    it('renders semanal-specific fields when tipo is semanal', () => {
      const draft = createDraft({ tipo: 'semanal' });
      const html = module.htmlStep4(draft);
      expect(html).toContain('Agenda Semanal');
      expect(html).toContain('data-action="pw-update-day-hour"');
      expect(html).toContain('type="checkbox"');
    });

    it('renders day names (Dom-Sáb)', () => {
      const html = module.htmlStep4(createDraft({ tipo: 'ciclo' }));
      expect(html).toContain('Dom');
      expect(html).toContain('Seg');
      expect(html).toContain('Sáb');
    });

    it('shows selected days as active', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      draft.horarios.diasAtivos = [1, 5]; // Seg, Sex
      const html = module.htmlStep4(draft);
      // Days with indices 1 and 5 should have is-selected class
      expect(html).toContain('is-selected');
    });

    it('shows date values from draft', () => {
      const draft = createDraft({
        tipo: 'ciclo',
        horarios: {
          dataInicial: '2026-01-01',
          dataFinal: '2026-12-31',
          sessaoMin: 45,
          sessaoMax: 90,
          diasAtivos: [],
        },
      });
      const html = module.htmlStep4(draft);
      expect(html).toContain('2026-01-01');
      expect(html).toContain('2026-12-31');
      expect(html).toContain('45');
      expect(html).toContain('90');
    });
  });

  describe('pwRenderWeightPreview()', () => {
    it('returns early if element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => {
        module.pwRenderWeightPreview(createDraft());
      }).not.toThrow();
    });

    it('renders weight bars for selected disciplinas', () => {
      document.body.innerHTML = '<div id="pw-weight-preview"></div>';
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Matemática' }, edital: { cor: '#0f766e' } },
      ]);
      const draft = createDraft({
        disciplinas: ['d1'],
        relevancia: { d1: { importancia: 5, conhecimento: 1 } },
      });
      module.pwRenderWeightPreview(draft);
      const el = document.getElementById('pw-weight-preview');
      expect(el.innerHTML).toContain('Matemática');
    });

    it('calculates percentage based on weight', () => {
      document.body.innerHTML = '<div id="pw-weight-preview"></div>';
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'A' }, edital: { cor: '#f00' } },
        { disc: { id: 'd2', nome: 'B' }, edital: { cor: '#0f0' } },
      ]);
      const draft = createDraft({
        disciplinas: ['d1', 'd2'],
        relevancia: {
          d1: { importancia: 5, conhecimento: 1 }, // peso = 5 * 5 = 25
          d2: { importancia: 5, conhecimento: 1 }, // peso = 5 * 5 = 25 → 50% each
        },
      });
      module.pwRenderWeightPreview(draft);
      const el = document.getElementById('pw-weight-preview');
      expect(el.innerHTML).toContain('50.0%');
    });

    it('sorts by weight descending (highest first)', () => {
      document.body.innerHTML = '<div id="pw-weight-preview"></div>';
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1', nome: 'Baixa' }, edital: { cor: '#ccc' } },
        { disc: { id: 'd2', nome: 'Alta' }, edital: { cor: '#f00' } },
      ]);
      const draft = createDraft({
        disciplinas: ['d1', 'd2'],
        relevancia: {
          d1: { importancia: 1, conhecimento: 5 }, // peso = 1 * 1 = 1
          d2: { importancia: 5, conhecimento: 1 }, // peso = 5 * 5 = 25
        },
      });
      module.pwRenderWeightPreview(draft);
      const el = document.getElementById('pw-weight-preview');
      const altaIndex = el.innerHTML.indexOf('Alta');
      const baixaIndex = el.innerHTML.indexOf('Baixa');
      expect(altaIndex).toBeLessThan(baixaIndex);
    });

    it('handles empty disciplina list', () => {
      document.body.innerHTML = '<div id="pw-weight-preview"></div>';
      logic.getActiveDisciplinas.mockReturnValue([]);
      const draft = createDraft();
      module.pwRenderWeightPreview(draft);
      const el = document.getElementById('pw-weight-preview');
      expect(el.innerHTML).toBe('');
    });
  });

  describe('getDisciplinasByEditalId()', () => {
    it('filters disciplinas by edital id', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1' }, edital: { id: 'e1' } },
        { disc: { id: 'd2' }, edital: { id: 'e2' } },
        { disc: { id: 'd3' }, edital: { id: 'e1' } },
      ]);
      const result = module.getDisciplinasByEditalId('e1');
      expect(result).toHaveLength(2);
      expect(result[0].disc.id).toBe('d1');
      expect(result[1].disc.id).toBe('d3');
    });

    it('returns empty array when edital has no disciplinas', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1' }, edital: { id: 'e1' } },
      ]);
      const result = module.getDisciplinasByEditalId('e_nonexistent');
      expect(result).toHaveLength(0);
    });

    it('matches by edital nome when id is absent', () => {
      logic.getActiveDisciplinas.mockReturnValue([
        { disc: { id: 'd1' }, edital: { nome: 'TRF' } },
      ]);
      const result = module.getDisciplinasByEditalId('TRF');
      expect(result).toHaveLength(1);
    });
  });

  describe('getEditalGroupId()', () => {
    it('returns edital id when present', () => {
      expect(module.getEditalGroupId({ edital: { id: 'e1', nome: 'TRF' } })).toBe('e1');
    });

    it('falls back to nome when id is absent', () => {
      expect(module.getEditalGroupId({ edital: { nome: 'TRF' } })).toBe('TRF');
    });

    it('returns "sem-edital" when no edital information', () => {
      expect(module.getEditalGroupId({})).toBe('sem-edital');
      expect(module.getEditalGroupId({ edital: {} })).toBe('sem-edital');
    });
  });

  describe('groupDisciplinasByEdital()', () => {
    it('groups multiple disciplinas under same edital', () => {
      const items = [
        { disc: { id: 'd1' }, edital: { id: 'e1', nome: 'TRF' } },
        { disc: { id: 'd2' }, edital: { id: 'e1', nome: 'TRF' } },
      ];
      const groups = module.groupDisciplinasByEdital(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('e1');
      expect(groups[0].disciplinas).toHaveLength(2);
    });

    it('creates separate groups for different editais', () => {
      const items = [
        { disc: { id: 'd1' }, edital: { id: 'e1', nome: 'TRF' } },
        { disc: { id: 'd2' }, edital: { id: 'e2', nome: 'PGE' } },
      ];
      const groups = module.groupDisciplinasByEdital(items);
      expect(groups).toHaveLength(2);
    });

    it('handles items without edital', () => {
      const items = [
        { disc: { id: 'd1' }, edital: {} },
        { disc: { id: 'd2' }, edital: {} },
      ];
      const groups = module.groupDisciplinasByEdital(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('sem-edital');
      expect(groups[0].disciplinas).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(module.groupDisciplinasByEdital([])).toHaveLength(0);
    });

    it('preserves edital metadata in group', () => {
      const items = [
        { disc: { id: 'd1' }, edital: { id: 'e1', nome: 'TRF', cor: '#0f0' } },
      ];
      const groups = module.groupDisciplinasByEdital(items);
      expect(groups[0].edital.nome).toBe('TRF');
      expect(groups[0].edital.cor).toBe('#0f0');
    });
  });
});

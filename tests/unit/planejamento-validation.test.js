import { describe, it, expect, vi } from 'vitest';

describe('planejamento/validation.js', () => {
  let validateStep;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/js/planejamento/validation.js');
    validateStep = mod.validateStep;
  });

  describe('module exports', () => {
    it('exports validateStep as a function', () => {
      expect(validateStep).toBeTypeOf('function');
    });
  });

  describe('step 1 — tipo selection', () => {
    it('returns false when tipo is null', () => {
      const draft = createDraft();
      expect(validateStep(1, draft)).toBe(false);
    });

    it('returns true when tipo is "ciclo"', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      expect(validateStep(1, draft)).toBe(true);
    });

    it('returns true when tipo is "semanal"', () => {
      const draft = createDraft({ tipo: 'semanal' });
      expect(validateStep(1, draft)).toBe(true);
    });

    it('returns false for unknown step numbers', () => {
      expect(validateStep(99, createDraft())).toBe(false);
    });
  });

  describe('step 2 — disciplina selection', () => {
    it('returns false when no disciplinas selected', () => {
      const draft = createDraft();
      expect(validateStep(2, draft)).toBe(false);
    });

    it('returns true when at least one disciplina is selected', () => {
      const draft = createDraft({ disciplinas: ['disc_1'] });
      expect(validateStep(2, draft)).toBe(true);
    });

    it('returns true when disciplinas array has items', () => {
      const draft = createDraft({ disciplinas: ['d1', 'd2'] });
      expect(validateStep(2, draft)).toBe(true);
    });
  });

  describe('step 3 — relevance sliders', () => {
    it('always returns true (sliders always have values)', () => {
      expect(validateStep(3, createDraft())).toBe(true);
      expect(validateStep(3, createDraft({ tipo: 'ciclo', disciplinas: ['d1'] }))).toBe(true);
    });
  });

  describe('step 4 — time configuration', () => {
    it('returns false when sessaoMin < 1', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      draft.horarios.sessaoMin = 0;
      expect(validateStep(4, draft)).toBe(false);
    });

    it('returns false when sessaoMax < sessaoMin', () => {
      const draft = createDraft({ tipo: 'ciclo' });
      draft.horarios.sessaoMin = 60;
      draft.horarios.sessaoMax = 30;
      expect(validateStep(4, draft)).toBe(false);
    });

    it('returns true when sessaoMin <= sessaoMax and both positive', () => {
      const draft = createDraft({ tipo: 'ciclo', horarios: { horasSemanais: '20' } });
      draft.horarios.sessaoMin = 30;
      draft.horarios.sessaoMax = 120;
      expect(validateStep(4, draft)).toBe(true);
    });

    describe('tipo "ciclo"', () => {
      it('returns false when horasSemanais is 0 or empty', () => {
        const draft = createDraft({ tipo: 'ciclo' });
        draft.horarios.horasSemanais = '';
        expect(validateStep(4, draft)).toBe(false);
        draft.horarios.horasSemanais = '0';
        expect(validateStep(4, draft)).toBe(false);
      });

      it('returns true when horasSemanais > 0', () => {
        const draft = createDraft({ tipo: 'ciclo', horarios: { horasSemanais: '30' } });
        expect(validateStep(4, draft)).toBe(true);
      });

      it('accepts float horasSemanais', () => {
        const draft = createDraft({ tipo: 'ciclo', horarios: { horasSemanais: '15.5' } });
        expect(validateStep(4, draft)).toBe(true);
      });
    });

    describe('tipo "semanal"', () => {
      it('returns false when no days are active', () => {
        const draft = createDraft({ tipo: 'semanal' });
        draft.horarios.diasAtivos = [];
        expect(validateStep(4, draft)).toBe(false);
      });

      it('returns false when active days exist but no hours assigned', () => {
        const draft = createDraft({ tipo: 'semanal' });
        draft.horarios.diasAtivos = [1, 3];
        draft.horarios.horasPorDia[1] = '';
        draft.horarios.horasPorDia[3] = '';
        expect(validateStep(4, draft)).toBe(false);
      });

      it('returns true when at least one active day has hours', () => {
        const draft = createDraft({ tipo: 'semanal' });
        draft.horarios.diasAtivos = [1, 3];
        draft.horarios.horasPorDia[1] = '4';
        draft.horarios.horasPorDia[3] = '';
        expect(validateStep(4, draft)).toBe(true);
      });

      it('ignores hours for days that are not active', () => {
        const draft = createDraft({ tipo: 'semanal' });
        draft.horarios.diasAtivos = [1];
        // Day 2 has hours but is not active — should not count
        draft.horarios.horasPorDia[2] = '3';
        expect(validateStep(4, draft)).toBe(false);
      });
    });
  });
});

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

  if (overrides.horarios) {
    return {
      ...base,
      ...overrides,
      horarios: { ...base.horarios, ...overrides.horarios },
    };
  }

  return { ...base, ...overrides };
}

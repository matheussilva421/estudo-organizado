import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/js/store.js?v=8.31', () => ({
  state: {
    editais: []
  },
  scheduleSave: vi.fn()
}));

const mapper = await import('../../src/js/lesson-mapper.js?v=8.31');
const { state, scheduleSave } = await import('../../src/js/store.js?v=8.31');

describe('lesson-mapper.js - mapAulasToAssuntos', () => {
  beforeEach(() => {
    state.editais = [];
    scheduleSave.mockClear();
  });

  it('returns 0 for non-existent edital', () => {
    const result = mapper.mapAulasToAssuntos('nonexistent', 'disc_1');
    expect(result).toBe(0);
  });

  it('returns 0 for non-existent disciplina', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{ id: 'disc_1', nome: 'Direito', assuntos: [], aulas: [] }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'nonexistent');
    expect(result).toBe(0);
  });

  it('returns 0 when disciplina has no aulas', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: []
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(0);
  });

  it('returns 0 when disciplina has no assuntos', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [],
        aulas: [{ id: 'aula_1', nome: 'Aula de Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(0);
  });

  it('creates links for exact name matches', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Direito Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Direito Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(1);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(aula.linkedAssuntoIds).toContain('ass_1');
    const assunto = state.editais[0].disciplinas[0].assuntos[0];
    expect(assunto.linkedAulaIds).toContain('aula_1');
  });

  it('creates links for inclusion matches', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Aula de Direito Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(1);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(aula.linkedAssuntoIds).toContain('ass_1');
  });

  it('creates links for fuzzy token matches above threshold', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Principios Constitucionais' }],
        aulas: [{ id: 'aula_1', nome: 'Principio Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(1);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(aula.linkedAssuntoIds).toContain('ass_1');
  });

  it('skips already-linked aulas', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Constitucional', linkedAssuntoIds: ['ass_1'] }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(0);
  });

  it('does not create links for scores below 0.70 threshold', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Matematica Avancada' }],
        aulas: [{ id: 'aula_1', nome: 'Direito Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(0);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(aula.linkedAssuntoIds).toBeUndefined();
  });

  it('creates bidirectional links for multiple matches', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [
          { id: 'ass_1', nome: 'Constitucional' },
          { id: 'ass_2', nome: 'Direito Constitucional' }
        ],
        aulas: [{ id: 'aula_1', nome: 'Direito Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBeGreaterThanOrEqual(1);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(aula.linkedAssuntoIds.length).toBeGreaterThanOrEqual(1);
  });

  it('calls scheduleSave when links are created', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Constitucional' }]
      }]
    }];
    mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(scheduleSave).toHaveBeenCalled();
  });

  it('does not call scheduleSave when no links created', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Matematica' }],
        aulas: [{ id: 'aula_1', nome: 'Direito Constitucional' }]
      }]
    }];
    mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(scheduleSave).not.toHaveBeenCalled();
  });

  it('handles aulas without linkedAssuntoIds array', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Constitucional' }]
      }]
    }];
    const result = mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    expect(result).toBe(1);
    const aula = state.editais[0].disciplinas[0].aulas[0];
    expect(Array.isArray(aula.linkedAssuntoIds)).toBe(true);
  });

  it('handles assuntos without linkedAulaIds array', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [{ id: 'ass_1', nome: 'Constitucional' }],
        aulas: [{ id: 'aula_1', nome: 'Constitucional' }]
      }]
    }];
    mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    const assunto = state.editais[0].disciplinas[0].assuntos[0];
    expect(Array.isArray(assunto.linkedAulaIds)).toBe(true);
  });

  it('does not duplicate existing links', () => {
    state.editais = [{
      id: 'ed_1',
      disciplinas: [{
        id: 'disc_1',
        nome: 'Direito',
        assuntos: [
          { id: 'ass_1', nome: 'Constitucional', linkedAulaIds: ['aula_1'] }
        ],
        aulas: [{ id: 'aula_1', nome: 'Constitucional' }]
      }]
    }];
    mapper.mapAulasToAssuntos('ed_1', 'disc_1');
    const assunto = state.editais[0].disciplinas[0].assuntos[0];
    expect(assunto.linkedAulaIds.filter(id => id === 'aula_1').length).toBe(1);
  });
});

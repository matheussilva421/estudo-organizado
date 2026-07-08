import { describe, expect, it } from 'vitest';
import {
  normalizeNameKey,
  validateRetaFinalPayload,
  matchRetaFinalToEditais,
  computeRetaFinalSummary,
} from '../../src/js/logic/reta-final-core.js';
import { createEdital, createDisciplina, createAssunto } from '../helpers/state-builders.js';

function validPayload(overrides = {}) {
  return {
    versao: 1,
    nome: 'Reta Final TJ-SP 2026',
    dataFinal: '2026-08-15',
    minutosPadrao: 60,
    dias: [
      {
        data: '2026-07-10',
        blocos: [
          {
            disciplina: 'Direito Penal',
            topicos: ['Crimes contra a vida'],
            aula: 'Aula 05',
            minutos: 90,
          },
          { disciplina: 'Português', topicos: ['Crase'] },
        ],
      },
    ],
    ...overrides,
  };
}

describe('normalizeNameKey', () => {
  it('remove acentos, baixa caixa e colapsa espaços', () => {
    expect(normalizeNameKey('  Direito  Penal ')).toBe('direito penal');
    expect(normalizeNameKey('Português')).toBe('portugues');
    expect(normalizeNameKey('CRASE')).toBe('crase');
  });

  it('valores vazios viram string vazia', () => {
    expect(normalizeNameKey(null)).toBe('');
    expect(normalizeNameKey(undefined)).toBe('');
    expect(normalizeNameKey('')).toBe('');
  });
});

describe('validateRetaFinalPayload', () => {
  it('aceita payload válido', () => {
    const result = validateRetaFinalPayload(validPayload());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejeita versao diferente de 1', () => {
    const result = validateRetaFinalPayload(validPayload({ versao: 2 }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejeita payload não-objeto e sem dias', () => {
    expect(validateRetaFinalPayload(null).valid).toBe(false);
    expect(validateRetaFinalPayload('x').valid).toBe(false);
    expect(validateRetaFinalPayload(validPayload({ dias: [] })).valid).toBe(false);
    expect(validateRetaFinalPayload(validPayload({ dias: 'x' })).valid).toBe(false);
  });

  it('rejeita dataFinal ausente ou mal formatada', () => {
    expect(validateRetaFinalPayload(validPayload({ dataFinal: undefined })).valid).toBe(false);
    expect(validateRetaFinalPayload(validPayload({ dataFinal: '15/08/2026' })).valid).toBe(false);
  });

  it('rejeita dia com data acima da dataFinal', () => {
    const payload = validPayload();
    payload.dias[0].data = '2026-08-16';
    expect(validateRetaFinalPayload(payload).valid).toBe(false);
  });

  it('rejeita bloco sem disciplina', () => {
    const payload = validPayload();
    delete payload.dias[0].blocos[0].disciplina;
    expect(validateRetaFinalPayload(payload).valid).toBe(false);
  });

  it('rejeita bloco sem tópicos e sem aula', () => {
    const payload = validPayload();
    payload.dias[0].blocos[1] = { disciplina: 'Português', topicos: [] };
    expect(validateRetaFinalPayload(payload).valid).toBe(false);
  });

  it('aceita bloco só com aula (topicos vazio)', () => {
    const payload = validPayload();
    payload.dias[0].blocos[1] = { disciplina: 'Português', topicos: [], aula: 'Aula 01' };
    expect(validateRetaFinalPayload(payload).valid).toBe(true);
  });

  it('rejeita minutos não inteiro positivo', () => {
    const payload = validPayload();
    payload.dias[0].blocos[0].minutos = -10;
    expect(validateRetaFinalPayload(payload).valid).toBe(false);
    payload.dias[0].blocos[0].minutos = 1.5;
    expect(validateRetaFinalPayload(payload).valid).toBe(false);
  });

  it('minutos ausente é aceito (usa minutosPadrao)', () => {
    const payload = validPayload();
    delete payload.dias[0].blocos[0].minutos;
    expect(validateRetaFinalPayload(payload).valid).toBe(true);
  });
});

describe('matchRetaFinalToEditais', () => {
  const editais = [
    createEdital({
      id: 'ed_1',
      nome: 'Principal',
      disciplinas: [
        createDisciplina({
          id: 'disc_penal',
          nome: 'Direito Penal',
          assuntos: [createAssunto({ id: 'ass_vida', nome: 'Crimes contra a Vida' })],
          aulas: [{ id: 'aula_05', nome: 'Aula 05' }],
        }),
      ],
    }),
  ];

  it('casa disciplina, tópico e aula por nome normalizado', () => {
    const match = matchRetaFinalToEditais(validPayload(), editais);
    const penal = match.disciplinas.find((d) => d.nome === 'Direito Penal');
    expect(penal.discId).toBe('disc_penal');
    expect(penal.topicos[0].assId).toBe('ass_vida');
    expect(penal.aulas[0].aulaId).toBe('aula_05');
  });

  it('disciplina/tópico ausentes ficam sem id (serão criados)', () => {
    const match = matchRetaFinalToEditais(validPayload(), editais);
    const portugues = match.disciplinas.find((d) => d.nome === 'Português');
    expect(portugues.discId).toBeNull();
    expect(portugues.topicos[0].assId).toBeNull();
  });

  it('resumo conta casados e criados', () => {
    const match = matchRetaFinalToEditais(validPayload(), editais);
    expect(match.summary.disciplinasCasadas).toBe(1);
    expect(match.summary.disciplinasCriadas).toBe(1);
    expect(match.summary.topicosCasados).toBe(1);
    expect(match.summary.topicosCriados).toBe(1);
    expect(match.summary.aulasCasadas).toBe(1);
    expect(match.summary.aulasCriadas).toBe(0);
  });

  it('disciplinas repetidas em dias diferentes são agregadas', () => {
    const payload = validPayload({
      dias: [
        { data: '2026-07-10', blocos: [{ disciplina: 'Direito Penal', topicos: ['A'] }] },
        { data: '2026-07-11', blocos: [{ disciplina: 'direito penal', topicos: ['A', 'B'] }] },
      ],
    });
    const match = matchRetaFinalToEditais(payload, editais);
    expect(match.disciplinas).toHaveLength(1);
    expect(match.disciplinas[0].topicos.map((t) => t.nome)).toEqual(['A', 'B']);
  });
});

describe('computeRetaFinalSummary', () => {
  const retaFinal = {
    nome: 'RF',
    dataFinal: '2026-08-15',
    minutosPadrao: 60,
    blocos: [
      {
        id: 'rf_1',
        data: '2026-07-10',
        dataOriginal: '2026-07-10',
        discId: 'disc_1',
        topicos: [{ assId: 'ass_1', aulaId: null }],
        minutos: 90,
        status: 'concluido',
        rolagens: 0,
      },
      {
        id: 'rf_2',
        data: '2026-07-11',
        dataOriginal: '2026-07-11',
        discId: 'disc_1',
        topicos: [{ assId: 'ass_2', aulaId: null }],
        minutos: 60,
        status: 'pendente',
        rolagens: 0,
      },
      {
        id: 'rf_3',
        data: '2026-07-11',
        dataOriginal: '2026-07-09',
        discId: 'disc_2',
        topicos: [{ assId: null, aulaId: 'aula_1' }],
        minutos: 30,
        status: 'nao_coberto',
        rolagens: 1,
      },
    ],
  };

  it('agrega minutos e blocos por disciplina', () => {
    const summary = computeRetaFinalSummary(retaFinal);
    expect(summary.porDisciplina.disc_1).toEqual({
      blocos: 2,
      blocosConcluidos: 1,
      minutos: 150,
      minutosConcluidos: 90,
      minutosRestantes: 60,
    });
    expect(summary.porDisciplina.disc_2.blocos).toBe(1);
  });

  it('conta não cobertos e totais', () => {
    const summary = computeRetaFinalSummary(retaFinal);
    expect(summary.naoCobertos).toBe(1);
    expect(summary.totalBlocos).toBe(3);
    expect(summary.totalMinutos).toBe(180);
    expect(summary.minutosRestantes).toBe(60);
  });

  it('retaFinal vazio não quebra', () => {
    const summary = computeRetaFinalSummary(null);
    expect(summary.totalBlocos).toBe(0);
    expect(summary.porDisciplina).toEqual({});
  });
});

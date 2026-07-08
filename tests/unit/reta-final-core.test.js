import { describe, expect, it } from 'vitest';
import {
  normalizeNameKey,
  validateRetaFinalPayload,
  matchRetaFinalToEditais,
  computeRetaFinalSummary,
  getRetaFinalTopicoLabel,
  buildRetaFinalEventTitle,
  listAssociableHistoryEvents,
  getNextRetaFinalBloco,
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

  it('ignora editais arquivados: disciplina homônima casa com o edital ativo', () => {
    const arquivado = createEdital({
      id: 'ed_old',
      nome: 'Concurso antigo',
      arquivado: true,
      disciplinas: [
        createDisciplina({
          id: 'disc_penal_old',
          nome: 'Direito Penal',
          assuntos: [createAssunto({ id: 'ass_old', nome: 'Crimes contra a Vida' })],
          aulas: [{ id: 'aula_old', nome: 'Aula antiga' }],
        }),
      ],
    });
    const match = matchRetaFinalToEditais(validPayload(), [arquivado, ...editais]);
    const penal = match.disciplinas.find((d) => d.nome === 'Direito Penal');
    expect(penal.discId).toBe('disc_penal');
    expect(penal.editalId).toBe('ed_1');
    expect(penal.aulas[0].aulaId).toBe('aula_05');
  });

  it('disciplina existente só em edital arquivado é tratada como criada', () => {
    const arquivado = createEdital({
      id: 'ed_old',
      nome: 'Concurso antigo',
      arquivado: true,
      disciplinas: [createDisciplina({ id: 'disc_pt_old', nome: 'Português' })],
    });
    const match = matchRetaFinalToEditais(validPayload(), [arquivado, ...editais]);
    const portugues = match.disciplinas.find((d) => d.nome === 'Português');
    expect(portugues.discId).toBeNull();
    expect(portugues.editalId).toBeNull();
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

describe('getRetaFinalTopicoLabel', () => {
  const disc = createDisciplina({
    id: 'disc_1',
    nome: 'Direito Penal',
    assuntos: [
      createAssunto({ id: 'ass_1', nome: '59 - Processo de Execução - 62 páginas - PDF sintético' }),
      createAssunto({ id: 'ass_2', nome: 'Crimes contra a vida' }),
    ],
    aulas: [{ id: 'aula_1', nome: 'Aula 05' }],
  });

  it('junta nomes de assuntos com separador', () => {
    const bloco = {
      topicos: [
        { assId: 'ass_1', aulaId: null },
        { assId: 'ass_2', aulaId: null },
      ],
    };
    expect(getRetaFinalTopicoLabel(bloco, disc)).toBe(
      '59 - Processo de Execução - 62 páginas - PDF sintético · Crimes contra a vida'
    );
  });

  it('aula ganha prefixo 🎬', () => {
    const bloco = { topicos: [{ assId: null, aulaId: 'aula_1' }] };
    expect(getRetaFinalTopicoLabel(bloco, disc)).toBe('🎬 Aula 05');
  });

  it('misto assunto + aula preserva a ordem do bloco', () => {
    const bloco = {
      topicos: [
        { assId: 'ass_2', aulaId: null },
        { assId: null, aulaId: 'aula_1' },
      ],
    };
    expect(getRetaFinalTopicoLabel(bloco, disc)).toBe('Crimes contra a vida · 🎬 Aula 05');
  });

  it('ids ausentes na disciplina são pulados', () => {
    const bloco = {
      topicos: [
        { assId: 'ass_removido', aulaId: null },
        { assId: 'ass_2', aulaId: null },
      ],
    };
    expect(getRetaFinalTopicoLabel(bloco, disc)).toBe('Crimes contra a vida');
  });

  it('disc null ou bloco sem tópicos vira string vazia', () => {
    expect(getRetaFinalTopicoLabel({ topicos: [{ assId: 'ass_1', aulaId: null }] }, null)).toBe('');
    expect(getRetaFinalTopicoLabel({ topicos: [] }, disc)).toBe('');
    expect(getRetaFinalTopicoLabel(null, disc)).toBe('');
  });
});

describe('buildRetaFinalEventTitle', () => {
  const disc = createDisciplina({
    id: 'disc_1',
    nome: 'Direito Penal',
    assuntos: [
      createAssunto({ id: 'ass_1', nome: '59 - Processo de Execução - 62 páginas - PDF sintético' }),
    ],
    aulas: [],
  });

  it('junta disciplina e tópico com travessão', () => {
    const bloco = { topicos: [{ assId: 'ass_1', aulaId: null }] };
    expect(buildRetaFinalEventTitle(bloco, disc)).toBe(
      'Direito Penal — 59 - Processo de Execução - 62 páginas - PDF sintético'
    );
  });

  it('trunca títulos muito longos em ~120 chars com reticências', () => {
    const longa = createDisciplina({
      id: 'disc_2',
      nome: 'Direito Processual Civil',
      assuntos: [createAssunto({ id: 'ass_x', nome: 'X'.repeat(200) })],
    });
    const bloco = { topicos: [{ assId: 'ass_x', aulaId: null }] };
    const titulo = buildRetaFinalEventTitle(bloco, longa);
    expect(titulo.length).toBeLessThanOrEqual(120);
    expect(titulo.endsWith('…')).toBe(true);
    expect(titulo.startsWith('Direito Processual Civil — ')).toBe(true);
  });

  it('sem tópicos resolvíveis usa fallback "Estudar {nome}"', () => {
    expect(buildRetaFinalEventTitle({ topicos: [] }, disc)).toBe('Estudar Direito Penal');
    expect(
      buildRetaFinalEventTitle({ topicos: [{ assId: 'ass_removido', aulaId: null }] }, disc)
    ).toBe('Estudar Direito Penal');
  });

  it('disc null usa fallback genérico', () => {
    expect(buildRetaFinalEventTitle({ topicos: [] }, null)).toBe('Estudar Disciplina');
  });
});

describe('listAssociableHistoryEvents', () => {
  const bloco = { id: 'rf_1', discId: 'disc_1', topicos: [{ assId: 'ass_1', aulaId: null }] };
  const estudada = (overrides = {}) => ({
    id: 'ev_x',
    status: 'estudei',
    discId: 'disc_1',
    dataEstudo: '2026-07-01',
    ...overrides,
  });

  it('filtra: só sessões estudadas da mesma disciplina e sem rfBlocoId', () => {
    const eventos = [
      estudada({ id: 'ev_ok' }),
      estudada({ id: 'ev_agendado', status: 'agendado' }),
      estudada({ id: 'ev_outra_disc', discId: 'disc_2' }),
      estudada({ id: 'ev_vinculado', rfBlocoId: 'rf_9' }),
      null,
    ];
    expect(listAssociableHistoryEvents(eventos, bloco).map((e) => e.id)).toEqual(['ev_ok']);
  });

  it('exclui evento já vinculado ao PRÓPRIO bloco (evitaria reabrir outro)', () => {
    const eventos = [estudada({ id: 'ev_meu', rfBlocoId: 'rf_1' })];
    expect(listAssociableHistoryEvents(eventos, bloco)).toEqual([]);
  });

  it('ordena por dataEstudo desc, com fallback em data', () => {
    const eventos = [
      estudada({ id: 'ev_antiga', dataEstudo: '2026-06-01' }),
      estudada({ id: 'ev_nova', dataEstudo: '2026-07-05' }),
      estudada({ id: 'ev_sem_data_estudo', dataEstudo: undefined, data: '2026-06-20' }),
    ];
    expect(listAssociableHistoryEvents(eventos, bloco).map((e) => e.id)).toEqual([
      'ev_nova',
      'ev_sem_data_estudo',
      'ev_antiga',
    ]);
  });

  it('aplica cap de 30 itens', () => {
    const eventos = Array.from({ length: 40 }, (_, i) =>
      estudada({ id: `ev_${i}`, dataEstudo: `2026-06-${String((i % 28) + 1).padStart(2, '0')}` })
    );
    expect(listAssociableHistoryEvents(eventos, bloco)).toHaveLength(30);
  });

  it('bloco sem discId ou eventos vazios retorna lista vazia', () => {
    expect(listAssociableHistoryEvents([estudada()], { id: 'rf_x', discId: null })).toEqual([]);
    expect(listAssociableHistoryEvents([], bloco)).toEqual([]);
    expect(listAssociableHistoryEvents(null, bloco)).toEqual([]);
  });
});

describe('getNextRetaFinalBloco', () => {
  const HOJE = '2026-07-10';
  const blocoBase = (overrides = {}) => ({
    id: 'rf_1',
    data: HOJE,
    dataOriginal: HOJE,
    discId: 'disc_1',
    topicos: [{ assId: 'ass_1', aulaId: null }],
    minutos: 60,
    status: 'pendente',
    rolagens: 0,
    ...overrides,
  });
  const plan = (blocos) => ({
    ativo: true,
    tipo: 'reta_final',
    retaFinal: { nome: 'RF', dataFinal: '2026-08-15', blocos },
  });

  it('retorna o primeiro pendente de hoje na ordem do array', () => {
    const blocos = [
      blocoBase({ id: 'rf_a' }),
      blocoBase({ id: 'rf_b' }),
      blocoBase({ id: 'rf_fut', data: '2026-07-12' }),
    ];
    expect(getNextRetaFinalBloco(plan(blocos), HOJE).id).toBe('rf_a');
  });

  it('pula concluídos e não cobertos', () => {
    const blocos = [
      blocoBase({ id: 'rf_done', status: 'concluido' }),
      blocoBase({ id: 'rf_nc', status: 'nao_coberto' }),
      blocoBase({ id: 'rf_ok' }),
    ];
    expect(getNextRetaFinalBloco(plan(blocos), HOJE).id).toBe('rf_ok');
  });

  it('sem pendente hoje, retorna o pendente futuro de menor data', () => {
    const blocos = [
      blocoBase({ id: 'rf_done', status: 'concluido' }),
      blocoBase({ id: 'rf_longe', data: '2026-07-20' }),
      blocoBase({ id: 'rf_perto', data: '2026-07-12' }),
    ];
    expect(getNextRetaFinalBloco(plan(blocos), HOJE).id).toBe('rf_perto');
  });

  it('tudo concluído retorna null', () => {
    const blocos = [blocoBase({ id: 'rf_done', status: 'concluido' })];
    expect(getNextRetaFinalBloco(plan(blocos), HOJE)).toBeNull();
  });

  it('plano inativo ou de outro tipo retorna null', () => {
    expect(getNextRetaFinalBloco(null, HOJE)).toBeNull();
    expect(getNextRetaFinalBloco({ ativo: false, tipo: 'reta_final' }, HOJE)).toBeNull();
    expect(getNextRetaFinalBloco({ ativo: true, tipo: 'ciclo' }, HOJE)).toBeNull();
  });
});

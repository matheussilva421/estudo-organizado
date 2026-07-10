import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAssunto,
  createDisciplina,
  createEdital,
  createEvento,
} from '../helpers/state-builders.js';
import {
  MIN_QUESTOES_CONFIAVEL,
  classifyTaxa,
  computeWeakPoints,
} from '../../src/js/logic/weak-points.js';

function buildEditais() {
  return [
    createEdital({
      id: 'ed_1',
      nome: 'Edital 1',
      disciplinas: [
        createDisciplina({
          id: 'disc_1',
          nome: 'Direito Administrativo',
          assuntos: [
            createAssunto({ id: 'ass_1', nome: 'Licitações' }),
            createAssunto({ id: 'ass_2', nome: 'Atos Administrativos' }),
          ],
        }),
        createDisciplina({
          id: 'disc_2',
          nome: 'Português',
          assuntos: [createAssunto({ id: 'ass_3', nome: 'Crase' })],
        }),
      ],
    }),
    createEdital({
      id: 'ed_2',
      nome: 'Edital 2',
      disciplinas: [
        createDisciplina({
          id: 'disc_3',
          nome: 'Informática',
          assuntos: [createAssunto({ id: 'ass_4', nome: 'Redes' })],
        }),
      ],
    }),
  ];
}

function compute(overrides = {}) {
  return computeWeakPoints({
    eventos: [],
    arquivo: [],
    editais: buildEditais(),
    cutoffStr: null,
    ...overrides,
  });
}

function eventoEstudado(overrides = {}) {
  return createEvento({ status: 'estudei', dataEstudo: '2026-04-18', ...overrides });
}

function findAssunto(result, assId) {
  return result.ranking.find((a) => a.assId === assId) || null;
}

describe('classifyTaxa — faixas do Dashboard', () => {
  it('classifica nas bordas 49/50/69/70', () => {
    expect(classifyTaxa(49)).toBe('vermelho');
    expect(classifyTaxa(50)).toBe('amarelo');
    expect(classifyTaxa(69)).toBe('amarelo');
    expect(classifyTaxa(70)).toBe('verde');
  });
});

describe('computeWeakPoints — agregação por assunto', () => {
  it('MIN_QUESTOES_CONFIAVEL é 10', () => {
    expect(MIN_QUESTOES_CONFIAVEL).toBe(10);
  });

  it('evento com topicos[] multi-assunto agrega por assId sem dupla contagem do agregado', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1', // compat: 1º item
      sessao: {
        // soma derivada por applyTopicosToEvent — NÃO deve ser contada de novo
        questoes: { total: 20, acertos: 12, erros: 8 },
        topicos: [
          { assId: 'ass_1', aulaId: null, questoes: { total: 10, acertos: 3, erros: 7 } },
          { assId: 'ass_2', aulaId: null, questoes: { total: 10, acertos: 9, erros: 1 } },
        ],
      },
    });
    const result = compute({ eventos: [ev] });

    const ass1 = findAssunto(result, 'ass_1');
    expect(ass1).toMatchObject({ total: 10, acertos: 3, erros: 7, taxa: 30, faixa: 'vermelho' });
    const ass2 = findAssunto(result, 'ass_2');
    expect(ass2).toMatchObject({ total: 10, acertos: 9, erros: 1, taxa: 90, faixa: 'verde' });
  });

  it('topico com apenas aulaId resolve o assunto via linkedAulaIds', () => {
    const editais = buildEditais();
    editais[0].disciplinas[0].assuntos[0].linkedAulaIds = ['aula_9'];
    const ev = eventoEstudado({
      discId: 'disc_1',
      sessao: {
        topicos: [{ assId: null, aulaId: 'aula_9', questoes: { total: 10, acertos: 4, erros: 6 } }],
      },
    });
    const result = compute({ eventos: [ev], editais });
    expect(findAssunto(result, 'ass_1')).toMatchObject({ total: 10, taxa: 40 });
  });

  it('legado: ev.sessao.questoes com certas/erradas e sem total', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1',
      sessao: { questoes: { certas: 6, erradas: 4 } },
    });
    const result = compute({ eventos: [ev] });
    expect(findAssunto(result, 'ass_1')).toMatchObject({
      total: 10,
      acertos: 6,
      erros: 4,
      taxa: 60,
      faixa: 'amarelo',
    });
  });

  it('legado mais antigo: ev.questoes top-level', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1',
      questoes: { total: 10, acertos: 5, erros: 5 },
    });
    const result = compute({ eventos: [ev] });
    expect(findAssunto(result, 'ass_1')).toMatchObject({ total: 10, taxa: 50 });
  });

  it('ignora eventos não estudados', () => {
    const ev = createEvento({
      status: 'agendado',
      discId: 'disc_1',
      assId: 'ass_1',
      sessao: { questoes: { total: 10, acertos: 5, erros: 5 } },
    });
    const result = compute({ eventos: [ev] });
    expect(result.ranking).toHaveLength(0);
  });

  it('assunto concluído entra no ranking normalmente', () => {
    const editais = buildEditais();
    editais[0].disciplinas[0].assuntos[0].concluido = true;
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1',
      sessao: { questoes: { total: 12, acertos: 4, erros: 8 } },
    });
    const result = compute({ eventos: [ev], editais });
    expect(findAssunto(result, 'ass_1')).toMatchObject({ taxa: 33, concluido: true });
  });
});

describe('computeWeakPoints — janela temporal', () => {
  const evEm = (dateOverrides, assId = 'ass_1') =>
    eventoEstudado({
      discId: 'disc_1',
      assId,
      sessao: { questoes: { total: 10, acertos: 2, erros: 8 } },
      ...dateOverrides,
    });

  it('exclui eventos anteriores ao cutoff (dataEstudo || data)', () => {
    const eventos = [
      evEm({ id: 'ev1', dataEstudo: '2026-03-01' }), // fora
      evEm({ id: 'ev2', dataEstudo: '2026-04-10' }), // dentro
      evEm({ id: 'ev3', dataEstudo: null, data: '2026-04-12' }), // dentro via data
    ];
    const result = compute({ eventos, cutoffStr: '2026-04-01' });
    expect(findAssunto(result, 'ass_1')).toMatchObject({ total: 20 });
  });

  it('evento sem nenhuma data é ignorado quando há janela, mas conta no "Tudo"', () => {
    const semData = evEm({ id: 'ev1', dataEstudo: null, data: null });
    const comJanela = compute({ eventos: [semData], cutoffStr: '2026-04-01' });
    expect(findAssunto(comJanela, 'ass_1')).toBeNull();
    const tudo = compute({ eventos: [semData], cutoffStr: null });
    expect(findAssunto(tudo, 'ass_1')).toMatchObject({ total: 10 });
  });

  it('"Tudo" (cutoffStr null) inclui arquivo; com janela o arquivo é ignorado', () => {
    const arquivado = evEm({ id: 'ev_arq', dataEstudo: '2025-10-01' });
    const tudo = compute({ eventos: [], arquivo: [arquivado] });
    expect(findAssunto(tudo, 'ass_1')).toMatchObject({ total: 10 });
    const comJanela = compute({ eventos: [], arquivo: [arquivado], cutoffStr: '2026-04-01' });
    expect(findAssunto(comJanela, 'ass_1')).toBeNull();
  });
});

describe('computeWeakPoints — partição e selo de confiabilidade', () => {
  const evComTotal = (total, acertos) =>
    eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_1',
      sessao: { questoes: { total, acertos, erros: total - acertos } },
    });

  it('9 questões entra no ranking com confiavel:false; 10 com confiavel:true', () => {
    const nove = compute({ eventos: [evComTotal(9, 3)] });
    expect(nove.ranking.find((a) => a.assId === 'ass_1')).toMatchObject({
      total: 9,
      taxa: 33,
      confiavel: false,
    });

    const dez = compute({ eventos: [evComTotal(10, 3)] });
    expect(dez.ranking.find((a) => a.assId === 'ass_1')).toMatchObject({
      total: 10,
      taxa: 30,
      confiavel: true,
    });
  });

  it('retorno não expõe mais a coleção insuficientes', () => {
    const result = compute({ eventos: [evComTotal(9, 3)] });
    expect(result).not.toHaveProperty('insuficientes');
  });

  it('assunto sem nenhuma questão na janela vai para semQuestoes', () => {
    const result = compute({ eventos: [evComTotal(10, 5)] });
    const sem = result.semQuestoes.map((a) => a.assId);
    expect(sem).toContain('ass_2');
    expect(sem).toContain('ass_3');
    expect(sem).not.toContain('ass_1');
  });

  it('total registrado sem acertos/erros (respondidas 0) fica no fim do ranking com taxa null', () => {
    const eventos = [
      eventoEstudado({
        id: 'e_semresp',
        discId: 'disc_1',
        assId: 'ass_1',
        sessao: { questoes: { total: 12 } },
      }),
      eventoEstudado({
        id: 'e_normal',
        discId: 'disc_1',
        assId: 'ass_2',
        sessao: { questoes: { total: 10, acertos: 9, erros: 1 } },
      }),
    ];
    const result = compute({ eventos });
    expect(result.ranking.map((a) => a.assId)).toEqual(['ass_2', 'ass_1']);
    expect(result.ranking[1]).toMatchObject({ total: 12, taxa: null, taxaAjustada: null });
  });
});

describe('computeWeakPoints — média bayesiana (taxaAjustada)', () => {
  const ev = (assId, total, acertos, id) =>
    eventoEstudado({
      id,
      discId: 'disc_1',
      assId,
      sessao: { questoes: { total, acertos, erros: total - acertos } },
    });

  it('encolhe taxas de amostras pequenas em direção ao prior global', () => {
    // Universo: ass_1 = 45/90 (50%), ass_2 = 0/10 (0%).
    // p = 45/100 = 0.45, m = 10.
    // ass_2: (0 + 10*0.45) / (10 + 10) = 22.5% → 23. ass_1: (45+4.5)/100 = 49.5% → 50.
    const result = compute({ eventos: [ev('ass_1', 90, 45, 'e1'), ev('ass_2', 10, 0, 'e2')] });
    const ass1 = findAssunto(result, 'ass_1');
    const ass2 = findAssunto(result, 'ass_2');
    expect(ass2).toMatchObject({ taxa: 0, taxaAjustada: 23 });
    expect(ass1).toMatchObject({ taxa: 50, taxaAjustada: 50 });
  });

  it('taxa bruta permanece intacta (exibição) e faixa segue a bruta', () => {
    const result = compute({ eventos: [ev('ass_1', 90, 45, 'e1'), ev('ass_2', 10, 0, 'e2')] });
    const ass2 = findAssunto(result, 'ass_2');
    expect(ass2.taxa).toBe(0);
    expect(ass2.faixa).toBe('vermelho');
  });

  it('ranking ordena pela taxa ajustada, podendo divergir da bruta', () => {
    // ass_1 = 35/100 (35%), ass_2 = 0/1 (0%), ass_3 = 80/100 (80%).
    // p = 115/201 ≈ 0.572. ass_2 adj = 5.72/11 ≈ 52; ass_1 adj = 40.72/110 ≈ 37.
    // Bruta: ass_2 (0%) seria o pior; ajustada: ass_1 vem primeiro.
    const result = compute({
      eventos: [ev('ass_1', 100, 35, 'e1'), ev('ass_2', 1, 0, 'e2'), ev('ass_3', 100, 80, 'e3')],
    });
    expect(result.ranking.map((a) => a.assId)).toEqual(['ass_1', 'ass_2', 'ass_3']);
  });

  it('amostra grande com taxa extrema quase não é ajustada', () => {
    const result = compute({ eventos: [ev('ass_1', 200, 20, 'e1')] });
    const ass1 = findAssunto(result, 'ass_1');
    // Prior vem do próprio universo (só ele): adj = taxa bruta.
    expect(ass1.taxaAjustada).toBe(ass1.taxa);
  });
});

describe('computeWeakPoints — órfãos e arquivados', () => {
  it('assId órfão soma em orfaos e nas naoAtribuidas da disciplina do evento', () => {
    const ev = eventoEstudado({
      discId: 'disc_1',
      assId: 'ass_deletado',
      sessao: { questoes: { total: 10, acertos: 7, erros: 3 } },
    });
    const result = compute({ eventos: [ev] });
    expect(result.orfaos).toMatchObject({ total: 10, acertos: 7, erros: 3 });
    const disc = result.disciplinas.find((d) => d.discId === 'disc_1');
    expect(disc.naoAtribuidas).toBe(10);
    expect(result.ranking).toHaveLength(0);
  });

  it('disciplina arquivada e edital arquivado ficam fora do universo e seus eventos são ignorados', () => {
    const editais = buildEditais();
    editais[0].disciplinas[1].arquivada = true; // disc_2
    editais[1].arquivado = true; // ed_2 inteiro
    const eventos = [
      eventoEstudado({
        id: 'ev1',
        discId: 'disc_2',
        assId: 'ass_3',
        sessao: { questoes: { total: 20, acertos: 5, erros: 15 } },
      }),
      eventoEstudado({
        id: 'ev2',
        discId: 'disc_3',
        assId: 'ass_4',
        sessao: { questoes: { total: 20, acertos: 5, erros: 15 } },
      }),
    ];
    const result = compute({ eventos, editais });
    expect(result.disciplinas.map((d) => d.discId)).toEqual(['disc_1']);
    expect(result.ranking).toHaveLength(0);
    expect(result.orfaos.total).toBe(0);
  });
});

describe('computeWeakPoints — ordenação e agregado por disciplina', () => {
  const ev = (assId, discId, total, acertos, id) =>
    eventoEstudado({
      id,
      discId,
      assId,
      sessao: { questoes: { total, acertos, erros: total - acertos } },
    });

  it('ranking ordenado por taxa asc, empate por total desc', () => {
    const eventos = [
      ev('ass_1', 'disc_1', 10, 8, 'e1'), // 80%
      ev('ass_2', 'disc_1', 10, 3, 'e2'), // 30%, total 10
      ev('ass_3', 'disc_2', 40, 12, 'e3'), // 30%, total 40 → antes de ass_2
    ];
    const result = compute({ eventos });
    expect(result.ranking.map((a) => a.assId)).toEqual(['ass_3', 'ass_2', 'ass_1']);
  });

  it('disciplinas agregam assuntos + naoAtribuidas e vêm ordenadas da pior para a melhor', () => {
    const eventos = [
      ev('ass_1', 'disc_1', 10, 2, 'e1'), // disc_1: 20%
      ev('ass_3', 'disc_2', 10, 9, 'e2'), // disc_2: 90%
      eventoEstudado({
        id: 'e3',
        discId: 'disc_1',
        assId: 'ass_orfao',
        sessao: { questoes: { total: 10, acertos: 8, erros: 2 } },
      }),
    ];
    const result = compute({ eventos });
    const disc1 = result.disciplinas.find((d) => d.discId === 'disc_1');
    // 2+8 acertos / 20 respondidas = 50%
    expect(disc1).toMatchObject({ acertos: 10, erros: 10, taxa: 50, faixa: 'amarelo' });
    const comDados = result.disciplinas.filter((d) => d.taxa !== null);
    expect(comDados.map((d) => d.discId)).toEqual(['disc_1', 'disc_2']);
  });

  it('ranking carrega contexto de disciplina e edital', () => {
    const result = compute({ eventos: [ev('ass_4', 'disc_3', 10, 1, 'e1')] });
    expect(result.ranking[0]).toMatchObject({
      assId: 'ass_4',
      nome: 'Redes',
      discId: 'disc_3',
      discNome: 'Informática',
      editalId: 'ed_2',
      editalNome: 'Edital 2',
    });
  });
});

describe('computeWeakPoints — filtros', () => {
  const eventos = () => [
    eventoEstudado({
      id: 'e1',
      discId: 'disc_1',
      assId: 'ass_1',
      sessao: { questoes: { total: 10, acertos: 3, erros: 7 } },
    }),
    eventoEstudado({
      id: 'e2',
      discId: 'disc_3',
      assId: 'ass_4',
      sessao: { questoes: { total: 10, acertos: 4, erros: 6 } },
    }),
  ];

  it('editalFilterId restringe ao edital', () => {
    const result = compute({ eventos: eventos(), editalFilterId: 'ed_2' });
    expect(result.ranking.map((a) => a.assId)).toEqual(['ass_4']);
    expect(result.disciplinas.map((d) => d.discId)).toEqual(['disc_3']);
  });

  it('discFilterId restringe à disciplina', () => {
    const result = compute({ eventos: eventos(), discFilterId: 'disc_1' });
    expect(result.ranking.map((a) => a.assId)).toEqual(['ass_1']);
    expect(result.disciplinas.map((d) => d.discId)).toEqual(['disc_1']);
  });
});

describe('computeWeakPoints — série semanal (sparkline)', () => {
  const ev = (assId, dataEstudo, total, acertos, id) =>
    eventoEstudado({
      id,
      discId: 'disc_1',
      assId,
      dataEstudo,
      sessao: { questoes: { total, acertos, erros: total - acertos } },
    });

  it('sem seriesWeeks não gera série', () => {
    const result = compute({ eventos: [ev('ass_1', '2026-07-08', 10, 5, 'e1')] });
    expect(findAssunto(result, 'ass_1').serie).toBeUndefined();
  });

  it('agrupa taxas em blocos de 7 dias terminando em todayStr (antiga → recente)', () => {
    const eventos = [
      ev('ass_1', '2026-07-08', 10, 8, 'e1'), // 2 dias atrás → última semana (80%)
      ev('ass_1', '2026-06-30', 10, 2, 'e2'), // 10 dias atrás → penúltima (20%)
    ];
    const result = compute({ eventos, seriesWeeks: 4, todayStr: '2026-07-10' });
    const serie = findAssunto(result, 'ass_1').serie;
    expect(serie).toHaveLength(4);
    expect(serie[3]).toEqual({ taxa: 80 });
    expect(serie[2]).toEqual({ taxa: 20 });
    expect(serie[1]).toEqual({ taxa: null });
    expect(serie[0]).toEqual({ taxa: null });
  });

  it('mesma semana agrega múltiplos eventos numa taxa única', () => {
    const eventos = [
      ev('ass_1', '2026-07-09', 10, 9, 'e1'),
      ev('ass_1', '2026-07-07', 10, 3, 'e2'), // mesma semana: 12/20 = 60%
    ];
    const result = compute({ eventos, seriesWeeks: 2, todayStr: '2026-07-10' });
    expect(findAssunto(result, 'ass_1').serie[1]).toEqual({ taxa: 60 });
  });

  it('evento fora da janela da série conta no agregado mas não na série', () => {
    const result = compute({
      eventos: [ev('ass_1', '2026-06-10', 10, 5, 'e1')], // 30 dias atrás
      seriesWeeks: 2,
      todayStr: '2026-07-10',
    });
    const a = findAssunto(result, 'ass_1');
    expect(a.total).toBe(10);
    expect(a.serie.every((s) => s.taxa === null)).toBe(true);
  });

  it('série via topicos[] multi-assunto atribui cada item à sua semana', () => {
    const evento = eventoEstudado({
      id: 'e1',
      discId: 'disc_1',
      dataEstudo: '2026-07-08',
      sessao: {
        topicos: [
          { assId: 'ass_1', aulaId: null, questoes: { total: 10, acertos: 4, erros: 6 } },
          { assId: 'ass_2', aulaId: null, questoes: { total: 10, acertos: 7, erros: 3 } },
        ],
      },
    });
    const result = compute({ eventos: [evento], seriesWeeks: 2, todayStr: '2026-07-10' });
    expect(findAssunto(result, 'ass_1').serie[1]).toEqual({ taxa: 40 });
    expect(findAssunto(result, 'ass_2').serie[1]).toEqual({ taxa: 70 });
  });
});

describe('weak-points.js — núcleo puro (guard)', () => {
  it('não tem statements de import', () => {
    const source = readFileSync(join(process.cwd(), 'src/js/logic/weak-points.js'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/from\s+['"]/);
  });
});

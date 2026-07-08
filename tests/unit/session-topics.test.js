import { describe, expect, it } from 'vitest';
import {
  normalizeSessionTopics,
  sumTopicQuestoes,
  sumTopicPaginas,
  applyTopicosToEvent,
  buildTopicosFromRetaFinalBloco,
} from '../../src/js/registro-sessao/session-topics.js';

function item(overrides = {}) {
  return {
    assId: 'ass_1',
    aulaId: null,
    questoes: null,
    paginas: null,
    statusTopico: 'em_andamento',
    ...overrides,
  };
}

describe('normalizeSessionTopics', () => {
  it('retorna topicos[] existentes (clonados)', () => {
    const ev = {
      assId: 'ass_x',
      sessao: { topicos: [item(), item({ assId: 'ass_2' })] },
    };
    const result = normalizeSessionTopics(ev);
    expect(result).toHaveLength(2);
    expect(result[0].assId).toBe('ass_1');
    result[0].assId = 'mutado';
    expect(ev.sessao.topicos[0].assId).toBe('ass_1'); // não compartilha referência
  });

  it('sessão legada (escalares) converte em 1 item com questões/páginas/status', () => {
    const ev = {
      assId: 'ass_leg',
      aulaId: 'aula_leg',
      sessao: {
        questoes: { total: 10, acertos: 8, erros: 2 },
        paginas: { modo: 'simples', total: 12 },
        statusTopico: 'finalizado',
      },
    };
    expect(normalizeSessionTopics(ev)).toEqual([
      {
        assId: 'ass_leg',
        aulaId: 'aula_leg',
        questoes: { total: 10, acertos: 8, erros: 2 },
        paginas: { modo: 'simples', total: 12 },
        statusTopico: 'finalizado',
      },
    ]);
  });

  it('evento sem assunto/aula nem topicos retorna lista vazia', () => {
    expect(normalizeSessionTopics({ discId: 'disc_1', sessao: {} })).toEqual([]);
    expect(normalizeSessionTopics(null)).toEqual([]);
  });

  it('itens inválidos (sem assId e sem aulaId) são descartados', () => {
    const ev = { sessao: { topicos: [item(), { questoes: null }] } };
    expect(normalizeSessionTopics(ev)).toHaveLength(1);
  });
});

describe('sumTopicQuestoes', () => {
  it('soma total/acertos/erros dos itens', () => {
    const topicos = [
      item({ questoes: { total: 10, acertos: 8, erros: 2 } }),
      item({ assId: 'ass_2', questoes: { total: 5, acertos: 3, erros: 1 } }),
      item({ assId: 'ass_3' }), // sem questões
    ];
    expect(sumTopicQuestoes(topicos)).toEqual({ total: 15, acertos: 11, erros: 3 });
  });

  it('sem questões em nenhum item retorna null', () => {
    expect(sumTopicQuestoes([item(), item({ assId: 'ass_2' })])).toBeNull();
    expect(sumTopicQuestoes([])).toBeNull();
  });
});

describe('sumTopicPaginas', () => {
  it('soma páginas dos itens em modo simples', () => {
    const topicos = [
      item({ paginas: { modo: 'simples', total: 10 } }),
      item({ assId: 'ass_2', paginas: { modo: 'detalhado', inicio: 5, fim: 12, total: 7 } }),
    ];
    expect(sumTopicPaginas(topicos)).toEqual({ modo: 'simples', total: 17 });
  });

  it('sem páginas retorna null', () => {
    expect(sumTopicPaginas([item()])).toBeNull();
  });
});

describe('applyTopicosToEvent', () => {
  it('grava topicos[] e deriva escalares e somas (compatibilidade sem migração)', () => {
    const ev = { id: 'ev_1', sessao: { tiposEstudo: ['questoes'] } };
    const topicos = [
      item({
        assId: 'ass_1',
        aulaId: 'aula_1',
        questoes: { total: 10, acertos: 8, erros: 2 },
        statusTopico: 'em_andamento',
      }),
      item({
        assId: 'ass_2',
        questoes: { total: 4, acertos: 4, erros: 0 },
        paginas: { modo: 'simples', total: 6 },
        statusTopico: 'finalizado',
      }),
    ];

    applyTopicosToEvent(ev, topicos);

    expect(ev.assId).toBe('ass_1');
    expect(ev.aulaId).toBe('aula_1');
    expect(ev.sessao.topicos).toHaveLength(2);
    expect(ev.sessao.questoes).toEqual({ total: 14, acertos: 12, erros: 2 });
    expect(ev.sessao.paginas).toEqual({ modo: 'simples', total: 6 });
    // algum item finalizado → sessão finalizada (promoção/histórico legado)
    expect(ev.sessao.statusTopico).toBe('finalizado');
  });

  it('nenhum item finalizado usa fallback de status', () => {
    const ev = { id: 'ev_1', sessao: {} };
    applyTopicosToEvent(ev, [item()], { statusTopico: 'nao_iniciado' });
    expect(ev.sessao.statusTopico).toBe('nao_iniciado');
  });

  it('sem somas usa fallbacks globais de questões/páginas', () => {
    const ev = { id: 'ev_1', sessao: {} };
    applyTopicosToEvent(ev, [item()], {
      questoes: { total: 3, acertos: 2, erros: 1 },
      paginas: { modo: 'simples', total: 9 },
    });
    expect(ev.sessao.questoes).toEqual({ total: 3, acertos: 2, erros: 1 });
    expect(ev.sessao.paginas).toEqual({ modo: 'simples', total: 9 });
  });
});

describe('buildTopicosFromRetaFinalBloco', () => {
  it('converte topicos do bloco em itens de sessão não iniciados', () => {
    const bloco = {
      id: 'rf_1',
      topicos: [
        { assId: 'ass_1', aulaId: null },
        { assId: null, aulaId: 'aula_1' },
      ],
    };
    expect(buildTopicosFromRetaFinalBloco(bloco)).toEqual([
      { assId: 'ass_1', aulaId: null, questoes: null, paginas: null, statusTopico: 'nao_iniciado' },
      { assId: null, aulaId: 'aula_1', questoes: null, paginas: null, statusTopico: 'nao_iniciado' },
    ]);
  });

  it('bloco vazio ou nulo retorna lista vazia', () => {
    expect(buildTopicosFromRetaFinalBloco(null)).toEqual([]);
    expect(buildTopicosFromRetaFinalBloco({ topicos: [] })).toEqual([]);
  });
});

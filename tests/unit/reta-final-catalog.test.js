import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveRetaFinalCatalog } from '../../src/js/logic/reta-final-catalog.js';
import { applyRetaFinalCommand } from '../../src/js/logic/reta-final-commands.js';

function catalogo(overrides = {}) {
  return [
    {
      id: 'edital_a',
      nome: 'Edital A',
      disciplinas: [
        {
          id: 'disc_a',
          nome: 'Direito Penal',
          assuntos: [{ id: 'ass_a', nome: 'Ação Penal' }],
          aulas: [{ id: 'aula_a', nome: 'Aula 1' }],
        },
      ],
    },
    {
      id: 'edital_b',
      nome: 'Edital B',
      disciplinas: [
        {
          id: 'disc_b',
          nome: 'Direito Penal',
          assuntos: [{ id: 'ass_b', nome: 'Ação Penal' }],
          aulas: [{ id: 'aula_b', nome: 'Aula 1' }],
        },
      ],
    },
    ...(overrides.editais || []),
  ];
}

function congelarProfundo(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(congelarProfundo);
    Object.freeze(value);
  }
  return value;
}

function plano(blocos = []) {
  return {
    tipo: 'reta_final',
    planId: 'rfplan_1',
    schemaVersionRetaFinal: 2,
    revision: 0,
    updatedAt: '2026-10-19T10:00:00.000Z',
    config: { dataProva: '2026-11-15', visualizacao: 'mes' },
    retaFinal: {
      nome: 'Reta Final',
      dataFinal: '2026-10-31',
      minutosPadrao: 60,
      capacidade: {
        minutosPorDiaSemana: { 0: 0, 1: 120, 2: 120, 3: 120, 4: 120, 5: 120, 6: 60 },
        excecoesPorData: {},
        folgas: [0],
        maximoDiario: 180,
      },
      blocos,
    },
  };
}

describe('resolveRetaFinalCatalog', () => {
  it('resolve um assunto pelo ID explícito', () => {
    const result = resolveRetaFinalCatalog(catalogo(), {
      discId: 'disc_a',
      assuntos: [{ id: 'ass_a', nome: 'rótulo antigo' }],
      aulas: [],
      makeId: () => 'unused',
    });

    expect(result).toEqual({
      refs: [{ assId: 'ass_a', aulaId: null }],
      createIntents: [],
      conflicts: [],
    });
  });

  it('mantém assuntos homônimos isolados pelo discId entre editais', () => {
    const result = resolveRetaFinalCatalog(catalogo(), {
      discId: 'disc_b',
      assuntos: [' AÇÃO PENAL '],
      aulas: [],
      makeId: () => 'unused',
    });

    expect(result.refs).toEqual([{ assId: 'ass_b', aulaId: null }]);
    expect(result.createIntents).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('não escolhe automaticamente entre homônimos da mesma disciplina', () => {
    const catalog = catalogo({
      editais: [
        {
          id: 'edital_c',
          disciplinas: [
            {
              id: 'disc_c',
              nome: 'Administrativo',
              assuntos: [
                { id: 'ass_c1', nome: 'Ação Penal' },
                { id: 'ass_c2', nome: 'ação   penal' },
              ],
              aulas: [],
            },
          ],
        },
      ],
    });
    const result = resolveRetaFinalCatalog(catalog, {
      discId: 'disc_c',
      assuntos: ['Ação Penal'],
      aulas: [],
      makeId: () => 'unused',
    });

    expect(result.refs).toEqual([]);
    expect(result.createIntents).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: 'REFERENCIA_AMBIGUA',
        entity: 'assunto',
        candidateIds: ['ass_c1', 'ass_c2'],
      }),
    ]);
  });

  it('propõe assunto e aula novos sem alterar o catálogo', () => {
    const catalog = congelarProfundo(catalogo());
    const before = JSON.parse(JSON.stringify(catalog));
    const generatedIds = ['ass_new', 'aula_new'];
    let generated = 0;
    const result = resolveRetaFinalCatalog(catalog, {
      discId: 'disc_a',
      assuntos: ['Novo assunto'],
      aulas: ['Nova aula'],
      makeId: () => generatedIds[generated++],
    });

    expect(result).toEqual({
      refs: [
        { assId: 'ass_new', aulaId: null },
        { assId: null, aulaId: 'aula_new' },
      ],
      createIntents: [
        { entity: 'assunto', id: 'ass_new', discId: 'disc_a', nome: 'Novo assunto' },
        { entity: 'aula', id: 'aula_new', discId: 'disc_a', nome: 'Nova aula' },
      ],
      conflicts: [],
    });
    expect(catalog).toEqual(before);
    expect(generated).toBe(2);
  });

  it('deduplica uma proposta repetida e retorna o mesmo resultado determinístico', () => {
    const proposal = {
      discId: 'disc_a',
      assuntos: ['Novo tema', ' novo   TEMA '],
      aulas: [],
      makeId: () => 'ass_draft_1',
    };
    const first = resolveRetaFinalCatalog(catalogo(), proposal);
    const repeated = resolveRetaFinalCatalog(catalogo(), proposal);

    expect(first).toEqual(repeated);
    expect(first.refs).toEqual([{ assId: 'ass_draft_1', aulaId: null }]);
    expect(first.createIntents).toEqual([
      { entity: 'assunto', id: 'ass_draft_1', discId: 'disc_a', nome: 'Novo tema' },
    ]);
    expect(first.conflicts).toEqual([]);
  });

  it.each([undefined, 'disc_missing'])(
    'falha fechado quando discId está ausente ou não existe (%s)',
    (discId) => {
      const result = resolveRetaFinalCatalog(catalogo(), {
        discId,
        assuntos: ['Ação Penal'],
        aulas: ['Aula 1'],
        makeId: () => 'must_not_be_used',
      });

      expect(result.refs).toEqual([]);
      expect(result.createIntents).toEqual([]);
      expect(result.conflicts).toEqual([expect.objectContaining({ code: 'DISCIPLINA_INVALIDA' })]);
    },
  );

  it('preserva catálogo e proposta congelados durante a resolução', () => {
    const catalog = congelarProfundo(catalogo());
    const proposal = congelarProfundo({
      discId: 'disc_a',
      assuntos: [{ id: 'ass_a', nome: 'Ação Penal' }],
      aulas: ['Nova aula'],
    });
    const before = JSON.parse(JSON.stringify(catalog));
    const proposalBefore = JSON.parse(JSON.stringify(proposal));

    const result = resolveRetaFinalCatalog(catalog, {
      ...proposal,
      makeId: () => 'aula_draft',
    });

    expect(result.refs).toEqual([
      { assId: 'ass_a', aulaId: null },
      { assId: null, aulaId: 'aula_draft' },
    ]);
    expect(catalog).toEqual(before);
    expect(proposal).toEqual(proposalBefore);
  });

  it('mantém a fronteira pura, sem estado, DOM, store, rede ou timers', () => {
    const source = readFileSync('src/js/logic/reta-final-catalog.js', 'utf8');

    expect(source).not.toMatch(
      /\b(document|window|localStorage|indexedDB|fetch|setTimeout|setInterval|scheduleSave)\b/,
    );
    expect(source).toMatch(/^import \{ normalizeNameKey \} from '\.\/reta-final-core\.js';$/m);
  });
});

describe('integração com PATCH/CREATE da Task 3', () => {
  it('usa referências existentes em PATCH e intents explícitos em CREATE', () => {
    const catalog = catalogo();
    const existing = resolveRetaFinalCatalog(catalog, {
      discId: 'disc_a',
      assuntos: [{ id: 'ass_a', nome: 'Ação Penal' }],
      aulas: [],
      makeId: () => 'unused',
    });
    const patch = applyRetaFinalCommand(
      plano([
        {
          id: 'rf_1',
          discId: 'disc_a',
          topicos: [{ assId: 'ass_b', aulaId: null }],
          minutos: 45,
          status: 'pendente',
          ordem: 0,
          dataOriginal: '2026-10-19',
          dataPlanejada: '2026-10-19',
          data: '2026-10-19',
          rolagens: 0,
        },
      ]),
      {
        operationId: 'op_patch',
        type: 'PATCH',
        blockIds: ['rf_1'],
        patch: { discId: 'disc_a', topicos: existing.refs },
      },
      { catalog, today: '2026-10-19' },
    );

    const created = resolveRetaFinalCatalog(catalog, {
      discId: 'disc_a',
      assuntos: ['Novo assunto'],
      aulas: [],
      makeId: () => 'ass_draft',
    });
    const createCommand = {
      operationId: 'op_create',
      type: 'CREATE',
      input: {
        discId: 'disc_a',
        topicos: created.refs,
        minutos: 45,
        dataPlanejada: '2026-10-25',
      },
    };
    const create = applyRetaFinalCommand(plano(), createCommand, {
      catalog,
      catalogIntents: created.createIntents,
      today: '2026-10-19',
      makeId: () => 'rf_new',
    });
    const unbackedIntent = applyRetaFinalCommand(plano(), createCommand, {
      catalog,
      today: '2026-10-19',
      makeId: () => 'rf_new',
    });

    expect(patch.valid).toBe(true);
    expect(create.valid).toBe(true);
    expect(unbackedIntent.valid).toBe(false);
    expect(unbackedIntent.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'REFERENCIA_INVALIDA' })]),
    );
  });
});

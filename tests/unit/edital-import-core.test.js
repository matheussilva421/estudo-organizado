import { describe, expect, it } from 'vitest';
import {
  canonicalizeEditalImportPayload,
  buildEditalSourceIdentity,
  buildEditalImportPlan,
  findEditalImportCandidates,
  buildEditalImportTargetSignature,
  isEditalImportPlanCurrent,
  normalizeEditalImportName,
  validateEditalImportPayload,
} from '../../src/js/logic/edital-import-core.js';

function validPayload(overrides = {}) {
  return {
    versao: 1,
    tipo: 'edital',
    nome: 'DPE-PB — Assistente Jurídico',
    disciplinas: [
      {
        nome: 'Direito Constitucional',
        topicos: [{ nome: 'Direitos Fundamentais' }],
        aulas: [{ nome: 'Controle de Constitucionalidade' }],
      },
    ],
    ...overrides,
  };
}

function importDiscipline(nome, topicos = [], aulas = []) {
  return { nome, topicos, aulas };
}

function targetEdital(disciplinas = [], overrides = {}) {
  return {
    id: 'ed_target',
    nome: 'DPE-PB',
    cor: '#123456',
    arquivado: false,
    disciplinas,
    ...overrides,
  };
}

function buildPlan(disciplinas, editais, destination = { mode: 'merge', editalId: 'ed_target' }) {
  return buildEditalImportPlan({
    payload: validPayload({ disciplinas }),
    editais,
    destination,
  });
}

describe('normalizeEditalImportName', () => {
  it('remove acentos, ignora caixa e colapsa espaços', () => {
    expect(normalizeEditalImportName('  DIREÍTO   Penal ')).toBe('direito penal');
  });

  it('converte valores vazios em chave vazia', () => {
    expect(normalizeEditalImportName(null)).toBe('');
    expect(normalizeEditalImportName(undefined)).toBe('');
    expect(normalizeEditalImportName('   ')).toBe('');
  });
});

describe('validateEditalImportPayload', () => {
  it('aceita um edital válido', () => {
    expect(validateEditalImportPayload(validPayload())).toEqual({ valid: true, errors: [] });
  });

  it('rejeita valores que não sejam objetos JSON', () => {
    for (const payload of [null, 'edital', 1, [], false]) {
      expect(validateEditalImportPayload(payload).valid).toBe(false);
    }
  });

  it('rejeita versão diferente de 1', () => {
    const result = validateEditalImportPayload(validPayload({ versao: 2 }));
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('versao');
  });

  it('rejeita tipo diferente de edital', () => {
    const result = validateEditalImportPayload(validPayload({ tipo: 'backup' }));
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('tipo');
  });

  it('rejeita nome do edital ausente ou em branco', () => {
    for (const nome of [undefined, '', '   ']) {
      const result = validateEditalImportPayload(validPayload({ nome }));
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toContain('nome');
    }
  });

  it('rejeita disciplinas ausentes, vazias ou não-array', () => {
    for (const disciplinas of [undefined, [], 'Direito']) {
      const result = validateEditalImportPayload(validPayload({ disciplinas }));
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toContain('disciplinas');
    }
  });

  it('aponta o caminho da disciplina sem nome', () => {
    const result = validateEditalImportPayload(validPayload({ disciplinas: [{ nome: '  ' }] }));
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('disciplinas[0].nome');
  });

  it('rejeita topicos e aulas presentes quando não são arrays', () => {
    const result = validateEditalImportPayload(
      validPayload({ disciplinas: [{ nome: 'Direito', topicos: {}, aulas: 'Aula 1' }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('disciplinas[0].topicos');
    expect(result.errors.join('\n')).toContain('disciplinas[0].aulas');
  });

  it('aponta o caminho de tópicos e aulas sem nome', () => {
    const result = validateEditalImportPayload(
      validPayload({
        disciplinas: [
          {
            nome: 'Direito',
            topicos: [{ nome: '   ' }],
            aulas: [null],
          },
        ],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('disciplinas[0].topicos[0].nome');
    expect(result.errors.join('\n')).toContain('disciplinas[0].aulas[0].nome');
  });

  it('tolera campos extras de proveniência e versões futuras', () => {
    const payload = validPayload({
      centralId: 'central-123',
      sourceRef: 'dpe-pb',
      sourceRevision: 'v1.3',
      hash: 'sha256:abc',
      campoFuturo: { habilitado: true },
    });
    expect(validateEditalImportPayload(payload)).toEqual({ valid: true, errors: [] });
  });

  it('não altera o payload validado nem o rejeitado', () => {
    const accepted = validPayload({ extra: { tags: ['source'] } });
    const rejected = validPayload({ disciplinas: [{ nome: 'Direito', topicos: 'inválido' }] });
    const acceptedBefore = structuredClone(accepted);
    const rejectedBefore = structuredClone(rejected);

    validateEditalImportPayload(accepted);
    validateEditalImportPayload(rejected);

    expect(accepted).toEqual(acceptedBefore);
    expect(rejected).toEqual(rejectedBefore);
  });
});

describe('canonicalizeEditalImportPayload', () => {
  it('une disciplinas e filhos duplicados por nome normalizado', () => {
    const payload = validPayload({
      disciplinas: [
        {
          nome: ' Direito  Penal ',
          topicos: [{ nome: 'Crimes contra a vida' }, { nome: 'Tentativa' }],
          aulas: [{ nome: 'Aula 01' }],
        },
        {
          nome: 'direito penal',
          topicos: [{ nome: ' CRIMES CONTRA A VIDA ' }, { nome: 'Dolo' }],
          aulas: [{ nome: 'aula 01' }, { nome: 'Aula 02' }],
        },
        { nome: 'Direito Constitucional' },
      ],
    });

    const result = canonicalizeEditalImportPayload(payload);

    expect(result.disciplinas).toEqual([
      {
        nome: ' Direito  Penal ',
        topicos: [{ nome: 'Crimes contra a vida' }, { nome: 'Tentativa' }, { nome: 'Dolo' }],
        aulas: [{ nome: 'Aula 01' }, { nome: 'Aula 02' }],
      },
      { nome: 'Direito Constitucional', topicos: [], aulas: [] },
    ]);
  });

  it('preserva a ordem das primeiras ocorrências e os campos extras do payload', () => {
    const payload = validPayload({
      sourceRevision: 'v1.3',
      extra: { central: 'portable' },
      disciplinas: [
        { nome: 'Português', ordemFonte: 1, topicos: [{ nome: 'Crase' }] },
        { nome: 'Direito Penal', ordemFonte: 2, aulas: [{ nome: 'Aula 1' }] },
        { nome: 'portugues', ordemFonte: 3, topicos: [{ nome: 'Concordância' }] },
      ],
    });

    const result = canonicalizeEditalImportPayload(payload);

    expect(result.nome).toBe('DPE-PB — Assistente Jurídico');
    expect(result.sourceRevision).toBe('v1.3');
    expect(result.extra).toEqual({ central: 'portable' });
    expect(result.disciplinas.map(({ nome }) => nome)).toEqual(['Português', 'Direito Penal']);
    expect(result.disciplinas[0].ordemFonte).toBe(1);
    expect(result.disciplinas[0].topicos.map(({ nome }) => nome)).toEqual(['Crase', 'Concordância']);
    expect(result.disciplinas[0].aulas).toEqual([]);
  });

  it('não altera o payload original ao unir disciplinas e filhos', () => {
    const payload = validPayload({
      disciplinas: [
        { nome: 'Matemática', topicos: [{ nome: 'Funções' }] },
        { nome: ' matemática ', topicos: [{ nome: 'Probabilidade' }] },
      ],
    });
    const before = structuredClone(payload);

    canonicalizeEditalImportPayload(payload);

    expect(payload).toEqual(before);
  });
});

describe('buildEditalSourceIdentity', () => {
  it('prioriza centralId sobre sourceRef e nome', () => {
    const identity = buildEditalSourceIdentity({
      nome: 'DPE-PB',
      centralId: '  central-42  ',
      sourceRef: 'portable:dpe-pb',
      sourceRevision: 'v1.3',
    });

    expect(identity).toMatchObject({
      centralId: 'central-42',
      sourceRef: 'portable:dpe-pb',
      sourceRevision: 'v1.3',
      identityKind: 'centralId',
      canonicalValue: 'central-42',
      fingerprint: 'edital:v1|centralId:central-42',
    });
  });

  it('usa sourceRef quando centralId falta e não incorpora sourceRevision na identidade', () => {
    const first = buildEditalSourceIdentity({
      sourceRef: '  source/dpe-pb  ',
      nome: 'DPE-PB',
      sourceRevision: 'v1.1',
    });
    const second = buildEditalSourceIdentity({
      nome: 'DPE-PB',
      sourceRevision: 'v1.3',
      sourceRef: 'source/dpe-pb',
    });

    expect(first.identityKind).toBe('sourceRef');
    expect(first.canonicalValue).toBe('source/dpe-pb');
    expect(first.fingerprint).toBe('edital:v1|sourceRef:source/dpe-pb');
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.sourceRevision).toBe('v1.3');
  });

  it('usa nome normalizado como identidade final, independente de espaços e ordem das propriedades', () => {
    const first = buildEditalSourceIdentity({ nome: '  DIREITO   Penal ', versao: 1, tipo: 'edital' });
    const second = buildEditalSourceIdentity({ tipo: 'edital', nome: 'direito penal', versao: 1 });

    expect(first.identityKind).toBe('name');
    expect(first.canonicalValue).toBe('direito penal');
    expect(first.fingerprint).toBe('edital:v1|name:direito penal');
    expect(second.fingerprint).toBe(first.fingerprint);
  });
});

describe('findEditalImportCandidates', () => {
  it('lista todos os candidatos ativos e arquivados por nome ou proveniência, sem escolher um vencedor', () => {
    const payload = validPayload({
      nome: 'DPE-PB',
      centralId: 'central-42',
      sourceRef: 'portable:dpe-pb',
      sourceRevision: 'v2.0',
    });
    const editais = [
      { id: 'by-name', nome: ' dpe-pb ', arquivado: false },
      {
        id: 'by-central-id',
        nome: 'Versão anterior',
        arquivado: false,
        importMetadata: { tipo: 'edital', centralId: 'central-42', sourceRevision: 'v1.3' },
      },
      {
        id: 'by-source-ref',
        nome: 'Origem portátil',
        arquivado: false,
        importMetadata: { tipo: 'edital', sourceRef: 'portable:dpe-pb' },
      },
      {
        id: 'by-both',
        nome: 'DPE-PB',
        arquivado: false,
        importMetadata: { tipo: 'edital', centralId: 'central-42', sourceRevision: 'v1.1' },
      },
      { id: 'archived-by-name', nome: 'DPE-PB', arquivado: true },
      {
        id: 'archived-by-provenance',
        nome: 'Edital antigo',
        arquivado: true,
        importMetadata: { tipo: 'edital', centralId: 'central-42', sourceRevision: 'v1.0' },
      },
      { id: 'unrelated', nome: 'Outro concurso', arquivado: false },
    ];
    const payloadBefore = structuredClone(payload);
    const editaisBefore = structuredClone(editais);

    const candidates = findEditalImportCandidates(payload, editais);

    expect(candidates.active.map(({ editalId }) => editalId)).toEqual([
      'by-name',
      'by-central-id',
      'by-source-ref',
      'by-both',
    ]);
    expect(candidates.archived.map(({ editalId }) => editalId)).toEqual([
      'archived-by-name',
      'archived-by-provenance',
    ]);
    expect(candidates.active[0]).toMatchObject({
      nome: ' dpe-pb ',
      archived: false,
      reasons: ['name'],
      previousRevision: null,
    });
    expect(candidates.active[1]).toMatchObject({
      reasons: ['provenance'],
      previousRevision: 'v1.3',
    });
    expect(candidates.active[3].reasons).toEqual(['name', 'provenance']);
    expect(candidates.archived[1]).toMatchObject({
      editalId: 'archived-by-provenance',
      archived: true,
      reasons: ['provenance'],
      previousRevision: 'v1.0',
    });
    expect(payload).toEqual(payloadBefore);
    expect(editais).toEqual(editaisBefore);
  });
});

describe('buildEditalImportPlan matching', () => {
  it('cria disciplina quando não há correspondência no edital destino', () => {
    const plan = buildPlan([importDiscipline('Direito Penal')], [targetEdital()]);

    expect(plan.disciplinas[0]).toMatchObject({
      nome: 'Direito Penal',
      action: 'create',
      existingId: null,
    });
    expect(plan.targetSignature).toEqual(expect.any(String));
    expect(plan.summary).toMatchObject({ disciplinasNovas: 1, disciplinasReutilizadas: 0 });
  });

  it('reutiliza a única disciplina com nome normalizado igual', () => {
    const target = targetEdital([{ id: 'disc_penal', nome: 'Direito  Penal', assuntos: [], aulas: [] }]);
    const plan = buildPlan([importDiscipline(' DIREITO Penal ')], [target]);

    expect(plan.disciplinas[0]).toMatchObject({
      action: 'reuse',
      existingId: 'disc_penal',
    });
    expect(plan.summary).toMatchObject({ disciplinasReutilizadas: 1, disciplinasNovas: 0 });
  });

  it('cria disciplina e conflito quando duas disciplinas destino têm o mesmo nome', () => {
    const target = targetEdital([
      { id: 'disc_penal_1', nome: 'Direito Penal', assuntos: [], aulas: [] },
      { id: 'disc_penal_2', nome: ' direito penal ', assuntos: [], aulas: [] },
    ]);
    const plan = buildPlan([importDiscipline('DIREITO PENAL')], [target]);

    expect(plan.disciplinas[0]).toMatchObject({
      action: 'create_conflict',
      existingId: null,
      conflictIds: ['disc_penal_1', 'disc_penal_2'],
    });
    expect(plan.conflicts).toContainEqual(
      expect.objectContaining({ tipo: 'disciplina', nome: 'DIREITO PENAL' })
    );
    expect(plan.summary.disciplinasConflitantes).toBe(1);
  });

  it('aplica 0/1/2+ a tópicos e aulas dentro da disciplina reutilizada', () => {
    const target = targetEdital([
      {
        id: 'disc_penal',
        nome: 'Direito Penal',
        assuntos: [
          { id: 'ass_crase', nome: 'Crase' },
          { id: 'ass_reg_1', nome: 'Regência' },
          { id: 'ass_reg_2', nome: ' regência ' },
        ],
        aulas: [
          { id: 'aula_1', nome: 'Aula 01' },
          { id: 'aula_2a', nome: 'Aula 02' },
          { id: 'aula_2b', nome: ' aula 02 ' },
        ],
      },
    ]);
    const plan = buildPlan(
      [
        importDiscipline(
          'Direito Penal',
          [{ nome: 'Dolo' }, { nome: ' CRase ' }, { nome: 'REGÊNCIA' }],
          [{ nome: 'Aula 03' }, { nome: 'aula 01' }, { nome: 'AULA 02' }]
        ),
      ],
      [target]
    );

    expect(plan.disciplinas[0].topicos.map(({ action }) => action)).toEqual([
      'create',
      'reuse',
      'create_conflict',
    ]);
    expect(plan.disciplinas[0].topicos.map(({ existingId }) => existingId)).toEqual([
      null,
      'ass_crase',
      null,
    ]);
    expect(plan.disciplinas[0].aulas.map(({ action }) => action)).toEqual([
      'create',
      'reuse',
      'create_conflict',
    ]);
    expect(plan.disciplinas[0].aulas.map(({ existingId }) => existingId)).toEqual([
      null,
      'aula_1',
      null,
    ]);
    expect(plan.summary).toMatchObject({
      topicosNovos: 1,
      topicosReutilizados: 1,
      topicosConflitantes: 1,
      aulasNovas: 1,
      aulasReutilizadas: 1,
      aulasConflitantes: 1,
    });
  });

  it('não casa tópicos nem aulas quando a disciplina será criada', () => {
    const target = targetEdital([
      { id: 'disc_civil', nome: 'Direito Civil', assuntos: [{ id: 'ass_1', nome: 'Dolo' }], aulas: [{ id: 'aula_1', nome: 'Aula 1' }] },
    ]);
    const plan = buildPlan(
      [importDiscipline('Direito Penal', [{ nome: 'Dolo' }], [{ nome: 'Aula 1' }])],
      [target]
    );

    expect(plan.disciplinas[0].action).toBe('create');
    expect(plan.disciplinas[0].topicos.map(({ action }) => action)).toEqual(['create']);
    expect(plan.disciplinas[0].aulas.map(({ action }) => action)).toEqual(['create']);
  });

  it('não casa tópicos nem aulas quando a disciplina está em conflito', () => {
    const target = targetEdital([
      { id: 'disc_penal_1', nome: 'Direito Penal', assuntos: [{ id: 'ass_1', nome: 'Dolo' }], aulas: [{ id: 'aula_1', nome: 'Aula 1' }] },
      { id: 'disc_penal_2', nome: 'direito penal', assuntos: [], aulas: [] },
    ]);
    const plan = buildPlan(
      [importDiscipline('Direito Penal', [{ nome: 'Dolo' }], [{ nome: 'Aula 1' }])],
      [target]
    );

    expect(plan.disciplinas[0].action).toBe('create_conflict');
    expect(plan.disciplinas[0].topicos.map(({ action }) => action)).toEqual(['create']);
    expect(plan.disciplinas[0].aulas.map(({ action }) => action)).toEqual(['create']);
  });

  it('ignora homônimos existentes em outros editais', () => {
    const target = targetEdital();
    const unrelated = targetEdital(
      [{ id: 'disc_penal_elsewhere', nome: 'Direito Penal', assuntos: [], aulas: [] }],
      { id: 'ed_other', nome: 'Outro concurso' }
    );
    const plan = buildPlan([importDiscipline('Direito Penal')], [target, unrelated]);

    expect(plan.destination.editalId).toBe('ed_target');
    expect(plan.disciplinas[0]).toMatchObject({ action: 'create', existingId: null });
  });

  it('rejeita merge com edital arquivado', () => {
    const archived = targetEdital([], { arquivado: true });

    expect(() => buildPlan([importDiscipline('Direito Penal')], [archived])).toThrow(/arquivado|ativo/i);
  });

  it('rejeita destino de merge inexistente', () => {
    expect(() =>
      buildPlan([importDiscipline('Direito Penal')], [targetEdital()], {
        mode: 'merge',
        editalId: 'ed_missing',
      })
    ).toThrow(/destino|não existe/i);
  });

  it('create mode cria edital e toda a estrutura sem reutilizar candidatos', () => {
    const target = targetEdital(
      [{ id: 'disc_penal', nome: 'Direito Penal', assuntos: [{ id: 'ass_1', nome: 'Dolo' }], aulas: [{ id: 'aula_1', nome: 'Aula 1' }] }],
      { nome: 'DPE-PB' }
    );
    const plan = buildPlan(
      [importDiscipline('Direito Penal', [{ nome: 'Dolo' }], [{ nome: 'Aula 1' }])],
      [target],
      { mode: 'create', editalId: null, makePrincipal: false }
    );

    expect(plan.destination).toMatchObject({ mode: 'create', editalId: null, makePrincipal: false });
    expect(plan.disciplinas[0].action).toBe('create');
    expect(plan.disciplinas[0].topicos.map(({ action }) => action)).toEqual(['create']);
    expect(plan.disciplinas[0].aulas.map(({ action }) => action)).toEqual(['create']);
    expect(plan.summary.disciplinasReutilizadas).toBe(0);
  });

  it('força o edital novo a principal quando não existe nenhum edital ativo', () => {
    const archived = targetEdital([], { arquivado: true });
    const plan = buildPlan([importDiscipline('Direito Penal')], [archived], {
      mode: 'create',
      editalId: null,
      makePrincipal: false,
    });

    expect(plan.destination.makePrincipal).toBe(true);
    expect(plan.principalForced).toBe(true);
  });
});

describe('editais import plan stale signature', () => {
  function targetWithStructure() {
    return targetEdital([
      {
        id: 'disc_penal',
        nome: 'Direito Penal',
        assuntos: [{ id: 'ass_dolo', nome: 'Dolo' }],
        aulas: [{ id: 'aula_01', nome: 'Aula 01' }],
      },
    ]);
  }

  function mergePlanFor(target, editais = [target]) {
    return buildPlan([importDiscipline('Direito Penal', [{ nome: 'Dolo' }], [{ nome: 'Aula 01' }])], editais);
  }

  it.each([
    ['renomear o edital destino', (editais) => { editais[0].nome = 'DPE-PB atualizado'; }],
    ['adicionar disciplina no destino', (editais) => { editais[0].disciplinas.push({ id: 'disc_new', nome: 'Português' }); }],
    ['remover disciplina do destino', (editais) => { editais[0].disciplinas.pop(); }],
    ['renomear disciplina do destino', (editais) => { editais[0].disciplinas[0].nome = 'Direito Civil'; }],
  ])('invalida merge preview ao %s', (_description, mutate) => {
    const target = targetWithStructure();
    const plan = mergePlanFor(target);
    const changed = structuredClone(target);
    mutate([changed]);

    expect(isEditalImportPlanCurrent(plan, [changed])).toBe(false);
  });

  it('invalida preview quando mudam tópicos ou aulas no destino', () => {
    const target = targetWithStructure();
    const plan = mergePlanFor(target);
    const changed = structuredClone(target);
    changed.disciplinas[0].assuntos[0].nome = 'Culpa';

    expect(isEditalImportPlanCurrent(plan, [changed])).toBe(false);

    const changedLesson = structuredClone(target);
    changedLesson.disciplinas[0].aulas.push({ id: 'aula_02', nome: 'Aula 02' });
    expect(isEditalImportPlanCurrent(plan, [changedLesson])).toBe(false);

    const replacedTopic = structuredClone(target);
    replacedTopic.disciplinas[0].assuntos[0].id = 'ass_replaced';
    expect(isEditalImportPlanCurrent(plan, [replacedTopic])).toBe(false);
  });

  it('invalida preview quando o edital destino é arquivado ou removido', () => {
    const target = targetWithStructure();
    const plan = mergePlanFor(target);

    expect(isEditalImportPlanCurrent(plan, [{ ...target, arquivado: true }])).toBe(false);
    expect(isEditalImportPlanCurrent(plan, [])).toBe(false);
  });

  it('não invalida merge por mudança em outro edital, eventos ou hábitos', () => {
    const target = targetWithStructure();
    const other = targetEdital([], { id: 'ed_other', nome: 'Outro edital' });
    const plan = mergePlanFor(target, [target, other]);
    const changedOther = targetEdital(
      [{ id: 'disc_other', nome: 'Estrutura modificada' }],
      { id: 'ed_other', nome: 'Outro edital', arquivado: true }
    );
    const runtimeState = { editais: [target, other], eventos: [], habitos: { revisao: [] } };
    const signatureBefore = buildEditalImportTargetSignature(runtimeState.editais, plan.destination);
    runtimeState.eventos.push({ id: 'ev_new' });
    runtimeState.habitos.revisao.push({ id: 'habit_new' });

    expect(isEditalImportPlanCurrent(plan, [target, changedOther])).toBe(true);
    expect(
      buildEditalImportTargetSignature(runtimeState.editais, plan.destination)
    ).toBe(signatureBefore);
  });

  it('observa o conjunto ativo quando create vai tornar o novo edital principal', () => {
    const target = targetWithStructure();
    const plan = buildPlan([importDiscipline('Direito Penal')], [target], {
      mode: 'create',
      editalId: null,
      makePrincipal: true,
    });
    const anotherActive = targetEdital([], { id: 'ed_new_active', nome: 'Outro' });

    expect(isEditalImportPlanCurrent(plan, [target])).toBe(true);
    expect(isEditalImportPlanCurrent(plan, [target, anotherActive])).toBe(false);
    expect(isEditalImportPlanCurrent(plan, [{ ...target, arquivado: true }])).toBe(false);
  });

  it('não invalida create arquivado por alterações estruturais quando já há principal', () => {
    const target = targetWithStructure();
    const plan = buildPlan([importDiscipline('Direito Penal')], [target], {
      mode: 'create',
      editalId: null,
      makePrincipal: false,
    });
    const changedTarget = structuredClone(target);
    changedTarget.nome = 'DPE-PB revisado';
    changedTarget.disciplinas[0].nome = 'Direito Civil';

    expect(isEditalImportPlanCurrent(plan, [changedTarget])).toBe(true);
    expect(isEditalImportPlanCurrent(plan, [{ ...target, arquivado: true }])).toBe(false);
  });

  it('força principal sem edital ativo e invalida se surgir um ativo antes da confirmação', () => {
    const archived = targetEdital([], { arquivado: true });
    const plan = buildPlan([importDiscipline('Direito Penal')], [archived], {
      mode: 'create',
      editalId: null,
      makePrincipal: false,
    });
    const newActive = targetEdital([], { id: 'ed_became_active', nome: 'Novo principal' });

    expect(plan.destination.makePrincipal).toBe(true);
    expect(plan.principalForced).toBe(true);
    expect(isEditalImportPlanCurrent(plan, [archived])).toBe(true);
    expect(isEditalImportPlanCurrent(plan, [archived, newActive])).toBe(false);
  });

  it('não invalida merge quando apenas o progresso do item destino muda', () => {
    const target = targetWithStructure();
    const plan = mergePlanFor(target);
    const changedProgress = structuredClone(target);
    changedProgress.disciplinas[0].assuntos[0].concluido = true;
    changedProgress.disciplinas[0].assuntos[0].revisoesFetas = ['2026-10-05'];
    changedProgress.disciplinas[0].aulas[0].progress = 75;

    expect(isEditalImportPlanCurrent(plan, [changedProgress])).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  canonicalizeEditalImportPayload,
  buildEditalSourceIdentity,
  findEditalImportCandidates,
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

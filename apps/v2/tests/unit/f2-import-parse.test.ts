import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Edital } from '../../src/domain/edital';
import type { ExistingContent } from '../../src/application/import-service';
import {
  nameKeyOf,
  parseEditalImport,
  previewEditalImport,
  qualifiedIdentity,
} from '../../src/application/import-service';
import { IMPORT_MAX_ENTITIES } from '../../src/application/import-types';

const fixtures = join(process.cwd(), 'tests', 'fixtures');

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixtures, name)));
}

const emptyContent: ExistingContent = {
  subjects: [],
  editais: [],
  links: [],
  assuntos: [],
  aulas: [],
};

function parseFixture() {
  const result = parseEditalImport(fixture('f2-edital-v1.json'), { namespace: 'tjpb' });
  if (!result.ok) throw new Error(`unexpected parse failure: ${result.reason}`);
  return result.parsed;
}

describe('F2 import parser and preview', () => {
  it('v1_edital_fixture_preserves_counts_or_quarantines_unknown', () => {
    const parsed = parseFixture();
    expect(parsed.sourceIdentity).toMatchObject({
      namespace: 'tjpb',
      centralId: 'tjpb-2026',
      nameKey: 'tjpb 2026',
    });
    expect(parsed.disciplines).toHaveLength(2);
    expect(parsed.disciplines[0]?.topics).toHaveLength(1);
    expect(parsed.disciplines[0]?.topics[0]?.children.map((item) => item.name)).toEqual(['ADPF']);
    expect(parsed.disciplines[0]?.lessons.map((item) => item.name)).toEqual([
      'Aula 01 - Teoria geral',
    ]);
    expect(parsed.quarantined).toEqual([]);
    expect(parsed.depth).toBe(2);

    const preview = previewEditalImport(parsed, emptyContent);
    expect(preview.creates.filter((item) => item.entityType === 'edital')).toHaveLength(1);
    expect(preview.creates.filter((item) => item.entityType === 'assunto')).toHaveLength(2);
    expect(preview.creates.filter((item) => item.entityType === 'aula')).toHaveLength(1);
    expect(preview.conflicts).toEqual([]);

    // Unknown children are quarantined with a reason instead of being dropped.
    const withUnknown = parseEditalImport(
      {
        versao: 1,
        tipo: 'edital',
        nome: 'Com desconhecidos',
        disciplinas: [
          {
            nome: 'Portugues',
            topicos: [{ semNome: true }, { nome: 'Interpretacao' }],
            aulas: 'nao-e-array',
          },
        ],
      },
      { namespace: 'tjpb' },
    );
    expect(withUnknown.ok).toBe(true);
    if (!withUnknown.ok) return;
    expect(withUnknown.parsed.quarantined.map((item) => item.reason).sort()).toEqual([
      'LESSONS_NOT_ARRAY',
      'MISSING_NAME',
    ]);
    expect(withUnknown.parsed.disciplines[0]?.topics).toHaveLength(1);
  });

  it('same_name_different_source_is_not_merged', () => {
    const parsed = parseFixture();
    const foreignEdital: Edital = {
      id: 'edital-existente',
      profileId: 'profile-local',
      title: 'TJPB 2026',
      status: 'ACTIVE',
      localRevision: 3,
      sourceRef: qualifiedIdentity('outra-fonte', 'tjpb-2026', null) ?? undefined,
      sourceRevision: 'r1',
    };

    const preview = previewEditalImport(parsed, {
      ...emptyContent,
      editais: [foreignEdital],
    });
    expect(preview.matches).toEqual([]);
    expect(preview.ambiguous).toEqual([
      expect.objectContaining({
        nameKey: 'tjpb 2026',
        candidates: ['edital-existente'],
        reason: 'SAME_NAME_DIFFERENT_SOURCE',
      }),
    ]);
    const created = preview.creates.find((item) => item.entityType === 'edital');
    expect(created?.id).not.toBe('edital-existente');
  });

  it('same_source_different_revision_requires_conflict_preview', () => {
    const parsed = parseFixture();
    const sourceRef = qualifiedIdentity('tjpb', 'tjpb-2026', null);
    const existing: Edital = {
      id: 'edital-importado',
      profileId: 'profile-local',
      title: 'TJPB 2026',
      status: 'ACTIVE',
      localRevision: 5,
      ...(sourceRef ? { sourceRef } : {}),
      sourceRevision: 'r0',
    };
    const preview = previewEditalImport(parsed, { ...emptyContent, editais: [existing] });

    expect(preview.conflicts).toEqual([
      expect.objectContaining({
        targetId: 'edital-importado',
        reason: 'SOURCE_REVISION_DIVERGED',
        incomingRevision: 'r1',
        existingRevision: 'r0',
      }),
    ]);
    expect(preview.creates.some((item) => item.entityType === 'edital')).toBe(false);

    const sameRevision = previewEditalImport(parsed, {
      ...emptyContent,
      editais: [{ ...existing, sourceRevision: 'r1' }],
    });
    expect(sameRevision.matches).toEqual([
      expect.objectContaining({ id: 'edital-importado', reason: 'SAME_QUALIFIED_IDENTITY' }),
    ]);
    expect(sameRevision.conflicts).toEqual([]);
  });

  it('same_central_id_different_namespace_is_not_same_entity', () => {
    const first = parseEditalImport(fixture('f2-namespaces.json'), { namespace: 'tjpb' });
    const second = parseEditalImport(fixture('f2-namespaces.json'), { namespace: 'tjro' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.parsed.fingerprint).not.toBe(second.parsed.fingerprint);
    expect(first.parsed.sourceIdentity.centralId).toBe(second.parsed.sourceIdentity.centralId);
    expect(
      qualifiedIdentity(first.parsed.sourceIdentity.namespace, first.parsed.sourceIdentity.centralId, null),
    ).not.toBe(
      qualifiedIdentity(second.parsed.sourceIdentity.namespace, second.parsed.sourceIdentity.centralId, null),
    );
  });

  it('fingerprint_ignores_volatile_timestamps', () => {
    const base = {
      versao: 1,
      tipo: 'edital',
      nome: 'TJPB 2026',
      centralId: 'tjpb-2026',
      revisao: 'r1',
      disciplinas: [{ nome: 'Portugues' }],
    };
    const first = parseEditalImport({ ...base, geradoEm: '2026-01-01T00:00:00Z' }, {
      namespace: 'tjpb',
    });
    const second = parseEditalImport({ ...base, geradoEm: '2026-10-28T12:00:00Z' }, {
      namespace: 'tjpb',
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.parsed.fingerprint).toBe(second.parsed.fingerprint);
    expect(nameKeyOf('  Direito   CONSTITUCIONAL ')).toBe('direito constitucional');
  });

  it('limits_reject_oversized_deep_and_unsafe_inputs', () => {
    expect(
      parseEditalImport(new Uint8Array(2 * 1024 * 1024 + 1), { namespace: 'tjpb' }),
    ).toMatchObject({ ok: false, reason: 'TOO_LARGE' });

    expect(parseEditalImport('{', { namespace: 'tjpb' })).toEqual({ ok: false, reason: 'NOT_JSON' });
    expect(parseEditalImport({ versao: 2, tipo: 'edital' }, { namespace: 'tjpb' })).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_VERSION',
    });
    expect(parseEditalImport({ versao: 1, tipo: 'plano' }, { namespace: 'tjpb' })).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_KIND',
    });
    expect(
      JSON.stringify(
        parseEditalImport('{"versao":1,"tipo":"edital","nome":"x","__proto__":{"a":1}}', {
          namespace: 'tjpb',
        }),
      ),
    ).toContain('UNSAFE_KEY');

    const tooLong = parseEditalImport(
      { versao: 1, tipo: 'edital', nome: 'x'.repeat(121), disciplinas: [{ nome: 'D' }] },
      { namespace: 'tjpb' },
    );
    expect(tooLong).toEqual({ ok: false, reason: 'TITLE_TOO_LONG' });

    const many = Array.from({ length: IMPORT_MAX_ENTITIES + 10 }, (_, index) => ({
      nome: `Disciplina ${index}`,
    }));
    expect(
      parseEditalImport(
        { versao: 1, tipo: 'edital', nome: 'Grande', disciplinas: many },
        { namespace: 'tjpb' },
      ),
    ).toEqual({ ok: false, reason: 'TOO_MANY_ENTITIES' });

    let topic: Record<string, unknown> = { nome: 'Folha' };
    for (let depth = 0; depth < 25; depth += 1) topic = { nome: `Nivel ${depth}`, filhos: [topic] };
    const deep = parseEditalImport(
      { versao: 1, tipo: 'edital', nome: 'Profundo', disciplinas: [{ nome: 'D', topicos: [topic] }] },
      { namespace: 'tjpb' },
    );
    expect(deep.ok).toBe(true);
    if (deep.ok) {
      expect(deep.parsed.quarantined.some((item) => item.reason === 'DEPTH_LIMIT')).toBe(true);
    }
  });

  it('hostile_markup_is_flagged_and_never_executed', () => {
    const parsed = parseEditalImport(
      {
        versao: 1,
        tipo: 'edital',
        nome: 'Hostil',
        disciplinas: [
          {
            nome: '<script>alert(1)</script>',
            topicos: [{ nome: 'javascript:alert(2)' }],
            aulas: [{ nome: 'Aula <iframe>' }],
          },
        ],
      },
      { namespace: 'tjpb' },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parsed.suspicious).toHaveLength(3);
    // Stored as plain text; nothing is evaluated or converted to HTML.
    expect(parsed.parsed.disciplines[0]?.name).toBe('<script>alert(1)</script>');
    expect(typeof parsed.parsed.disciplines[0]?.name).toBe('string');
  });
});

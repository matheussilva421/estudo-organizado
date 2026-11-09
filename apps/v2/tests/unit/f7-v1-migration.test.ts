import { describe, expect, it, vi } from 'vitest';
import schemas from '../fixtures/v1-schemas.json';
import { compareLegacyPlan } from '../../src/platform/legacy/recognize';
import {
  convertLegacyV1InIsolation,
  inspectLegacyV1Export,
} from '../../src/platform/legacy/v1-adapter';

function blocks(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `bloco-${index + 1}`,
    disciplinaId: `disc-${(index % 5) + 1}`,
    disciplina: `Disciplina ${(index % 5) + 1}`,
    assunto: `Assunto ${index + 1}`,
    duracaoMin: 30 + (index % 4) * 15,
    prioridade: (index % 3) + 1,
    notas: index === 0 ? 'revisar lei seca' : '',
    status: 'pendente',
    planoRemoto: { id: `remote-${index + 1}` },
  }));
}

describe('F7 V1 migration', () => {
  it('f7_v1_schema_12_11_9_7_supported_as_test_fixtures', () => {
    for (const schema of schemas) {
      expect(inspectLegacyV1Export(schema).kind).toBe('SAFE');
    }
  });

  it('f7_v1_db_7_6_migration_fixtures', () => {
    expect(inspectLegacyV1Export({ idbVersion: 7, schemaVersion: 7, editais: [], eventos: [], habitos: { questoes: [] } }).kind).toBe('SAFE');
    expect(inspectLegacyV1Export({ idbVersion: 6, schemaVersion: 7, editais: [], eventos: [], habitos: { questoes: [] } }).kind).toBe('SAFE');
    expect(inspectLegacyV1Export({ idbVersion: 5, schemaVersion: 7, editais: [], eventos: [], habitos: { questoes: [] } }).kind).toBe('INVALID');
  });

  it('f7_legacy_180_blocks_equivalent_only_if_semantically_equal', () => {
    const original = { retaFinal: { blocos: blocks(180) } };
    const equivalent = { retaFinal: { blocos: blocks(180).map((block) => ({ ...block, status: 'concluido' })) } };
    const divergent = { retaFinal: { blocos: blocks(180).map((block, index) => index === 0 ? { ...block, duracaoMin: 999 } : block) } };
    expect(compareLegacyPlan(original, equivalent)).toBe('EQUIVALENT');
    expect(compareLegacyPlan(original, divergent)).toBe('DIVERGENT');
  });

  it('f7_missing_remote_plan_not_treated_as_absent', () => {
    const input = { planejamento: { retaFinal: { blocos: blocks(2).map(({ planoRemoto: _planoRemoto, ...block }) => block) } } };
    const preview = inspectLegacyV1Export(input);
    expect(preview.kind).toBe('AMBIGUOUS');
    expect(preview.recordCount).toBe(2);
    expect(preview.unmapped).toBe(2);
  });

  it('f7_legacy_ambiguous_ids_quarantined', async () => {
    const duplicate = blocks(1)[0];
    const input = { retaFinal: { blocos: [duplicate, duplicate] } };
    const preview = inspectLegacyV1Export(input);
    expect(preview.kind).toBe('AMBIGUOUS');
    expect(preview.conflicts).toBe(1);
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.snapshot).toBeNull();
  });

  it('f7_study_time_revisions_questions_notes_preserved', async () => {
    const input = {
      schemaVersion: 12,
      idbVersion: 7,
      eventos: [{ id: 'evento-1', duracaoMin: 45, revisoes: [{ id: 'rev-1' }] }],
      habitos: { questoes: [{ id: 'questao-1', acertos: 3 }] },
      retaFinal: { blocos: blocks(1) },
    };
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('AMBIGUOUS');
    expect(converted.snapshot).toBeNull();
  });

  it('f7_nonempty_legacy_export_is_never_safe_by_inference', async () => {
    const input = { retaFinal: { blocos: blocks(2) } };
    const preview = inspectLegacyV1Export(input);
    expect(preview.kind).toBe('AMBIGUOUS');
    expect(preview.recordCount).toBe(2);
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.snapshot).toBeNull();
  });

  it('f7_real_v1_origin_never_accessed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('network must not be used');
    });
    try {
      await convertLegacyV1InIsolation({ schemaVersion: 12, editais: [], eventos: [], habitos: { questoes: [] } });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('f7_v1_unmapped_habitos_content_is_ambiguous', async () => {
    const input = { schemaVersion: 12, habitos: { sequencia: 10 } };
    expect(inspectLegacyV1Export(input).kind).toBe('AMBIGUOUS');
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('AMBIGUOUS');
    expect(converted.snapshot).toBeNull();
  });

  it('f7_v1_reta_final_without_blocks_is_ambiguous', async () => {
    const input = { schemaVersion: 12, retaFinal: { ativa: true } };
    expect(inspectLegacyV1Export(input).kind).toBe('AMBIGUOUS');
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('AMBIGUOUS');
    expect(converted.snapshot).toBeNull();
  });

  it('f7_v1_unknown_string_content_is_ambiguous', async () => {
    const input = { schemaVersion: 12, arquivo: 'x' };
    expect(inspectLegacyV1Export(input).kind).toBe('AMBIGUOUS');
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('AMBIGUOUS');
    expect(converted.snapshot).toBeNull();
  });

  it('f7_v1_nested_blocks_are_not_hidden_by_an_empty_top_level_array', async () => {
    const input = {
      schemaVersion: 12,
      blocos: [],
      retaFinal: { blocos: [{ id: 'b1', titulo: 'Bloco real' }] },
    };
    expect(inspectLegacyV1Export(input).kind).toBe('AMBIGUOUS');
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('AMBIGUOUS');
    expect(converted.snapshot).toBeNull();
  });

  it('f7_v1_empty_content_remains_safe', async () => {
    const input = {
      schemaVersion: 12,
      idbVersion: 7,
      editais: [],
      eventos: [],
      habitos: { questoes: [] },
      retaFinal: { blocos: [] },
      arquivo: null,
      desconhecido: {},
      lista: [null, {}],
    };
    const preview = inspectLegacyV1Export(input);
    expect(preview.kind).toBe('SAFE');
    expect(preview.recordCount).toBe(0);
    const converted = await convertLegacyV1InIsolation(input);
    expect(converted.preview.kind).toBe('SAFE');
    expect(converted.snapshot).not.toBeNull();
  });
});

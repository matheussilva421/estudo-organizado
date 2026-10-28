import { describe, expect, it } from 'vitest';
import { validateSchemaMatrix } from '../../scripts/v2-audit/validate-schema-matrix.mjs';

const BASE_ROW = {
  id: 'S-V1-EXAMPLE',
  entity: 'Entidade sintética',
  storage: 'app_state',
  source_paths: ['docs/api/sync-contract.md'],
  versions: {
    declared: ['12'],
    observed: ['12'],
    conflicts: [],
  },
  export_paths: ['src/js/store/export-state.js'],
  import_paths: ['src/js/backup-restore.js'],
  sync_paths: ['src/js/sync/firestore-schema.js'],
  relations: [],
  migration_risks: ['Risco sintético.'],
  evidence_gaps: [],
};

function makeRow(overrides = {}) {
  const { versions, ...rest } = overrides;
  const mergedVersions =
    versions === undefined
      ? BASE_ROW.versions
      : versions && typeof versions === 'object' && !Array.isArray(versions)
        ? { ...BASE_ROW.versions, ...versions }
        : versions;
  return {
    ...BASE_ROW,
    ...rest,
    versions: mergedVersions,
  };
}

function sortedErrors(result) {
  return [...result.errors].sort();
}

describe('validateSchemaMatrix', () => {
  it('requires_explanation_for_schema_conflict', () => {
    const unexplained = validateSchemaMatrix([
      makeRow({
        versions: { declared: ['12'], observed: ['11'], conflicts: [] },
      }),
    ]);
    const explained = validateSchemaMatrix([
      makeRow({
        versions: {
          declared: ['12'],
          observed: ['11'],
          conflicts: ['O código declara 12; o README ainda descreve v1→v11.'],
        },
      }),
    ]);

    expect(unexplained.ok).toBe(false);
    expect(unexplained.errors).toContain('SCHEMA_CONFLICT_UNEXPLAINED');
    expect(explained).toEqual({ ok: true, errors: [] });
  });

  it('rejects_too_short_conflict_explanation', () => {
    const result = validateSchemaMatrix([
      makeRow({
        versions: { declared: ['12'], observed: ['11'], conflicts: ['x'] },
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('CONFLICT_EXPLANATION_TOO_SHORT');
  });

  it('rejects_missing_source_evidence', () => {
    const result = validateSchemaMatrix([makeRow({ source_paths: [] })]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('MISSING_SOURCE_EVIDENCE');
  });

  it('accepts_explicit_import_gap', () => {
    const result = validateSchemaMatrix([
      makeRow({
        import_paths: [],
        evidence_gaps: [
          'IMPORT_ABSENT: nenhum importador dedicado foi localizado para esta entidade.',
        ],
      }),
    ]);

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects_implicit_import_and_export_gaps', () => {
    const result = validateSchemaMatrix([
      makeRow({
        import_paths: [],
        export_paths: [],
        evidence_gaps: ['Existe outra lacuna, mas nenhuma declara ausência de I/O.'],
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(sortedErrors(result)).toEqual([
      'EXPORT_GAP_UNEXPLAINED',
      'IMPORT_GAP_UNEXPLAINED',
    ]);
  });

  it('accepts_explicit_export_gap', () => {
    const result = validateSchemaMatrix([
      makeRow({
        export_paths: [],
        evidence_gaps: ['EXPORT_ABSENT: a entidade só existe no estado integral.'],
      }),
    ]);

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('treats_version_arrays_as_sets', () => {
    const result = validateSchemaMatrix([
      makeRow({ versions: { declared: ['12', '9'], observed: ['9', '12'] } }),
    ]);

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects_non_array_input_and_non_object_rows', () => {
    expect(validateSchemaMatrix({ rows: [] })).toEqual({
      ok: false,
      errors: ['INPUT_NOT_ARRAY'],
    });
    expect(validateSchemaMatrix([null])).toEqual({
      ok: false,
      errors: ['ROW_NOT_OBJECT'],
    });
  });

  it('rejects_invalid_ids_and_duplicate_rows', () => {
    const prefix = validateSchemaMatrix([makeRow({ id: 'F-V1-X' })]);
    const format = validateSchemaMatrix([makeRow({ id: 'S-V1-' })]);
    const duplicate = validateSchemaMatrix([
      makeRow({ id: 'S-V1-DUPLICATE' }),
      makeRow({ id: 'S-V1-DUPLICATE' }),
    ]);

    expect(prefix.errors).toContain('INVALID_ID_PREFIX');
    expect(format.errors).toContain('INVALID_ID_FORMAT');
    expect(duplicate.errors).toContain('DUPLICATE_ID');
  });

  it('rejects_empty_required_fields_and_invalid_text_lists', () => {
    const result = validateSchemaMatrix([
      makeRow({
        entity: '  ',
        storage: '',
        relations: 'edital contém disciplinas',
        migration_risks: [''],
        evidence_gaps: [null],
      }),
    ]);

    expect(result.errors).toContain('EMPTY_REQUIRED_FIELD');
    expect(result.errors).toContain('INVALID_TEXT_LIST');
  });

  it('rejects_invalid_and_duplicate_paths', () => {
    const invalid = validateSchemaMatrix([
      makeRow({
        source_paths: ['../outside.js'],
        export_paths: ['/absolute.js'],
        import_paths: ['src\\js\\file.js'],
        sync_paths: [42],
      }),
    ]);
    const duplicate = validateSchemaMatrix([
      makeRow({ source_paths: ['docs/api/sync-contract.md', 'docs/api/sync-contract.md'] }),
    ]);

    expect(sortedErrors(invalid)).toEqual([
      'INVALID_EXPORT_PATHS',
      'INVALID_IMPORT_PATHS',
      'INVALID_SOURCE_PATHS',
      'INVALID_SYNC_PATHS',
    ]);
    expect(duplicate.errors).toContain('DUPLICATE_PATH');
  });

  it('rejects_malformed_version_objects', () => {
    const notObject = validateSchemaMatrix([makeRow({ versions: '12' })]);
    const invalidEntry = validateSchemaMatrix([
      makeRow({ versions: { declared: ['12', ''], observed: ['12'], conflicts: [] } }),
    ]);
    const invalidConflicts = validateSchemaMatrix([
      makeRow({ versions: { declared: ['12'], observed: ['12'], conflicts: 'ok' } }),
    ]);

    expect(notObject.errors).toContain('INVALID_VERSIONS');
    expect(invalidEntry.errors).toContain('INVALID_VERSION_VALUE');
    expect(invalidConflicts.errors).toContain('INVALID_SCHEMA_CONFLICTS');
  });

  it('rejects_blank_conflict_explanations_and_duplicate_versions', () => {
    const blank = validateSchemaMatrix([
      makeRow({ versions: { declared: ['12'], observed: ['11'], conflicts: ['   '] } }),
    ]);
    const duplicate = validateSchemaMatrix([
      makeRow({ versions: { declared: ['12', '12'], observed: ['12'] } }),
    ]);

    expect(blank.errors).toContain('INVALID_SCHEMA_CONFLICTS');
    expect(blank.errors).toContain('SCHEMA_CONFLICT_UNEXPLAINED');
    expect(duplicate.errors).toContain('DUPLICATE_VERSION_VALUE');
  });
});

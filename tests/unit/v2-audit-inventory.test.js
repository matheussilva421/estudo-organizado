import { describe, expect, it } from 'vitest';
import { validateInventory } from '../../scripts/v2-audit/validate-inventory.mjs';

const BASE_ROW = Object.freeze({
  id: 'F-V1-STUDY-ORGANIZER',
  name: 'Study Organizer',
  domain: 'study',
  observed_behavior: 'Organiza disciplinas e assuntos em uma árvore navegável.',
  source_paths: ['src/js/views.js'],
  tests: ['tests/unit/views.test.js'],
  test_gap: null,
  evidence_level: 'CODE_AND_TEST',
  proposed_disposition: 'PRESERVE',
  risk: 'MEDIUM',
  decision_status: 'PROPOSED',
  approval_reference: null,
});

function makeRow(overrides = {}) {
  return { ...BASE_ROW, ...overrides };
}

function sortedErrors(result) {
  return [...result.errors].sort();
}

describe('validateInventory', () => {
  it('rejects_duplicate_and_unproven_rows', () => {
    const result = validateInventory([
      makeRow({ id: 'F-V1-DUPLICATE' }),
      makeRow({
        id: 'F-V1-DUPLICATE',
        source_paths: [],
        evidence_level: 'CODE_ONLY',
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(sortedErrors(result)).toEqual(['DUPLICATE_ID', 'NO_PROVENANCE']);
  });

  it('accepts_synthetic_proposed_row', () => {
    expect(validateInventory([makeRow()])).toEqual({ ok: true, errors: [] });
  });

  it('accepts_doc_only_row_without_source_paths_and_with_test_gap', () => {
    const result = validateInventory([
      makeRow({
        source_paths: [],
        tests: [],
        test_gap:
          'Comportamento descrito apenas em documento legado; código não localizado.',
        evidence_level: 'DOC_ONLY',
      }),
    ]);

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('rejects_empty_required_fields', () => {
    const result = validateInventory([makeRow({ name: '   ', domain: '' })]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('EMPTY_REQUIRED_FIELD');
  });

  it('rejects_ids_without_v1_prefix_or_suffix', () => {
    expect(validateInventory([makeRow({ id: 'F-V2-STUDY' })]).errors).toContain(
      'INVALID_ID_PREFIX',
    );
    expect(validateInventory([makeRow({ id: 'F-V1-' })]).errors).toContain(
      'INVALID_ID_FORMAT',
    );
  });

  it('rejects_invalid_source_paths_and_tests', () => {
    const result = validateInventory([
      makeRow({
        source_paths: ['src/js/views.js', ''],
        tests: ['tests/unit/views.test.js', 42],
      }),
    ]);

    expect(result.errors).toContain('INVALID_SOURCE_PATHS');
    expect(result.errors).toContain('INVALID_TESTS');
  });

  it('requires_test_gap_when_tests_are_empty', () => {
    const result = validateInventory([makeRow({ tests: [], test_gap: null })]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('MISSING_TEST_GAP');
  });

  it('requires_approval_reference_for_approved_rows', () => {
    const rejected = validateInventory([
      makeRow({ decision_status: 'APPROVED', approval_reference: null }),
    ]);
    const accepted = validateInventory([
      makeRow({
        decision_status: 'APPROVED',
        approval_reference: 'docs/acceptance.md#F0',
      }),
    ]);

    expect(rejected.ok).toBe(false);
    expect(rejected.errors).toContain('APPROVAL_WITHOUT_REFERENCE');
    expect(accepted).toEqual({ ok: true, errors: [] });
  });

  it('rejects_invalid_enums', () => {
    const result = validateInventory([
      makeRow({
        evidence_level: 'MAYBE',
        proposed_disposition: 'MERGE',
        risk: 'NONE',
        decision_status: 'PENDING',
      }),
    ]);

    expect(sortedErrors(result)).toEqual([
      'INVALID_DECISION_STATUS',
      'INVALID_EVIDENCE_LEVEL',
      'INVALID_PROPOSED_DISPOSITION',
      'INVALID_RISK',
    ]);
  });

  it('rejects_code_and_test_without_tests', () => {
    const result = validateInventory([
      makeRow({
        tests: [],
        test_gap: 'Comportamento não coberto por teste.',
        evidence_level: 'CODE_AND_TEST',
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('TEST_LEVEL_MISMATCH');
  });

  it('rejects_weak_approval_reference', () => {
    const result = validateInventory([
      makeRow({ decision_status: 'APPROVED', approval_reference: 'x' }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('INVALID_APPROVAL_REFERENCE');
  });

  it('rejects_duplicate_ids_with_whitespace_variant', () => {
    const result = validateInventory([
      makeRow({ id: 'F-V1-SAMPLE-3' }),
      makeRow({ id: 'F-V1-SAMPLE-3 ' }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['DUPLICATE_ID', 'INVALID_ID_FORMAT']),
    );
  });

  it('rejects_non_array_input_and_non_object_rows', () => {
    const nonArray = validateInventory({ rows: [] });
    const nonObjectRow = validateInventory([null]);

    expect(nonArray).toEqual({ ok: false, errors: ['INPUT_NOT_ARRAY'] });
    expect(nonObjectRow).toEqual({ ok: false, errors: ['ROW_NOT_OBJECT'] });
  });
});

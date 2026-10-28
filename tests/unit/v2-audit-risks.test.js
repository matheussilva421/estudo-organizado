import { describe, expect, it } from 'vitest';
import { validateRiskMatrix } from '../../scripts/v2-audit/validate-risk-matrix.mjs';

const BASE_ROW = Object.freeze({
  id: 'R-V1-SYNTHETIC-HIGH',
  area: 'sync',
  severity: 'HIGH',
  trigger: 'Duas abas executam o mesmo flush simultaneamente.',
  consequence: 'A outbox pode ser processada mais de uma vez.',
  evidence_paths: ['src/js/sync/sync-lock.js'],
  evidence_level: 'CODE_AND_TEST',
  v2_invariant: 'Um flush por outbox e por revisão remota.',
  proposed_test: 'Abrir duas páginas e disparar flush concorrente.',
  suggested_phase: 'F4 - sync e recuperação',
  mitigation: 'CAS remoto e troca atômica da outbox; lock cross-tab pendente.',
  status: 'OPEN',
});

function makeRow(overrides = {}) {
  return { ...BASE_ROW, ...overrides };
}

function sortedErrors(result) {
  return [...result.errors].sort();
}

describe('validateRiskMatrix', () => {
  it('rejects_unowned_critical_risk', () => {
    const result = validateRiskMatrix([
      makeRow({
        id: 'R-V1-SYNTHETIC-CRITICAL',
        severity: 'CRITICAL',
        proposed_test: '',
        suggested_phase: '   ',
        mitigation: '',
      }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('CRITICAL_RISK_UNOWNED');
  });

  it('rejects_high_risk_without_evidence_or_reproduction', () => {
    const result = validateRiskMatrix([
      makeRow({ evidence_paths: [], proposed_test: '' }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('MISSING_EVIDENCE');
    expect(result.errors).toContain('HIGH_RISK_UNOWNED');
  });

  it('rejects_unproven_mitigation', () => {
    const result = validateRiskMatrix([
      makeRow({ status: 'MITIGATED', evidence_note: '   ' }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('MITIGATION_UNPROVEN');
  });

  it('accepts_complete_high_risk_and_proven_mitigation', () => {
    expect(validateRiskMatrix([makeRow()])).toEqual({ ok: true, errors: [] });
    expect(
      validateRiskMatrix([
        makeRow({
          status: 'MITIGATED',
          evidence_note: 'Teste local observou o comportamento esperado.',
        }),
      ]),
    ).toEqual({ ok: true, errors: [] });
  });

  it('rejects_invalid_enums_and_empty_required_text', () => {
    const result = validateRiskMatrix([
      makeRow({
        severity: 'SEVERE',
        evidence_level: 'MAYBE',
        status: 'RESOLVED',
        area: '   ',
        trigger: '',
      }),
    ]);

    expect(sortedErrors(result)).toEqual([
      'EMPTY_REQUIRED_FIELD',
      'INVALID_EVIDENCE_LEVEL',
      'INVALID_SEVERITY',
      'INVALID_STATUS',
    ]);
  });

  it('rejects_duplicate_ids', () => {
    const result = validateRiskMatrix([makeRow(), makeRow()]);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('DUPLICATE_ID');
  });

  it('rejects_invalid_or_duplicate_evidence_paths', () => {
    expect(
      validateRiskMatrix([
        makeRow({ evidence_paths: ['../fora', '/absoluto', 'src\\js\\x.js'] }),
      ]).errors,
    ).toContain('INVALID_EVIDENCE_PATHS');

    expect(
      validateRiskMatrix([
        makeRow({ evidence_paths: ['src/js/sync/sync-lock.js', 'src/js/sync/sync-lock.js'] }),
      ]).errors,
    ).toContain('DUPLICATE_EVIDENCE_PATH');
  });

  it('rejects_non_array_and_malformed_rows', () => {
    expect(validateRiskMatrix({})).toEqual({
      ok: false,
      errors: ['INPUT_NOT_ARRAY'],
    });
    expect(validateRiskMatrix([null])).toEqual({
      ok: false,
      errors: ['ROW_NOT_OBJECT'],
    });
  });

  it('rejects_invalid_id_prefix_and_format', () => {
    expect(
      validateRiskMatrix([makeRow({ id: 'X-V1-SYNTHETIC' })]).errors,
    ).toContain('INVALID_ID_PREFIX');
    expect(
      validateRiskMatrix([makeRow({ id: 'R-V1-SINTÉTICO COM ESPAÇO' })]).errors,
    ).toContain('INVALID_ID_FORMAT');
  });
});

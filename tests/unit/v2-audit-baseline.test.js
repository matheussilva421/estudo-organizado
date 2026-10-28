import { describe, expect, it } from 'vitest';
import {
  computeBaselineGate,
  validateBaseline,
} from '../../scripts/v2-audit/validate-baseline.mjs';

const ENVIRONMENT = 'Windows 11, Node 24.15.0, Vitest 3.2.4';

const BASE_ROW = Object.freeze({
  id: 'B-V1-UNIT',
  area: 'UNIT',
  command_or_check: 'npm test',
  status: 'PASS',
  environment: ENVIRONMENT,
  evidence_ref: 'docs/superpowers/audits/evidence/unit.txt',
  executed_at: '2026-10-28T08:22:14-03:00',
  notes: 'Suite sintética integral.',
});

const IMPECCABLE_ROW = Object.freeze({
  ...BASE_ROW,
  id: 'B-V1-IMPECCABLE',
  area: 'IMPECCABLE',
  command_or_check: 'Impeccable audit',
  evidence_ref: 'docs/superpowers/audits/evidence/impeccable.md',
});

function makeRow(overrides = {}) {
  return { ...BASE_ROW, ...overrides };
}

function makeImpeccable(overrides = {}) {
  return { ...IMPECCABLE_ROW, ...overrides };
}

describe('validateBaseline', () => {
  it('accepts_evidenced_pass', () => {
    const rows = [makeRow(), makeImpeccable()];

    expect(validateBaseline(rows)).toEqual({ ok: true, errors: [] });
    expect(computeBaselineGate(rows)).toBe('PASS');
  });

  it('rejects_pass_without_output', () => {
    const withoutEvidence = validateBaseline([
      makeRow({ evidence_ref: null }),
      makeImpeccable(),
    ]);
    const withoutTimestamp = validateBaseline([
      makeRow({ executed_at: '   ' }),
      makeImpeccable(),
    ]);

    expect(withoutEvidence.ok).toBe(false);
    expect(withoutEvidence.errors).toContain('PASS_WITHOUT_EVIDENCE');
    expect(withoutTimestamp.ok).toBe(false);
    expect(withoutTimestamp.errors).toContain('PASS_WITHOUT_TIMESTAMP');
  });

  it('preserves_not_run_status', () => {
    const notRun = makeRow({
      id: 'B-V1-MIGRATION',
      area: 'MIGRATION',
      command_or_check: 'migração real de IndexedDB',
      status: 'NOT_RUN',
      evidence_ref: null,
      executed_at: null,
      notes: 'Não executada.',
    });
    const rows = Object.freeze([Object.freeze(notRun), Object.freeze(makeImpeccable())]);

    expect(validateBaseline(rows)).toEqual({ ok: true, errors: [] });
    expect(computeBaselineGate(rows)).toBe('PASS');
    expect(rows[0]).toMatchObject({
      status: 'NOT_RUN',
      evidence_ref: null,
      executed_at: null,
    });
  });

  it('blocks_visual_gate_without_impeccable', () => {
    const rows = [makeRow()];

    expect(validateBaseline(rows)).toEqual({
      ok: false,
      errors: ['MISSING_IMPECCABLE'],
    });
    expect(computeBaselineGate(rows)).toBe('BLOCKED');
  });

  it('blocks_visual_gate_when_impeccable_is_not_pass', () => {
    const rows = [
      makeRow(),
      makeImpeccable({
        status: 'INCONCLUSIVE',
        notes: 'Auditoria visual incompleta.',
      }),
    ];

    expect(validateBaseline(rows)).toEqual({ ok: true, errors: [] });
    expect(computeBaselineGate(rows)).toBe('BLOCKED');
  });

  it('rejects_duplicate_ids_and_invalid_enums', () => {
    const result = validateBaseline([
      makeRow(),
      makeRow({ status: 'DONE' }),
      makeImpeccable({ id: 'B-V1-UNIT' }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['DUPLICATE_ID', 'INVALID_STATUS']),
    );
  });

  it('rejects_invalid_and_empty_rows', () => {
    const result = validateBaseline([
      null,
      {
        ...makeRow(),
        id: 'B-V2-NOT-BASELINE',
        area: ' ',
        command_or_check: '',
        environment: null,
        notes: '',
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'ROW_NOT_OBJECT',
        'EMPTY_REQUIRED_FIELD',
        'INVALID_ID_PREFIX',
      ]),
    );
  });

  it('rejects_invalid_optional_field_types', () => {
    const result = validateBaseline([
      makeRow({
        evidence_ref: 42,
        executed_at: { at: '2026-10-28' },
      }),
      makeImpeccable(),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['INVALID_EVIDENCE_REF', 'INVALID_EXECUTED_AT']),
    );
  });

  it('blocks_gate_for_non_array_input', () => {
    expect(validateBaseline({ rows: [] })).toEqual({
      ok: false,
      errors: ['INPUT_NOT_ARRAY'],
    });
    expect(computeBaselineGate({ rows: [] })).toBe('BLOCKED');
  });

  it('accepts_evidenced_non_pass_status', () => {
    const rows = [
      makeRow({
        id: 'B-V1-E2E',
        area: 'E2E',
        status: 'FAIL',
        notes: 'Falha registrada, sem correção na F0.',
      }),
      makeImpeccable(),
    ];

    expect(validateBaseline(rows)).toEqual({ ok: true, errors: [] });
    expect(computeBaselineGate(rows)).toBe('PASS');
  });
});

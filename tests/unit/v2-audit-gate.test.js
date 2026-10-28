import { describe, expect, it } from 'vitest';
import { evaluateF0Gate } from '../../scripts/v2-audit/validate-gate.mjs';

const DECISION_REFS = [
  'D01',
  'D02',
  'D03',
  'D04',
  'D05',
  'D06',
  'D07',
  'D08',
  'D09',
  'D10',
  'D11',
  'D12',
  'D13',
  'D14',
  'D15',
  'D16',
  'D17',
  'D18',
  'D19',
  'D20',
  'D21',
  'D22',
  'D23',
  'D24',
  'D25',
  'D26',
  'D27',
  'A-01',
];

const INVENTORY_ROW = {
  id: 'F-V1-SYNTHETIC',
  name: 'Synthetic surface',
  domain: 'synthetic',
  observed_behavior: 'Exercita o gate sem representar comportamento real.',
  source_paths: ['src/js/views.js'],
  tests: ['tests/unit/v2-audit-gate.test.js'],
  test_gap: null,
  evidence_level: 'CODE_AND_TEST',
  proposed_disposition: 'PRESERVE',
  risk: 'LOW',
  decision_status: 'APPROVED',
  approval_reference: 'synthetic://acceptance/F0#inventory-row',
};

const SCHEMA_ROW = {
  id: 'S-V1-SYNTHETIC',
  entity: 'Synthetic entity',
  storage: 'Synthetic storage',
  source_paths: ['src/js/store.js'],
  export_paths: [],
  import_paths: [],
  sync_paths: [],
  relations: [],
  migration_risks: [],
  evidence_gaps: [
    'EXPORT_ABSENT: synthetic fixture has no export surface.',
    'IMPORT_ABSENT: synthetic fixture has no import surface.',
  ],
  versions: {
    declared: ['1'],
    observed: ['1'],
    conflicts: [],
  },
};

const RISK_ROW = {
  id: 'R-V1-SYNTHETIC',
  area: 'Synthetic area',
  trigger: 'Synthetic trigger',
  consequence: 'Synthetic consequence',
  v2_invariant: 'Synthetic invariant remains true.',
  severity: 'HIGH',
  status: 'MITIGATED',
  evidence_note: 'Synthetic mitigation evidence.',
  evidence_level: 'CODE_AND_TEST',
  evidence_paths: ['tests/unit/v2-audit-gate.test.js'],
  proposed_test: 'Synthetic regression test.',
  suggested_phase: 'F0',
  mitigation: 'Synthetic mitigation.',
};

const BASELINE_ROW = {
  id: 'B-V1-IMPECCABLE',
  area: 'IMPECCABLE',
  command_or_check: 'Synthetic Impeccable scan',
  status: 'PASS',
  environment: 'Synthetic environment',
  evidence_ref: 'synthetic://evidence/impeccable',
  executed_at: '2026-10-19T00:00:00Z',
  notes: 'Synthetic visual baseline.',
};

function cloneRow(row) {
  return {
    ...row,
    source_paths: Array.isArray(row.source_paths) ? [...row.source_paths] : undefined,
    tests: Array.isArray(row.tests) ? [...row.tests] : undefined,
    export_paths: Array.isArray(row.export_paths) ? [...row.export_paths] : undefined,
    import_paths: Array.isArray(row.import_paths) ? [...row.import_paths] : undefined,
    sync_paths: Array.isArray(row.sync_paths) ? [...row.sync_paths] : undefined,
    relations: Array.isArray(row.relations) ? [...row.relations] : undefined,
    migration_risks: Array.isArray(row.migration_risks)
      ? [...row.migration_risks]
      : undefined,
    evidence_gaps: Array.isArray(row.evidence_gaps)
      ? [...row.evidence_gaps]
      : undefined,
    versions: row.versions
      ? {
          ...row.versions,
          declared: [...row.versions.declared],
          observed: [...row.versions.observed],
          conflicts: [...row.versions.conflicts],
        }
      : undefined,
    evidence_paths: Array.isArray(row.evidence_paths)
      ? [...row.evidence_paths]
      : undefined,
  };
}

function makeInput(overrides = {}) {
  return {
    inventory: [cloneRow(INVENTORY_ROW)],
    coverage: { unmapped: [], invalid_exclusions: [] },
    schemas: [cloneRow(SCHEMA_ROW)],
    risks: [cloneRow(RISK_ROW)],
    baseline: [cloneRow(BASELINE_ROW)],
    decision_refs: [...DECISION_REFS],
    human_approval_ref: 'synthetic://acceptance/F0#human',
    ...overrides,
  };
}

describe('evaluateF0Gate', () => {
  it('cannot_approve_without_human', () => {
    for (const humanApprovalRef of [undefined, null, '', '   ']) {
      expect(
        evaluateF0Gate(makeInput({ human_approval_ref: humanApprovalRef })),
      ).toEqual({
        status: 'READY_FOR_HUMAN_REVIEW',
        reasons: ['MISSING_HUMAN_APPROVAL'],
      });
    }
  });

  it('blocks_missing_a01_or_decision', () => {
    for (const missingRef of ['A-01', 'D17']) {
      const decisionRefs = DECISION_REFS.filter((ref) => ref !== missingRef);
      expect(
        evaluateF0Gate(makeInput({ decision_refs: decisionRefs })),
      ).toEqual({
        status: 'BLOCKED',
        reasons: ['MISSING_DECISION_REFS'],
      });
    }
  });

  it('blocks_open_critical_risk', () => {
    const criticalRisk = {
      ...cloneRow(RISK_ROW),
      id: 'R-V1-SYNTHETIC-CRITICAL',
      severity: 'CRITICAL',
      status: 'OPEN',
      evidence_note: null,
    };

    expect(evaluateF0Gate(makeInput({ risks: [criticalRisk] }))).toEqual({
      status: 'BLOCKED',
      reasons: ['OPEN_CRITICAL_RISK'],
    });
  });

  it('approves_synthetic_complete_case', () => {
    expect(evaluateF0Gate(makeInput())).toEqual({
      status: 'APPROVED',
      reasons: [],
    });
  });
});
